import type { PlaceRecord, Province } from '../src/domain/schemas.js';
import type { Taxonomy } from '../src/services/search.js';

export const provinces: Province[] = [
  { code: 'HNI', slug: 'ha-noi', name: 'Hà Nội', type: 'city', centerLatitude: 21.0285, centerLongitude: 105.8542 },
  { code: 'DNG', slug: 'da-nang', name: 'Đà Nẵng', type: 'city', centerLatitude: 16.0544, centerLongitude: 108.2022 },
  { code: 'HCM', slug: 'tp-ho-chi-minh', name: 'TP. Hồ Chí Minh', type: 'city', centerLatitude: 10.7769, centerLongitude: 106.7009 },
];

export const taxonomy: Taxonomy = {
  categories: [
    { id: 'food', label: 'Ăn uống', icon: '🍜' },
    { id: 'cafe', label: 'Cà phê', icon: '☕' },
    { id: 'sight', label: 'Du lịch', icon: '🏛️' },
    { id: 'fun', label: 'Vui chơi', icon: '🎡' },
  ],
  tags: { pho: 'Phở', 'ca-phe-trung': 'Cà phê trứng', 'lich-su': 'Lịch sử', bien: 'Biển' },
};

const base = {
  description: null,
  mustTry: null,
  area: null,
  address: null,
  priceMin: null,
  priceMax: null,
  openingHours: null,
  website: null,
  phone: null,
  verificationStatus: 'unverified' as const,
  publicationStatus: 'published' as const,
  isDemo: true,
  editorPick: false,
  providerRefs: [],
  osmHint: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

export const places: PlaceRecord[] = [
  { ...base, id: 'p1', slug: 'pho-a', name: 'Phở A', category: 'food', provinceSlug: 'ha-noi', latitude: 21.03, longitude: 105.85, tags: ['pho'], priceMin: 40000, priceMax: 55000, editorPick: true },
  { ...base, id: 'p2', slug: 'pho-co-cafe', name: 'Cafe Phố Cổ', category: 'cafe', provinceSlug: 'ha-noi', latitude: 21.031, longitude: 105.851, tags: ['ca-phe-trung'] },
  { ...base, id: 'p3', slug: 'van-mieu', name: 'Văn Miếu', category: 'sight', provinceSlug: 'ha-noi', latitude: 21.0293, longitude: 105.8355, tags: ['lich-su'], verificationStatus: 'coordinates_checked' },
  { ...base, id: 'p4', slug: 'my-khe', name: 'Bãi biển Mỹ Khê', category: 'sight', provinceSlug: 'da-nang', latitude: 16.06, longitude: 108.2468, tags: ['bien'] },
  { ...base, id: 'p5', slug: 'nhap', name: 'Quán nháp', category: 'food', provinceSlug: 'ha-noi', latitude: 21.03, longitude: 105.85, tags: ['pho'], publicationStatus: 'draft' },
  {
    ...base,
    id: 'p6',
    slug: 'pho-dem',
    name: 'Phở Đêm',
    category: 'food',
    provinceSlug: 'ha-noi',
    latitude: 21.02,
    longitude: 105.84,
    tags: ['pho'],
    priceMin: 70000,
    priceMax: 90000,
    openingHours: { periods: [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, open: '18:00', close: '02:00' })), verifiedAt: '2026-09-01T00:00:00.000Z' },
  },
];
