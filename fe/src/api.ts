import type { Meta, Place } from './types';

async function get<T>(path: string, params: Record<string, string | number | undefined> = {}): Promise<T> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') qs.set(k, String(v));
  const res = await fetch(`/api${path}${qs.size ? `?${qs}` : ''}`);
  const body = await res.json();
  if (!res.ok) throw new Error(body.error ?? res.statusText);
  return body as T;
}

export const api = {
  meta: () => get<Meta>('/meta'),
  places: (params: Record<string, string | number | undefined>) => get<{ total: number; items: Place[] }>('/places', params),
  random: (params: Record<string, string | number | undefined>) => get<Place>('/random', params),
};

/** Deep link chỉ đường (miễn phí, mở app Google Maps trên điện thoại). */
export function directionsUrl(p: Place) {
  return `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=two-wheeler`;
}

/** Mở Google Maps tìm theo tên + địa chỉ để so sánh vị trí trên bản đồ của mình. */
export function googleSearchUrl(p: Place) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${p.name}, ${p.address}, Hà Nội`)}`;
}

export function osmUrl(p: Place) {
  return p.osm ? `https://www.openstreetmap.org/${p.osm.type}/${p.osm.id}` : `https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=19/${p.lat}/${p.lng}`;
}

export const PRICE_LABEL: Record<number, string> = { 1: '< 50k/người', 2: '50–150k/người', 3: '> 150k/người' };

export function formatDistance(km?: number) {
  if (km == null) return '';
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`;
}
