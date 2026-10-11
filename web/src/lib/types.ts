// Kiểu dữ liệu khớp với API backend (be/src/providers/PlaceProvider.ts)

export type Category = 'food' | 'cafe' | 'sight' | 'fun';
export type OpenStatus = 'open' | 'closed' | 'unknown';
export type VerificationStatus = 'unverified' | 'coordinates_checked' | 'verified';
export type SortMode = 'relevance' | 'distance' | 'rating';

export interface ProviderInfo {
  id: 'local' | 'google';
  label: string;
  attribution: string;
  attributionUrl?: string;
  capabilities: { rating: boolean; openingHours: boolean; requiresProviderMap: boolean; indexable: boolean };
}

export interface PlaceSummary {
  id: string;
  slug: string;
  name: string;
  category: Category;
  provinceSlug: string | null;
  area: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  tags: string[];
  mustTry: string | null;
  priceMin: number | null;
  priceMax: number | null;
  /** Mức giá ước tính 0–4 (0 miễn phí · 1 <100k · 2 100–300k · 3 300–700k · 4 >700k / người). */
  priceLevel: number | null;
  photo: Photo | null;
  rating: number | null;
  ratingCount: number | null;
  openStatus: OpenStatus;
  verificationStatus: VerificationStatus;
  isDemo: boolean;
  editorPick: boolean;
  googleMapsUrl: string;
  source: 'local' | 'google';
  score: number;
  reasons: string[];
  /** Chỉ có ở client khi user đã chia sẻ vị trí. */
  distanceKm?: number;
}

export interface PlaceDetail extends PlaceSummary {
  description: string | null;
  website: string | null;
  phone: string | null;
  openingHours: { periods: { day: number; open: string; close: string }[]; verifiedAt: string } | null;
  providerRefs: { provider: string; providerPlaceId: string; label?: string | null }[];
  updatedAt: string | null;
}

export interface SearchResponse {
  items: PlaceSummary[];
  total: number;
  page: number;
  pageSize: number;
  facets: { hasPriceData: boolean; hasOpeningHours: boolean; hasRating: boolean };
  provider: ProviderInfo;
}

export interface Province {
  code: string;
  slug: string;
  name: string;
  type: 'city' | 'province';
  centerLatitude: number | null;
  centerLongitude: number | null;
  placeCount: number;
  byCategory: Partial<Record<Category, number>>;
  coverPhoto: Photo | null;
}

export interface Meta {
  categories: { id: Category; label: string; icon: string }[];
  tags: Record<string, string>;
  provider: ProviderInfo;
  googleSearchAvailable: boolean;
  cheapMaxVnd: number;
  defaultRadiusKm: number;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export type Intent = 'travel' | 'date' | 'food' | 'cafe' | 'family';

export interface PlanStop {
  order: number;
  slotKey: string;
  slotLabel: string;
  day?: number;
  place: PlaceSummary;
  distanceKm: number;
  legKm: number;
  reasons: string[];
  tip?: string;
}

export interface PlanResult {
  intent: Intent;
  title: string;
  anchor: { lat: number; lng: number; label: string; precision: 'coarse' | 'exact' | 'province' };
  radiusKm: number | null;
  stops: PlanStop[];
  alternatives: Record<string, PlaceSummary[]>;
  more: (PlaceSummary & { distanceKm: number })[];
  notes: string[];
  showRoute: boolean;
}

export interface LocationSuggestion {
  type: 'province' | 'area' | 'place';
  label: string;
  sublabel: string;
  lat: number;
  lng: number;
  provinceSlug: string;
}

export interface Photo {
  url: string;
  pageUrl: string;
  author: string;
  authorUrl?: string | null;
  authorAvatarUrl?: string | null;
  license: string;
  licenseUrl?: string | null;
  /** place = ảnh của chính địa điểm; topic = ảnh món ăn/chủ đề minh họa. */
  match?: 'place' | 'topic';
  source?: string;
}
