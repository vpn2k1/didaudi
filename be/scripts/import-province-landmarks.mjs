// Run without flags to inspect Wikimedia matches. --apply adds reviewed candidates.
// Candidate rows may specify wikidataId to pin a manually reviewed entity.
import { readFile, rename, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const root = new URL('../data/', import.meta.url);
const file = (name) => fileURLToPath(new URL(name, root));
const candidates = JSON.parse(await readFile(file('province-landmark-candidates.json'), 'utf8'));
const provinces = JSON.parse(await readFile(file('provinces.json'), 'utf8')).provinces;
const places = JSON.parse(await readFile(file('places.json'), 'utf8'));
const photos = JSON.parse(await readFile(file('photos.json'), 'utf8'));
const sources = JSON.parse(await readFile(file('place-sources.json'), 'utf8').catch(() => '{}'));
const apply = process.argv.includes('--apply');
const wikiOnly = process.argv.includes('--wiki-only');
const only = process.argv.find((arg) => arg.startsWith('--only='))?.slice(7).split(',');
const date = new Date().toISOString();
const ua = 'DiDauVietNam/0.3 (province data research; Wikimedia Commons attribution)';
let lastRequest = 0;

async function json(url) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const wait = Math.max(0, 750 - (Date.now() - lastRequest));
      if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
      lastRequest = Date.now();
      const response = await fetch(url, { headers: { 'User-Agent': ua }, signal: AbortSignal.timeout(10000) });
      if (response.ok) return response.json();
      if (process.env.DEBUG_IMPORT) console.error(`HTTP ${response.status}: ${url.slice(0, 100)}`);
      if (response.status < 500 && response.status !== 429) break;
    } catch (error) { if (process.env.DEBUG_IMPORT) console.error(error.message); }
    await new Promise((resolve) => setTimeout(resolve, 1000 * (attempt + 1)));
  }
  return null;
}

