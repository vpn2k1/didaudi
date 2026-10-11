// Preview photo-backed Wikidata landmarks grouped by Vietnam's 34 current provinces.
// Read-only unless --output is supplied. Examples:
//   node be/scripts/discover-wikidata-places.mjs
//   node be/scripts/discover-wikidata-places.mjs --province=son-la
//   node be/scripts/discover-wikidata-places.mjs --province=quang-tri --name=hang
import { readFile, writeFile } from 'node:fs/promises';

const read = async (name) => JSON.parse(await readFile(new URL(`../data/${name}`, import.meta.url), 'utf8'));
const provinces = (await read('provinces.json')).provinces;
const places = await read('places.json');
const onlySlug = process.argv.find((arg) => arg.startsWith('--province='))?.slice(11);
const nameQuery = process.argv.find((arg) => arg.startsWith('--name='))?.slice(7);
const output = process.argv.find((arg) => arg.startsWith('--output='))?.slice(9);
const summaryOnly = process.argv.includes('--summary');
if (process.argv.includes('--help')) {
  console.log('Dùng: node be/scripts/discover-wikidata-places.mjs [--province=slug] [--name=từ khóa] [--summary] [--output=path]');
  process.exit(0);
}
if (onlySlug && !provinces.some((item) => item.slug === onlySlug)) throw new Error(`Không có tỉnh: ${onlySlug}`);

const touristType = /^(vườn quốc gia|bảo tàng|núi|đảo|chùa(?: Việt Nam)?|đền(?: Hindu)?|nhà thờ(?: Kitô giáo| chính tòa)?|mũi đất|hồ|bãi biển|tượng đài|di chỉ|đình|hang|tháp|đèo|công viên(?: đô thị)?|thác|vịnh|thành|bán đảo|nhà hát|khu dự trữ sinh quyển thế giới|văn miếu|cung điện|show cave|làng cổ|khu bảo tồn thiên nhiên|danh lam thắng cảnh|di tích lịch sử|tourist attraction|museum|mountain|island|temple|beach|waterfall|cave|palace|national park)$/i;
const normalize = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const query = `SELECT ?item ?itemLabel ?coord ?image ?typeLabel WHERE {
  ?item wdt:P17 wd:Q881; wdt:P625 ?coord; wdt:P18 ?image; wdt:P31 ?type.
  SERVICE wikibase:label { bd:serviceParam wikibase:language "vi,en". }
} LIMIT 5000`;
const url = new URL('https://query.wikidata.org/sparql');
url.searchParams.set('query', query);
url.searchParams.set('format', 'json');
const response = await fetch(url, { headers: { 'User-Agent': 'DiDauVietNam/0.4 (province discovery; contact: project maintainers)', Accept: 'application/sparql-results+json' }, signal: AbortSignal.timeout(60000) });
if (!response.ok) throw new Error(`Wikidata HTTP ${response.status}: ${(await response.text()).slice(0, 150)}`);
const rows = (await response.json()).results.bindings;

// MIT-licensed province polygons, derived from Vietnam's administrative reference map.
const directoryUrl = 'https://api.github.com/repos/thanglequoc/vietnamese-provinces-database/contents/json/geojson';
const directoryResponse = await fetch(directoryUrl, { headers: { 'User-Agent': 'DiDauVietNam/0.4' }, signal: AbortSignal.timeout(15000) });
if (!directoryResponse.ok) throw new Error(`Province boundary index HTTP ${directoryResponse.status}`);
const directories = (await directoryResponse.json()).filter((entry) => entry.type === 'dir');
const slugOf = (folder) => folder.replace(/^\d+_/, '').replaceAll('_', '-').replace(/^ho-chi-minh$/, 'tp-ho-chi-minh');
const boundaries = [];
for (let i = 0; i < directories.length; i += 4) {
  const batch = directories.slice(i, i + 4);
  const loaded = await Promise.all(batch.map(async ({ name }) => {
    const slug = slugOf(name);
    if (!provinces.some((item) => item.slug === slug)) return null;
    const source = `https://raw.githubusercontent.com/thanglequoc/vietnamese-provinces-database/master/json/geojson/${name}/${name}.geojson`;
    const res = await fetch(source, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) throw new Error(`${slug}: GeoJSON HTTP ${res.status}`);
    const data = await res.json();
    return { slug, source, bbox: data.bbox, geometry: data.features?.[0]?.geometry };
  }));
  boundaries.push(...loaded.filter(Boolean));
  if (i + 4 < directories.length) await sleep(100);
}
if (boundaries.length !== provinces.length) throw new Error(`Thiếu ranh giới: ${boundaries.length}/${provinces.length}`);

function insideRing(lon, lat, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function insidePolygon(lon, lat, rings) {
  return insideRing(lon, lat, rings[0]) && !rings.slice(1).some((hole) => insideRing(lon, lat, hole));
}
function provinceFor(lon, lat) {
  return boundaries.find(({ bbox, geometry }) => {
    if (!geometry || (bbox && (lon < bbox[0] || lat < bbox[1] || lon > bbox[2] || lat > bbox[3]))) return false;
    const polygons = geometry.type === 'MultiPolygon' ? geometry.coordinates : [geometry.coordinates];
    return polygons.some((polygon) => insidePolygon(lon, lat, polygon));
  })?.slug;
}

const byItem = new Map();
for (const row of rows) {
  if (!touristType.test(row.typeLabel.value)) continue;
  const id = row.item.value.split('/').at(-1);
  const point = /^Point\(([-\d.]+) ([-\d.]+)\)$/.exec(row.coord.value);
  if (!point || /^Q\d+$/.test(row.itemLabel.value)) continue;
  const [, lonText, latText] = point;
  const lon = Number(lonText), lat = Number(latText);
  const slug = provinceFor(lon, lat);
  if (!slug || (onlySlug && slug !== onlySlug)) continue;
  const image = decodeURIComponent(row.image.value.split('/').at(-1)).replaceAll('_', ' ');
  if (/\b(logo|seal|flag|map|banner)\b/i.test(image)) continue;
  const key = `${slug}/${id}`;
  if (!byItem.has(key)) byItem.set(key, { province: slug, id, name: row.itemLabel.value, type: row.typeLabel.value, lat, lon, image, source: row.item.value, boundarySource: boundaries.find((boundary) => boundary.slug === slug).source });
}

const existing = new Map();
for (const place of places) {
  if (!existing.has(place.provinceSlug)) existing.set(place.provinceSlug, new Set());
  existing.get(place.provinceSlug).add(normalize(place.name));
}
const candidates = [...byItem.values()].filter((item) =>
  !existing.get(item.province)?.has(normalize(item.name)) && (!nameQuery || normalize(item.name).includes(normalize(nameQuery))));
for (const province of provinces) {
  if (onlySlug && province.slug !== onlySlug) continue;
  const matches = candidates.filter((item) => item.province === province.slug).sort((a, b) => a.name.localeCompare(b.name, 'vi'));
  console.log(`${province.name}: ${matches.length} ứng viên có ảnh trên Wikidata`);
  if (!summaryOnly) console.table(matches.slice(0, 30).map(({ id, name, type, image }) => ({ id, name, type, image })));
}
if (output) {
  await writeFile(output, `${JSON.stringify({ generatedAt: new Date().toISOString(), source: 'Wikidata P17/P625/P18/P31 + province polygons', candidates }, null, 2)}\n`);
  console.log(`Đã ghi ứng viên chưa duyệt: ${output}`);
}
