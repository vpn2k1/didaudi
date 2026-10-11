'use client';

import Link from 'next/link';
import { formatDistance } from '@/lib/geo';
import { formatPriceLevel, formatPriceRange, OPEN_STATUS_LABEL } from '@/lib/format';
import type { Meta, PlaceSummary } from '@/lib/types';
import { Icon } from './Icon';
import { PlaceImage } from './PlaceImage';
import { PhotoAttribution } from './PhotoAttribution';
import { CATEGORY_STYLE, DemoBadge, Pill } from './ui';

interface Props {
  place: PlaceSummary;
  meta: Pick<Meta, 'categories' | 'tags'>;
  provinceName?: string;
  selected?: boolean;
  onSelect?: () => void;
  onHover?: (hovering: boolean) => void;
  variant?: 'row' | 'feature';
}

export function PlaceCard({ place: p, meta, provinceName, selected, onSelect, onHover, variant = 'row' }: Props) {
  const cat = meta.categories.find((c) => c.id === p.category);
  const style = CATEGORY_STYLE[p.category];
  // Ưu tiên giá chính xác; nếu chỉ có mức ước tính thì ghi rõ "ước tính"
  const price = formatPriceRange(p.priceMin, p.priceMax) ?? (p.priceLevel != null ? `${formatPriceLevel(p.priceLevel)} · ước tính` : null);
  const open = OPEN_STATUS_LABEL[p.openStatus];
  const location = [p.area, provinceName].filter(Boolean).join(', ');

  const title = (
    // Link phủ cả thẻ: bấm hoặc Tab vào là mở chi tiết
    <Link
      href={`/dia-diem/${p.slug}`}
      className="after:absolute after:inset-0 after:rounded-3xl focus-visible:outline-none"
      onFocus={() => onHover?.(true)}
      onBlur={() => onHover?.(false)}
    >
      {p.name}
    </Link>
  );

  const badges = (
    <div className="flex flex-wrap items-center gap-1.5">
      {p.isDemo && <DemoBadge />}
      {p.rating != null && (
        <Pill>
          <Icon name="star" className="size-3 fill-amber-400 text-amber-400" />
          <span className="text-ink">{p.rating.toFixed(1)}</span>
          {p.ratingCount != null && `(${p.ratingCount})`}
        </Pill>
      )}
      {open && <Pill tone={p.openStatus === 'open' ? 'ok' : 'neutral'}>{open}</Pill>}
      {price && <Pill>{price}</Pill>}
      {p.reasons.map((r) => (
        <Pill key={r} tone="brand">
          {r === 'Được biên tập chọn' && <Icon name="sparkles" className="size-3" />}
          {r === 'Gần bạn' && <Icon name="pin" className="size-3" />}
          {r}
        </Pill>
      ))}
    </div>
  );

  if (variant === 'feature') {
    return (
      <article className="group relative flex h-full flex-col overflow-hidden rounded-3xl bg-surface shadow-sm ring-1 ring-line transition hover:-translate-y-0.5 hover:shadow-lg focus-within:ring-2 focus-within:ring-brand-500">
        <PlaceImage place={p} credit="none" className="h-36" />
        <PhotoAttribution photo={p.photo} className="px-4 pt-2" />
        <div className="flex flex-1 flex-col gap-2 p-4">
          <p className={`text-xs font-semibold uppercase tracking-wide ${style.text}`}>{cat?.label}</p>
          <h3 className="font-semibold leading-snug group-hover:text-brand-700">{title}</h3>
          <p className="line-clamp-1 text-sm text-muted">{p.mustTry ?? location}</p>
          <div className="mt-auto pt-1">{badges}</div>
        </div>
      </article>
    );
  }

  return (
    <article
      id={`place-${p.slug}`}
      onMouseEnter={() => onHover?.(true)}
      onMouseLeave={() => onHover?.(false)}
      className={`group relative flex flex-col rounded-3xl bg-surface p-3 transition hover:shadow-lg hover:shadow-ink/5 focus-within:ring-2 focus-within:ring-brand-500 ${
        selected ? 'shadow-lg ring-2 ring-brand-500' : 'shadow-sm ring-1 ring-line'
      }`}
    >
      <div className="flex gap-4">
        <PlaceImage place={p} credit="none" className="size-24 shrink-0 rounded-2xl sm:h-24 sm:w-32" />
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 py-0.5">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold leading-snug group-hover:text-brand-700">{title}</h3>
            {p.distanceKm != null && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
                <Icon name="navigation" className="size-3" />
                {formatDistance(p.distanceKm)}
              </span>
            )}
          </div>
          <p className="truncate text-sm text-muted">
            <span className={`font-medium ${style.text}`}>{cat?.label}</span>
            {location && <> · {location}</>}
            {p.mustTry && <> · {p.mustTry}</>}
          </p>
          {badges}
        </div>
        {onSelect && p.latitude != null && (
          <button
            type="button"
            onClick={onSelect}
            aria-label={`Xem ${p.name} trên bản đồ`}
            aria-pressed={selected}
            title="Xem trên bản đồ"
            className={`relative z-10 hidden size-9 shrink-0 self-center place-items-center rounded-full transition lg:grid ${
              selected ? 'bg-brand-600 text-white' : 'bg-canvas text-muted hover:bg-brand-50 hover:text-brand-700'
            }`}
          >
            <Icon name="pin" />
          </button>
        )}
      </div>
      <PhotoAttribution photo={p.photo} className="mt-2" />
    </article>
  );
}
