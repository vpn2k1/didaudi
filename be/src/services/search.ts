import type { Category, Photo, PlaceRecord, Province, SearchQuery } from '../domain/schemas.js';
import { coarsen, COARSE_PRECISION_KM, haversineKm } from '../lib/geo.js';
import { isHoursFresh, openStatus } from '../lib/hours.js';
import { normalize } from '../lib/text.js';
import type { PlaceDetail, PlaceSummary, SearchResult } from '../providers/PlaceProvider.js';

export const DEFAULT_RADIUS_KM = 5;
/** Ngưỡng "Giá rẻ": giá tối đa mỗi người ≤ 60.000đ. */
export const CHEAP_MAX_VND = 60_000;

/** Giá rẻ: có giá chính xác ≤ 60k, hoặc mức giá ước tính ≤ 1 (< 100k/người). */
export function isCheap(p: Pick<PlaceRecord, 'priceMax' | 'priceLevel'>): boolean {
  if (p.priceMax != null) return p.priceMax <= CHEAP_MAX_VND;
  return p.priceLevel != null && p.priceLevel <= 1;
}

export interface Taxonomy {
  categories: { id: Category; label: string; icon: string }[];
  tags: Record<string, string>;
}

export interface SearchContext {
  provinces: Province[];
  taxonomy: Taxonomy;
  photos?: Record<string, Photo>;
  now?: Date;
}

/**
 * Nếu từ khóa chứa tên tỉnh/thành ("phở đà nẵng") thì tách ra thành bộ lọc tỉnh.
 */
export function extractProvince(q: string, provinces: Province[]): { province?: string; rest: string } {
  const nq = ` ${normalize(q)} `;
  // Ưu tiên tên dài trước để "tp ho chi minh" không bị khớp nhầm
  const sorted = [...provinces].sort((a, b) => b.name.length - a.name.length);
  for (const p of sorted) {
    const names = [normalize(p.name), normalize(p.name.replace(/^TP\.\s*/, ''))];
    for (const n of names) {
      if (nq.includes(` ${n} `)) return { province: p.slug, rest: nq.replace(` ${n} `, ' ').trim() };
    }
  }
  return { rest: normalize(q) };
}

function textScore(p: PlaceRecord, tokens: string[], phrase: string, ctx: SearchContext, rawTokens: string[]): number {
  if (!tokens.length) return 0;
  const name = normalize(p.name);
  const accentedName = p.name.toLowerCase();
  const tagWords = new Set(p.tags.flatMap((t) => [t, ...normalize(ctx.taxonomy.tags[t] ?? '').split(' ')]));
  const label = normalize(
    [ctx.taxonomy.categories.find((c) => c.id === p.category)?.label ?? '', ...p.tags.map((t) => ctx.taxonomy.tags[t] ?? t), p.mustTry ?? ''].join(' '),
  );
  const other = normalize([p.address, p.area, p.description].filter(Boolean).join(' '));
  let score = name.includes(phrase) ? 3 : 0;
  // Gõ không dấu dễ nhập nhằng ("pho" = phở/phố): ưu tiên khớp đúng thẻ và khớp đúng dấu
  for (const t of tokens) if (tagWords.has(t)) score += 1.5;
  for (const t of rawTokens) if (/[^\x00-\x7f]/.test(t) && accentedName.includes(t)) score += 1;
  for (const t of tokens) {
    if (name.includes(t)) score += 1;
    else if (label.includes(t)) score += 0.8;
    else if (other.includes(t)) score += 0.4;
    else return -1; // mọi từ khóa đều phải khớp ở đâu đó
  }
  return score;
}

export function googleMapsUrl(p: Pick<PlaceRecord, 'name' | 'address' | 'latitude' | 'longitude' | 'providerRefs'>, provinceName?: string) {
  const gid = p.providerRefs.find((r) => r.provider === 'google')?.providerPlaceId;
  const query = encodeURIComponent([p.name, p.address, provinceName].filter(Boolean).join(', '));
  return `https://www.google.com/maps/search/?api=1&query=${query}${gid ? `&query_place_id=${encodeURIComponent(gid)}` : ''}`;
}

function photoOf(ph: Photo | undefined): PlaceSummary['photo'] {
  if (!ph) return null;
  return { url: ph.thumbUrl, pageUrl: ph.pageUrl, author: ph.author, license: ph.license, licenseUrl: ph.licenseUrl ?? null, match: ph.match, source: ph.source };
}

