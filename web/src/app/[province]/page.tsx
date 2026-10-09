import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ExploreView } from '@/components/ExploreView';
import { Hero } from '@/components/Hero';
import { IntentGrid } from '@/components/IntentGrid';
import { INTENTS } from '@/lib/intents';
import { brand } from '@/config/brand';
import { publicEnv } from '@/config/env';
import { ApiError } from '@/lib/api';
import { isIndexablePlace } from '@/lib/format';
import type { Photo } from '@/lib/types';
import { api, readExploreQuery } from '@/lib/server';

type Params = Promise<{ province: string }>;
/** Trang tỉnh cần đủ địa điểm đã xác minh mới cho index – tránh trang mỏng. */
const MIN_INDEXABLE_PLACES = 3;

async function loadProvince(slug: string) {
  if (!/^[a-z0-9-]{2,40}$/.test(slug)) notFound();
  try {
    return await api().province(slug);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const province = await loadProvince((await params).province);
  const { items } = await api().search({ province: province.slug, limit: 50 });
  const indexable = publicEnv.allowIndexing && items.filter(isIndexablePlace).length >= MIN_INDEXABLE_PLACES;
  const title = `Ăn gì, chơi gì ở ${province.name}`;
  const description = province.placeCount
    ? `Khám phá ${province.placeCount} quán ăn, quán cà phê, điểm du lịch và vui chơi tại ${province.name} trên bản đồ – ${brand.name}.`
    : `Địa điểm ăn uống, du lịch tại ${province.name} đang được ${brand.name} bổ sung.`;
  return {
    title,
    description,
    alternates: { canonical: `/${province.slug}` },
    openGraph: { title, description, url: `/${province.slug}` },
    robots: indexable ? undefined : { index: false, follow: true },
  };
}

export default async function ProvincePage({ params, searchParams }: { params: Params; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const slug = (await params).province;
  const query = readExploreQuery(await searchParams);
  const province = await loadProvince(slug);
  const client = api();
  const [meta, provinces, initial, intentPhotos] = await Promise.all([
    client.meta(),
    client.provinces(),
    client.search({ ...query, province: slug, limit: 24 }),
    client.photos(INTENTS.map((i) => i.photoSlug)).catch((): Record<string, Photo> => ({})),
  ]);

  return (
    <>
      <Hero
        eyebrow={province.type === 'city' ? 'Thành phố' : 'Tỉnh'}
        title={<>Ăn gì, chơi gì ở {province.name}?</>}
        subtitle={province.placeCount ? `${province.placeCount} địa điểm ăn uống, cà phê, du lịch và vui chơi đang có trên bản đồ.` : 'Chưa có địa điểm nào – dữ liệu sẽ được bổ sung dần.'}
        stats={meta.categories.filter((c) => province.byCategory[c.id]).map((c) => ({ label: c.label, value: province.byCategory[c.id]! }))}
      >
        {province.placeCount > 0 && <IntentGrid province={province.slug} photos={intentPhotos} />}
      </Hero>
      <ExploreView meta={meta} provinces={provinces} province={province} initial={initial} initialQuery={query} />
    </>
  );
}
