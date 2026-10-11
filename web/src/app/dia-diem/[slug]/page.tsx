import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { PlaceCard } from '@/components/PlaceCard';
import { DistanceFromUser, PlaceMap } from '@/components/PlaceDetailClient';
import { PlaceImage } from '@/components/PlaceImage';
import { PhotoAttribution } from '@/components/PhotoAttribution';
import { CATEGORY_ICON, Icon, type IconName } from '@/components/Icon';
import { DemoBadge, Pill } from '@/components/ui';
import { publicEnv } from '@/config/env';
import { ApiError } from '@/lib/api';
import { directionsUrl, formatDate, formatPriceLevel, formatPriceRange, isIndexablePlace, OPEN_STATUS_LABEL, VERIFICATION_LABEL, WEEKDAYS } from '@/lib/format';
import { api } from '@/lib/server';
import { normalizeText } from '@/lib/text';

type Params = Promise<{ slug: string }>;

// Dùng chung giữa generateMetadata và trang trong cùng 1 request
const loadPlace = cache(async (slug: string) => {
  if (!/^[A-Za-z0-9_-]{2,320}$/.test(slug)) notFound();
  try {
    return await api().place(slug);
  } catch (e) {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  }
});

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { place } = await loadPlace((await params).slug);
  const title = place.name;
  const description = (place.description ?? [place.mustTry, place.address].filter(Boolean).join(' · ')).slice(0, 160);
  return {
    title,
    description,
    alternates: { canonical: `/dia-diem/${place.slug}` },
    openGraph: { title, description, url: `/dia-diem/${place.slug}` },
    // Dữ liệu minh họa / chưa xác minh / dữ liệu provider ngoài → không index
    robots: publicEnv.allowIndexing && isIndexablePlace(place) ? undefined : { index: false, follow: true },
  };
}

