import Link from 'next/link';
import { brand } from '@/config/brand';

export function Logo() {
  return (
    <span aria-hidden className="grid size-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-md shadow-black/30 ring-1 ring-gold-400/40">
      <svg viewBox="0 0 24 24" className="size-6 text-gold-400 drop-shadow-sm">
        <path fill="currentColor" d="M12 2.5l2.6 6.9 7.4.3-5.8 4.6 2 7.1L12 17.3l-6.2 4.1 2-7.1L2 9.7l7.4-.3z" />
      </svg>
    </span>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-brand-900/95 text-white backdrop-blur">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2.5 font-bold tracking-tight">
          <Logo />
          <span className="hidden whitespace-nowrap text-[17px] min-[360px]:inline">{brand.name}</span>
        </Link>
        <nav aria-label="Điều hướng chính" className="flex items-center gap-1 text-sm font-medium">
          <Link href="/" className="hidden rounded-full px-3.5 py-2 text-gold-100/80 transition hover:bg-white/10 hover:text-white sm:block">
            Khám phá
          </Link>
          <Link href="/tinh-thanh" className="whitespace-nowrap rounded-full bg-gold-400 px-3.5 py-2 font-semibold text-brand-900 shadow-sm transition hover:bg-gold-300">
            <span className="hidden sm:inline">34 </span>tỉnh/thành
          </Link>
        </nav>
      </div>
    </header>
  );
}
