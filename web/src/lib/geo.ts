import type { LatLng, PlaceSummary, SortMode } from './types';

const toRad = (d: number) => (d * Math.PI) / 180;

export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Làm tròn ~1 km trước khi gửi lên server – vị trí chính xác chỉ ở lại trên máy người dùng. */
export function coarse(loc: LatLng): string {
  return `${loc.lat.toFixed(2)},${loc.lng.toFixed(2)}`;
}

export function formatDistance(km: number): string {
  if (km < 1) return `${Math.max(10, Math.round((km * 1000) / 10) * 10)} m`;
  return `${km.toFixed(km < 10 ? 1 : 0).replace('.', ',')} km`;
}

export const NEAR_YOU_KM = 1;

/**
 * Áp vị trí chính xác của user (chỉ ở client): tính khoảng cách, lọc đúng bán kính
 * (server chỉ lọc thô theo tọa độ đã làm tròn), thêm nhãn "Gần bạn", sắp xếp nếu cần.
 */
export function applyUserLocation(items: PlaceSummary[], loc: LatLng | null, radiusKm: number | null, sort: SortMode): PlaceSummary[] {
  if (!loc) return items.map((p) => ({ ...p, distanceKm: undefined }));
  const withDist = items.map((p) => {
    if (p.latitude == null || p.longitude == null) return { ...p, distanceKm: undefined };
    const d = haversineKm(loc, { lat: p.latitude, lng: p.longitude });
    const reasons = d <= NEAR_YOU_KM && !p.reasons.includes('Gần bạn') ? ['Gần bạn', ...p.reasons] : p.reasons;
    return { ...p, distanceKm: d, reasons };
  });
  const filtered = radiusKm ? withDist.filter((p) => p.distanceKm == null || p.distanceKm <= radiusKm) : withDist;
  if (sort === 'distance') return [...filtered].sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  return filtered;
}
