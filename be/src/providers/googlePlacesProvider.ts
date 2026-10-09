import type { Category, SearchQuery } from '../domain/schemas.js';
import { coarsen } from '../lib/geo.js';
import type { OpenStatus } from '../lib/hours.js';
import type { Province } from '../domain/schemas.js';
import { DEFAULT_RADIUS_KM, extractProvince, type Taxonomy } from '../services/search.js';
import { ProviderError, type PlaceDetail, type PlaceProvider, type PlaceSummary, type ProviderInfo, type SearchResult } from './PlaceProvider.js';

/**
 * Adapter Google Places API (New) – CHỈ chạy ở server, key không bao giờ gửi ra trình duyệt.
 *
 * Tuân thủ điều khoản Google Maps Platform (kiểm tra lại bản mới nhất trước khi production):
 *  - Không lưu/caching nội dung Google (rating, review, giờ mở cửa…) vào database; mỗi request gọi trực tiếp.
 *  - Nội dung Places phải hiển thị kèm attribution và KHÔNG hiển thị trên bản đồ không phải Google
 *    → capabilities.requiresProviderMap = true, frontend sẽ ẩn bản đồ MapLibre khi dùng provider này.
 *  - Không dùng để tạo trang SEO → capabilities.indexable = false.
 *  - Field mask tối thiểu; các trường rating/giờ mở cửa thuộc SKU Enterprise (đắt hơn) – xem README.
 */
const API = 'https://places.googleapis.com/v1';
const SEARCH_FIELDS = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
  'places.primaryType',
  'places.rating',
  'places.userRatingCount',
  'places.googleMapsUri',
  'places.currentOpeningHours.openNow',
].join(',');
const DETAIL_FIELDS = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'primaryType',
  'rating',
  'userRatingCount',
  'googleMapsUri',
  'websiteUri',
  'nationalPhoneNumber',
  'regularOpeningHours.periods',
  'currentOpeningHours.openNow',
].join(',');

const INCLUDED_TYPE: Record<Category, string> = {
  food: 'restaurant',
  cafe: 'cafe',
  sight: 'tourist_attraction',
  fun: 'amusement_park',
};

const CATEGORY_BY_TYPE: [RegExp, Category][] = [
  [/cafe|coffee|tea_house/, 'cafe'],
  [/restaurant|food|bakery|meal|bar$|pub/, 'food'],
  [/amusement|zoo|aquarium|water_park|bowling|movie|night_club|park$/, 'fun'],
];

interface GPlace {
  id: string;
  displayName?: { text: string };
  formattedAddress?: string;
  location?: { latitude: number; longitude: number };
  primaryType?: string;
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  websiteUri?: string;
  nationalPhoneNumber?: string;
  currentOpeningHours?: { openNow?: boolean };
  regularOpeningHours?: { periods?: { open: { day: number; hour: number; minute: number }; close?: { day: number; hour: number; minute: number } }[] };
}

