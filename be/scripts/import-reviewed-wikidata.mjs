// Import a small, manually reviewed set of Wikidata places. Preview by default.
// Refresh candidate discovery separately; this importer never accepts arbitrary search hits.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const path = (name) => fileURLToPath(new URL(`../data/${name}`, import.meta.url));
const read = async (name) => JSON.parse(await readFile(path(name), 'utf8'));
const reviewed = [
  ['Q10842294', 'cao-bang', 'dong-nguom-ngao'],
  ['Q2857598', 'bac-ninh', 'chua-dau'],
  ['Q180566', 'bac-ninh', 'den-do'],
  ['Q5029086', 'can-tho', 'bao-tang-can-tho'],
  ['Q286546', 'dak-lak', 'vuon-quoc-gia-yok-don'],
  ['Q10825850', 'dak-lak', 'thap-nhan'],
  ['Q5004767', 'dong-nai', 'nui-ba-ra'],
  ['Q2092726', 'dong-nai', 'nui-chua-chan'],
  ['Q10763514', 'dong-thap', 'go-thap'],
  ['Q10833431', 'dong-thap', 'van-thanh-mieu-cao-lanh'],
  ['Q10825825', 'gia-lai', 'thap-banh-it'],
  ['Q16480582', 'gia-lai', 'chua-minh-thanh'],
  ['Q1537215', 'hai-phong', 'vuon-quoc-gia-cat-ba'],
  ['Q7698740', 'hung-yen', 'van-mieu-xich-dang'],
  ['Q6922067', 'lang-son', 'mau-son'],
  ['Q10825640', 'lao-cai', 'thac-cat-cat'],
  ['Q3217169', 'lam-dong', 'dinh-langbiang'],
  ['Q10748461', 'lam-dong', 'chua-linh-phuoc'],
  ['Q1749733', 'phu-tho', 'vuon-quoc-gia-xuan-son'],
  ['Q78334560', 'quang-ngai', 'ho-thoi-loi'],
  ['Q10802059', 'quang-ninh', 'nui-yen-tu'],
  ['Q112182634', 'quang-ninh', 'bao-tang-quang-ninh'],
  ['Q43171', 'quang-tri', 'hang-thien-duong'],
  ['Q44889', 'quang-tri', 'hang-son-doong'],
  ['Q10825609', 'quang-tri', 'thanh-co-quang-tri'],
  ['Q10831162', 'tay-ninh', 'toa-thanh-tay-ninh'],
  ['Q1968747', 'thai-nguyen', 'vuon-quoc-gia-ba-be'],
  ['Q10784247', 'thanh-hoa', 'lam-kinh'],
  ['Q6949928', 'tuyen-quang', 'deo-ma-pi-leng'],
  ['Q61130932', 'tuyen-quang', 'hang-lung-khuy'],
  ['Q1536917', 'an-giang', 'vuon-quoc-gia-u-minh-thuong'],
  ['Q2344822', 'an-giang', 'oc-eo'],
  ['Q3895714', 'ca-mau', 'vuon-quoc-gia-u-minh-ha'],
  ['Q109438230', 'ca-mau', 'thap-vinh-hung'],
];
const candidates = (await read('wikidata-discovery.json')).candidates;
const provinces = (await read('provinces.json')).provinces;
const places = await read('places.json');
const photos = await read('photos.json');
const sources = await read('place-sources.json');
const selected = reviewed.map(([qid, province, id]) => {
  const candidate = candidates.find((item) => item.id === qid && item.province === province);
  if (!candidate) throw new Error(`Missing reviewed candidate ${qid} in ${province}`);
  if (!provinces.some((item) => item.slug === province)) throw new Error(`Unknown province ${province}`);
  if (places.some((item) => item.id === id)) return null;
  if (places.some((item) => item.name === candidate.name && item.provinceSlug === province)) throw new Error(`Duplicate place ${id}`);
  return { ...candidate, id, qid };
}).filter(Boolean);

const clean = (html = '') => html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const infoByTitle = new Map();
for (let i = 0; i < selected.length; i += 15) {
  const batch = selected.slice(i, i + 15);
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.search = new URLSearchParams({ action: 'query', format: 'json', prop: 'imageinfo', iiprop: 'url|extmetadata|mime|size', iiurlwidth: '1000', titles: batch.map((item) => `File:${item.image}`).join('|') }).toString();
  const response = await fetch(url, { headers: { 'User-Agent': 'DiDauVietNam/0.4 (photo attribution review)' }, signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Commons HTTP ${response.status}`);
  const result = await response.json();
  for (const page of Object.values(result.query?.pages ?? {})) infoByTitle.set(page.title.replaceAll('_', ' '), page);
}

const stamp = new Date().toISOString();
const today = stamp.slice(0, 10);
for (const item of selected) {
  const page = infoByTitle.get(`File:${item.image}`);
  const info = page?.imageinfo?.[0];
  const meta = info?.extmetadata ?? {};
  const license = clean(meta.LicenseShortName?.value);
  if (!info || !/^image\/(jpeg|png|webp)$/.test(info.mime) || !/^(CC0|CC BY|Public domain|PD)/i.test(license)) throw new Error(`Unsupported image/license: ${item.image} (${license})`);
  const province = provinces.find((entry) => entry.slug === item.province);
  places.push({
    id: item.id, slug: item.id, name: item.name,
    description: `Điểm tham quan tại ${province.name}. Thông tin mở cửa và vị trí lối vào cần kiểm tra trước chuyến đi.`,
    mustTry: null, category: 'sight', provinceSlug: item.province, area: null, address: null,
    latitude: item.lat, longitude: item.lon, priceMin: null, priceMax: null, priceLevel: null,
    tags: [], openingHours: null, website: null, phone: null,
    verificationStatus: 'unverified', publicationStatus: 'published', isDemo: true, editorPick: false,
    providerRefs: [], osmHint: null, createdAt: stamp, updatedAt: stamp,
  });
  photos[item.id] = {
    file: page.title, pageUrl: info.descriptionurl, thumbUrl: info.thumburl ?? info.url,
    width: info.thumbwidth ?? info.width, height: info.thumbheight ?? info.height,
    author: clean(meta.Artist?.value).slice(0, 120) || 'Không rõ tác giả', license,
    licenseUrl: meta.LicenseUrl?.value ?? null, match: 'place', via: item.source,
    source: 'wikimedia', fetchedAt: today,
  };
  sources[item.id] = { place: item.source, coordinates: `${item.source}#P625`, photo: info.descriptionurl, reviewedAt: today };
  console.log(`${item.province}: ${item.name} · ${license} · ${page.title}`);
}
if (process.argv.includes('--apply')) {
  for (const [name, data] of [['places.json', places], ['photos.json', photos], ['place-sources.json', sources]]) {
    await writeFile(path(name), `${JSON.stringify(data, null, 2)}\n`);
  }
  console.log(`Đã thêm ${selected.length} địa điểm.`);
} else {
  console.log(`Xem trước ${selected.length} địa điểm; thêm --apply để ghi dữ liệu.`);
}