export default async function PlaceDetailPage({ params }: { params: Params }) {
  const { place: p, provider } = await loadPlace((await params).slug);
  const client = api();
  const [meta, provinces] = await Promise.all([client.meta(), client.provinces()]);
  const province = provinces.find((x) => x.slug === p.provinceSlug);
  const cat = meta.categories.find((c) => c.id === p.category);
  const price = formatPriceRange(p.priceMin, p.priceMax);
  const open = OPEN_STATUS_LABEL[p.openStatus];
  const verification = VERIFICATION_LABEL[p.verificationStatus];
  const dir = directionsUrl(p);
  const mapDisabled = provider.capabilities.requiresProviderMap ? 'Dữ liệu từ Google chỉ được hiển thị trên bản đồ Google.' : null;

  // Gợi ý gần đây: dùng tọa độ của địa điểm (không phải của người dùng)
  const nearby =
    p.latitude != null && p.longitude != null
      ? (await client.search({ near: `${p.latitude.toFixed(2)},${p.longitude.toFixed(2)}`, radius: 2, limit: 5 }).catch(() => null))?.items.filter((x) => x.slug !== p.slug).slice(0, 4) ?? []
      : [];

  const infoRows: { icon: IconName; label: string; value: React.ReactNode }[] = [];
  // Không lặp tên tỉnh nếu địa chỉ đã có sẵn
  const withProvince = p.address && province && !normalizeText(p.address).includes(normalizeText(province.name)) ? `${p.address}, ${province.name}` : p.address;
  if (withProvince) infoRows.push({ icon: 'pin', label: 'Địa chỉ', value: withProvince });
  if (p.mustTry) infoRows.push({ icon: 'sparkles', label: 'Nên thử', value: p.mustTry });
  if (price) infoRows.push({ icon: 'tag', label: 'Khoảng giá', value: price });
  else if (p.priceLevel != null) infoRows.push({ icon: 'tag', label: 'Mức giá', value: <>{formatPriceLevel(p.priceLevel)}{p.priceLevel > 0 && ' / người'} <span className="text-muted">(ước tính, minh họa)</span></> });
  if (p.rating != null)
    infoRows.push({
      icon: 'star',
      label: 'Đánh giá',
      value: (
        <>
          {p.rating.toFixed(1)} {p.ratingCount != null && <span className="text-muted">({p.ratingCount} lượt, theo {provider.label})</span>}
        </>
      ),
    });
  if (p.website)
    infoRows.push({
      icon: 'globe',
      label: 'Website',
      value: (
        <a href={p.website} target="_blank" rel="noreferrer nofollow" className="break-all text-brand-700 underline">
          {p.website.replace(/^https?:\/\//, '')}
        </a>
      ),
    });
  if (p.phone)
    infoRows.push({
      icon: 'phone',
      label: 'Điện thoại',
      value: (
        <a href={`tel:${p.phone.replace(/[^0-9+]/g, '')}`} className="text-brand-700 underline">
          {p.phone}
        </a>
      ),
    });
  if (p.latitude != null && p.longitude != null)
    infoRows.push({ icon: 'navigation', label: 'Tọa độ', value: <span className="tabular-nums">{`${p.latitude.toFixed(5)}, ${p.longitude.toFixed(5)}`}</span> });

  return (
    <div className="pb-6">
      {/* Banner */}
      <div className="relative isolate overflow-hidden bg-brand-900 text-white">
        <PlaceImage place={p} credit="none" priority className="absolute inset-0 -z-20" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/40 to-black/20" />
        <div className="mx-auto max-w-7xl px-4 pb-20 pt-6 md:pt-10">
          <nav aria-label="Breadcrumb" className="text-sm text-white/80">
            <ol className="flex flex-wrap items-center gap-1.5">
              <li>
                <Link href="/" className="hover:text-white hover:underline">
                  Khám phá
                </Link>
              </li>
              {province && (
                <>
                  <li aria-hidden>
                    <Icon name="chevron" className="size-3.5" />
                  </li>
                  <li>
                    <Link href={`/${province.slug}`} className="hover:text-white hover:underline">
                      {province.name}
                    </Link>
                  </li>
                </>
              )}
            </ol>
          </nav>
          <p className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold uppercase tracking-wider ring-1 ring-white/25">
            <Icon name={CATEGORY_ICON[p.category]} className="size-3.5" />
            {cat?.label}
            {p.area && <span className="opacity-80">· {p.area}</span>}
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight tracking-tight drop-shadow-sm md:text-5xl">{p.name}</h1>
          {p.latitude != null && p.longitude != null && (
            <p className="mt-2 text-white/85">
              {province?.name}
              <DistanceFromUser lat={p.latitude} lng={p.longitude} />
            </p>
          )}
        </div>
      </div>
      <PhotoAttribution photo={p.photo} className="mx-auto max-w-7xl px-4 py-2" />

      <div className="mx-auto mt-4 grid max-w-7xl gap-6 px-4 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <article className="relative rounded-3xl bg-surface p-5 shadow-xl shadow-ink/5 ring-1 ring-line md:p-7">
          <div className="flex flex-wrap gap-1.5">
            {p.isDemo && <DemoBadge />}
            <Pill tone={verification.tone === 'ok' ? 'ok' : verification.tone === 'info' ? 'brand' : 'warn'}>
              <Icon name="shield" className="size-3" />
              {verification.label}
            </Pill>
            {p.editorPick && (
              <Pill tone="brand">
                <Icon name="sparkles" className="size-3" />
                Được biên tập chọn
              </Pill>
            )}
            {open && <Pill tone={p.openStatus === 'open' ? 'ok' : 'neutral'}>{open}</Pill>}
          </div>

          {p.description && <p className="mt-5 text-[17px] leading-relaxed text-ink/90">{p.description}</p>}

          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <a href={p.googleMapsUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-4 py-3.5 font-semibold text-white shadow-md shadow-brand-600/25 transition hover:bg-brand-700">
              <Icon name="external" />
              Mở trên Google Maps
            </a>
            {dir && (
              <a href={dir} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-2xl bg-canvas px-4 py-3.5 font-semibold ring-1 ring-line transition hover:bg-brand-50 hover:text-brand-700">
                <Icon name="navigation" />
                Chỉ đường
              </a>
            )}
          </div>

          <dl className="mt-6 divide-y divide-line rounded-2xl bg-canvas/60 ring-1 ring-line">
            {infoRows.map((r) => (
              <div key={r.label} className="flex gap-3 px-4 py-3 text-sm">
                <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-xl bg-surface text-brand-600 ring-1 ring-line">
                  <Icon name={r.icon} />
                </span>
                <div className="min-w-0">
                  <dt className="text-xs font-medium uppercase tracking-wide text-muted">{r.label}</dt>
                  <dd className="mt-0.5">{r.value}</dd>
                </div>
              </div>
            ))}
          </dl>

          {p.tags.length > 0 && (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {p.tags.map((t) => (
                <span key={t} className="rounded-full bg-surface px-3 py-1 text-sm ring-1 ring-line">
                  #{meta.tags[t] ?? t}
                </span>
              ))}
            </div>
          )}

          {p.openingHours && (
            <section className="mt-6">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Icon name="clock" className="size-4 text-brand-600" />
                Giờ mở cửa
              </h2>
              <table className="mt-2 w-full text-sm">
                <tbody>
                  {WEEKDAYS.map((label, day) => {
                    const periods = p.openingHours!.periods.filter((x) => x.day === day);
                    return (
                      <tr key={day} className="border-b border-line last:border-0">
                        <th scope="row" className="py-1.5 pr-4 text-left font-normal text-muted">
                          {label}
                        </th>
                        <td className="py-1.5 tabular-nums">{periods.length ? periods.map((x) => `${x.open}–${x.close}`).join(', ') : 'Đóng cửa'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="mt-1 text-xs text-muted">Cập nhật {formatDate(p.openingHours.verifiedAt)} · giờ Việt Nam</p>
            </section>
          )}

          <footer className="mt-6 border-t border-line pt-4 text-xs leading-relaxed text-muted">
            <p>
              Nguồn:{' '}
              {provider.attributionUrl ? (
                <a href={provider.attributionUrl} target="_blank" rel="noreferrer" className="underline">
                  {provider.attribution}
                </a>
              ) : (
                provider.attribution
              )}
              {p.providerRefs
                .filter((r) => r.provider === 'osm')
                .map((r) => (
                  <span key={r.providerPlaceId}>
                    {' · '}
                    <a href={`https://www.openstreetmap.org/${r.providerPlaceId}`} target="_blank" rel="noreferrer" className="underline">
                      Đối tượng OSM {r.providerPlaceId}
                    </a>
                  </span>
                ))}
            </p>
            {p.updatedAt && <p className="mt-1">Cập nhật nội dung: {formatDate(p.updatedAt)}</p>}
            {p.isDemo && <p className="mt-1">Đây là dữ liệu minh họa cho bản MVP – hãy kiểm tra lại thông tin trước khi đến.</p>}
          </footer>
        </article>

        <div className="md:sticky md:top-20 md:self-start">
          <PlaceMap place={p} disabledReason={mapDisabled} />
        </div>
      </div>

      {nearby.length > 0 && (
        <section className="mx-auto mt-12 max-w-7xl px-4">
          <h2 className="text-xl font-bold tracking-tight">Gần địa điểm này</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {nearby.map((x) => (
              <PlaceCard key={x.slug} place={x} meta={meta} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
