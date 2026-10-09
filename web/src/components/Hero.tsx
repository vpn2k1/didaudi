import Link from 'next/link';
import { Icon } from './Icon';

/** Dải hero nền gradient; card tìm kiếm của ExploreView nổi đè lên mép dưới. */
export function Hero({
  eyebrow,
  title,
  subtitle,
  links,
  stats,
  children,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  links?: { href: string; label: string; count?: number }[];
  stats?: { label: string; value: string | number }[];
  children?: React.ReactNode;
}) {
  return (
    <section className="relative isolate overflow-hidden bg-brand-900 text-white">
      {/* Họa tiết nền */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-[radial-gradient(60rem_30rem_at_85%_-10%,rgba(218,37,29,0.75),transparent),radial-gradient(40rem_25rem_at_0%_120%,rgba(255,205,0,0.22),transparent)]" />
      <svg aria-hidden className="absolute inset-0 -z-10 h-full w-full opacity-[0.09]">
        <defs>
          <pattern id="hero-dots" width="44" height="44" patternUnits="userSpaceOnUse">
            <path d="M8 2l1.5 4 4.3.2-3.4 2.7 1.2 4.1L8 10.6 4.4 13l1.2-4.1L2.2 6.2 6.5 6z" fill="#ffcd00" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#hero-dots)" />
      </svg>
      <div className="mx-auto max-w-7xl px-4 pb-20 pt-10 md:pb-24 md:pt-14">
        {eyebrow && (
          <p className="inline-flex items-center gap-1.5 rounded-full bg-gold-400/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-gold-300 ring-1 ring-gold-400/40">
            <Icon name="pin" className="size-3.5" />
            {eyebrow}
          </p>
        )}
        <h1 className="mt-4 max-w-3xl text-[2rem] font-bold leading-[1.15] tracking-tight md:text-5xl">{title}</h1>
        {subtitle && <p className="mt-3 max-w-2xl text-base text-gold-50/85 md:text-lg">{subtitle}</p>}
        {stats && stats.length > 0 && (
          <dl className="mt-6 flex flex-wrap gap-x-8 gap-y-3">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="text-xs uppercase tracking-wider text-gold-200/75">{s.label}</dt>
                <dd className="text-2xl font-bold text-gold-300">{s.value}</dd>
              </div>
            ))}
          </dl>
        )}
        {links && links.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center gap-2 text-sm">
            {links.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3.5 py-1.5 font-medium ring-1 ring-white/20 transition hover:bg-white hover:text-brand-900"
              >
                {l.label}
                {l.count != null && <span className="text-xs opacity-70">{l.count}</span>}
              </Link>
            ))}
          </div>
        )}
        {children && <div className="mt-8">{children}</div>}
      </div>
    </section>
  );
}
