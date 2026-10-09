import express from 'express';
import cors from 'cors';
import { readFileSync } from 'node:fs';
import { haversineKm } from './geo.js';

const PORT = process.env.PORT || 4000;
const places = JSON.parse(readFileSync(new URL('../data/hanoi.json', import.meta.url), 'utf8'));

export const CATEGORIES = {
  sight: { label: 'Đi đâu', icon: '🏛️' },
  food: { label: 'Ăn gì', icon: '🍜' },
  cafe: { label: 'Cà phê', icon: '☕' },
};

export const TAGS = {
  pho: 'Phở', 'bun-cha': 'Bún chả', bun: 'Bún', 'bun-dau': 'Bún đậu', mien: 'Miến', 'cha-ca': 'Chả cá',
  'banh-mi': 'Bánh mì', 'banh-cuon': 'Bánh cuốn', xoi: 'Xôi', che: 'Chè', kem: 'Kem', 'an-vat': 'Ăn vặt',
  bia: 'Bia hơi', 'nha-hang': 'Nhà hàng', 'khu-am-thuc': 'Phố ẩm thực',
  'ca-phe-trung': 'Cà phê trứng', 'ca-phe-co': 'Cà phê cổ', 'view-ho': 'View hồ',
  'lich-su': 'Lịch sử', 'van-hoa': 'Văn hóa', 'tam-linh': 'Tâm linh', 'bao-tang': 'Bảo tàng', 'kien-truc': 'Kiến trúc',
  ho: 'Hồ', 'cong-vien': 'Công viên', 'pho-di-bo': 'Phố đi bộ', cho: 'Chợ', 'mua-sam': 'Mua sắm',
  'view-dep': 'View đẹp', 'lang-nghe': 'Làng nghề', 'lang-co': 'Làng cổ', 'nghe-thuat': 'Nghệ thuật', 'song-ao': 'Sống ảo',
};

const app = express();
app.use(cors());

// Bỏ trường nội bộ, thêm khoảng cách nếu có vị trí user
function present(p, lat, lng) {
  const { match, osmStreet, osmRadius, ...rest } = p;
  if (lat == null || lng == null) return rest;
  return { ...rest, distanceKm: +haversineKm(lat, lng, p.lat, p.lng).toFixed(2) };
}

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : undefined;
}

function filterPlaces(query) {
  const lat = num(query.lat);
  const lng = num(query.lng);
  const radius = num(query.radius); // km
  const categories = query.category ? String(query.category).split(',') : null;
  const tags = query.tags ? String(query.tags).split(',') : null;
  const maxPrice = num(query.maxPrice);
  const q = query.q ? normalize(String(query.q)) : null;

  let list = places.map((p) => present(p, lat, lng));
  if (categories) list = list.filter((p) => categories.includes(p.category));
  if (tags) list = list.filter((p) => p.tags.some((t) => tags.includes(t)));
  if (maxPrice) list = list.filter((p) => p.price == null || p.price <= maxPrice);
  if (q) list = list.filter((p) => normalize(`${p.name} ${p.address} ${p.mustTry ?? ''} ${p.tags.map((t) => TAGS[t]).join(' ')}`).includes(q));
  if (radius && lat != null) list = list.filter((p) => p.distanceKm <= radius);
  if (lat != null) list.sort((a, b) => a.distanceKm - b.distanceKm);
  return list;
}

// Tìm kiếm không dấu: "bun cha" khớp "Bún chả"
function normalize(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

app.get('/api/health', (_req, res) => res.json({ ok: true, places: places.length }));

app.get('/api/meta', (_req, res) => {
  const tagsByCategory = {};
  for (const p of places) {
    tagsByCategory[p.category] ??= new Set();
    p.tags.forEach((t) => tagsByCategory[p.category].add(t));
  }
  res.json({
    city: { name: 'Hà Nội', center: [21.0285, 105.8542] },
    categories: CATEGORIES,
    tags: TAGS,
    tagsByCategory: Object.fromEntries(Object.entries(tagsByCategory).map(([k, v]) => [k, [...v]])),
  });
});

app.get('/api/places', (req, res) => {
  const list = filterPlaces(req.query);
  res.json({ total: list.length, items: list });
});

app.get('/api/places/:id', (req, res) => {
  const p = places.find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Không tìm thấy địa điểm' });
  res.json(present(p, num(req.query.lat), num(req.query.lng)));
});

// "Hôm nay ăn gì?" – chọn ngẫu nhiên, ưu tiên quán trong bán kính
app.get('/api/random', (req, res) => {
  const list = filterPlaces({ category: 'food', radius: 3, ...req.query });
  if (!list.length) return res.status(404).json({ error: 'Không có quán nào phù hợp quanh đây' });
  res.json(list[Math.floor(Math.random() * list.length)]);
});

app.listen(PORT, () => console.log(`API chạy tại http://localhost:${PORT} (${places.length} địa điểm)`));
