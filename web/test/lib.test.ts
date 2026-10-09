import { describe, expect, it } from 'vitest';
import { toQuery } from '@/lib/api';
import { directionsUrl, formatPriceRange, isIndexablePlace, OPEN_STATUS_LABEL } from '@/lib/format';
import { applyUserLocation, coarse, formatDistance, haversineKm } from '@/lib/geo';
import type { PlaceSummary } from '@/lib/types';

const place = (over: Partial<PlaceSummary>): PlaceSummary => ({
  id: 'x',
  slug: 'x',
  name: 'X',
  category: 'food',
  provinceSlug: 'ha-noi',
  area: null,
  address: null,
  latitude: 21.0287,
  longitude: 105.8524,
  tags: [],
  mustTry: null,
  priceMin: null,
  priceMax: null,
  priceLevel: null,
  photo: null,
  rating: null,
  ratingCount: null,
  openStatus: 'unknown',
  verificationStatus: 'unverified',
  isDemo: true,
  editorPick: false,
  googleMapsUrl: 'https://www.google.com/maps',
  source: 'local',
  score: 1,
  reasons: [],
  ...over,
});

describe('geo', () => {
  it('haversine & làm tròn vị trí trước khi gửi server', () => {
    expect(haversineKm({ lat: 21.0287, lng: 105.8524 }, { lat: 21.0293, lng: 105.8355 })).toBeCloseTo(1.76, 1);
    expect(coarse({ lat: 21.028734, lng: 105.852412 })).toBe('21.03,105.85');
  });

  it('định dạng khoảng cách kiểu Việt Nam', () => {
    expect(formatDistance(0.234)).toBe('230 m');
    expect(formatDistance(1.26)).toBe('1,3 km');
    expect(formatDistance(12.4)).toBe('12 km');
  });

  it('không có vị trí user → không có khoảng cách', () => {
    const [p] = applyUserLocation([place({ distanceKm: 3 })], null, null, 'relevance');
    expect(p!.distanceKm).toBeUndefined();
  });

  it('lọc đúng bán kính, gắn nhãn "Gần bạn", sắp theo khoảng cách', () => {
    const items = [
      place({ slug: 'far', latitude: 21.06, longitude: 105.85 }), // ~3.5 km
      place({ slug: 'mid', latitude: 21.0293, longitude: 105.8355 }), // ~1.8 km
      place({ slug: 'near', latitude: 21.03, longitude: 105.853 }), // ~0.15 km
      place({ slug: 'nocoord', latitude: null, longitude: null }),
    ];
    const r = applyUserLocation(items, { lat: 21.0287, lng: 105.8524 }, 2, 'distance');
    expect(r.map((p) => p.slug)).toEqual(['near', 'mid', 'nocoord']);
    expect(r[0]!.reasons).toContain('Gần bạn');
    expect(r[1]!.reasons).not.toContain('Gần bạn');
    expect(r[2]!.distanceKm).toBeUndefined();
  });
});

describe('format', () => {
  it('giá VND, ẩn khi không có dữ liệu', () => {
    expect(formatPriceRange(null, null)).toBeNull();
    expect(formatPriceRange(40000, 60000)?.replace(/\s/g, ' ')).toBe('40.000 ₫ – 60.000 ₫');
    expect(formatPriceRange(null, 50000)?.replace(/\s/g, ' ')).toBe('Đến 50.000 ₫');
  });

  it('không hiển thị trạng thái mở cửa khi không biết', () => {
    expect(OPEN_STATUS_LABEL.unknown).toBeNull();
  });

  it('chỉ đường cần tọa độ', () => {
    expect(directionsUrl(place({}))).toContain('destination=21.0287,105.8524');
    expect(directionsUrl(place({ latitude: null }))).toBeNull();
  });

  it('chỉ index địa điểm nội bộ đã xác minh, không phải demo', () => {
    expect(isIndexablePlace(place({ isDemo: true, verificationStatus: 'verified' }))).toBe(false);
    expect(isIndexablePlace(place({ isDemo: false, verificationStatus: 'coordinates_checked' }))).toBe(false);
    expect(isIndexablePlace(place({ isDemo: false, verificationStatus: 'verified', source: 'google' }))).toBe(false);
    expect(isIndexablePlace(place({ isDemo: false, verificationStatus: 'verified' }))).toBe(true);
  });

  it('query string bỏ giá trị rỗng', () => {
    expect(toQuery({ q: 'phở', category: undefined, page: 1, x: '' })).toBe('?q=ph%E1%BB%9F&page=1');
  });
});
