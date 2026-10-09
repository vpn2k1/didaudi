const R = 6371;
const toRad = (d: number) => (d * Math.PI) / 180;

/** Khoảng cách đường chim bay giữa 2 điểm (km). */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/**
 * Làm tròn tọa độ user còn 2 chữ số thập phân (~1,1 km) trước khi dùng ở server,
 * để server không xử lý vị trí chính xác. Sai số tối đa ~0,8 km.
 */
export const COARSE_PRECISION_KM = 0.8;
export function coarsen(lat: number, lng: number) {
  return { lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100 };
}