const wikidataApi = 'https://www.wikidata.org/w/api.php?format=json&origin=*';
const commonsApi = 'https://commons.wikimedia.org/w/api.php?format=json&origin=*';
const plain = (html = '') => html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, ' ').trim();
const normalizeTitle = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').replace(/\s*\([^)]*\)$/, '').replace(/[^a-z0-9]+/gi, ' ').trim().toLowerCase();
const slugify = (value) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[đĐ]/g, 'd').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const distanceKm = (a, b) => {
  const rad = (n) => n * Math.PI / 180;
  const dLat = rad(a.latitude - b.latitude);
  const dLng = rad(a.longitude - b.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
};

async function wikipediaEntity(candidate) {
  const province = provinces.find((item) => item.slug === candidate.province);
  for (const [language, query] of [['en', candidate.query], ['vi', candidate.name]]) {
    const api = `https://${language}.wikipedia.org/w/api.php?format=json`;
    const url = `${api}&action=query&generator=search&gsrsearch=${encodeURIComponent(query)}&gsrlimit=5&prop=coordinates|pageimages&piprop=name|thumbnail&pithumbsize=1000`;
    const result = await json(url);
    const pages = Object.values(result?.query?.pages ?? {}).sort((a, b) => a.index - b.index);
    for (const page of pages) {
      const coordinate = page.coordinates?.[0];
      if (!coordinate || !page.pageimage) continue;
      // Search rank alone is insufficient: it can return the province or nearby town.
      if (![candidate.query, candidate.name].some((name) => normalizeTitle(page.title) === normalizeTitle(name))) continue;
      const point = { latitude: coordinate.lat, longitude: coordinate.lon };
      if (distanceKm(point, { latitude: province.centerLatitude, longitude: province.centerLongitude }) > 260) continue;
      const sourcePage = `https://${language}.wikipedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`;
      if (process.env.DEBUG_IMPORT) console.error(`wiki ${candidate.name}: ${page.title} ${point.latitude},${point.longitude} ${page.pageimage}`);
      return { id: null, point, image: candidate.image ?? page.pageimage.replace(/_/g, ' '), sourcePage, description: '' };
    }
  }
  return null;
}

async function entityFor(candidate) {
  if (wikiOnly) return wikipediaEntity(candidate);
  let ids = candidate.wikidataId ? [candidate.wikidataId] : [];
  if (!ids.length) {
    const vietnamese = await json(`${wikidataApi}&action=wbsearchentities&search=${encodeURIComponent(candidate.name)}&language=vi&limit=7`);
    const english = await json(`${wikidataApi}&action=wbsearchentities&search=${encodeURIComponent(candidate.query)}&language=en&limit=7`);
    ids = [...new Set([...(vietnamese?.search ?? []), ...(english?.search ?? [])].map((result) => result.id))];
  }
  if (!ids.length) return wikipediaEntity(candidate);
  const result = await json(`${wikidataApi}&action=wbgetentities&ids=${ids.join('|')}&props=labels|descriptions|claims&languages=vi|en`);
  for (const id of ids) {
    const entity = result?.entities?.[id];
    const point = entity?.claims?.P625?.[0]?.mainsnak?.datavalue?.value;
    const image = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
    if (process.env.DEBUG_IMPORT) console.error(`candidate ${candidate.name}: ${id} point=${!!point} image=${!!image} label=${entity?.labels?.vi?.value ?? entity?.labels?.en?.value ?? ''}`);
    if (!point || !(candidate.image ?? image) || point.latitude < 8 || point.latitude > 23.5 || point.longitude < 102 || point.longitude > 117.5) continue;
    return { id, point, image: candidate.image ?? image, description: entity.descriptions?.vi?.value ?? entity.descriptions?.en?.value ?? '' };
  }
  return wikipediaEntity(candidate);
}

async function imageInfo(image, sourceId) {
  const title = `File:${image}`;
  const result = await json(`${commonsApi}&action=query&prop=imageinfo&iiprop=url|extmetadata|mime|size&iiurlwidth=1000&titles=${encodeURIComponent(title)}`);
  const page = Object.values(result?.query?.pages ?? {})[0];
  const info = page?.imageinfo?.[0];
  if (!info || !/^image\/(jpeg|png|webp)$/.test(info.mime) || info.width < 500) return null;
  const meta = info.extmetadata ?? {};
  const license = plain(meta.LicenseShortName?.value);
  if (/\b(logo|seal|flag|map|banner)\b/i.test(image)) return null;
  if (!/^(CC0|CC BY|Public domain|PD)/i.test(license)) return null;
  return {
    file: page.title,
    pageUrl: info.descriptionurl,
    thumbUrl: info.thumburl ?? info.url,
    width: info.thumbwidth ?? info.width,
    height: info.thumbheight ?? info.height,
    author: plain(meta.Artist?.value).slice(0, 120) || 'Không rõ tác giả',
    license,
    licenseUrl: meta.LicenseUrl?.value ?? null,
    match: 'place',
    source: 'wikimedia',
    via: sourceId,
    fetchedAt: date.slice(0, 10),
  };
}

const report = [];
for (const candidate of candidates) {
  if (only && !only.includes(candidate.province)) continue;
  if (!provinces.some((province) => province.slug === candidate.province)) throw new Error(`Unknown province ${candidate.province}`);
  const id = slugify(candidate.name);
  if (places.some((place) => place.id === id)) {
    report.push({ province: candidate.province, name: candidate.name, result: 'exists' });
    console.log(`${candidate.province}: exists`);
    continue;
  }
  const entity = await entityFor(candidate);
  const photo = entity && (await imageInfo(entity.image, entity.id ? `wikidata:${entity.id}` : `wikipedia:${entity.sourcePage}`));
  if (!entity || !photo) {
    report.push({ province: candidate.province, name: candidate.name, result: entity ? 'no licensed photo' : 'no entity/coordinates/image' });
    console.log(`${candidate.province}: ${entity ? 'no licensed photo' : 'no entity/coordinates/image'}`);
    continue;
  }
  report.push({ province: candidate.province, name: candidate.name, result: 'ready', wikidata: entity.id, lat: entity.point.latitude, lng: entity.point.longitude, photo: photo.file, license: photo.license });
  console.log(`${candidate.province}: ready ${entity.id} ${photo.file}`);
  if (!apply) continue;
  places.push({
    id, slug: id, name: candidate.name,
    description: candidate.description ?? `Điểm tham quan tại ${provinces.find((province) => province.slug === candidate.province).name}. Thông tin mở cửa và vị trí cần kiểm tra trước chuyến đi.`,
    mustTry: null, category: 'sight', provinceSlug: candidate.province,
    area: null, address: null,
    latitude: entity.point.latitude, longitude: entity.point.longitude,
    priceMin: null, priceMax: null, priceLevel: null, tags: candidate.tags,
    openingHours: null, website: null, phone: null,
    verificationStatus: 'unverified', publicationStatus: 'published', isDemo: true, editorPick: false,
    providerRefs: [], osmHint: null, createdAt: date, updatedAt: date,
  });
  photos[id] = photo;
  sources[id] = { place: entity.sourcePage ?? `https://www.wikidata.org/wiki/${entity.id}`, coordinates: entity.sourcePage ?? `https://www.wikidata.org/wiki/${entity.id}#P625`, photo: photo.pageUrl, reviewedAt: null };
}
console.table(report);
console.log(`ready=${report.filter((item) => item.result === 'ready').length} missing=${report.filter((item) => item.result !== 'ready' && item.result !== 'exists').length}`);
if (apply) {
  for (const [name, data] of [['places.json', places], ['photos.json', photos], ['place-sources.json', sources]]) {
    await writeFile(file(`${name}.tmp`), `${JSON.stringify(data, null, 2)}\n`);
    await rename(file(`${name}.tmp`), file(name));
  }
}
