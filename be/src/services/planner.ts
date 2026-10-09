import { z } from 'zod';
import type { Category, PlaceRecord } from '../domain/schemas.js';
import { coarsen, haversineKm } from '../lib/geo.js';
import type { PlaceSummary } from '../providers/PlaceProvider.js';
import { toSummary, type SearchContext } from './search.js';

/**
 * Gợi ý theo nhu cầu (du lịch, hẹn hò, ăn uống, cà phê, gia đình).
 * Thuật toán dựa trên luật, giải thích được: khớp nhu cầu + sở thích + thời điểm + ngân sách,
 * trừ điểm theo khoảng cách, nối các điểm theo kiểu "điểm gần nhất tiếp theo".
 */

export const INTENTS = ['travel', 'date', 'food', 'cafe', 'family'] as const;
export type Intent = (typeof INTENTS)[number];
export const TIMES = ['morning', 'afternoon', 'evening', 'night'] as const;
export type TimeOfDay = (typeof TIMES)[number];
export const DURATIONS = ['short', 'halfday', 'day', 'multiday'] as const;
export type Duration = (typeof DURATIONS)[number];
export const MEALS = ['breakfast', 'lunch', 'dinner', 'snack'] as const;

const coord = z
  .string()
  .regex(/^-?\d{1,3}(\.\d+)?,-?\d{1,3}(\.\d+)?$/)
  .transform((s) => {
    const [lat, lng] = s.split(',').map(Number) as [number, number];
    return { lat, lng };
  })
  .pipe(z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }));

const csv = z
  .string()
  .optional()
  .transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : []))
  .pipe(z.array(z.string().regex(/^[a-z0-9-]+$/)).max(12));

export const planQuerySchema = z
  .object({
    intent: z.enum(INTENTS),
    /** Vị trí GPS của người dùng – server làm tròn ~1 km. */
    near: coord.optional(),
    /** Điểm xuất phát công khai (địa điểm/khu vực người dùng chọn) – dùng tọa độ chính xác. */
    from: coord.optional(),
    fromLabel: z.string().trim().max(100).optional(),
    province: z
      .string()
      .regex(/^[a-z0-9-]{2,40}$/)
      .optional(),
    radius: z.coerce.number().min(0.5).max(300).optional(),
    /** Ngân sách: mức giá ước tính tối đa (0–4). */
    budget: z.coerce.number().int().min(0).max(4).optional(),
    time: z.enum(TIMES).optional(),
    duration: z.enum(DURATIONS).optional(),
    meal: z.enum(MEALS).optional(),
    prefs: csv,
  })
  .refine((q) => q.near || q.from || q.province, { message: 'Cần vị trí của bạn, điểm xuất phát hoặc tỉnh/thành', path: ['near'] });
export type PlanQuery = z.infer<typeof planQuerySchema>;

interface Slot {
  key: string;
  label: string;
  categories: Category[];
  /** Thẻ phù hợp với mục này (khớp càng nhiều càng tốt). */
  tags: string[];
  /** Bắt buộc phải khớp ít nhất 1 thẻ. */
  requireTag?: boolean;
  /** Không chọn địa điểm có các thẻ này. */
  excludeTags?: string[];
}

export interface PlanStop {
  order: number;
  slotKey: string;
  slotLabel: string;
  day?: number;
  place: PlaceSummary;
  /** Khoảng cách từ điểm xuất phát (km, xấp xỉ nếu dùng GPS đã làm tròn). */
  distanceKm: number;
  /** Quãng đường chim bay từ điểm trước (km). */
  legKm: number;
  reasons: string[];
  tip?: string;
}

export interface PlanResult {
  intent: Intent;
  title: string;
  anchor: { lat: number; lng: number; label: string; precision: 'coarse' | 'exact' | 'province' };
  radiusKm: number | null;
  stops: PlanStop[];
  /** Phương án thay thế cho từng mục. */
  alternatives: Record<string, PlaceSummary[]>;
  /** Các địa điểm phù hợp khác, sắp từ gần đến xa. */
  more: (PlaceSummary & { distanceKm: number })[];
  notes: string[];
  showRoute: boolean;
}

// ---------- Luật biên tập ----------

