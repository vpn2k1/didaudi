// Lấy ảnh thật (giấy phép tự do) cho địa điểm từ Wikimedia Commons qua API chính thức.
//   node scripts/fetch-photos.mjs                 -> lấy cho địa điểm chưa có ảnh
//   node scripts/fetch-photos.mjs --force         -> lấy lại tất cả (trừ mục locked)
//   node scripts/fetch-photos.mjs --only=a,b      -> chỉ các id này
//
// Thứ tự ưu tiên:
//   1. Thẻ wikidata / wikimedia_commons / image gắn trên đối tượng OpenStreetMap của địa điểm  → match "place"
//   2. Tìm trên Commons theo tên, chỉ nhận khi tên file chứa tên địa điểm                       → match "place"
//   3. Quán ăn/cà phê: ảnh MÓN ĂN theo chủ đề (không phải ảnh của quán)                         → match "topic"
// KHÔNG lấy ảnh từ Google Maps (điều khoản cấm). Luôn lưu tác giả + giấy phép để hiển thị ghi công.
import { readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const PLACES = fileURLToPath(new URL('../data/places.json', import.meta.url));
const PROVINCES = fileURLToPath(new URL('../data/provinces.json', import.meta.url));
const OUT = fileURLToPath(new URL('../data/photos.json', import.meta.url));
const UA = 'DiDauVietNam/0.2 (MVP; photo attribution script)';
const force = process.argv.includes('--force');
const only = process.argv.find((a) => a.startsWith('--only='))?.split('=')[1]?.split(',');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const norm = (s) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

async function getJson(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(20_000) });
      if (res.ok) return await res.json();
      if (res.status === 404) return null;
    } catch {}
    await sleep(1500 * (i + 1));
  }
  return null;
}

const COMMONS = 'https://commons.wikimedia.org/w/api.php?format=json&origin=*';

