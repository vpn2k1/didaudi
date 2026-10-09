import Link from 'next/link';
import { INTENTS } from '@/lib/intents';
import type { Photo } from '@/lib/types';
import { Icon } from './Icon';
import { PlaceImage } from './PlaceImage';

const LAYOUT: Record<string, string> = {
  travel: 'col-span-2 lg:col-span-3 lg:row-span-2 min-h-56 lg:min-h-[23rem]',
  date: 'col-span-2 lg:col-span-3 min-h-44',
  food: 'min-h-40',
  cafe: 'min-h-40',
  family: 'col-span-2 lg:col-span-1 min-h-40',
};

/** Các lựa chọn theo nhu cầu – bấm vào để mở form gợi ý riêng. */
export function IntentGrid({ province, photos = {} }: { province?: string; photos?: Record<string, Photo> }) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-6 lg:grid-rows-[auto_auto]">
      {INTENTS.map((it) => {
        const big = it.id === 'travel' || it.id === 'date';
        return (
          <Link
            key={it.id}
            href={`/goi-y/${it.slug}${province ? `?province=${province}` : ''}`}
            className={`group relative isolate flex flex-col justify-end overflow-hidden rounded-3xl p-4 text-white shadow-lg shadow-black/20 ring-1 ring-white/10 transition hover:-translate-y-0.5 hover:shadow-2xl focus-visible:ring-4 focus-visible:ring-gold-400 md:p-5 ${LAYOUT[it.id]}`}
          >
            <PlaceImage photo={photos[it.photoSlug]} illustration={it.image} credit="none" className="absolute inset-0 -z-20" priority={big} />
            <div aria-hidden className={`absolute inset-0 -z-10 bg-gradient-to-t ${it.accent} to-transparent`} />
            {photos[it.photoSlug] && (
              <span className="absolute right-3 top-3 max-w-[70%] truncate rounded-full bg-black/40 px-2 py-0.5 text-[9px] text-white/80 backdrop-blur-sm" title={`Ảnh: ${photos[it.photoSlug]!.author} · ${photos[it.photoSlug]!.license} · Wikimedia Commons`}>
                © {photos[it.photoSlug]!.author} · {photos[it.photoSlug]!.license}
              </span>
            )}
            <h3 className={`font-bold tracking-tight drop-shadow ${big ? 'text-2xl md:text-3xl' : 'text-lg'}`}>{it.title}</h3>
            <p className={`mt-1 text-white/85 drop-shadow ${big ? 'max-w-md text-sm md:text-base' : 'line-clamp-2 text-xs md:text-sm'}`}>{it.description}</p>
            <span
              className={`mt-3 inline-flex w-fit items-center gap-1.5 rounded-full bg-gold-400 font-semibold text-brand-900 shadow transition group-hover:bg-gold-300 group-hover:gap-2.5 ${
                big ? 'px-4 py-2 text-sm' : 'px-3 py-1.5 text-xs'
              }`}
            >
              {it.cta}
              <Icon name="chevron" className="size-4" />
            </span>
          </Link>
        );
      })}
    </div>
  );
}