const PHOTO_TAGS = ['view-dep', 'song-ao', 'ho', 'bien', 'nui', 'kien-truc', 'di-san', 'lang-co', 'thien-nhien', 'thuyen', 'hang-dong', 'tam-linh', 'pho-di-bo', 'cong-vien'];
/** Điểm trong nhà/giờ hành chính – thường đóng cửa buổi tối. */
const DAYTIME_ONLY = ['bao-tang', 'lich-su', 'tam-linh', 'lang-nghe', 'hang-dong', 'thuyen'];
const NIGHT_FRIENDLY = ['an-vat', 'bia', 'khu-am-thuc', 'pho-di-bo', 'view-dep', 'kien-truc', 'ho', 'che', 'kem', 'nha-hang', 'cho'];

const MEAL_TAGS: Record<(typeof MEALS)[number], string[]> = {
  breakfast: ['pho', 'bun', 'banh-cuon', 'xoi', 'banh-mi', 'mien', 'mi-quang'],
  lunch: ['bun-cha', 'cha-ca', 'bun', 'mien', 'pho', 'bun-dau', 'nha-hang', 'banh-xeo', 'mi-quang'],
  dinner: ['nha-hang', 'cha-ca', 'bun-cha', 'bia', 'khu-am-thuc', 'an-vat', 'banh-xeo', 'mi-quang'],
  snack: ['an-vat', 'che', 'kem', 'banh-mi', 'xoi', 'bia'],
};

/** Sở thích người dùng chọn → các thẻ tương ứng. */
export const PREF_TAGS: Record<string, string[]> = {
  // du lịch
  'thien-nhien': ['thien-nhien', 'nui', 'thuyen', 'hang-dong', 'bien', 'ho', 'cong-vien'],
  'van-hoa': ['lich-su', 'van-hoa', 'di-san', 'bao-tang', 'lang-co', 'lang-nghe'],
  'tam-linh': ['tam-linh'],
  'song-ao': ['view-dep', 'song-ao', 'kien-truc', 'pho-di-bo', 'lang-co'],
  bien: ['bien'],
  'lang-co': ['lang-co', 'lang-nghe', 'di-san'],
  // hẹn hò
  'lang-man': ['view-ho', 'view-dep', 'ho', 'che', 'kem', 'ca-phe-co', 'nha-hang', 'bien'],
  'soi-dong': ['bia', 'an-vat', 'khu-am-thuc', 'pho-di-bo', 'giai-tri', 'cho'],
  'am-thuc': ['nha-hang', 'cha-ca', 'bun-cha', 'an-vat', 'che', 'pho'],
  // cà phê
  'view-dep': ['view-ho', 'view-dep'],
  'dac-san': ['ca-phe-trung'],
  'co-kinh': ['ca-phe-co'],
  'yen-tinh': ['ca-phe-co', 'view-ho'],
};

const TIPS: [string, string][] = [
  ['ho', 'Ánh sáng đẹp lúc bình minh và hoàng hôn, có mặt nước phản chiếu.'],
  ['bien', 'Chụp ngược sáng lúc sáng sớm; tránh nắng gắt giữa trưa.'],
  ['thuyen', 'Mang túi chống nước cho điện thoại/máy ảnh khi đi thuyền.'],
  ['nui', 'Đi sớm để tránh nắng gắt và đông người.'],
  ['lang-co', 'Đẹp nhất lúc lên đèn chiều tối; dạo các con hẻm nhỏ.'],
  ['di-san', 'Đi sớm để có khung hình vắng người.'],
  ['tam-linh', 'Ăn mặc kín đáo; hỏi trước khi chụp ở khu thờ tự.'],
  ['kien-truc', 'Chụp góc rộng từ xa để thấy toàn bộ công trình.'],
  ['bao-tang', 'Một số khu trong nhà có thể hạn chế chụp ảnh – xem biển báo.'],
  ['view-dep', 'Hoàng hôn và lúc lên đèn thường cho khung hình đẹp nhất.'],
];