async function imageInfo(fileTitle) {
  const title = fileTitle.startsWith('File:') ? fileTitle : `File:${fileTitle}`;
  const d = await getJson(`${COMMONS}&action=query&prop=imageinfo&iiprop=url|extmetadata|mime|size&iiurlwidth=1000&titles=${encodeURIComponent(title)}`);
  const page = d && Object.values(d.query?.pages ?? {})[0];
  const ii = page?.imageinfo?.[0];
  if (!ii || !/^image\/(jpeg|png|webp)$/.test(ii.mime) || ii.width < 500) return null;
  const m = ii.extmetadata ?? {};
  const strip = (h) => (h ?? '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const license = strip(m.LicenseShortName?.value);
  if (!license) return null;
  return {
    file: page.title,
    pageUrl: ii.descriptionurl,
    thumbUrl: ii.thumburl ?? ii.url,
    width: ii.thumbwidth ?? ii.width,
    height: ii.thumbheight ?? ii.height,
    author: strip(m.Artist?.value).slice(0, 120) || 'Không rõ tác giả',
    license,
    licenseUrl: m.LicenseUrl?.value ?? null,
  };
}

async function searchFiles(query, limit = 8) {
  const d = await getJson(`${COMMONS}&action=query&list=search&srnamespace=6&srlimit=${limit}&srsearch=${encodeURIComponent(query + ' filetype:bitmap')}`);
  return (d?.query?.search ?? []).map((r) => r.title);
}

async function fromOsm(ref) {
  if (!ref) return null;
  const d = await getJson(`https://api.openstreetmap.org/api/0.6/${ref}.json`);
  const tags = d?.elements?.[0]?.tags ?? {};
  if (tags.wikimedia_commons?.startsWith('File:')) return { file: tags.wikimedia_commons, via: 'osm:wikimedia_commons' };
  if (tags.image?.includes('commons.wikimedia.org/wiki/File:')) return { file: decodeURIComponent(tags.image.split('/wiki/')[1]), via: 'osm:image' };
  if (tags.wikidata) {
    const w = await getJson(`https://www.wikidata.org/w/api.php?format=json&action=wbgetclaims&property=P18&entity=${tags.wikidata}`);
    const file = w?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    if (file) return { file, via: `wikidata:${tags.wikidata}` };
  }
  if (tags.wikimedia_commons?.startsWith('Category:')) {
    const c = await getJson(`${COMMONS}&action=query&list=categorymembers&cmtype=file&cmlimit=10&cmtitle=${encodeURIComponent(tags.wikimedia_commons)}`);
    const file = c?.query?.categorymembers?.map((x) => x.title).find((t) => /\.(jpe?g|png|webp)$/i.test(t));
    if (file) return { file, via: 'osm:commons-category' };
  }
  return null;
}

// Ảnh món ăn theo thẻ: [từ khóa tìm, regex bắt buộc có trong tên file (phân biệt dấu: "phở" ≠ "phố")]
const L = '[^\\p{L}]';
const word = (alts) => new RegExp(`(^|${L})(${alts})(${L}|$)`, 'iu');
const TOPIC = {
  pho: ['Pho bo noodle soup', word('pho|phở')],
  'bun-cha': ['Bun cha Hanoi', word('bun cha|bún chả')],
  'cha-ca': ['Cha ca Hanoi', word('cha ca|chả cá')],
  'banh-mi': ['Banh mi sandwich', word('banh mi|bánh mì')],
  'banh-cuon': ['Banh cuon', word('banh cuon|bánh cuốn')],
  xoi: ['Xoi Vietnamese sticky rice', word('xoi|xôi')],
  che: ['Chè Vietnamese sweet soup', word('chè|che')],
  kem: ['Kem Trang Tien', word('kem|ice cream')],
  'bun-dau': ['Bun dau mam tom', word('bun dau|bún đậu')],
  mien: ['Mien luon eel noodle', word('mien|miến')],
  bun: ['Bun noodle Hanoi', word('bun|bún')],
  'banh-xeo': ['Banh xeo', word('banh xeo|bánh xèo')],
  'mi-quang': ['Mi Quang', word('mi quang|mì quảng')],
  bia: ['Bia hoi Hanoi', word('bia hoi|bia hơi')],
  'an-vat': ['Hanoi street food', word('street food')],
  'khu-am-thuc': ['Hanoi street food', word('street food')],
  'nha-hang': ['Pizza 4Ps', word('pizza')],
  'ca-phe-trung': ['Egg coffee Hanoi', word('egg coffee|cà phê trứng')],
  'ca-phe-co': ['Vietnamese coffee phin', word('coffee|cà phê|cafe')],
  'view-ho': ['Vietnamese coffee phin', word('coffee|cà phê|cafe')],
};
/** Thẻ món chính theo từng quán khi thẻ chung chưa đủ cụ thể. */
const TOPIC_BY_ID = { 'bun-thang-ba-duc': ['Bun thang Hanoi', word('bun thang|bún thang')], 'tong-duy-tan': ['Hanoi street food', word('street food')] };
/** Quán đặt tên theo tên phố → tìm theo tên dễ ra ảnh con phố/di tích khác, chỉ dùng ảnh món. */
const SKIP_NAME_SEARCH = new Set(['pho-10-ly-quoc-su', 'pho-bat-dan', 'bun-bo-nam-bo', 'banh-cuon-thanh-van', 'tong-duy-tan']);
/** Từ khóa tìm riêng (tên tiếng Anh trên Commons) cho điểm khó tìm. */
const QUERY_BY_ID = {
  'den-quan-thanh': 'Quan Thanh Temple Hanoi',
  'trang-an': 'Trang An Ninh Binh',
  'nha-tho-phat-diem': 'Phat Diem Cathedral',
  'ngu-hanh-son': 'Marble Mountains Da Nang',
  'bat-trang': 'Bat Trang pottery village',
  'asia-park': 'Sun Wheel Asia Park Da Nang',
  'van-long': 'Van Long Nature Reserve Ninh Binh',
  'nha-co-ma-may': 'Ma May ancient house Hanoi',
  'cafe-lam': 'Cafe Lam Hanoi',
};

const STOP = new Set(['ha', 'noi', 'cafe', 'ca', 'phe', 'quan', 'the', 'bun', 'pho', 'cha', 'banh', 'mi', 'gia', 'truyen', 'cua', 'hang', 'va', 'viet', 'nam', 'quoc', 'gia', 'tp', 'ho', 'chi', 'minh']);

function nameMatches(title, name) {
  const t = norm(title);
  const tokens = norm(name.replace(/\(.*?\)/g, '')).split(' ').filter((w) => w.length > 1);
  const key = tokens.filter((w) => !STOP.has(w));
  const need = key.length ? key : tokens;
  // Cần khớp ≥ 2 từ đặc trưng (hoặc tất cả nếu tên ngắn), tránh nhận nhầm ảnh
  const hits = need.filter((w) => new RegExp(`\\b${w}\\b`).test(t)).length;
  return hits >= Math.min(2, need.length) && hits / need.length >= 0.6;
}

const places = JSON.parse(await readFile(PLACES, 'utf8'));
const provinces = JSON.parse(await readFile(PROVINCES, 'utf8')).provinces;
let photos = {};
try {
  photos = JSON.parse(await readFile(OUT, 'utf8'));
} catch {}

const report = [];
for (const p of places) {
  if (only && !only.includes(p.id)) continue;
  if (photos[p.id]?.locked || (photos[p.id] && !force)) continue;
  const provinceName = provinces.find((x) => x.slug === p.provinceSlug)?.name ?? '';
  let found = null;

  const osmRef = p.providerRefs?.find((r) => r.provider === 'osm')?.providerPlaceId;
  const viaOsm = await fromOsm(osmRef);
  if (viaOsm) {
    const info = await imageInfo(viaOsm.file);
    if (info) found = { ...info, match: 'place', via: viaOsm.via };
  }

  if (!found && !SKIP_NAME_SEARCH.has(p.id)) {
    const custom = QUERY_BY_ID[p.id];
    const queries = custom ? [custom] : [`${norm(p.name.replace(/\(.*?\)/g, ''))} ${norm(provinceName)}`, norm(p.name.replace(/\(.*?\)/g, ''))];
    for (const q of queries) {
      for (const title of await searchFiles(q)) {
        if (!nameMatches(title, custom ?? p.name)) continue;
        const info = await imageInfo(title);
        if (info) {
          found = { ...info, match: 'place', via: `search:${q}` };
          break;
        }
      }
      if (found) break;
      await sleep(200);
    }
  }

  if (!found && (p.category === 'food' || p.category === 'cafe')) {
    const tag = p.tags.find((t) => TOPIC[t]) ?? (p.category === 'cafe' ? 'ca-phe-co' : 'nha-hang');
    const [query, must] = TOPIC_BY_ID[p.id] ?? TOPIC[tag];
    // Gom vài ảnh hợp lệ rồi chọn theo id để các quán cùng món không trùng ảnh
    const valid = [];
    for (const title of await searchFiles(query, 15)) {
      if (!must.test(title.replace(/^File:/, '').replace(/[_.]/g, ' ')) || /phố/iu.test(title)) continue;
      const info = await imageInfo(title);
      if (info) valid.push(info);
      if (valid.length >= 4) break;
    }
    if (valid.length) {
      const h = [...p.id].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) | 0, 0);
      found = { ...valid[Math.abs(h) % valid.length], match: 'topic', via: `topic:${query}` };
    }
  }

  if (found) photos[p.id] = { ...found, source: 'wikimedia', fetchedAt: new Date().toISOString().slice(0, 10) };
  report.push({ id: p.id, match: found?.match ?? '—', via: found?.via?.slice(0, 34) ?? '', file: found?.file?.slice(5, 60) ?? '', license: found?.license ?? '' });
  await sleep(300);
}

console.table(report);
const c = (m) => report.filter((r) => r.match === m).length;
console.log(`Ảnh đúng địa điểm: ${c('place')} | Ảnh chủ đề (món ăn): ${c('topic')} | Không có: ${c('—')}`);
await writeFile(`${OUT}.tmp`, JSON.stringify(photos, null, 2) + '\n');
await rename(`${OUT}.tmp`, OUT);
console.log('Đã ghi', OUT, '– hãy xem lại các ảnh trước khi công bố; đặt "locked": true để giữ ảnh đã duyệt.');
