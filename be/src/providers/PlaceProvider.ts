import type { Category, SearchQuery } from '../domain/schemas.js';
import type { OpenStatus } from '../lib/hours.js';

export interface ProviderInfo {
  id: 'local' | 'google';
  label: string;
  /** Dòng ghi nguồn bắt buộc hiển thị cùng dữ liệu. */
  attribution: string;
  attributionUrl?: string;
  capabilities: {
    rating: boolean;
    openingHours: boolean;
    /** Dữ liệu chỉ được hiển thị trên bản đồ của chính provider (vd. Google Maps Platform). */
    requiresProviderMap: boolean;
    /** Có được phép tạo trang SEO/index từ dữ liệu này không. */
    indexable: boolean;
  };
}

/** Dạng địa điểm trả cho UI – không phụ thuộc nguồn dữ liệu. */
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
  /** Mức giá ước tính 0–4 (xem priceLevelSchema). */
  priceLevel: number | null;
  /** Ảnh thật kèm ghi công; null = chưa có ảnh được phép dùng. */
  photo: { url: string; pageUrl: string; author: string; license: string; licenseUrl: string | null; match: 'place' | 'topic'; source: string } | null;
  rating: number | null;
  ratingCount: number | null;
  openStatus: OpenStatus;
  verificationStatus: 'unverified' | 'coordinates_checked' | 'verified';
  isDemo: boolean;
  editorPick: boolean;
  googleMapsUrl: string;
  source: 'local' | 'google';
  /** Điểm xếp hạng phía server (chưa gồm khoảng cách chính xác – client tự cộng). */
  score: number;
  /** Lý do gợi ý, dựa trên tiêu chí thực tế. */
  reasons: string[];
}

export interface PlaceDetail extends PlaceSummary {
  description: string | null;
  website: string | null;
  phone: string | null;
  openingHours: { periods: { day: number; open: string; close: string }[]; verifiedAt: string } | null;
  providerRefs: { provider: string; providerPlaceId: string; label?: string | null }[];
  updatedAt: string | null;
}

export interface SearchResult {
  items: PlaceSummary[];
  total: number;
  page: number;
  pageSize: number;
  /** Bộ lọc nào có dữ liệu để bật (không hiện chip khi không có dữ liệu). */
  facets: { hasPriceData: boolean; hasOpeningHours: boolean; hasRating: boolean };
}

export interface PlaceProvider {
  readonly info: ProviderInfo;
  search(query: SearchQuery): Promise<SearchResult>;
  getBySlug(slug: string): Promise<PlaceDetail | null>;
  /** Số địa điểm công khai theo tỉnh & danh mục – phục vụ trang tỉnh/thành, sitemap. */
  countByProvince(): Promise<Record<string, Partial<Record<Category, number>>>>;
}

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status = 502,
  ) {
    super(message);
  }
}