function slotsFor(q: PlanQuery): { title: string; slots: Slot[]; route: boolean } {
  const dur = q.duration ?? 'halfday';
  const cafe: Slot = { key: 'cafe', label: 'Cà phê', categories: ['cafe'], tags: ['view-ho', 'ca-phe-trung', 'ca-phe-co'] };
  const dessert: Slot = { key: 'dessert', label: 'Tráng miệng / cà phê', categories: ['food', 'cafe'], tags: ['che', 'kem', 'view-ho', 'ca-phe-trung'], requireTag: true };
  const walk: Slot = { key: 'walk', label: 'Dạo bộ & ngắm cảnh', categories: ['sight', 'fun'], tags: ['ho', 'view-dep', 'pho-di-bo', 'kien-truc', 'cong-vien', 'bien'], requireTag: true };
  // Bữa ăn phải khớp món của bữa đó (không chọn quán chè làm bữa tối)
  const meal = (key: string, label: string, tags: string[]): Slot => ({ key, label, categories: ['food'], tags, requireTag: true, excludeTags: ['che', 'kem'] });
  const sight: Slot = { key: 'sight', label: 'Tham quan', categories: ['sight'], tags: ['lich-su', 'van-hoa', 'kien-truc', 'di-san', 'bao-tang'] };
  const photo: Slot = { key: 'photo', label: 'Chụp ảnh', categories: ['sight', 'fun'], tags: PHOTO_TAGS, requireTag: true };

  switch (q.intent) {
    case 'date': {
      if (dur === 'short') return { title: 'Hẹn hò ngắn', slots: q.time === 'evening' || q.time === 'night' ? [walk, dessert] : [cafe, walk], route: true };
      if (dur === 'day' || dur === 'multiday')
        return { title: 'Hẹn hò cả ngày', slots: [cafe, sight, meal('lunch', 'Ăn trưa', MEAL_TAGS.lunch), photo, meal('dinner', 'Ăn tối', MEAL_TAGS.dinner)], route: true };
      return q.time === 'morning' || q.time === 'afternoon'
        ? { title: 'Hẹn hò nửa ngày', slots: [cafe, photo, dessert], route: true }
        : { title: 'Hẹn hò buổi tối', slots: [meal('dinner', 'Ăn tối', MEAL_TAGS.dinner), walk, dessert], route: true };
    }
    case 'family':
      return {
        title: 'Đi chơi cùng gia đình',
        slots: [
          { key: 'play', label: 'Vui chơi', categories: ['fun', 'sight'], tags: ['giai-tri', 'gia-dinh', 'cong-vien', 'thien-nhien'], requireTag: true },
          meal('lunch', 'Ăn uống', [...MEAL_TAGS.lunch, 'kem', 'che']),
          { key: 'learn', label: 'Khám phá', categories: ['sight'], tags: ['bao-tang', 'ho', 'cong-vien', 'van-hoa', 'lang-nghe'] },
        ],
        route: true,
      };
    default:
      return { title: '', slots: [], route: q.intent === 'travel' };
  }
}

const DEFAULT_RADIUS: Record<Intent, number> = { travel: 50, date: 5, food: 3, cafe: 3, family: 15 };
const STOPS_BY_DURATION: Record<Duration, number> = { short: 2, halfday: 3, day: 5, multiday: 9 };

// ---------- Engine ----------

interface Candidate {
  p: PlaceRecord;
  dist: number;
  base: number;
  reasons: string[];
}

function timeFit(p: PlaceRecord, time?: TimeOfDay): number | null {
  if (!time) return 0;
  const evening = time === 'evening' || time === 'night';
  const nightOk = p.tags.some((t) => NIGHT_FRIENDLY.includes(t));
  // Điểm trong nhà/giờ hành chính thường đã đóng cửa; điểm ngoài trời (hồ, phố đi bộ…) vẫn giữ
  if (evening && p.category === 'sight' && !nightOk && p.tags.some((t) => DAYTIME_ONLY.includes(t))) return null;
  if (time === 'night' && p.category === 'sight' && !nightOk) return null;
  if (evening && nightOk) return 1;
  if (time === 'morning' && (p.category === 'cafe' || p.tags.some((t) => MEAL_TAGS.breakfast.includes(t)))) return 1;
  return 0;
}

const tagMatches = (p: PlaceRecord, tags: string[]) => p.tags.filter((t) => tags.includes(t)).length;

