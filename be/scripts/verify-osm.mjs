// Đối chiếu tọa độ trong data/places.json với OpenStreetMap (Overpass API).
//   node scripts/verify-osm.mjs                       -> chỉ in báo cáo
//   node scripts/verify-osm.mjs --apply               -> ghi tọa độ OSM + verificationStatus
//   node scripts/verify-osm.mjs --province=da-nang    -> chỉ kiểm tra 1 tỉnh/thành
//   node scripts/verify-osm.mjs --apply --ids=a,b     -> chỉ ghi các địa điểm đã duyệt báo cáo
// Không ghi đè địa điểm đã "verified" (đội ngũ xác minh thực địa).
import { readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const DATA = fileURLToPath(new URL('../data/places.json', import.meta.url));
const MIRRORS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];
const SEARCH_RADIUS_M = 1500;
const apply = process.argv.includes('--apply');
const onlyProvince = process.argv.find((a) => a.startsWith('--province='))?.split('=')[1];
const onlyIds = process.argv.find((a) => a.startsWith('--ids='))?.split('=')[1]?.split(',');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function haversineM(lat1, lng1, lat2, lng2) {
  const toRad = (d) => (d * Math.PI) / 180;
  const a = Math.sin(toRad(lat2 - lat1) / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lng2 - lng1) / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(a));
}

async function overpass(query) {
  // Có giới hạn số lần thử, không retry vô hạn
  for (let attempt = 0; attempt < MIRRORS.length * 2; attempt++) {
    const url = MIRRORS[attempt % MIRRORS.length];
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'User-Agent': 'di-dau-viet-nam-verify/0.2', 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query),
        signal: AbortSignal.timeout(40_000),
      });
      const text = await res.text();
      if (res.ok && text.startsWith('{')) return JSON.parse(text);
    } catch {}
    await sleep(2000);
  }
  throw new Error('Overpass không phản hồi');
}

const places = JSON.parse(await readFile(DATA, 'utf8'));
const report = [];

for (const p of places) {
  if (onlyProvince && p.provinceSlug !== onlyProvince) continue;
  if (onlyIds && !onlyIds.includes(p.id)) continue;
  if (!p.osmHint?.match || p.verificationStatus === 'verified') continue;
  const radius = p.osmHint.radius ?? SEARCH_RADIUS_M;
  const q = `[out:json][timeout:25];nwr["name"~"${p.osmHint.match.replace(/"/g, '\\"')}",i](around:${radius},${p.latitude},${p.longitude});out center tags;`;
  let best = null;
  try {
    const { elements } = await overpass(q);
    for (const el of elements) {
      const lat = el.lat ?? el.center?.lat;
      const lng = el.lon ?? el.center?.lon;
      if (lat == null) continue;
      // Quán/điểm tham quan không phải là con đường: bỏ qua đối tượng highway
      if (el.tags?.highway && !p.osmHint.street) continue;
      const d = haversineM(p.latitude, p.longitude, lat, lng);
      const addr = [el.tags?.['addr:housenumber'], el.tags?.['addr:street']].filter(Boolean).join(' ');
      if (!best || d < best.d) best = { d, lat, lng, name: el.tags?.name, addr, type: el.type, id: el.id };
    }
  } catch (e) {
    report.push({ id: p.id, status: 'LỖI', note: e.message });
    continue;
  }

  if (best) {
    report.push({ id: p.id, status: best.d > 150 ? 'LỆCH' : 'OK', lechMet: Math.round(best.d), osmName: best.name, osmAddr: best.addr });
    if (apply) {
      p.latitude = +best.lat.toFixed(6);
      p.longitude = +best.lng.toFixed(6);
      p.verificationStatus = 'coordinates_checked';
      p.providerRefs = [...(p.providerRefs ?? []).filter((r) => r.provider !== 'osm'), { provider: 'osm', providerPlaceId: `${best.type}/${best.id}`, label: best.name }];
      p.updatedAt = new Date().toISOString();
    }
  } else {
    report.push({ id: p.id, status: 'KHÔNG THẤY', note: 'chưa có trên OSM quanh tọa độ hiện tại' });
  }
  await sleep(1100);
}

console.table(report);
const count = (s) => report.filter((r) => r.status === s).length;
console.log(`OK: ${count('OK')} | Lệch >150m: ${count('LỆCH')} | Không thấy: ${count('KHÔNG THẤY')} | Lỗi: ${count('LỖI')}`);
if (apply) {
  await writeFile(`${DATA}.tmp`, JSON.stringify(places, null, 2) + '\n');
  await rename(`${DATA}.tmp`, DATA);
  console.log('Đã ghi lại', DATA, '– nhớ kiểm tra lại các dòng LỆCH trước khi công bố.');
}
