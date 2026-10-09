import { ExploreView } from '@/components/ExploreView';
import { Hero } from '@/components/Hero';
import { IntentGrid } from '@/components/IntentGrid';
import { INTENTS } from '@/lib/intents';
import { brand } from '@/config/brand';
import type { Photo } from '@/lib/types';
import { api, readExploreQuery } from '@/lib/server';

export default async function HomePage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = readExploreQuery(await searchParams);
  const client = api();
  const [meta, provinces, initial, intentPhotos] = await Promise.all([client.meta(), client.provinces(), client.search({ ...query, limit: 24 }), client.photos(INTENTS.map((i) => i.photoSlug)).catch((): Record<string, Photo> => ({}))]);
  const withData = provinces.filter((p) => p.placeCount > 0);
  const totalPlaces = withData.reduce((n, p) => n + p.placeCount, 0);

  return (
    <>
      <Hero
        eyebrow="Khám phá Việt Nam"
        title={
          <>
            Hôm nay bạn muốn <span className="bg-gradient-to-r from-gold-300 to-gold-100 bg-clip-text text-transparent">đi đâu?</span>
          </>
        }
        subtitle={`${brand.description} Chọn nhu cầu để nhận gợi ý riêng trên bản đồ.`}
        stats={[
          { label: 'Địa điểm', value: totalPlaces },
          { label: 'Tỉnh/thành có dữ liệu', value: `${withData.length}/${provinces.length}` },
        ]}
      >
        <IntentGrid photos={intentPhotos} />
        <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gold-200/75">Hoặc khám phá theo tỉnh:</span>
          {withData.map((p) => (
            <a key={p.slug} href={`/${p.slug}`} className="rounded-full bg-white/10 px-3.5 py-1.5 font-medium ring-1 ring-white/20 transition hover:bg-white hover:text-brand-900">
              {p.name} <span className="text-xs opacity-70">{p.placeCount}</span>
            </a>
          ))}
        </div>
      </Hero>
      <ExploreView meta={meta} provinces={provinces} province={null} initial={initial} initialQuery={query} />
    </>
  );
}
