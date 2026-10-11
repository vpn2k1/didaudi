// Apply the manually checked source, coordinates and Commons file for province seed places.
// This script needs network access to refresh license and thumbnail metadata from Commons.
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const dataFile = (name) => fileURLToPath(new URL(`../data/${name}`, import.meta.url));
const read = async (name) => JSON.parse(await readFile(dataFile(name), 'utf8'));
const places = await read('places.json');
const photos = await read('photos.json');
const sources = await read('place-sources.json');
const provinces = (await read('provinces.json')).provinces;
const today = new Date().toISOString().slice(0, 10);
const apply = process.argv.includes('--apply');

const reviewed = [
  { id: 'doi-a1', province: 'dien-bien', name: 'Đồi A1', lat: 21.38102, lng: 103.01674,
    place: 'https://dienbien.gov.vn/en/bai-viet/A1-HILL-RELIC-ELIAN-2-zx8e81', coordinates: 'https://mapcarta.com/N4275582395',
    file: 'Crater Left by Vietminh Dynamite Blast - Hill A1 (Eliane 2) - Dien Bien Phu - Vietnam (48168795271).jpg' },
  { id: 'thac-dai-yem', province: 'son-la', name: 'Thác Dải Yếm', lat: 20.81798, lng: 104.59169,
    place: 'https://commons.wikimedia.org/wiki/Category:Dai_Yem_Waterfall', coordinates: 'https://mapcarta.com/N4958586922', file: 'Thacdaiyem.jpg' },
  { id: 'dong-tam-thanh', province: 'lang-son', name: 'Động Tam Thanh', lat: 21.85557, lng: 106.7468,
    place: 'https://mapcarta.com/N5602133184', coordinates: 'https://mapcarta.com/N5602133184', file: 'Trong động Tam Thanh.jpg' },
  { id: 'bien-thien-cam', province: 'ha-tinh', name: 'Biển Thiên Cầm', lat: 18.272712, lng: 106.1059362,
    place: 'https://tanitour.vn/thien-cam-beach/', coordinates: 'https://tanitour.vn/thien-cam-beach/', file: 'Thiencambeach.jpg' },
  { id: 'chua-keo', province: 'hung-yen', name: 'Chùa Keo', lat: 20.36081, lng: 106.29718,
    place: 'https://mapcarta.com/29485060', coordinates: 'https://mapcarta.com/29485060', file: 'Chuakeothaibinh.jpg' },
  { id: 'vuon-quoc-gia-tram-chim', province: 'dong-thap', name: 'Vườn quốc gia Tràm Chim', lat: 10.725, lng: 105.51667,
    place: 'https://nbca.gov.vn/vuon-quoc-gia-tram-chim-dong-thap/', coordinates: 'https://en.wikipedia.org/wiki/Tr%C3%A0m_Chim_National_Park',
    file: 'Vườn Quốc Gia Tràm Chim, Phú Hiệp,Tam Nong, Đồng tháp, Vietnam - panoramio.jpg' },
  { id: 'rung-tram-tra-su', province: 'an-giang', name: 'Rừng tràm Trà Sư', lat: 10.5848, lng: 105.0585,
    place: 'https://commons.wikimedia.org/wiki/Category:Tra_Su_Forest', coordinates: 'https://mapcarta.com/W170193928', file: 'Rừng Tràm Trà Sư.JPG' },
  { id: 'nui-ba-den', province: 'tay-ninh', name: 'Núi Bà Đen', file: 'Núi Bà Đen, 2021.jpg', place: 'https://www.wikidata.org/wiki/Q4922113' },
  { id: 'chua-vinh-trang', province: 'dong-thap', name: 'Chùa Vĩnh Tràng', file: 'Vinh Trang Pagoda.JPG', place: 'https://www.wikidata.org/wiki/Q16742066' },
  { id: 'ao-ba-om', province: 'vinh-long', name: 'Ao Bà Om', lat: 9.9176081, lng: 106.3040916,
    place: 'https://vinhlong.gov.vn/du-khach-old/diadanh_test', coordinates: 'https://tanitour.vn/ao-ba-om/',
    file: 'Ao Bà Om.jpg', tags: ['ho', 'van-hoa'] },
  { id: 'thanh-nha-ho', province: 'thanh-hoa', name: 'Thành nhà Hồ', lat: 20.07805556, lng: 105.60472222,
    place: 'https://whc.unesco.org/en/list/1358/', coordinates: 'https://commons.wikimedia.org/wiki/Category:Citadel_of_the_H%E1%BB%93_Dynasty',
    file: "Ho dynasty's citadel, Vietnam.jpg", tags: ['lich-su', 'kien-truc'] },
  { id: 'bien-ho', province: 'gia-lai', name: 'Biển Hồ', lat: 14.04536, lng: 107.99984,
    place: 'https://mapcarta.com/15521526', coordinates: 'https://mapcarta.com/15521526',
    file: 'Biển Hồ - Pleiku, Gia Lai, Việt Nam (cropped).jpg', tags: ['thien-nhien', 'view-dep'] },
];

