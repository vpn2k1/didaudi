// MapLibre GL v6 (ESM) tải web worker từ file .mjs riêng mà webpack không đóng gói.
// Copy worker + module dùng chung sang public/ để phục vụ cùng domain; chạy tự động trước dev/build.
import { copyFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const src = new URL('../node_modules/maplibre-gl/dist/', import.meta.url);
const dest = new URL('../public/maplibre/', import.meta.url);
await mkdir(dest, { recursive: true });
for (const f of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
  await copyFile(new URL(f, src), new URL(f, dest));
}
console.log('maplibre worker →', fileURLToPath(dest));
