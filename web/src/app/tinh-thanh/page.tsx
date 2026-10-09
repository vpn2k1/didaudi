import type { Metadata } from 'next';
import Link from 'next/link';
import { Hero } from '@/components/Hero';
import { Icon } from '@/components/Icon';
import { api } from '@/lib/server';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: '34 tỉnh, thành phố',
  description: 'Chọn tỉnh/thành để khám phá quán ăn, cà phê, điểm du lịch và vui chơi.',
  alternates: { canonical: '/tinh-thanh' },
};

export default async function ProvincesPage() {
  const provinces = await api().provinces();
  const groups = [
    { title: 'Thành phố trực thuộc Trung ương', items: provinces.filter((p) => p.type === 'city') },
    { title: 'Tỉnh', items: provinces.filter((p) => p.type === 'province').sort((a, b) => a.name.localeCompare(b.name, 'vi')) },
  ];
  return (
    <>
      <Hero eyebrow="Đơn vị hành chính từ 01/07/2025" title="34 tỉnh, thành phố" subtitle="Chọn nơi bạn đang ở hoặc sắp đến để xem quán ăn, cà phê, điểm du lịch và vui chơi." />
      <div className="mx-auto -mt-10 max-w-7xl space-y-6 px-4">
        {groups.map((g) => (
          <section key={g.title} className="rounded-3xl bg-surface p-5 shadow-xl shadow-ink/5 ring-1 ring-line md:p-6">
            <h2 className="text-lg font-bold tracking-tight">{g.title}</h2>
            <ul className="mt-4 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {g.items.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/${p.slug}`}
                    className={`group flex items-center gap-3 rounded-2xl px-4 py-3 ring-1 ring-inset transition ${
                      p.placeCount ? 'bg-brand-50/60 ring-brand-100 hover:bg-brand-50 hover:ring-brand-500' : 'ring-line hover:bg-canvas'
                    }`}
                  >
                    <span className={`grid size-9 shrink-0 place-items-center rounded-xl ${p.placeCount ? 'bg-brand-600 text-white' : 'bg-canvas text-muted'}`}>
                      <Icon name="pin" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold group-hover:text-brand-700">{p.name}</span>
                      <span className="block text-xs text-muted">{p.placeCount ? `${p.placeCount} địa điểm` : 'Sắp có dữ liệu'}</span>
                    </span>
                    <Icon name="chevron" className="size-4 text-muted transition group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </>
  );
}
