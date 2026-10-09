import type { PlaceRecord, Province } from '../domain/schemas.js';
import { normalize } from '../lib/text.js';

export interface LocationSuggestion {
  type: 'province' | 'area' | 'place';
  label: string;
  sublabel: string;
  lat: number;
  lng: number;
  provinceSlug: string;
}

/**
 * Gợi ý điểm xuất phát cho ô "Nhập địa điểm": tỉnh/thành, khu vực (vd. "Phố cổ", "Hồ Tây")
 * và địa điểm đã có. Không gọi dịch vụ geocoding bên ngoài.
 */
export function suggestLocations(q: string, records: PlaceRecord[], provinces: Province[], limit = 8): LocationSuggestion[] {
  const nq = normalize(q);
  if (nq.length < 1) return [];
  const published = records.filter((p) => p.publicationStatus === 'published');
  const provinceName = (slug: string) => provinces.find((p) => p.slug === slug)?.name ?? '';
  const out: (LocationSuggestion & { rank: number })[] = [];
  const rankOf = (text: string) => {
    const n = normalize(text);
    if (n === nq) return 0;
    if (n.startsWith(nq)) return 1;
    if (n.includes(` ${nq}`)) return 2;
    return n.includes(nq) ? 3 : -1;
  };

  for (const p of provinces) {
    const r = rankOf(p.name);
    if (r >= 0 && p.centerLatitude != null) {
      out.push({ type: 'province', label: p.name, sublabel: p.type === 'city' ? 'Thành phố' : 'Tỉnh', lat: p.centerLatitude, lng: p.centerLongitude!, provinceSlug: p.slug, rank: r });
    }
  }

  // Khu vực = nhóm địa điểm cùng "area" trong 1 tỉnh, lấy tâm trung bình
  const areas = new Map<string, { area: string; provinceSlug: string; lat: number; lng: number; n: number }>();
  for (const p of published) {
    if (!p.area) continue;
    const key = `${p.provinceSlug}|${p.area}`;
    const a = areas.get(key) ?? { area: p.area, provinceSlug: p.provinceSlug, lat: 0, lng: 0, n: 0 };
    a.lat += p.latitude;
    a.lng += p.longitude;
    a.n++;
    areas.set(key, a);
  }
  for (const a of areas.values()) {
    const r = rankOf(a.area);
    if (r >= 0) out.push({ type: 'area', label: a.area, sublabel: `Khu vực · ${provinceName(a.provinceSlug)}`, lat: a.lat / a.n, lng: a.lng / a.n, provinceSlug: a.provinceSlug, rank: r + 0.5 });
  }

  for (const p of published) {
    const r = rankOf(p.name);
    if (r >= 0) out.push({ type: 'place', label: p.name, sublabel: [p.area, provinceName(p.provinceSlug)].filter(Boolean).join(' · '), lat: p.latitude, lng: p.longitude, provinceSlug: p.provinceSlug, rank: r + 1 });
  }

  return out
    .sort((a, b) => a.rank - b.rank || a.label.localeCompare(b.label, 'vi'))
    .slice(0, limit)
    .map(({ rank: _rank, ...s }) => s);
}
