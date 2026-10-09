import { ApiError } from '@/lib/api';
import type { Category, VerificationStatus } from '@/lib/types';

export interface AdminPlaceRow {
  id: string;
  slug: string;
  name: string;
  category: Category;
  provinceSlug: string;
  publicationStatus: 'draft' | 'published';
  verificationStatus: VerificationStatus;
  isDemo: boolean;
  updatedAt: string;
}

export interface AdminPlace extends AdminPlaceRow {
  description: string | null;
  mustTry: string | null;
  area: string | null;
  address: string | null;
  latitude: number;
  longitude: number;
  priceMin: number | null;
  priceMax: number | null;
  tags: string[];
  openingHours: { periods: { day: number; open: string; close: string }[]; verifiedAt: string } | null;
  website: string | null;
  phone: string | null;
  editorPick: boolean;
  providerRefs: { provider: 'osm' | 'google'; providerPlaceId: string; label?: string | null }[];
}

export type AdminPlaceInput = Omit<AdminPlace, 'id' | 'updatedAt' | 'slug'> & { slug?: string };

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api/admin${path}`, {
    ...init,
    credentials: 'same-origin',
    // Header bắt buộc cho mọi request ghi (chống CSRF) – backend kiểm tra
    headers: { 'Content-Type': 'application/json', 'x-ddvn-admin': '1', ...init.headers },
  });
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(body.message ?? `Lỗi ${res.status}`, res.status, body.issues);
  return body as T;
}

export const adminApi = {
  session: () => call<{ enabled: boolean; authenticated: boolean }>('/session'),
  login: (password: string) => call<{ authenticated: boolean }>('/session', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => call<{ authenticated: boolean }>('/session', { method: 'DELETE' }),
  list: () => call<{ items: AdminPlaceRow[] }>('/places').then((r) => r.items),
  get: (id: string) => call<{ place: AdminPlace }>(`/places/${encodeURIComponent(id)}`).then((r) => r.place),
  create: (input: AdminPlaceInput) => call<{ place: AdminPlace }>('/places', { method: 'POST', body: JSON.stringify(input) }).then((r) => r.place),
  update: (id: string, input: AdminPlaceInput) =>
    call<{ place: AdminPlace }>(`/places/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(input) }).then((r) => r.place),
  remove: (id: string) => call<void>(`/places/${encodeURIComponent(id)}`, { method: 'DELETE' }),
};
