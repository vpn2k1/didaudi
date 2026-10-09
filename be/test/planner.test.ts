import { describe, expect, it } from 'vitest';
import type { PlaceRecord } from '../src/domain/schemas.js';
import { buildPlan, planQuerySchema } from '../src/services/planner.js';
import { suggestLocations } from '../src/services/suggest.js';
import { places as basePlaces, provinces, taxonomy } from './fixtures.js';

const ctx = { provinces, taxonomy: { ...taxonomy, tags: { ...taxonomy.tags, ho: 'Hồ', 'view-ho': 'View hồ', 'nha-hang': 'Nhà hàng', kem: 'Kem', 'bao-tang': 'Bảo tàng' } } };
const base = basePlaces[0]!;
const mk = (o: Partial<PlaceRecord> & Pick<PlaceRecord, 'id' | 'name' | 'category' | 'latitude' | 'longitude' | 'tags'>): PlaceRecord => ({
  ...base,
  slug: o.id,
  provinceSlug: 'ha-noi',
  editorPick: false,
  priceMin: null,
  priceMax: null,
  priceLevel: null,
  area: null,
  ...o,
});

// Quanh Hồ Gươm (21.0287, 105.8524)
const records: PlaceRecord[] = [
  mk({ id: 'ho', name: 'Hồ Gươm', category: 'sight', latitude: 21.0287, longitude: 105.8524, tags: ['ho', 'view-dep'], priceLevel: 0, area: 'Phố cổ' }),
  mk({ id: 'bao-tang', name: 'Bảo tàng X', category: 'sight', latitude: 21.025, longitude: 105.85, tags: ['bao-tang', 'lich-su'], priceLevel: 1 }),
  mk({ id: 'nha-hang-dat', name: 'Nhà hàng sang', category: 'food', latitude: 21.03, longitude: 105.853, tags: ['nha-hang'], priceLevel: 4 }),
  mk({ id: 'bun-cha', name: 'Bún chả Y', category: 'food', latitude: 21.031, longitude: 105.851, tags: ['bun-cha'], priceLevel: 1, area: 'Phố cổ' }),
  mk({ id: 'kem', name: 'Kem Z', category: 'food', latitude: 21.025, longitude: 105.855, tags: ['kem'], priceLevel: 1 }),
  mk({ id: 'cafe', name: 'Cà phê view hồ', category: 'cafe', latitude: 21.0295, longitude: 105.8526, tags: ['view-ho'], priceLevel: 1 }),
  mk({ id: 'bien', name: 'Biển xa', category: 'sight', provinceSlug: 'da-nang', latitude: 16.06, longitude: 108.24, tags: ['bien'], priceLevel: 0 }),
  mk({ id: 'nui', name: 'Núi gần ĐN', category: 'sight', provinceSlug: 'da-nang', latitude: 16.1, longitude: 108.27, tags: ['nui', 'view-dep'], priceLevel: 0 }),
];
const plan = (q: Record<string, string>) => buildPlan(records, planQuerySchema.parse(q), ctx);

describe('planQuerySchema', () => {
  it('cần vị trí, điểm xuất phát hoặc tỉnh', () => {
    expect(() => planQuerySchema.parse({ intent: 'date' })).toThrow();
    expect(() => planQuerySchema.parse({ intent: 'xyz', province: 'ha-noi' })).toThrow();
  });
});

describe('buildPlan – hẹn hò', () => {
  it('buổi tối: ăn tối → dạo → tráng miệng, tôn trọng ngân sách, bỏ bảo tàng', () => {
    const r = plan({ intent: 'date', near: '21.0287,105.8524', time: 'evening', duration: 'halfday', budget: '2' });
    expect(r.stops.map((s) => s.slotKey)).toEqual(['dinner', 'walk', 'dessert']);
    const ids = r.stops.map((s) => s.place.id);
    expect(ids).not.toContain('nha-hang-dat'); // vượt ngân sách
    expect(ids).not.toContain('bao-tang'); // buổi tối thường đóng cửa
    expect(r.anchor.precision).toBe('coarse');
    expect(r.showRoute).toBe(true);
    expect(r.stops[0]!.legKm).toBeGreaterThanOrEqual(0);
  });

  it('không có ứng viên cho một mục → ghi chú, không bịa', () => {
    const r = plan({ intent: 'date', province: 'da-nang', time: 'evening' });
    expect(r.notes.some((n) => n.includes('Chưa tìm thấy'))).toBe(true);
  });
});

describe('buildPlan – du lịch', () => {
  it('chọn tỉnh: chỉ lấy điểm trong tỉnh, sắp từ gần đến xa so với trung tâm tỉnh', () => {
    const r = plan({ intent: 'travel', province: 'da-nang', duration: 'day' });
    expect(r.anchor.precision).toBe('province');
    expect(r.radiusKm).toBeNull();
    expect(r.stops.map((s) => s.place.id).sort()).toEqual(['bien', 'nui']);
    const d = r.stops.map((s) => s.distanceKm);
    expect([...d].sort((a, b) => a - b)).toEqual(d);
    expect(r.stops.every((s) => s.tip)).toBe(true);
  });

  it('nhiều ngày: gán số ngày cho từng điểm', () => {
    const r = plan({ intent: 'travel', near: '21.0287,105.8524', duration: 'multiday', radius: '10' });
    expect(r.stops[0]!.day).toBe(1);
  });
});

describe('buildPlan – ăn uống / cà phê', () => {
  it('ăn uống: lọc theo món & ngân sách, không vẽ lộ trình', () => {
    const r = plan({ intent: 'food', from: '21.03,105.852', fromLabel: 'Phố cổ', budget: '1' });
    expect(r.anchor).toMatchObject({ precision: 'exact', label: 'Phố cổ' });
    expect(r.showRoute).toBe(false);
    expect(r.stops.every((s) => s.place.category === 'food')).toBe(true);
    expect(r.stops.map((s) => s.place.id)).not.toContain('nha-hang-dat');
  });

  it('cà phê theo sở thích view đẹp', () => {
    const r = plan({ intent: 'cafe', near: '21.0287,105.8524', prefs: 'view-dep' });
    expect(r.stops[0]?.place.id).toBe('cafe');
  });
});

describe('suggestLocations', () => {
  it('gợi ý tỉnh, khu vực và địa điểm, gõ không dấu', () => {
    const items = suggestLocations('pho co', records, provinces);
    expect(items[0]).toMatchObject({ type: 'area', label: 'Phố cổ' });
    expect(suggestLocations('da nang', records, provinces)[0]).toMatchObject({ type: 'province', provinceSlug: 'da-nang' });
  });
});