const titles = reviewed.map((row) => `File:${row.file}`);
const url = new URL('https://commons.wikimedia.org/w/api.php');
url.search = new URLSearchParams({ action: 'query', format: 'json', prop: 'imageinfo', iiprop: 'url|extmetadata|mime|size', iiurlwidth: '1000', titles: titles.join('|') }).toString();
const response = await fetch(url, { headers: { 'User-Agent': 'DiDauVietNam/0.3 (photo attribution review)' }, signal: AbortSignal.timeout(20000) });
if (!response.ok) throw new Error(`Commons HTTP ${response.status}`);
const result = await response.json();
const pages = Object.values(result.query?.pages ?? {});
const clean = (html = '') => html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();

for (const row of reviewed) {
  const page = pages.find((item) => item.title.replaceAll('_', ' ') === `File:${row.file}`);
  const info = page?.imageinfo?.[0];
  const meta = info?.extmetadata ?? {};
  const license = clean(meta.LicenseShortName?.value);
  if (!info || !/^image\/(jpeg|png|webp)$/.test(info.mime) || !/^(CC0|CC BY|Public domain|PD)/i.test(license)) {
    throw new Error(`Missing or unsupported image/license: ${row.file}`);
  }
  let place = places.find((item) => item.id === row.id);
  if (!place) {
    const province = provinces.find((item) => item.slug === row.province);
    if (!province) throw new Error(`Unknown province ${row.province}`);
    const stamp = new Date().toISOString();
    place = {
      id: row.id, slug: row.id, name: row.name,
      description: `Điểm tham quan tại ${province.name}. Thông tin mở cửa và vị trí cần kiểm tra trước chuyến đi.`,
      mustTry: null, category: 'sight', provinceSlug: row.province, area: null, address: null,
      latitude: row.lat, longitude: row.lng, priceMin: null, priceMax: null, priceLevel: null,
      tags: row.tags, openingHours: null, website: null, phone: null,
      verificationStatus: 'unverified', publicationStatus: 'published', isDemo: true, editorPick: false,
      providerRefs: [], osmHint: null, createdAt: stamp, updatedAt: stamp,
    };
    places.push(place);
  }
  if (place.name !== row.name || place.provinceSlug !== row.province) throw new Error(`Place mismatch: ${row.id}`);
  if (row.lat !== undefined) { place.latitude = row.lat; place.longitude = row.lng; }
  photos[row.id] = {
    file: page.title, pageUrl: info.descriptionurl, thumbUrl: info.thumburl ?? info.url,
    width: info.thumbwidth ?? info.width, height: info.thumbheight ?? info.height,
    author: clean(meta.Artist?.value).slice(0, 120) || 'Không rõ tác giả', license,
    licenseUrl: meta.LicenseUrl?.value ?? null, match: 'place', source: 'wikimedia',
    via: row.place, fetchedAt: today,
  };
  sources[row.id] = {
    place: row.place,
    coordinates: row.coordinates ?? sources[row.id]?.coordinates ?? row.place,
    photo: info.descriptionurl, reviewedAt: today,
  };
  console.log(`${row.province}: ${row.name} · ${page.title} · ${license}`);
}
if (apply) {
  for (const [name, data] of [['places.json', places], ['photos.json', photos], ['place-sources.json', sources]]) {
    await writeFile(dataFile(name), `${JSON.stringify(data, null, 2)}\n`);
  }
} else {
  console.log('Dry run: thêm --apply sau khi kiểm tra kết quả để ghi dữ liệu.');
}
