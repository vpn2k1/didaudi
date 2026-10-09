import { z } from 'zod';

export const CATEGORY_IDS = ['food', 'cafe', 'sight', 'fun'] as const;
export const categorySchema = z.enum(CATEGORY_IDS);
export type Category = z.infer<typeof categorySchema>;

export const verificationStatusSchema = z.enum(['unverified', 'coordinates_checked', 'verified']);
export const publicationStatusSchema = z.enum(['draft', 'published']);

const slugSchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Slug chỉ gồm chữ thường không dấu, số và dấu gạch ngang');

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Giờ dạng HH:mm');

/** Giờ mở cửa: day 0 = Chủ nhật … 6 = Thứ bảy. close < open nghĩa là mở qua đêm. */
export const openingHoursSchema = z.object({
  periods: z.array(z.object({ day: z.number().int().min(0).max(6), open: timeSchema, close: timeSchema })).min(1).max(21),
  verifiedAt: z.string().datetime(),
});
export type OpeningHours = z.infer<typeof openingHoursSchema>;

export const providerRefSchema = z.object({
  provider: z.enum(['osm', 'google']),
  providerPlaceId: z.string().min(1).max(300),
  label: z.string().max(200).nullish(),
});

// Tọa độ phải nằm trong khung bao Việt Nam (gồm cả quần đảo Hoàng Sa, Trường Sa)
const latitude = z.number().min(8).max(23.5);
const longitude = z.number().min(102).max(117.5);
const vnd = z.number().int().min(0).max(100_000_000);
/**
 * Mức giá ƯỚC TÍNH mỗi người: 0 miễn phí · 1 < 100k · 2 100–300k · 3 300–700k · 4 > 700k.
 * Dùng cho gợi ý theo ngân sách khi chưa có giá chính xác (priceMin/priceMax).
 */
export const priceLevelSchema = z.number().int().min(0).max(4);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

/** Dữ liệu admin gửi lên khi tạo/sửa địa điểm. */
export const placeInputSchema = z
  .object({
    slug: slugSchema.optional(),
    name: z.string().trim().min(2).max(120),
    description: optionalText(2000),
    mustTry: optionalText(200),
    category: categorySchema,
    provinceSlug: slugSchema,
    area: optionalText(80),
    address: optionalText(300),
    latitude,
    longitude,
    priceMin: vnd.nullish().transform((v) => v ?? null),
    priceMax: vnd.nullish().transform((v) => v ?? null),
    priceLevel: priceLevelSchema.nullish().transform((v) => v ?? null),
    tags: z.array(z.string().regex(/^[a-z0-9-]+$/).max(40)).max(12).default([]),
    openingHours: openingHoursSchema.nullish().transform((v) => v ?? null),
    // Chỉ http(s) – chặn javascript:/data: URL (XSS khi render thành link)
    website: z
      .string()
      .trim()
      .max(300)
      .url()
      .refine((v) => /^https?:\/\//i.test(v), 'Website phải bắt đầu bằng http:// hoặc https://')
      .nullish()
      .transform((v) => v || null),
    phone: z
      .string()
      .trim()
      .regex(/^[0-9 +().-]{6,20}$/, 'Số điện thoại không hợp lệ')
      .nullish()
      .transform((v) => v || null),
    verificationStatus: verificationStatusSchema.default('unverified'),
    publicationStatus: publicationStatusSchema.default('draft'),
    isDemo: z.boolean().default(false),
    editorPick: z.boolean().default(false),
    providerRefs: z.array(providerRefSchema).max(5).default([]),
  })
  .refine((p) => p.priceMin == null || p.priceMax == null || p.priceMax >= p.priceMin, {
    message: 'Giá tối đa phải ≥ giá tối thiểu',
    path: ['priceMax'],
  });
export type PlaceInput = z.infer<typeof placeInputSchema>;

/** Bản ghi lưu trong repository. */
export const placeRecordSchema = z.object({
  id: z.string().min(1),
  slug: slugSchema,
  name: z.string(),
  description: z.string().nullish(),
  mustTry: z.string().nullish(),
  category: categorySchema,
  provinceSlug: slugSchema,
  area: z.string().nullish(),
  address: z.string().nullish(),
  latitude,
  longitude,
  priceMin: vnd.nullish(),
  priceMax: vnd.nullish(),
  priceLevel: priceLevelSchema.nullish(),
  tags: z.array(z.string()),
  openingHours: openingHoursSchema.nullish(),
  website: z.string().nullish(),
  phone: z.string().nullish(),
  verificationStatus: verificationStatusSchema,
  publicationStatus: publicationStatusSchema,
  isDemo: z.boolean(),
  editorPick: z.boolean(),
  providerRefs: z.array(providerRefSchema),
  /** Gợi ý cho script đối chiếu OSM – không trả ra API công khai. */
  osmHint: z.object({ match: z.string(), radius: z.number().optional(), street: z.boolean().optional() }).nullish(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PlaceRecord = z.infer<typeof placeRecordSchema>;

export const provinceSchema = z.object({
  code: z.string(),
  slug: slugSchema,
  name: z.string(),
  type: z.enum(['city', 'province']),
  centerLatitude: z.number().nullable(),
  centerLongitude: z.number().nullable(),
});
export type Province = z.infer<typeof provinceSchema>;

const csv = <T extends z.ZodTypeAny>(item: T) =>
  z
    .string()
    .optional()
    .transform((v) => (v ? v.split(',').map((s) => s.trim()).filter(Boolean) : undefined))
    .pipe(z.array(item).max(10).optional());

const coord = z
  .string()
  .regex(/^-?\d{1,3}(\.\d+)?,-?\d{1,3}(\.\d+)?$/)
  .transform((s) => {
    const [lat, lng] = s.split(',').map(Number) as [number, number];
    return { lat, lng };
  })
  .pipe(z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }));

/** Query của GET /api/places/search – có giới hạn để tránh lạm dụng. */
export const searchQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  category: csv(categorySchema),
  tags: csv(z.string().regex(/^[a-z0-9-]+$/)),
  province: slugSchema.optional(),
  near: coord.optional(),
  radius: z.coerce.number().min(0.5).max(50).optional(),
  price: z.enum(['cheap']).optional(),
  openNow: z.enum(['1', 'true']).optional().transform((v) => !!v),
  sort: z.enum(['relevance', 'distance', 'rating']).default('relevance'),
  page: z.coerce.number().int().min(1).max(100).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(24),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

/** Ảnh có giấy phép tự do (Wikimedia Commons) – lưu kèm tác giả/giấy phép để ghi công. */
export const photoSchema = z.object({
  file: z.string(),
  pageUrl: z.string().url(),
  thumbUrl: z.string().url(),
  width: z.number().optional(),
  height: z.number().optional(),
  author: z.string(),
  license: z.string(),
  licenseUrl: z.string().nullish(),
  /** place = ảnh chính địa điểm; topic = ảnh món ăn/chủ đề, không phải ảnh của quán. */
  match: z.enum(['place', 'topic']),
  source: z.literal('wikimedia'),
  locked: z.boolean().optional(),
});
export type Photo = z.infer<typeof photoSchema>;
