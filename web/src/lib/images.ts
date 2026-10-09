import type { PlaceSummary } from './types';

/**
 * Ảnh minh họa (SVG tự vẽ trong public/illustrations) – dùng khi chưa có ảnh thật được phép sử dụng.
 * Luôn hiển thị nhãn "Ảnh minh họa" để không gây hiểu nhầm.
 */
export type Illustration =
  | 'lake' | 'temple' | 'beach' | 'karst' | 'lanterns' | 'bridge' | 'museum' | 'funpark' | 'market'
  | 'pho' | 'coffee' | 'streetfood' | 'date' | 'park' | 'mountain' | 'cityview' | 'dessert';

// Thứ tự ưu tiên: thẻ đặc trưng nhất trước
const BY_TAG: [string, Illustration][] = [
  ['di-san', 'lanterns'], ['lang-co', 'lanterns'], ['thuyen', 'karst'], ['hang-dong', 'karst'], ['bien', 'beach'],
  ['nui', 'mountain'], ['giai-tri', 'funpark'], ['bao-tang', 'museum'], ['cho', 'market'], ['mua-sam', 'market'],
  ['che', 'dessert'], ['kem', 'dessert'], ['bia', 'streetfood'], ['an-vat', 'streetfood'], ['khu-am-thuc', 'streetfood'],
  ['ho', 'lake'], ['tam-linh', 'temple'], ['lich-su', 'temple'], ['cong-vien', 'park'], ['thien-nhien', 'park'],
  ['lang-nghe', 'market'], ['view-dep', 'cityview'], ['pho-di-bo', 'lanterns'], ['van-hoa', 'temple'],
];

export function illustrationFor(p: Pick<PlaceSummary, 'name' | 'category' | 'tags'>): Illustration {
  if (p.category === 'cafe') return 'coffee';
  if (/^cầu\s/i.test(p.name)) return 'bridge';
  if (p.category === 'food') return BY_TAG.find(([t, i]) => p.tags.includes(t) && ['dessert', 'streetfood', 'market'].includes(i))?.[1] ?? 'pho';
  const hit = BY_TAG.find(([t]) => p.tags.includes(t));
  if (hit) return hit[1];
  if (p.tags.includes('kien-truc')) return 'museum';
  return p.category === 'fun' ? 'funpark' : 'temple';
}

/** Lệch màu nhẹ theo slug để các ảnh cùng chủ đề không giống hệt nhau. */
export function hueFor(seed: string): number {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return (Math.abs(h) % 25) - 12;
}

export const illustrationSrc = (name: Illustration) => `/illustrations/${name}.svg`;
