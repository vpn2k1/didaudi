import type { LocationSuggestion, Meta, Photo, PlaceDetail, PlanResult, Province, ProviderInfo, SearchResponse } from './types';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly issues?: { path: (string | number)[]; message: string }[],
  ) {
    super(message);
  }
}

export type SearchParams = Record<string, string | number | undefined | null>;

export function toQuery(params: SearchParams): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
  const s = qs.toString();
  return s ? `?${s}` : '';
}

async function parse<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.message ?? `Lỗi ${res.status}`, res.status, body.issues);
  return body as T;
}

/** Gọi API từ trình duyệt (qua rewrite /api của Next.js → backend). */
export const clientApi = {
  search: (params: SearchParams, signal?: AbortSignal) => fetch(`/api/places/search${toQuery(params)}`, { signal }).then(parse<SearchResponse>),
  googleSearch: (params: SearchParams, signal?: AbortSignal) => fetch(`/api/google/places/search${toQuery(params)}`, { signal, cache: 'no-store' }).then(parse<SearchResponse>),
  plan: (params: SearchParams, signal?: AbortSignal) => fetch(`/api/plan${toQuery(params)}`, { signal }).then(parse<{ plan: PlanResult; provider: ProviderInfo }>),
  suggest: (q: string, signal?: AbortSignal) => fetch(`/api/suggest${toQuery({ q })}`, { signal }).then(parse<{ items: LocationSuggestion[] }>),
};

/** Gọi API từ server component. */
export function serverApi(base: string) {
  const get = <T>(path: string, init?: RequestInit) => fetch(`${base}/api${path}`, init).then(parse<T>);
  return {
    meta: () => get<Meta>('/meta', { next: { revalidate: 300 } }),
    provinces: () => get<{ items: Province[] }>('/provinces', { next: { revalidate: 300 } }).then((r) => r.items),
    province: (slug: string) => get<Province>(`/provinces/${encodeURIComponent(slug)}`, { next: { revalidate: 300 } }),
    // Dữ liệu địa điểm không cache ở Next (provider bên ngoài có thể cấm caching)
    search: (params: SearchParams) => get<SearchResponse>(`/places/search${toQuery(params)}`, { cache: 'no-store' }),
    photos: (slugs: string[]) => get<{ photos: Record<string, Photo> }>(`/photos${toQuery({ slugs: slugs.join(',') })}`, { next: { revalidate: 300 } }).then((r) => r.photos),
    place: (slug: string) => get<{ place: PlaceDetail; provider: ProviderInfo }>(`/places/${encodeURIComponent(slug)}`, { cache: 'no-store' }),
  };
}
