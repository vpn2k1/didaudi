import { describe, expect, it, vi } from 'vitest';
import { searchQuerySchema } from '../src/domain/schemas.js';
import { GooglePlacesProvider, smoothedRating } from '../src/providers/googlePlacesProvider.js';
import { provinces, taxonomy } from './fixtures.js';

const KEY = 'test-key-not-real-123';
const gPlace = {
  id: 'ChIJabcdefghijk',
  displayName: { text: 'Quán Test' },
  formattedAddress: '1 Phố Test, Hà Nội',
  location: { latitude: 21.03, longitude: 105.85 },
  primaryType: 'vietnamese_restaurant',
  rating: 4.6,
  userRatingCount: 120,
  googleMapsUri: 'https://maps.google.com/?cid=1',
  currentOpeningHours: { openNow: true },
  photos: [{ name: 'places/ChIJabcdefghijk/photos/abcdefghijk', authorAttributions: [{ displayName: 'Tác giả ảnh', uri: 'https://maps.google.com/maps/contrib/123' }] }],
};

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const make = (fetchImpl: typeof fetch) => new GooglePlacesProvider({ apiKey: KEY, provinces: () => provinces, taxonomy: () => taxonomy, fetchImpl });

describe('GooglePlacesProvider', () => {
  it('gửi key qua header, field mask tối thiểu, tọa độ đã làm tròn', async () => {
    const fetchImpl = vi.fn(async () => json({ places: [gPlace] }));
    const r = await make(fetchImpl as unknown as typeof fetch).search(searchQuerySchema.parse({ q: 'phở', category: 'food', near: '21.03456,105.85678' }));
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toContain('places:searchText');
    expect(url).not.toContain(KEY);
    expect(init.headers['X-Goog-Api-Key']).toBe(KEY);
    expect(init.headers['X-Goog-FieldMask']).not.toContain('reviews');
    expect(init.headers['X-Goog-FieldMask']).toContain('places.photos');
    const body = JSON.parse(init.body as string);
    expect(body.includedType).toBe('restaurant');
    expect(body.locationBias.circle.center).toEqual({ latitude: 21.03, longitude: 105.86 });

    expect(r.items[0]).toMatchObject({ slug: `g-${gPlace.id}`, category: 'food', rating: 4.6, openStatus: 'open', source: 'google', isDemo: false });
    expect(r.items[0]?.photo).toMatchObject({ author: 'Tác giả ảnh', source: 'google', pageUrl: gPlace.googleMapsUri });
    expect(JSON.stringify(r)).not.toContain(KEY);
  });

  it('ảnh được lấy qua server bằng key trong header, URL trả về không chứa key', async () => {
    const fetchImpl = vi.fn(async () => json({ photoUri: 'https://lh3.googleusercontent.com/photo-example' }));
    const provider = make(fetchImpl as unknown as typeof fetch);
    await expect(provider.photoUri('places/ChIJabcdefghijk/photos/abcdefghijk')).resolves.toBe('https://lh3.googleusercontent.com/photo-example');
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toContain('skipHttpRedirect=true');
    expect(url).not.toContain(KEY);
    expect(init.headers['X-Goog-Api-Key']).toBe(KEY);
    await expect(provider.photoUri('https://example.com/evil')).rejects.toThrow(/không hợp lệ/);
  });

  it('retry 1 lần khi lỗi 5xx, không retry vô hạn', async () => {
    const ok = vi.fn().mockResolvedValueOnce(json({}, 503)).mockResolvedValueOnce(json({ places: [] }));
    await expect(make(ok as unknown as typeof fetch).search(searchQuerySchema.parse({}))).resolves.toMatchObject({ items: [] });
    expect(ok).toHaveBeenCalledTimes(2);

    const down = vi.fn(async () => json({}, 500));
    await expect(make(down as unknown as typeof fetch).search(searchQuerySchema.parse({}))).rejects.toThrow(/Google Places/);
    expect(down).toHaveBeenCalledTimes(2);
  });

  it('chi tiết: 404 → null, slug lạ → null', async () => {
    const notFound = vi.fn(async () => json({}, 404));
    expect(await make(notFound as unknown as typeof fetch).getBySlug('g-ChIJabcdefghijk')).toBeNull();
    expect(await make(notFound as unknown as typeof fetch).getBySlug('pho-thin')).toBeNull();
  });

  it('rating làm mượt: ít đánh giá không vượt địa điểm nhiều đánh giá ổn định', () => {
    expect(smoothedRating(5, 2)!).toBeLessThan(smoothedRating(4.6, 300)!);
    expect(smoothedRating(undefined, 10)).toBeNull();
  });
});