export function toSummary(p: PlaceRecord, ctx: SearchContext, score = 0, reasons: string[] = []): PlaceSummary {
  const province = ctx.provinces.find((x) => x.slug === p.provinceSlug);
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    category: p.category,
    provinceSlug: p.provinceSlug,
    area: p.area ?? null,
    address: p.address ?? null,
    latitude: p.latitude,
    longitude: p.longitude,
    tags: p.tags,
    mustTry: p.mustTry ?? null,
    priceMin: p.priceMin ?? null,
    priceMax: p.priceMax ?? null,
    priceLevel: p.priceLevel ?? null,
    photo: photoOf(ctx.photos?.[p.id]),
    rating: null,
    ratingCount: null,
    openStatus: openStatus(p.openingHours, ctx.now),
    verificationStatus: p.verificationStatus,
    isDemo: p.isDemo,
    editorPick: p.editorPick,
    googleMapsUrl: googleMapsUrl(p, province?.name),
    source: 'local',
    score: Math.round(score * 100) / 100,
    reasons,
  };
}

export function toDetail(p: PlaceRecord, ctx: SearchContext): PlaceDetail {
  return {
    ...toSummary(p, ctx),
    description: p.description ?? null,
    website: p.website ?? null,
    phone: p.phone ?? null,
    // Chỉ trả giờ mở cửa còn "mới"; dữ liệu cũ bị ẩn để không gây hiểu nhầm
    openingHours: isHoursFresh(p.openingHours, ctx.now) ? p.openingHours : null,
    providerRefs: p.providerRefs,
    updatedAt: p.updatedAt,
  };
}

/** Tìm kiếm + lọc + xếp hạng trên dữ liệu nội bộ. */
export function searchPlaces(records: PlaceRecord[], query: SearchQuery, ctx: SearchContext): SearchResult {
  let province = query.province;
  let phrase = '';
  if (query.q) {
    const extracted = extractProvince(query.q, ctx.provinces);
    province ??= extracted.province;
    phrase = extracted.rest;
  }
  const tokens = phrase.split(' ').filter((t) => t.length > 0);
  const rawTokens = (query.q ?? '').toLowerCase().split(/\s+/).filter(Boolean);
  const near = query.near ? coarsen(query.near.lat, query.near.lng) : undefined;
  const radius = query.radius ?? DEFAULT_RADIUS_KM;

  // Phạm vi (tỉnh + danh mục) dùng để quyết định bật bộ lọc nào
  const scoped = records.filter(
    (p) => p.publicationStatus === 'published' && (!province || p.provinceSlug === province) && (!query.category || query.category.includes(p.category)),
  );
  const facets = {
    hasPriceData: scoped.some((p) => p.priceMax != null || p.priceLevel != null),
    hasOpeningHours: scoped.some((p) => isHoursFresh(p.openingHours, ctx.now)),
    hasRating: false,
  };

  const scored: { p: PlaceRecord; score: number; reasons: string[]; dist?: number }[] = [];
  for (const p of scoped) {
    if (query.tags && !p.tags.some((t) => query.tags!.includes(t))) continue;
    if (query.price === 'cheap' && !isCheap(p)) continue;
    if (query.openNow && openStatus(p.openingHours, ctx.now) !== 'open') continue;

    const ts = textScore(p, tokens, phrase, ctx, rawTokens);
    if (ts < 0) continue;
    const reasons: string[] = [];
    let score = ts;
    if (ts > 0) reasons.push('Khớp tìm kiếm');

    let dist: number | undefined;
    if (near) {
      dist = haversineKm(near.lat, near.lng, p.latitude, p.longitude);
      if (dist > radius + COARSE_PRECISION_KM) continue;
      score += 2 * Math.max(0, 1 - dist / (radius + COARSE_PRECISION_KM));
    }
    if (p.verificationStatus === 'verified') score += 1;
    else if (p.verificationStatus === 'coordinates_checked') score += 0.5;
    if (p.editorPick) {
      score += 0.5;
      reasons.push('Được biên tập chọn');
    }
    scored.push({ p, score, reasons, dist });
  }

  if (query.sort === 'distance' && near) scored.sort((a, b) => (a.dist ?? 0) - (b.dist ?? 0));
  else scored.sort((a, b) => b.score - a.score || a.p.name.localeCompare(b.p.name, 'vi'));

  const start = (query.page - 1) * query.limit;
  return {
    items: scored.slice(start, start + query.limit).map((s) => toSummary(s.p, ctx, s.score, s.reasons)),
    total: scored.length,
    page: query.page,
    pageSize: query.limit,
    facets,
  };
}