export function buildPlan(records: PlaceRecord[], q: PlanQuery, ctx: SearchContext): PlanResult {
  const province = q.province ? ctx.provinces.find((p) => p.slug === q.province) : undefined;
  if (q.province && !province) throw new PlanError('Không tìm thấy tỉnh/thành', 404);

  // Điểm xuất phát: điểm người dùng chọn > GPS (làm tròn) > trung tâm tỉnh
  let anchor: PlanResult['anchor'];
  if (q.from) anchor = { ...q.from, label: q.fromLabel || 'Điểm bạn chọn', precision: 'exact' };
  else if (q.near) anchor = { ...coarsen(q.near.lat, q.near.lng), label: 'Vị trí của bạn', precision: 'coarse' };
  else if (province?.centerLatitude != null) anchor = { lat: province.centerLatitude, lng: province.centerLongitude!, label: `Trung tâm ${province.name}`, precision: 'province' };
  else throw new PlanError('Tỉnh/thành này chưa có tọa độ trung tâm', 400);

  // Chọn tỉnh mà không có vị trí → tìm trong cả tỉnh, không giới hạn bán kính
  const radius = anchor.precision === 'province' && !q.radius ? null : (q.radius ?? DEFAULT_RADIUS[q.intent]);
  const prefTags = [...new Set(q.prefs.flatMap((p) => PREF_TAGS[p] ?? [p]))];
  // Lịch trình cả ngày trải qua nhiều buổi → không lọc theo một thời điểm
  const time = q.duration === 'day' || q.duration === 'multiday' ? undefined : q.time;
  const notes: string[] = [];

  const candidates: Candidate[] = [];
  let unknownPrice = 0;
  for (const p of records) {
    if (p.publicationStatus !== 'published') continue;
    if (province && anchor.precision === 'province' && p.provinceSlug !== province.slug) continue;
    const dist = haversineKm(anchor.lat, anchor.lng, p.latitude, p.longitude);
    if (radius != null && dist > radius + (anchor.precision === 'coarse' ? 0.8 : 0)) continue;
    const tf = timeFit(p, time);
    if (tf == null) continue;
    if (q.budget != null && p.priceLevel != null && p.priceLevel > q.budget) continue;

    const reasons: string[] = [];
    let base = 0;
    const prefHits = tagMatches(p, prefTags);
    if (prefHits) {
      base += 1.5 * Math.min(prefHits, 2);
      reasons.push('Khớp sở thích');
    }
    if (tf > 0) {
      base += 1;
      reasons.push(time === 'morning' ? 'Hợp buổi sáng' : 'Hợp buổi tối');
    }
    if (q.budget != null) {
      if (p.priceLevel == null) {
        base -= 0.5;
        unknownPrice++;
      } else reasons.push('Trong ngân sách');
    }
    if (p.editorPick) {
      base += 0.5;
      reasons.push('Được biên tập chọn');
    }
    if (p.verificationStatus === 'verified') base += 0.5;
    else if (p.verificationStatus === 'coordinates_checked') base += 0.25;
    candidates.push({ p, dist, base, reasons });
  }

  const scale = radius ?? Math.max(10, ...candidates.map((c) => c.dist));
  const distPenalty = (d: number) => (d / scale) * 2;
  const summary = (c: Candidate, extra: string[] = []) => toSummary(c.p, ctx, c.base, [...new Set([...c.reasons, ...extra])]);
  const tipFor = (p: PlaceRecord) => TIPS.find(([t]) => p.tags.includes(t))?.[1];

  const stops: PlanStop[] = [];
  const alternatives: Record<string, PlaceSummary[]> = {};
  const used = new Set<string>();
  let { title, slots, route } = slotsFor(q);

  if (q.intent === 'travel') {
    title = province && anchor.precision === 'province' ? `Điểm chụp ảnh ở ${province.name}` : 'Điểm du lịch & chụp ảnh quanh bạn';
    const photoScore = (p: PlaceRecord) => Math.min(tagMatches(p, PHOTO_TAGS), 3);
    const pool = candidates
      .filter((c) => (c.p.category === 'sight' || c.p.category === 'fun') && (photoScore(c.p) > 0 || tagMatches(c.p, prefTags) > 0))
      .filter((c) => !prefTags.length || tagMatches(c.p, prefTags) > 0)
      .map((c) => ({ ...c, base: c.base + photoScore(c.p) }));
    const n = STOPS_BY_DURATION[q.duration ?? 'day'];
    // Lấy các điểm nổi bật nhất trong vùng rồi sắp từ gần đến xa
    const top = [...pool].sort((a, b) => b.base - distPenalty(b.dist) - (a.base - distPenalty(a.dist))).slice(0, n);
    top.sort((a, b) => a.dist - b.dist);
    const perDay = q.duration === 'multiday' ? 3 : undefined;
    let prev = anchor;
    top.forEach((c, i) => {
      used.add(c.p.id);
      stops.push({
        order: i + 1,
        slotKey: `stop-${i + 1}`,
        slotLabel: perDay ? `Ngày ${Math.floor(i / perDay) + 1}` : 'Điểm chụp ảnh',
        day: perDay ? Math.floor(i / perDay) + 1 : undefined,
        place: summary(c),
        distanceKm: round(c.dist),
        legKm: round(haversineKm(prev.lat, prev.lng, c.p.latitude, c.p.longitude)),
        reasons: c.reasons,
        tip: tipFor(c.p),
      });
      prev = { ...prev, lat: c.p.latitude, lng: c.p.longitude };
    });
    if (q.time === 'evening' || q.time === 'night') notes.push('Buổi tối nhiều điểm tham quan trong nhà đã đóng cửa – chỉ gợi ý điểm ngoài trời.');
    return finish(pool);
  }

  if (q.intent === 'food' || q.intent === 'cafe') {
    route = false;
    title = q.intent === 'food' ? 'Quán ăn phù hợp' : 'Quán cà phê phù hợp';
    const wantTags = [...prefTags, ...(q.meal ? MEAL_TAGS[q.meal] : [])];
    const pool = candidates
      .filter((c) => c.p.category === (q.intent === 'food' ? 'food' : 'cafe'))
      .filter((c) => !q.prefs.length || tagMatches(c.p, prefTags) > 0)
      .map((c) => {
        const hits = tagMatches(c.p, wantTags);
        return { ...c, base: c.base + hits, reasons: q.meal && tagMatches(c.p, MEAL_TAGS[q.meal]) ? [...c.reasons, 'Hợp bữa đã chọn'] : c.reasons };
      });
    const top = [...pool].sort((a, b) => b.base - distPenalty(b.dist) - (a.base - distPenalty(a.dist))).slice(0, 3);
    top.forEach((c, i) => {
      used.add(c.p.id);
      stops.push({ order: i + 1, slotKey: `top-${i + 1}`, slotLabel: 'Gợi ý hàng đầu', place: summary(c), distanceKm: round(c.dist), legKm: round(c.dist), reasons: c.reasons });
    });
    return finish(pool);
  }

  // Lịch trình nhiều mục (hẹn hò, gia đình): mỗi mục chọn điểm tốt nhất, ưu tiên gần điểm trước
  let prev = { lat: anchor.lat, lng: anchor.lng };
  for (const slot of slots) {
    const scored = candidates
      .filter((c) => !used.has(c.p.id) && slot.categories.includes(c.p.category))
      .map((c) => {
        const hits = tagMatches(c.p, slot.tags);
        if (slot.requireTag && !hits) return null;
        if (slot.excludeTags && tagMatches(c.p, slot.excludeTags)) return null;
        const leg = haversineKm(prev.lat, prev.lng, c.p.latitude, c.p.longitude);
        return { c, leg, score: c.base + Math.min(hits, 2) * 1.5 - distPenalty(c.dist) - (leg / scale) * 3 };
      })
      .filter((x): x is { c: Candidate; leg: number; score: number } => !!x)
      .sort((a, b) => b.score - a.score);
    const best = scored[0];
    if (!best) {
      notes.push(`Chưa tìm thấy địa điểm phù hợp cho mục “${slot.label}” trong khu vực này.`);
      continue;
    }
    used.add(best.c.p.id);
    stops.push({
      order: stops.length + 1,
      slotKey: slot.key,
      slotLabel: slot.label,
      place: summary(best.c),
      distanceKm: round(best.c.dist),
      legKm: round(best.leg),
      reasons: best.c.reasons,
      tip: tipFor(best.c.p),
    });
    alternatives[slot.key] = scored
      .slice(1)
      .filter((x) => !used.has(x.c.p.id))
      .slice(0, 3)
      .map((x) => summary(x.c));
    prev = { lat: best.c.p.latitude, lng: best.c.p.longitude };
  }
  return finish(candidates);

  function finish(pool: Candidate[]): PlanResult {
    if (q.budget != null && unknownPrice) notes.push('Một số địa điểm chưa có thông tin giá nên vẫn được hiển thị.');
    if (pool.length === 0 || stops.length === 0) notes.push('Không có địa điểm phù hợp. Thử tăng bán kính, nới ngân sách hoặc bỏ bớt sở thích.');
    notes.push('Mức giá là ước tính minh họa; khoảng cách là đường chim bay.');
    return {
      intent: q.intent,
      title,
      anchor,
      radiusKm: radius,
      stops,
      alternatives,
      more: pool
        .filter((c) => !used.has(c.p.id))
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 30)
        .map((c) => ({ ...summary(c), distanceKm: round(c.dist) })),
      notes,
      showRoute: route && stops.length > 1,
    };
  }
}

const round = (n: number) => Math.round(n * 100) / 100;

export class PlanError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
  }
}
