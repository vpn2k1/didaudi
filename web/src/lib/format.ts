import type { OpenStatus, PlaceSummary, VerificationStatus } from './types';

const vnd = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 });

export function formatPriceRange(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return min === max ? vnd.format(min) : `${vnd.format(min)} – ${vnd.format(max)}`;
  return min != null ? `Từ ${vnd.format(min)}` : `Đến ${vnd.format(max!)}`;
}

export const OPEN_STATUS_LABEL: Record<OpenStatus, string | null> = {
  open: 'Đang mở cửa',
  closed: 'Đang đóng cửa',
  unknown: null, // không đủ dữ liệu → không hiển thị gì
};

export const VERIFICATION_LABEL: Record<VerificationStatus, { label: string; tone: 'ok' | 'info' | 'warn' }> = {
  verified: { label: 'Đã xác minh thực tế', tone: 'ok' },
  coordinates_checked: { label: 'Tọa độ đã đối chiếu OpenStreetMap', tone: 'info' },
  unverified: { label: 'Chưa xác minh vị trí', tone: 'warn' },
};

export const WEEKDAYS = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];

export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(iso));
}

/** Chỉ đường bằng Google Maps (deep link, miễn phí). */
export function directionsUrl(p: Pick<PlaceSummary, 'latitude' | 'longitude' | 'googleMapsUrl'>): string | null {
  if (p.latitude == null || p.longitude == null) return null;
  return `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}`;
}

/** Chỉ cho index trang địa điểm đã được xác minh và không phải dữ liệu minh họa. */
export function isIndexablePlace(p: Pick<PlaceSummary, 'isDemo' | 'verificationStatus' | 'source'>): boolean {
  return p.source === 'local' && !p.isDemo && p.verificationStatus === 'verified';
}

const PRICE_LEVEL_LABEL = ['Miễn phí', 'Dưới 100k', '100k – 300k', '300k – 700k', 'Trên 700k'];

/** Mức giá ước tính (chưa phải giá chính xác) – luôn hiển thị kèm chữ "ước tính". */
export function formatPriceLevel(level: number | null | undefined): string | null {
  if (level == null) return null;
  return PRICE_LEVEL_LABEL[level] ?? null;
}
