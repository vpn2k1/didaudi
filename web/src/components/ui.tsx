import type { Category } from '@/lib/types';
import { CATEGORY_ICON, Icon } from './Icon';

export const CATEGORY_STYLE: Record<Category, { text: string; soft: string; cover: string; ring: string }> = {
  food: { text: 'text-food', soft: 'bg-food/10', cover: 'from-[#ff9a62] via-[#f3743f] to-[#d9532b]', ring: 'ring-food/30' },
  cafe: { text: 'text-cafe', soft: 'bg-cafe/10', cover: 'from-[#c99a6b] via-[#a8754d] to-[#7a4f32]', ring: 'ring-cafe/30' },
  sight: { text: 'text-sight', soft: 'bg-sight/10', cover: 'from-[#5aa7e6] via-[#3d85cc] to-[#245f9e]', ring: 'ring-sight/30' },
  fun: { text: 'text-fun', soft: 'bg-fun/10', cover: 'from-[#c08bf0] via-[#9d62d9] to-[#7340b0]', ring: 'ring-fun/30' },
};

/** "Ảnh bìa" minh họa theo danh mục – dùng khi chưa có ảnh được phép sử dụng. */
export function CategoryCover({ category, className = '', iconClass = 'size-7' }: { category: Category; className?: string; iconClass?: string }) {
  return (
    <div aria-hidden className={`relative isolate grid place-items-center overflow-hidden bg-gradient-to-br text-white ${CATEGORY_STYLE[category].cover} ${className}`}>
      <span className="absolute -right-4 -top-6 size-20 rounded-full bg-white/15" />
      <span className="absolute -bottom-8 -left-4 size-24 rounded-full bg-black/10" />
      <span className="absolute bottom-2 right-3 size-6 rounded-full bg-white/10" />
      <Icon name={CATEGORY_ICON[category]} className={`relative drop-shadow-sm ${iconClass}`} strokeWidth={1.8} />
    </div>
  );
}

export function DemoBadge({ className = '' }: { className?: string }) {
  return (
    <span
      title="Nội dung minh họa, chưa được xác minh thực tế"
      className={`inline-flex items-center gap-1 rounded-full bg-amber-100/80 px-2 py-0.5 text-[11px] font-semibold text-amber-800 ring-1 ring-amber-300/70 ring-inset ${className}`}
    >
      <span className="size-1.5 rounded-full bg-amber-500" />
      Dữ liệu minh họa
    </span>
  );
}

export function Pill({ children, tone = 'neutral', className = '' }: { children: React.ReactNode; tone?: 'neutral' | 'brand' | 'ok' | 'warn'; className?: string }) {
  const styles = {
    neutral: 'bg-canvas text-muted ring-line',
    brand: 'bg-brand-50 text-brand-700 ring-brand-100',
    ok: 'bg-green-50 text-ok ring-green-200',
    warn: 'bg-amber-50 text-warn ring-amber-200',
  }[tone];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${styles} ${className}`}>{children}</span>;
}

export function Chip({ active, onClick, children, ...rest }: { active: boolean; onClick: () => void; children: React.ReactNode } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition ${
        active
          ? 'bg-brand-900 text-white shadow-md shadow-brand-900/15'
          : 'bg-surface text-ink ring-1 ring-line ring-inset hover:bg-brand-50 hover:text-brand-700 hover:ring-brand-100'
      }`}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-line/70 ${className}`} />;
}

export function PlaceCardSkeleton() {
  return (
    <div className="flex gap-4 rounded-3xl bg-surface p-3 ring-1 ring-line" aria-hidden>
      <Skeleton className="size-24 shrink-0 rounded-2xl" />
      <div className="flex-1 space-y-2.5 py-2">
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-5 w-1/3 rounded-full" />
      </div>
    </div>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'error'; children: React.ReactNode }) {
  const styles = {
    info: 'bg-gold-50 text-gold-700 ring-gold-200',
    warn: 'bg-orange-50 text-orange-900 ring-orange-200',
    error: 'bg-red-50 text-red-900 ring-red-200',
  }[tone];
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={`flex gap-2.5 rounded-2xl px-4 py-3 text-sm ring-1 ring-inset ${styles}`}>
      <Icon name="info" className="mt-0.5 size-4 shrink-0 opacity-70" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}
