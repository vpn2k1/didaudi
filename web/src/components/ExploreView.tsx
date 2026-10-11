'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { ApiError, clientApi } from '@/lib/api';
import { applyUserLocation, coarse } from '@/lib/geo';
import type { Category, LatLng, Meta, Province, SearchResponse, SortMode } from '@/lib/types';
import { CATEGORY_ICON, Icon } from './Icon';
import { MapView } from './MapView';
import { PlaceCard } from './PlaceCard';
import { PlaceImage } from './PlaceImage';
import { PhotoAttribution } from './PhotoAttribution';
import { SelectedPlaceCard } from './SelectedPlaceCard';
import { Chip, Notice, PlaceCardSkeleton } from './ui';
import { useUserLocation, type LocationStatus } from './useUserLocation';

const RADII = [1, 2, 5, 10, 20];
const PAGE_SIZE = 24;
const VN_CENTER: LatLng = { lat: 16.2, lng: 106.3 };

interface Props {
  meta: Meta;
  provinces: Province[];
  province: Province | null;
  initial: SearchResponse | null;
  initialQuery?: { q?: string; category?: Category };
}

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Bản đồ chỉ khởi tạo khi thực sự hiển thị (desktop, hoặc mobile ở chế độ Bản đồ). */
function useIsDesktop() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia('(min-width: 1024px)');
      mq.addEventListener('change', cb);
      return () => mq.removeEventListener('change', cb);
    },
    () => window.matchMedia('(min-width: 1024px)').matches,
    () => false,
  );
}

const LOCATION_MESSAGE: Partial<Record<LocationStatus, { tone: 'info' | 'warn'; text: string }>> = {
  locating: { tone: 'info', text: 'Đang xác định vị trí của bạn…' },
  denied: { tone: 'warn', text: 'Bạn đã từ chối quyền vị trí. Bạn vẫn có thể chọn tỉnh/thành hoặc tìm theo từ khóa.' },
  unavailable: { tone: 'warn', text: 'Không xác định được vị trí trên thiết bị này. Hãy chọn tỉnh/thành hoặc tìm theo từ khóa.' },
  timeout: { tone: 'warn', text: 'Lấy vị trí quá lâu. Thử lại hoặc chọn tỉnh/thành.' },
  insecure: { tone: 'warn', text: 'Trình duyệt chỉ cho lấy vị trí trên kết nối HTTPS (hoặc localhost).' },
};

