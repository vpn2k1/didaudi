import { describe, expect, it } from 'vitest';
import { searchQuerySchema } from '../src/domain/schemas.js';
import { extractProvince, searchPlaces } from '../src/services/search.js';
import { places, provinces, taxonomy } from './fixtures.js';

const ctx = { provinces, taxonomy, now: new Date('2026-10-09T20:00:00+07:00') };
const search = (q: Record<string, string>) => searchPlaces(places, searchQuerySchema.parse(q), ctx);
const names = (q: Record<string, string>) => search(q).items.map((p) => p.name);

describe('extractProvince', () => {
  it('tách tên tỉnh khỏi từ khóa (có dấu / không dấu)', () => {
    expect(extractProvince('phở Hà Nội', provinces)).toEqual({ province: 'ha-noi', rest: 'pho' });
    expect(extractProvince('bien da nang', provinces)).toEqual({ province: 'da-nang', rest: 'bien' });
    expect(extractProvince('cà phê hồ chí minh', provinces).province).toBe('tp-ho-chi-minh');
    expect(extractProvince('bún chả', provinces).province).toBeUndefined();
  });
});

describe('searchPlaces', () => {
  it('không trả địa điểm nháp (draft)', () => {
    expect(names({})).not.toContain('Quán nháp');
  });

  it('tìm không dấu và ưu tiên khớp thẻ hơn khớp chữ nhập nhằng', () => {
    const result = names({ q: 'pho' });
    expect(result.slice(0, 2).sort()).toEqual(['Phở A', 'Phở Đêm']);
    expect(result).toContain('Cafe Phố Cổ');
  });

  it('lọc theo tỉnh suy ra từ từ khóa', () => {
    expect(names({ q: 'bien da nang' })).toEqual(['Bãi biển Mỹ Khê']);
  });

  it('lọc danh mục và gắn lý do gợi ý thực tế', () => {
    const r = search({ category: 'food' });
    expect(r.items.every((p) => p.category === 'food')).toBe(true);
    expect(r.items.find((p) => p.slug === 'pho-a')?.reasons).toContain('Được biên tập chọn');
  });

  it('lọc theo bán kính quanh tọa độ (đã làm tròn)', () => {
    const r = names({ near: '16.0600,108.2400', radius: '2' });
    expect(r).toEqual(['Bãi biển Mỹ Khê']);
  });

  it('facets chỉ bật khi có dữ liệu', () => {
    expect(search({ province: 'ha-noi' }).facets).toMatchObject({ hasPriceData: true, hasOpeningHours: true, hasRating: false });
    expect(search({ province: 'da-nang' }).facets).toMatchObject({ hasPriceData: false, hasOpeningHours: false });
  });

  it('giá rẻ và đang mở cửa chỉ dựa trên dữ liệu có thật', () => {
    expect(names({ price: 'cheap' })).toEqual(['Phở A']);
    expect(names({ openNow: '1' })).toEqual(['Phở Đêm']);
  });

  it('phân trang', () => {
    const r = search({ limit: '2', page: '2' });
    expect(r.items).toHaveLength(2);
    expect(r.total).toBe(5);
  });
});

describe('searchQuerySchema', () => {
  it('giới hạn bán kính và page size', () => {
    expect(() => searchQuerySchema.parse({ radius: '500' })).toThrow();
    expect(() => searchQuerySchema.parse({ limit: '1000' })).toThrow();
    expect(() => searchQuerySchema.parse({ near: 'abc' })).toThrow();
  });
});