export interface GoogleProviderOptions {
  apiKey: string;
  provinces: () => Province[];
  taxonomy: () => Taxonomy;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

/** Rating làm mượt (Bayesian) – tránh điểm 5.0 từ vài đánh giá, không thưởng thêm cho số lượng lớn. */
export function smoothedRating(rating: number | undefined, count: number | undefined, prior = 4.0, weight = 20): number | null {
  if (rating == null || !count) return null;
  return (count / (count + weight)) * rating + (weight / (count + weight)) * prior;
}

const pad = (n: number) => String(n).padStart(2, '0');

export class GooglePlacesProvider implements PlaceProvider {
  readonly info: ProviderInfo = {
    id: 'google',
    label: 'Google Places',
    attribution: 'Dữ liệu địa điểm © Google',
    capabilities: { rating: true, openingHours: true, requiresProviderMap: true, indexable: false },
  };
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly opts: GoogleProviderOptions) {
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  private async call<T>(url: string, init: RequestInit, fieldMask: string): Promise<T> {
    let lastError = new ProviderError('Không kết nối được Google Places');
    // Tối đa 2 lần (1 lần retry) cho lỗi mạng/timeout/5xx – không retry vô hạn
    for (let attempt = 0; attempt < 2; attempt++) {
      let res: Response;
      try {
        res = await this.fetchImpl(url, {
          ...init,
          headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': this.opts.apiKey, 'X-Goog-FieldMask': fieldMask },
          signal: AbortSignal.timeout(this.opts.timeoutMs ?? 8000),
        });
      } catch {
        continue;
      }
      if (res.status >= 500) {
        lastError = new ProviderError(`Google Places lỗi ${res.status}`);
        continue;
      }
      if (res.status === 404) throw new ProviderError('Không tìm thấy địa điểm', 404);
      if (!res.ok) throw new ProviderError(`Google Places từ chối yêu cầu (${res.status})`);
      return (await res.json()) as T;
    }
    throw lastError;
  }

  private categoryOf(type?: string): Category {
    for (const [re, c] of CATEGORY_BY_TYPE) if (type && re.test(type)) return c;
    return 'sight';
  }

  private toSummary(g: GPlace, index: number, matched: boolean): PlaceSummary {
    const smooth = smoothedRating(g.rating, g.userRatingCount);
    const openStatus: OpenStatus = g.currentOpeningHours?.openNow == null ? 'unknown' : g.currentOpeningHours.openNow ? 'open' : 'closed';
    return {
      id: `g-${g.id}`,
      slug: `g-${g.id}`,
      name: g.displayName?.text ?? 'Không rõ tên',
      category: this.categoryOf(g.primaryType),
      provinceSlug: null,
      area: null,
      address: g.formattedAddress ?? null,
      latitude: g.location?.latitude ?? null,
      longitude: g.location?.longitude ?? null,
      tags: [],
      mustTry: null,
      priceMin: null,
      priceMax: null,
      priceLevel: null,
      photo: null,
      rating: g.rating ?? null,
      ratingCount: g.userRatingCount ?? null,
      openStatus,
      verificationStatus: 'unverified',
      isDemo: false,
      editorPick: false,
      googleMapsUrl: g.googleMapsUri ?? `https://www.google.com/maps/search/?api=1&query=Google&query_place_id=${encodeURIComponent(g.id)}`,
      source: 'google',
      // Thứ tự liên quan của Google + rating đã làm mượt
      score: Math.round((Math.max(0, 3 - index * 0.1) + (smooth ?? 0) / 2) * 100) / 100,
      reasons: matched ? ['Khớp tìm kiếm'] : [],
    };
  }

  async search(query: SearchQuery): Promise<SearchResult> {
    const provinces = this.opts.provinces();
    const taxonomy = this.opts.taxonomy();
    const { province: fromQ, rest } = query.q ? extractProvince(query.q, provinces) : { province: undefined, rest: '' };
    const province = provinces.find((p) => p.slug === (query.province ?? fromQ));
    const category = query.category?.length === 1 ? query.category[0] : undefined;
    const catLabel = category ? taxonomy.categories.find((c) => c.id === category)?.label : 'địa điểm';
    const textQuery = [query.q ? query.q : catLabel, province && !fromQ ? province.name : '', 'Việt Nam'].filter(Boolean).join(' ');

    const body: Record<string, unknown> = { textQuery, languageCode: 'vi', regionCode: 'VN', pageSize: Math.min(query.limit, 20) };
    if (category) body.includedType = INCLUDED_TYPE[category];
    if (query.openNow) body.openNow = true;
    const center = query.near ? coarsen(query.near.lat, query.near.lng) : province?.centerLatitude != null ? { lat: province.centerLatitude, lng: province.centerLongitude! } : undefined;
    if (center) {
      const radiusM = Math.min(50_000, (query.near ? (query.radius ?? DEFAULT_RADIUS_KM) : 30) * 1000);
      body.locationBias = { circle: { center: { latitude: center.lat, longitude: center.lng }, radius: radiusM } };
    }

    const data = await this.call<{ places?: GPlace[] }>(`${API}/places:searchText`, { method: 'POST', body: JSON.stringify(body) }, SEARCH_FIELDS);
    let items = (data.places ?? []).map((g, i) => this.toSummary(g, i, !!rest));
    if (query.sort === 'rating') items = items.sort((a, b) => (smoothedRating(b.rating ?? undefined, b.ratingCount ?? undefined) ?? 0) - (smoothedRating(a.rating ?? undefined, a.ratingCount ?? undefined) ?? 0));
    return { items, total: items.length, page: 1, pageSize: items.length, facets: { hasPriceData: false, hasOpeningHours: true, hasRating: true } };
  }

  async getBySlug(slug: string): Promise<PlaceDetail | null> {
    if (!slug.startsWith('g-')) return null;
    const id = slug.slice(2);
    if (!/^[A-Za-z0-9_-]{10,300}$/.test(id)) return null;
    try {
      const g = await this.call<GPlace>(`${API}/places/${id}?languageCode=vi&regionCode=VN`, { method: 'GET' }, DETAIL_FIELDS);
      const periods =
        g.regularOpeningHours?.periods
          ?.filter((p) => p.close)
          .map((p) => ({ day: p.open.day, open: `${pad(p.open.hour)}:${pad(p.open.minute)}`, close: `${pad(p.close!.hour)}:${pad(p.close!.minute)}` })) ?? [];
      return {
        ...this.toSummary(g, 0, false),
        description: null,
        website: g.websiteUri ?? null,
        phone: g.nationalPhoneNumber ?? null,
        openingHours: periods.length ? { periods, verifiedAt: new Date().toISOString() } : null,
        providerRefs: [{ provider: 'google', providerPlaceId: g.id }],
        updatedAt: null,
      };
    } catch (e) {
      if (e instanceof ProviderError && e.status === 404) return null;
      throw e;
    }
  }

  async countByProvince() {
    return {};
  }
}
