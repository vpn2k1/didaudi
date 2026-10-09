import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { PlaceImage } from '@/components/PlaceImage';
import { PlannerView } from '@/components/planner/PlannerView';
import { brand } from '@/config/brand';
import { INTENTS, intentBySlug } from '@/lib/intents';
import type { Photo } from '@/lib/types';
import { api } from '@/lib/server';

type Params = Promise<{ intent: string }>;

export function generateStaticParams() {
  return INTENTS.map((i) => ({ intent: i.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const intent = intentBySlug((await params).intent);
  if (!intent) return {};
  return {
    title: `Gợi ý ${intent.title.toLowerCase()}`,
    description: `${intent.description} – ${brand.name}`,
    alternates: { canonical: `/goi-y/${intent.slug}` },
  };
}

export const dynamic = 'force-dynamic';

export default async function IntentPage({ params }: { params: Params }) {
  const intent = intentBySlug((await params).intent);
  if (!intent) notFound();
  const client = api();
  const [meta, provinces, photos] = await Promise.all([client.meta(), client.provinces(), client.photos([intent.photoSlug]).catch((): Record<string, Photo> => ({}))]);
  const photo = photos[intent.photoSlug];

  return (
    <>
      <section className="relative isolate overflow-hidden bg-brand-900 text-white">
        <PlaceImage photo={photo} illustration={intent.image} credit="none" priority className="absolute inset-0 -z-20" />
        <div aria-hidden className={`absolute inset-0 -z-10 bg-gradient-to-r ${intent.accent} to-black/20`} />
        <div className="mx-auto max-w-7xl px-4 pb-20 pt-8 md:pt-12">
          <nav aria-label="Chọn nhu cầu" className="flex gap-2 overflow-x-auto pb-1 text-sm [scrollbar-width:none]">
            {INTENTS.map((i) => (
              <Link
                key={i.id}
                href={`/goi-y/${i.slug}`}
                aria-current={i.id === intent.id ? 'page' : undefined}
                className={`shrink-0 rounded-full px-3.5 py-1.5 font-semibold ring-1 transition ${
                  i.id === intent.id ? 'bg-white text-ink ring-white' : 'bg-white/10 ring-white/25 hover:bg-white/20'
                }`}
              >
                {i.short}
              </Link>
            ))}
          </nav>
          <h1 className="mt-6 flex items-center gap-3 text-3xl font-bold tracking-tight drop-shadow md:text-5xl">
            <Icon name="sparkles" className="size-8 text-amber-300" />
            {intent.title}
          </h1>
          <p className="mt-2 max-w-2xl text-white/85 drop-shadow md:text-lg">{intent.description}</p>
          {photo && (
            <a href={photo.pageUrl} target="_blank" rel="noreferrer" className="absolute bottom-14 right-4 max-w-[60%] truncate text-[10px] text-white/70 hover:underline">
              Ảnh: {photo.author} · {photo.license} · Wikimedia Commons
            </a>
          )}
        </div>
      </section>
      <PlannerView intent={intent} meta={meta} provinces={provinces} />
    </>
  );
}
