import type { Category, SearchQuery } from '../domain/schemas.js';
import type { PlaceRepository } from '../repositories/placeRepository.js';
import { searchPlaces, toDetail, type SearchContext } from '../services/search.js';
import type { PlaceProvider, ProviderInfo } from './PlaceProvider.js';

/**
 * Provider dùng dữ liệu nội bộ (đội ngũ tự biên tập, quản lý qua trang admin).
 * Ở local/dev nó chạy với dữ liệu minh họa trong data/places.json nên không cần API key
 * – đây là "MockPlaceProvider" theo đặc tả.
 */
export class LocalPlaceProvider implements PlaceProvider {
  readonly info: ProviderInfo = {
    id: 'local',
    label: 'Dữ liệu nội bộ',
    attribution: 'Nội dung do Đi Đâu Việt Nam biên tập · Tọa độ đối chiếu © OpenStreetMap contributors',
    attributionUrl: 'https://www.openstreetmap.org/copyright',
    capabilities: { rating: false, openingHours: true, requiresProviderMap: false, indexable: true },
  };

  constructor(
    private readonly repo: PlaceRepository,
    private readonly ctx: () => SearchContext,
  ) {}

  async search(query: SearchQuery) {
    return searchPlaces(await this.repo.list(), query, this.ctx());
  }

  async getBySlug(slug: string) {
    const p = await this.repo.findBySlug(slug);
    if (!p || p.publicationStatus !== 'published') return null;
    return toDetail(p, this.ctx());
  }

  async countByProvince() {
    const counts: Record<string, Partial<Record<Category, number>>> = {};
    for (const p of await this.repo.list()) {
      if (p.publicationStatus !== 'published') continue;
      const c = (counts[p.provinceSlug] ??= {});
      c[p.category] = (c[p.category] ?? 0) + 1;
    }
    return counts;
  }
}

