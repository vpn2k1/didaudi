import Link from 'next/link';
import { directionsUrl } from '@/lib/format';
import { formatDistance } from '@/lib/geo';
import type { Meta, PlaceSummary } from '@/lib/types';
import { Icon } from './Icon';
import { PlaceImage } from './PlaceImage';
import { CATEGORY_STYLE, DemoBadge } from './ui';

/** Thẻ tóm tắt khi chọn marker trên bản đồ. */
export function SelectedPlaceCard({ place: p, meta, onClose }: { place: PlaceSummary; meta: Pick<Meta, 'categories'>; onClose: () => void }) {
  const cat = meta.categories.find((c) => c.id === p.category);
  const dir = directionsUrl(p);
  return (
    <div role="dialog" aria-label={`Thông tin ${p.name}`} className="rounded-3xl bg-surface/95 p-3 shadow-2xl ring-1 ring-line backdrop-blur">
      <div className="flex gap-3">
        <PlaceImage place={p} className="size-16 shrink-0 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <p className={`text-xs font-semibold ${CATEGORY_STYLE[p.category].text}`}>
            {cat?.label}
            {p.distanceKm != null && <span className="text-muted"> · cách {formatDistance(p.distanceKm)}</span>}
          </p>
          <h3 className="truncate font-semibold leading-snug">{p.name}</h3>
          {p.address && <p className="truncate text-sm text-muted">{p.address}</p>}
          {p.isDemo && <DemoBadge className="mt-1" />}
        </div>
        <button type="button" onClick={onClose} aria-label="Đóng" className="grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-canvas hover:text-ink">
          <Icon name="x" />
        </button>
      </div>
      <div className="mt-3 grid grid-cols-3 gap-2 whitespace-nowrap text-sm font-semibold">
        <Link href={`/dia-diem/${p.slug}`} className="rounded-2xl bg-brand-600 px-3 py-2.5 text-center text-white hover:bg-brand-700">
          Chi tiết
        </Link>
        <a href={p.googleMapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-canvas px-2 py-2.5 ring-1 ring-line hover:bg-brand-50">
          <Icon name="external" className="size-3.5" /> Maps
        </a>
        {dir && (
          <a href={dir} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-1.5 rounded-2xl bg-canvas px-2 py-2.5 ring-1 ring-line hover:bg-brand-50">
            <Icon name="navigation" className="size-3.5" /> Đường đi
          </a>
        )}
      </div>
    </div>
  );
}
