import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { photoSchema, provinceSchema } from './domain/schemas.js';
import { GooglePlacesProvider } from './providers/googlePlacesProvider.js';
import { LocalPlaceProvider } from './providers/localPlaceProvider.js';
import type { PlaceProvider } from './providers/PlaceProvider.js';
import { JsonPlaceRepository } from './repositories/jsonPlaceRepository.js';
import type { Taxonomy } from './services/search.js';

const config = loadConfig();
const readJson = async (name: string) => JSON.parse(await readFile(join(config.DATA_DIR, name), 'utf8'));

const provinces = z.array(provinceSchema).parse((await readJson('provinces.json')).provinces);
const taxonomy = (await readJson('taxonomy.json')) as Taxonomy;
const repo = await JsonPlaceRepository.open(join(config.DATA_DIR, 'places.json'));
// Ảnh (tùy chọn) – tạo bằng scripts/fetch-photos.mjs
const photos = z.record(photoSchema).parse(await readJson('photos.json').catch(() => ({})));

const googleProvider = config.GOOGLE_PLACES_API_KEY
  ? new GooglePlacesProvider({ apiKey: config.GOOGLE_PLACES_API_KEY, provinces: () => provinces, taxonomy: () => taxonomy })
  : undefined;
const provider: PlaceProvider = config.PLACES_PROVIDER === 'google'
  ? googleProvider!
  : new LocalPlaceProvider(repo, () => ({ provinces, taxonomy, photos }));

createApp({ config, provider, googleProvider, repo, provinces, taxonomy, photos }).listen(config.PORT, () => {
  console.log(`API: http://localhost:${config.PORT}/api  ·  provider=${provider.info.id}  ·  admin=${config.adminEnabled ? 'bật' : 'tắt'}`);
});