export function ExploreView({ meta, provinces, province, initial, initialQuery }: Props) {
  const router = useRouter();
  const isDesktop = useIsDesktop();
  const [q, setQ] = useState(initialQuery?.q ?? '');
  const debouncedQ = useDebounced(q.trim(), 350);
  const [category, setCategory] = useState<Category | null>(initialQuery?.category ?? null);
  const [cheap, setCheap] = useState(false);
  const [openNow, setOpenNow] = useState(false);
  const [sort, setSort] = useState<SortMode>('relevance');
  const [radius, setRadius] = useState(meta.defaultRadiusKm);
  const location = useUserLocation();
  const nearActive = location.status === 'active' && !!location.loc;

  const [data, setData] = useState<SearchResponse | null>(initial);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(!initial);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [googleData, setGoogleData] = useState<SearchResponse | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [googleError, setGoogleError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [selected, setSelected] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const [view, setView] = useState<'list' | 'map'>('list');
  const provinceSelect = useRef<HTMLSelectElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const googleRequest = useRef<AbortController | null>(null);
  const skipFirst = useRef(!!initial);

  const params = useMemo(
    () => ({
      q: debouncedQ || undefined,
      category: category ?? undefined,
      // "Quanh tôi" tìm theo bán kính trên mọi tỉnh/thành
      province: nearActive ? undefined : province?.slug,
      near: nearActive ? coarse(location.loc!) : undefined,
      radius: nearActive ? radius : undefined,
      price: cheap ? 'cheap' : undefined,
      openNow: openNow ? '1' : undefined,
      sort: sort === 'distance' && !nearActive ? 'relevance' : sort,
      limit: PAGE_SIZE,
    }),
    [debouncedQ, category, nearActive, location.loc, province?.slug, radius, cheap, openNow, sort],
  );

  // Tải trang 1 mỗi khi bộ lọc đổi; hủy request cũ để tránh kết quả lệch
  useEffect(() => {
    googleRequest.current?.abort();
    setGoogleData(null);
    setGoogleError(null);
    setGoogleLoading(false);
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    setError(null);
    clientApi
      .search({ ...params, page: 1 }, ctrl.signal)
      .then((r) => {
        setData(r);
        setPage(1);
        setSelected(null);
      })
      .catch((e) => {
        if (ctrl.signal.aborted) return;
        setError(e instanceof ApiError ? e.message : 'Không tải được dữ liệu. Kiểm tra kết nối và thử lại.');
      })
      .finally(() => !ctrl.signal.aborted && setLoading(false));
    return () => ctrl.abort();
  }, [params, reloadKey]);

  // Giữ từ khóa/danh mục trên URL để chia sẻ được (không reload trang)
  useEffect(() => {
    const url = new URL(window.location.href);
    if (debouncedQ) url.searchParams.set('q', debouncedQ);
    else url.searchParams.delete('q');
    if (category) url.searchParams.set('category', category);
    else url.searchParams.delete('category');
    window.history.replaceState(null, '', url);
  }, [debouncedQ, category]);

  // Khi bật vị trí: mặc định sắp xếp gần nhất
  useEffect(() => {
    if (nearActive) setSort('distance');
    else setSort((s) => (s === 'distance' ? 'relevance' : s));
  }, [nearActive]);

  useEffect(() => {
    if (location.status === 'denied' || location.status === 'unavailable') provinceSelect.current?.focus();
  }, [location.status]);

  const loadMore = async () => {
    setLoadingMore(true);
    try {
      const r = await clientApi.search({ ...params, page: page + 1 });
      setData((d) => (d ? { ...r, items: [...d.items, ...r.items] } : r));
      setPage(page + 1);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Không tải thêm được kết quả.');
    } finally {
      setLoadingMore(false);
    }
  };

  const items = useMemo(() => applyUserLocation(data?.items ?? [], nearActive ? location.loc : null, nearActive ? radius : null, sort), [data, nearActive, location.loc, radius, sort]);
  const selectedPlace = items.find((p) => p.slug === selected) ?? null;
  const provider = data?.provider ?? meta.provider;
  const facets = data?.facets;
  const hasFilters = !!(debouncedQ || category || cheap || openNow);
  const featured = !hasFilters && !nearActive ? items.filter((p) => p.editorPick).slice(0, 6) : [];
  const provinceName = useCallback((slug: string | null) => provinces.find((p) => p.slug === slug)?.name, [provinces]);

  const selectPlace = (slug: string) => {
    setSelected(slug);
    document.getElementById(`place-${slug}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  const center: LatLng = nearActive
    ? location.loc!
    : province?.centerLatitude != null
      ? { lat: province.centerLatitude, lng: province.centerLongitude! }
      : VN_CENTER;

  const resetFilters = () => {
    setQ('');
    setCategory(null);
    setCheap(false);
    setOpenNow(false);
  };

  const categoryLabel = meta.categories.find((item) => item.id === category)?.label;
  const googleQuery = [debouncedQ || categoryLabel || 'địa điểm du lịch', nearActive ? 'gần tôi' : province?.name, 'Việt Nam'].filter(Boolean).join(' ');
  const googleMapsSearchUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(googleQuery)}`;
  const searchGoogle = async () => {
    googleRequest.current?.abort();
    const ctrl = new AbortController();
    googleRequest.current = ctrl;
    setGoogleLoading(true);
    setGoogleError(null);
    try {
      const result = await clientApi.googleSearch({ ...params, limit: 20 }, ctrl.signal);
      setGoogleData(result);
    } catch (e) {
      if (!ctrl.signal.aborted) setGoogleError(e instanceof ApiError ? e.message : 'Không tải được kết quả từ Google Maps.');
    } finally {
      if (googleRequest.current === ctrl) {
        googleRequest.current = null;
        setGoogleLoading(false);
      }
    }
  };

  const locMsg = LOCATION_MESSAGE[location.status];
  const mapDisabled = provider.capabilities.requiresProviderMap ? 'Dữ liệu từ Google chỉ được hiển thị trên bản đồ Google; bản đồ hiện tại đã được ẩn.' : null;
  const showMap = isDesktop || view === 'map';
  const heading = nearActive ? 'Quanh bạn' : province ? `Khám phá ${province.name}` : 'Khám phá Việt Nam';

  return (
    <div className="mx-auto max-w-7xl px-4">
      {/* Card tìm kiếm nổi đè lên hero */}
      <section aria-label="Tìm kiếm" className="relative z-20 -mt-10 rounded-3xl bg-surface p-3 shadow-xl shadow-brand-900/10 ring-1 ring-line md:p-4 lg:sticky lg:top-[68px]">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:gap-0 md:rounded-2xl md:bg-canvas md:p-1.5 md:ring-1 md:ring-line">
          <label className="relative flex-1">
            <span className="sr-only">Tìm địa điểm</span>
            <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Phở, cà phê trứng, bãi biển, Hội An…"
              className="h-12 w-full rounded-2xl bg-canvas pl-12 pr-3 text-[15px] outline-none ring-1 ring-line placeholder:text-muted/80 focus:bg-surface focus:ring-2 focus:ring-brand-500 md:bg-transparent md:ring-0 md:focus:bg-surface"
            />
          </label>
          <span aria-hidden className="mx-1 hidden h-7 w-px bg-line md:block" />
          <div className="flex gap-2">
            <label className="relative flex-1 md:w-56 md:flex-none">
              <span className="sr-only">Chọn tỉnh/thành</span>
              <Icon name="pin" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-brand-600" />
              <select
                ref={provinceSelect}
                value={province?.slug ?? ''}
                onChange={(e) => router.push(e.target.value ? `/${e.target.value}` : '/')}
                className="h-12 w-full appearance-none rounded-2xl bg-canvas pl-10 pr-8 text-[15px] font-medium ring-1 ring-line focus:ring-2 focus:ring-brand-500 md:bg-transparent md:ring-0"
              >
                <option value="">Cả nước</option>
                {provinces.map((p) => (
                  <option key={p.slug} value={p.slug}>
                    {p.name}
                    {p.placeCount ? ` (${p.placeCount})` : ' – chưa có dữ liệu'}
                  </option>
                ))}
              </select>
              <Icon name="chevron" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 rotate-90 text-muted" />
            </label>
            <button
              type="button"
              onClick={nearActive ? location.clear : location.locate}
              disabled={location.status === 'locating'}
              aria-pressed={nearActive}
              className={`inline-flex h-12 shrink-0 items-center gap-2 rounded-2xl px-4 text-[15px] font-semibold transition disabled:opacity-60 md:px-5 ${
                nearActive ? 'bg-brand-50 text-brand-700 ring-1 ring-brand-500' : 'bg-brand-600 text-white shadow-md shadow-brand-600/25 hover:bg-brand-700'
              }`}
            >
              <Icon name={nearActive ? 'x' : 'locate'} className={`size-5 ${location.status === 'locating' ? 'animate-spin' : ''}`} />
              <span>{location.status === 'locating' ? 'Đang định vị…' : nearActive ? 'Tắt quanh tôi' : 'Tìm quanh tôi'}</span>
            </button>
          </div>
        </div>

        {/* Danh mục */}
        <div className="mt-3 flex gap-2 overflow-x-auto pb-0.5 [scrollbar-width:none]" role="group" aria-label="Danh mục">
          <Chip active={!category} onClick={() => setCategory(null)}>
            Tất cả
          </Chip>
          {meta.categories.map((c) => (
            <Chip key={c.id} active={category === c.id} onClick={() => setCategory(category === c.id ? null : c.id)}>
              <Icon name={CATEGORY_ICON[c.id]} />
              {c.label}
              {province?.byCategory[c.id] != null && !nearActive && <span className="text-xs opacity-60">{province.byCategory[c.id]}</span>}
            </Chip>
          ))}
          <span aria-hidden className="mx-1 w-px shrink-0 bg-line" />
          {/* Bộ lọc nhanh – chỉ hiện khi dữ liệu hỗ trợ */}
          <Chip active={nearActive} onClick={nearActive ? location.clear : location.locate}>
            <Icon name="pin" /> Gần tôi
          </Chip>
          {provider.capabilities.rating && (
            <Chip active={sort === 'rating'} onClick={() => setSort(sort === 'rating' ? 'relevance' : 'rating')}>
              <Icon name="star" /> Đánh giá cao
            </Chip>
          )}
          {(facets?.hasPriceData || cheap) && (
            <Chip active={cheap} onClick={() => setCheap(!cheap)} title={`Giá tối đa ≤ ${meta.cheapMaxVnd.toLocaleString('vi-VN')}đ`}>
              <Icon name="tag" /> Giá rẻ
            </Chip>
          )}
          {(facets?.hasOpeningHours || openNow) && (
            <Chip active={openNow} onClick={() => setOpenNow(!openNow)}>
              <Icon name="clock" /> Đang mở cửa
            </Chip>
          )}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
          <a href={googleMapsSearchUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-900">
            Tìm thêm trên Google Maps ↗
          </a>
          {meta.googleSearchAvailable && provider.id === 'local' && (
            <button type="button" onClick={searchGoogle} disabled={googleLoading} className="rounded-full bg-brand-50 px-3 py-1.5 font-semibold text-brand-700 ring-1 ring-brand-100 hover:bg-brand-100 disabled:opacity-60">
              {googleLoading ? 'Đang tìm trên Google Maps…' : 'Xem kết quả Google Maps tại đây'}
            </button>
          )}
        </div>
      </section>

      {/* Trạng thái vị trí */}
      {(nearActive || locMsg) && (
        <div className="mt-4 space-y-2">
          {nearActive && (
            <Notice>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>
                  Đang tìm quanh vị trí của bạn
                  {location.accuracy != null && <span className="opacity-70"> (sai số ~{Math.round(location.accuracy)} m)</span>} trong bán kính
                </span>
                <select value={radius} onChange={(e) => setRadius(Number(e.target.value))} aria-label="Bán kính tìm kiếm" className="rounded-full bg-white px-3 py-1 font-semibold ring-1 ring-brand-100">
                  {RADII.map((r) => (
                    <option key={r} value={r}>
                      {r} km
                    </option>
                  ))}
                </select>
              </div>
              <p className="mt-1 text-xs opacity-75">Vị trí chính xác chỉ dùng trên máy bạn; máy chủ chỉ nhận vị trí làm tròn ~1 km.</p>
            </Notice>
          )}
          {locMsg && (
            <Notice tone={locMsg.tone}>
              <span>{locMsg.text}</span>
              {['timeout', 'unavailable'].includes(location.status) && (
                <button type="button" onClick={location.locate} className="ml-2 font-semibold underline">
                  Thử lại
                </button>
              )}
            </Notice>
          )}
        </div>
      )}

      {(googleData || googleError) && (
        <section aria-label="Kết quả Google Maps" className="mt-6 rounded-3xl bg-surface p-4 ring-1 ring-line md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold">Kết quả trực tiếp từ Google Maps</h2>
            <span translate="no" className="font-sans text-sm font-normal text-[#5e5e5e]">Google Maps</span>
          </div>
          {googleError && <p className="mt-3 text-sm text-red-700">{googleError}</p>}
          {googleData && (
            <>
              <p className="mt-1 text-xs text-muted">Tối đa 20 kết quả cho lần tìm này. Mở địa điểm trên Google Maps để xem thêm thông tin.</p>
              {googleData.items.length === 0 ? <p className="mt-4 text-sm text-muted">Không tìm thấy địa điểm phù hợp.</p> : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {googleData.items.map((item) => (
                    <article key={item.id} className="rounded-2xl bg-canvas p-4 ring-1 ring-line">
                      {item.photo && (
                        <>
                          <PlaceImage place={item} className="mb-2 h-36 rounded-xl" credit="none" />
                          <PhotoAttribution photo={item.photo} className="mb-2" />
                        </>
                      )}
                      <a href={item.googleMapsUrl} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 hover:underline">{item.name} ↗</a>
                      {item.address && <p className="mt-1 text-sm text-muted">{item.address}</p>}
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
                        {item.rating != null && <span>★ {item.rating.toFixed(1)}{item.ratingCount != null && ` (${item.ratingCount})`}</span>}
                        {item.openStatus === 'open' && <span>Đang mở cửa</span>}
                        {item.openStatus === 'closed' && <span>Đã đóng cửa</span>}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}
        </section>
      )}

      {featured.length > 0 && view === 'list' && (
        <section className="mt-8" aria-labelledby="featured-heading">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 id="featured-heading" className="flex items-center gap-2 text-xl font-bold tracking-tight">
                <Icon name="sparkles" className="size-5 text-amber-500" />
                Được biên tập chọn
              </h2>
              <p className="text-sm text-muted">Những địa điểm đội ngũ biên tập đánh dấu nổi bật{province ? ` tại ${province.name}` : ''}.</p>
            </div>
          </div>
          <div className="-mx-4 mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-3 [scrollbar-width:thin]">
            {featured.map((p) => (
              <div key={p.slug} className="w-64 shrink-0 snap-start">
                <PlaceCard place={p} meta={meta} variant="feature" provinceName={province ? undefined : provinceName(p.provinceSlug)} />
              </div>
            ))}
          </div>
        </section>
      )}

      <div ref={resultsRef} className="mt-8 grid scroll-mt-16 grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
        {/* Danh sách */}
        <section aria-labelledby="results-heading" className={`min-w-0 ${view === 'map' ? 'hidden lg:block' : ''}`}>
          <div className="flex items-end justify-between gap-3">
            <div>
              <h2 id="results-heading" className="text-xl font-bold tracking-tight">
                {heading}
              </h2>
              {items.some((p) => p.isDemo) && !loading && <p className="text-xs text-muted">Nhãn “Dữ liệu minh họa”: nội dung demo, chưa được xác minh thực tế.</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <p className="hidden text-sm text-muted sm:block" aria-live="polite">
                {/* Khi tìm quanh tôi, server lọc theo tọa độ làm tròn nên tổng là xấp xỉ */}
                {loading ? 'Đang tải…' : data ? `${nearActive ? '≈ ' : ''}${data.total} địa điểm` : ''}
              </p>
              <label>
                <span className="sr-only">Sắp xếp</span>
                <select value={sort} onChange={(e) => setSort(e.target.value as SortMode)} className="rounded-full bg-surface px-3 py-1.5 text-sm font-medium ring-1 ring-line">
                  <option value="relevance">Phù hợp nhất</option>
                  {nearActive && <option value="distance">Gần nhất</option>}
                  {provider.capabilities.rating && <option value="rating">Đánh giá cao</option>}
                </select>
              </label>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {error && (
              <Notice tone="error">
                {error}{' '}
                <button type="button" onClick={() => setReloadKey((k) => k + 1)} className="font-semibold underline">
                  Thử lại
                </button>
              </Notice>
            )}
            {loading && Array.from({ length: 6 }, (_, i) => <PlaceCardSkeleton key={i} />)}
            {!loading && !error && items.length === 0 && (
              <div className="rounded-3xl bg-surface p-10 text-center ring-1 ring-line">
                <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-600">
                  <Icon name="map" className="size-7" />
                </div>
                <p className="mt-4 text-lg font-semibold">Chưa có địa điểm phù hợp</p>
                <p className="mx-auto mt-1 max-w-sm text-sm text-muted">
                  {nearActive
                    ? `Không có địa điểm nào trong bán kính ${radius} km. Dữ liệu demo hiện có ở Hà Nội, Đà Nẵng và Ninh Bình.`
                    : province && !province.placeCount
                      ? `${province.name} chưa có địa điểm nào. Dữ liệu sẽ được bổ sung dần.`
                      : 'Thử từ khóa khác hoặc bỏ bớt bộ lọc.'}
                </p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {hasFilters && (
                    <button type="button" onClick={resetFilters} className="rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-line hover:bg-canvas">
                      Bỏ bộ lọc
                    </button>
                  )}
                  {nearActive && radius < 20 && (
                    <button type="button" onClick={() => setRadius(RADII.find((r) => r > radius) ?? 20)} className="rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white">
                      Tăng bán kính
                    </button>
                  )}
                  {(nearActive || province) && (
                    <button type="button" onClick={() => (nearActive ? location.clear() : router.push('/'))} className="rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-line hover:bg-canvas">
                      Xem cả nước
                    </button>
                  )}
                </div>
              </div>
            )}
            {!loading &&
              items.map((p) => (
                <PlaceCard
                  key={p.slug}
                  place={p}
                  meta={meta}
                  provinceName={province ? undefined : provinceName(p.provinceSlug)}
                  selected={selected === p.slug}
                  onSelect={() => selectPlace(p.slug)}
                  onHover={(h) => setHover(h ? p.slug : null)}
                />
              ))}
          </div>

          {!loading && data && data.items.length < data.total && (
            <button
              type="button"
              onClick={loadMore}
              disabled={loadingMore}
              className="mt-5 w-full rounded-2xl bg-surface py-3.5 text-sm font-semibold ring-1 ring-line transition hover:bg-brand-50 hover:text-brand-700 disabled:opacity-60"
            >
              {loadingMore ? 'Đang tải…' : `Xem thêm ${data.total - data.items.length} địa điểm`}
            </button>
          )}

          <p className="mt-5 text-xs text-muted">
            Nguồn:{' '}
            {provider.attributionUrl ? (
              <a href={provider.attributionUrl} target="_blank" rel="noreferrer" className="underline">
                {provider.attribution}
              </a>
            ) : (
              provider.attribution
            )}
          </p>
        </section>

        {/* Bản đồ */}
        <section aria-label="Bản đồ" className={`min-w-0 ${view === 'list' ? 'hidden lg:block' : ''}`}>
          <div className="relative lg:sticky lg:top-[236px]">
            {showMap && (
              <MapView
                places={items}
                center={center}
                zoom={province || nearActive ? 13 : 5}
                userLoc={nearActive ? location.loc : null}
                selectedSlug={selected}
                highlightSlug={hover}
                onSelect={selectPlace}
                disabledReason={mapDisabled}
                className="h-[calc(100dvh-180px)] min-h-[380px] rounded-3xl shadow-sm ring-1 ring-line lg:h-[calc(100dvh-260px)]"
              />
            )}
            {selectedPlace && (
              <div className="absolute inset-x-3 bottom-3 z-10 lg:bottom-auto lg:right-14 lg:top-3">
                <SelectedPlaceCard place={selectedPlace} meta={meta} onClose={() => setSelected(null)} />
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Nút nổi chuyển Danh sách/Bản đồ trên mobile */}
      <div className="pointer-events-none fixed inset-x-0 bottom-5 z-30 flex justify-center lg:hidden">
        <button
          type="button"
          onClick={() => {
            setView(view === 'list' ? 'map' : 'list');
            requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
          }}
          className="pointer-events-auto inline-flex items-center gap-2 rounded-full bg-brand-900 px-5 py-3 text-sm font-semibold text-white shadow-xl shadow-brand-900/30"
        >
          <Icon name={view === 'list' ? 'map' : 'list'} className="size-4" />
          {view === 'list' ? 'Xem bản đồ' : 'Xem danh sách'}
        </button>
      </div>
    </div>
  );
}
