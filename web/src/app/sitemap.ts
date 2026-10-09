import type { MetadataRoute } from 'next';
import { publicEnv } from '@/config/env';
import { isIndexablePlace } from '@/lib/format';
import { api } from '@/lib/server';

export const dynamic = 'force-dynamic';

/**
 * Chỉ đưa vào sitemap những trang có nội dung thật: trang địa điểm đã xác minh (không phải demo)
 * và trang tỉnh/thành có ≥ 3 địa điểm như vậy. Không tạo hàng loạt trang rỗng.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = publicEnv.siteUrl;
  const entries: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: 'weekly', priority: 1 },
    { url: `${base}/tinh-thanh`, changeFrequency: 'monthly', priority: 0.5 },
  ];
  if (!publicEnv.allowIndexing) return entries;

  try {
    const client = api();
    const provinces = (await client.provinces()).filter((p) => p.placeCount > 0);
    for (const p of provinces) {
      const { items } = await client.search({ province: p.slug, limit: 50 });
      const indexable = items.filter(isIndexablePlace);
      if (indexable.length >= 3) entries.push({ url: `${base}/${p.slug}`, changeFrequency: 'weekly', priority: 0.8 });
      for (const place of indexable) entries.push({ url: `${base}/dia-diem/${place.slug}`, changeFrequency: 'monthly', priority: 0.6 });
    }
  } catch {
    // Backend lỗi: vẫn trả sitemap tối thiểu
  }
  return entries;
}
