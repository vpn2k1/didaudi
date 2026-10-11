'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ApiError, clientApi } from '@/lib/api';
import { formatPriceLevel } from '@/lib/format';
import { coarse, formatDistance, haversineKm } from '@/lib/geo';
import { INTENTS, type Field, type IntentConfig } from '@/lib/intents';
import type { LatLng, Meta, PlaceSummary, PlanResult, PlanStop, Province } from '@/lib/types';
import { Icon } from '../Icon';
import { MapView } from '../MapView';
import { PlaceCard } from '../PlaceCard';
import { PlaceImage } from '../PlaceImage';
import { PhotoAttribution } from '../PhotoAttribution';
import { DemoBadge, Notice, Pill, Skeleton } from '../ui';
import { useUserLocation } from '../useUserLocation';
import { LocationPicker, type LocationValue } from './LocationPicker';

type Values = Record<string, string | string[]>;

function initialValues(intent: IntentConfig, sp: URLSearchParams): Values {
  const v: Values = {};
  for (const f of intent.fields) {
    if (f.kind === 'single') v[f.key] = sp.get(f.key) ?? f.defaultValue ?? '';
    if (f.kind === 'multi') v[f.key] = sp.get(f.key)?.split(',').filter(Boolean) ?? [];
  }
  return v;
}

function initialLocation(sp: URLSearchParams): LocationValue {
  if (sp.get('province')) return { mode: 'province', province: sp.get('province')! };
  const from = sp.get('from')?.split(',').map(Number);
  if (from?.length === 2 && from.every(Number.isFinite)) return { mode: 'place', lat: from[0]!, lng: from[1]!, label: sp.get('fromLabel') ?? 'Điểm đã chọn' };
  if (sp.get('loc') === 'gps') return { mode: 'gps' };
  return null;
}

/** Link Google Maps chỉ đường qua các điểm (deep link miễn phí, tối đa 9 điểm dừng). */
function googleRouteUrl(origin: LatLng, stops: PlanStop[]): string | null {
  const pts = stops.map((s) => s.place).filter((p) => p.latitude != null && p.longitude != null);
  if (!pts.length) return null;
  const last = pts[pts.length - 1]!;
  const waypoints = pts
    .slice(0, -1)
    .slice(0, 9)
    .map((p) => `${p.latitude},${p.longitude}`)
    .join('|');
  return `https://www.google.com/maps/dir/?api=1&origin=${origin.lat},${origin.lng}&destination=${last.latitude},${last.longitude}${waypoints ? `&waypoints=${encodeURIComponent(waypoints)}` : ''}`;
}

export function PlannerView({ intent, meta, provinces }: { intent: IntentConfig; meta: Meta; provinces: Province[] }) {
  const gps = useUserLocation();
  const [values, setValues] = useState<Values>(() => initialValues(intent, new URLSearchParams()));
  const [location, setLocation] = useState<LocationValue>(null);
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [stops, setStops] = useState<PlanStop[]>([]);
  const [alts, setAlts] = useState<Record<string, PlaceSummary[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const pendingSubmit = useRef(false);
  const resultsRef = useRef<HTMLDivElement>(null);
  const locField = intent.fields.find((f) => f.kind === 'location') as Extract<Field, { kind: 'location' }>;

  // Khôi phục từ URL (chia sẻ được) – chạy ở client để tránh lệch SSR
  const [booted, setBooted] = useState(false);
  useEffect(() => {
    const sp = new URLSearchParams(window.location.search);
    setValues(initialValues(intent, sp));
    setLocation(initialLocation(sp));
    setBooted(true);
  }, [intent]);

  const buildParams = useCallback((): Record<string, string> | null => {
    const p: Record<string, string> = { intent: intent.id };
    if (!location) return null;
    if (location.mode === 'gps') {
      if (!gps.loc) return null;
      p.near = coarse(gps.loc);
    } else if (location.mode === 'province') p.province = location.province;
    else {
      p.from = `${location.lat.toFixed(5)},${location.lng.toFixed(5)}`;
      p.fromLabel = location.label;
    }
    for (const f of intent.fields) {
      const v = values[f.key];
      if (f.kind === 'single' && typeof v === 'string' && v) p[f.key] = v;
      if (f.kind === 'multi' && Array.isArray(v) && v.length) p[f.key] = v.join(',');
    }
    // Chọn tỉnh = tìm trong cả tỉnh, không giới hạn bán kính
    if (location.mode === 'province') delete p.radius;
    return p;
  }, [intent, location, gps.loc, values]);

  const submit = useCallback(async () => {
    setFormError(null);
    if (!location) return setFormError('Hãy chọn điểm xuất phát: vị trí của bạn, tỉnh/thành hoặc nhập địa điểm.');
    if (location.mode === 'gps' && !gps.loc) {
      pendingSubmit.current = true;
      return gps.locate();
    }
    const params = buildParams();
    if (!params) return;
    setLoading(true);
    setError(null);
    try {
      const { plan } = await clientApi.plan(params);
      setPlan(plan);
      setStops(plan.stops);
      setAlts(plan.alternatives);
      setSelected(null);
      // Lưu lên URL để chia sẻ – không ghi tọa độ GPS
      const url = new URL(window.location.href);
      url.search = '';
      for (const [k, v] of Object.entries(params)) if (k !== 'near' && k !== 'intent') url.searchParams.set(k, v);
      if (location.mode === 'gps') url.searchParams.set('loc', 'gps');
      window.history.replaceState(null, '', url);
      requestAnimationFrame(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'Không tạo được gợi ý. Thử lại sau.');
    } finally {
      setLoading(false);
    }
  }, [location, gps, buildParams]);

  // Sau khi lấy được GPS theo yêu cầu "Gợi ý" → tự chạy tiếp
  useEffect(() => {
    if (gps.status === 'active' && pendingSubmit.current) {
      pendingSubmit.current = false;
      void submit();
    }
    if (['denied', 'unavailable', 'timeout', 'insecure'].includes(gps.status)) pendingSubmit.current = false;
  }, [gps.status, submit]);

  // Mở link chia sẻ có sẵn thông tin → tự gợi ý
  // Chỉ tự chạy với thông tin có sẵn trên URL lúc mở trang, không tự chạy khi người dùng đang điền form
  const autoRun = useRef<'pending' | 'done' | null>(null);
  useEffect(() => {
    if (!booted || autoRun.current === 'done') return;
    if (autoRun.current === null) autoRun.current = location ? 'pending' : 'done';
    if (autoRun.current !== 'pending' || !location) return;
    if (location.mode === 'gps' && !gps.loc) return;
    autoRun.current = 'done';
    void submit();
  }, [booted, location, gps.loc, submit]);

  // Khoảng cách chính xác (chỉ trên máy) khi dùng GPS
  const origin = useMemo<LatLng | null>(
    () => (plan ? (location?.mode === 'gps' && gps.loc ? gps.loc : { lat: plan.anchor.lat, lng: plan.anchor.lng }) : null),
    [plan, location?.mode, gps.loc],
  );
  const dist = useCallback((p: PlaceSummary, fallback: number) => (origin && p.latitude != null && p.longitude != null ? haversineKm(origin, { lat: p.latitude, lng: p.longitude }) : fallback), [origin]);

  const shownStops = useMemo(() => {
    let prev = origin;
    return stops.map((s) => {
      const here = s.place.latitude != null ? { lat: s.place.latitude, lng: s.place.longitude! } : null;
      const legKm = prev && here ? haversineKm(prev, here) : s.legKm;
      prev = here ?? prev;
      return { ...s, distanceKm: dist(s.place, s.distanceKm), legKm };
    });
  }, [stops, origin, dist]);

  const more = useMemo(
    () => (plan?.more ?? []).map((p) => ({ ...p, distanceKm: dist(p, p.distanceKm) })).sort((a, b) => a.distanceKm - b.distanceKm),
    [plan, dist],
  );

  const swap = (slotKey: string) => {
    const list = alts[slotKey];
    if (!list?.length) return;
    setStops((cur) => {
      const i = cur.findIndex((s) => s.slotKey === slotKey);
      if (i < 0) return cur;
      const old = cur[i]!;
      setAlts((a) => ({ ...a, [slotKey]: [...list.slice(1), old.place] }));
      const next = [...cur];
      next[i] = { ...old, place: list[0]!, reasons: list[0]!.reasons, tip: undefined };
      return next;
    });
  };

  const numbers = useMemo(() => Object.fromEntries(shownStops.map((s) => [s.place.slug, s.order])), [shownStops]);
  const mapPlaces = useMemo(() => [...shownStops.map((s) => s.place), ...more.slice(0, 12)], [shownStops, more]);
  const route = useMemo(
    () => (plan?.showRoute && origin ? [origin, ...shownStops.filter((s) => s.place.latitude != null).map((s) => ({ lat: s.place.latitude!, lng: s.place.longitude! }))] : null),
    [plan?.showRoute, origin, shownStops],
  );
  const routeUrl = origin && plan?.showRoute ? googleRouteUrl(origin, shownStops) : null;
  const isList = intent.id === 'food' || intent.id === 'cafe';

  const setSingle = (key: string, v: string, optional?: boolean) => setValues((s) => ({ ...s, [key]: optional && s[key] === v ? '' : v }));
  const toggleMulti = (key: string, v: string) =>
    setValues((s) => {
      const cur = (s[key] as string[]) ?? [];
      return { ...s, [key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] };
    });

  return (
    <div className="mx-auto -mt-10 grid max-w-7xl grid-cols-1 gap-6 px-4 lg:grid-cols-[400px_minmax(0,1fr)]">
      {/* Form */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        className="relative z-10 h-fit space-y-6 rounded-3xl bg-surface p-5 shadow-xl shadow-ink/5 ring-1 ring-line lg:sticky lg:top-20"
        aria-label={`Thông tin để gợi ý ${intent.title.toLowerCase()}`}
      >
        <LocationPicker label={locField.label} modes={locField.modes} value={location} onChange={setLocation} provinces={provinces} gps={gps} />

        {intent.fields.map((f) => {
          if (f.kind === 'single') {
            if (f.key === 'radius' && location?.mode === 'province') return null;
            return (
              <fieldset key={f.key}>
                <legend className="text-sm font-semibold">
                  {f.label}
                  {f.optional && <span className="ml-1 font-normal text-muted">(tùy chọn)</span>}
                </legend>
                <div role="radiogroup" aria-label={f.label} className="mt-2 flex flex-wrap gap-2">
                  {f.options.map((o) => {
                    const on = values[f.key] === o.value;
                    return (
                      <button
                        key={o.value || 'any'}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setSingle(f.key, o.value, f.optional)}
                        className={`rounded-2xl px-3.5 py-2 text-sm font-medium transition ${on ? 'bg-brand-900 text-white shadow-md' : 'bg-canvas ring-1 ring-line hover:ring-brand-500'}`}
                      >
                        {o.label}
                        {o.hint && <span className={`ml-1 text-xs ${on ? 'text-white/70' : 'text-muted'}`}>· {o.hint}</span>}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            );
          }
          if (f.kind === 'multi') {
            return (
              <fieldset key={f.key}>
                <legend className="text-sm font-semibold">
                  {f.label}
                  {f.hint && <span className="ml-1 font-normal text-muted">({f.hint})</span>}
                </legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {f.options.map((o) => {
                    const on = ((values[f.key] as string[]) ?? []).includes(o.value);
                    return (
                      <button
                        key={o.value}
                        type="button"
                        aria-pressed={on}
                        onClick={() => toggleMulti(f.key, o.value)}
                        className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${on ? 'bg-brand-600 text-white shadow-md' : 'bg-canvas ring-1 ring-line hover:ring-brand-500'}`}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            );
          }
          return null;
        })}

        {formError && (
          <p role="alert" className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-900 ring-1 ring-red-200">
            {formError}
          </p>
        )}
        <button
          type="submit"
          disabled={loading || gps.status === 'locating'}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700 disabled:opacity-60"
        >
          <Icon name="sparkles" className="size-5" />
          {loading ? 'Đang tìm gợi ý…' : intent.cta}
        </button>
        <p className="text-center text-xs text-muted">Gợi ý dựa trên quy tắc rõ ràng (khoảng cách, sở thích, thời điểm, ngân sách) – không dùng đánh giá ảo.</p>
      </form>

      {/* Kết quả */}
      <section ref={resultsRef} aria-live="polite" aria-busy={loading} className="min-w-0 scroll-mt-20 space-y-6 lg:pt-14">
        {!plan && !loading && !error && <EmptyHint intent={intent} />}
        {loading && (
          <div className="space-y-4">
            <Skeleton className="h-10 w-2/3" />
            <Skeleton className="h-80 w-full rounded-3xl" />
            <Skeleton className="h-40 w-full rounded-3xl" />
          </div>
        )}
        {error && (
          <Notice tone="error">
            {error}{' '}
            <button type="button" onClick={() => void submit()} className="font-semibold underline">
              Thử lại
            </button>
          </Notice>
        )}

        {plan && !loading && (
          <>
            <header className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="flex items-center gap-1.5 text-sm font-medium text-brand-700">
                  <Icon name="pin" className="size-4" />
                  {plan.anchor.label}
                  {plan.radiusKm != null && <span className="text-muted"> · bán kính {plan.radiusKm} km</span>}
                </p>
                <h2 className="text-2xl font-bold tracking-tight md:text-3xl">{plan.title}</h2>
                {intent.id === 'travel' && shownStops.length > 0 && <p className="text-sm text-muted">Sắp xếp từ gần đến xa so với điểm xuất phát.</p>}
              </div>
              {routeUrl && (
                <a
                  href={routeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-brand-900 px-4 py-2 text-sm font-semibold text-white shadow-md hover:bg-brand-700"
                >
                  <Icon name="navigation" className="size-4" /> Mở lộ trình trên Google Maps
                </a>
              )}
            </header>

            {plan.notes.length > 0 && (
              <Notice>
                <ul className="space-y-0.5">
                  {plan.notes.map((n) => (
                    <li key={n}>{n}</li>
                  ))}
                </ul>
              </Notice>
            )}

            <div className="relative">
              <MapView
                places={mapPlaces}
                center={origin ?? { lat: plan.anchor.lat, lng: plan.anchor.lng }}
                zoom={13}
                userLoc={origin}
                userLabel={plan.anchor.label}
                numbers={numbers}
                route={route}
                selectedSlug={selected}
                onSelect={(slug) => {
                  setSelected(slug);
                  document.getElementById(`stop-${slug}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className="h-[360px] rounded-3xl shadow-sm ring-1 ring-line md:h-[440px]"
                label={`Bản đồ ${plan.title}`}
              />
              <div className="pointer-events-none absolute left-3 top-3 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                <span className="rounded-full bg-white/95 px-2.5 py-1 shadow ring-1 ring-line">
                  <span className="mr-1 inline-block size-2.5 rounded-full bg-blue-600 align-middle" /> Điểm xuất phát
                </span>
                {shownStops.length > 0 && (
                  <span className="rounded-full bg-white/95 px-2.5 py-1 shadow ring-1 ring-line">
                    <span className="mr-1 inline-grid size-4 place-items-center rounded-full bg-brand-700 align-middle text-[9px] text-white">1</span> {isList ? 'Gợi ý hàng đầu' : 'Lịch trình'}
                  </span>
                )}
              </div>
            </div>

            {shownStops.length > 0 && (
              <ol className="relative space-y-4">
                {shownStops.map((s, i) => {
                  const dayHeader = s.day && s.day !== shownStops[i - 1]?.day;
                  return (
                    <li key={s.slotKey} id={`stop-${s.place.slug}`} className="scroll-mt-24">
                      {dayHeader && <h3 className="mb-3 mt-2 text-lg font-bold text-brand-900">Ngày {s.day}</h3>}
                      <StopCard stop={s} meta={meta} selected={selected === s.place.slug} canSwap={!!alts[s.slotKey]?.length} onSwap={() => swap(s.slotKey)} isList={isList} last={i === shownStops.length - 1} />
                    </li>
                  );
                })}
              </ol>
            )}

            {more.length > 0 && (
              <div>
                <h3 className="text-lg font-bold tracking-tight">{intent.id === 'travel' ? 'Các điểm khác – từ gần đến xa' : 'Lựa chọn khác gần đó'}</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {more.slice(0, 12).map((p) => (
                    <PlaceCard key={p.slug} place={p} meta={meta} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

function StopCard({ stop: s, meta, selected, canSwap, onSwap, isList, last }: { stop: PlanStop; meta: Meta; selected: boolean; canSwap: boolean; onSwap: () => void; isList: boolean; last: boolean }) {
  const p = s.place;
  const cat = meta.categories.find((c) => c.id === p.category);
  const price = formatPriceLevel(p.priceLevel);
  const dir = p.latitude != null ? `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}` : null;
  return (
    <div className="relative flex gap-3 md:gap-4">
      {/* Cột số thứ tự + đường nối */}
      <div className="flex flex-col items-center">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-700 text-base font-extrabold text-white shadow-md ring-4 ring-brand-50">{s.order}</span>
        {!last && !isList && <span aria-hidden className="mt-1 w-0.5 flex-1 border-l-2 border-dashed border-brand-500/50" />}
      </div>
      <article className={`group mb-1 flex min-w-0 flex-1 flex-col overflow-hidden rounded-3xl bg-surface shadow-sm transition hover:shadow-lg sm:flex-row ${selected ? 'ring-2 ring-brand-500' : 'ring-1 ring-line'}`}>
        <div className="w-full shrink-0 sm:w-56">
          <PlaceImage place={p} credit="none" className="h-44 w-full" />
          <PhotoAttribution photo={p.photo} className="px-3 py-2" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-2 p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="rounded-full bg-brand-50 px-2.5 py-0.5 uppercase tracking-wide text-brand-700">{s.slotLabel}</span>
            <span className="text-muted">{cat?.label}</span>
          </div>
          <h4 className="text-lg font-bold leading-snug">
            <Link href={`/dia-diem/${p.slug}`} className="hover:text-brand-700">
              {p.name}
            </Link>
          </h4>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
            <span className="inline-flex items-center gap-1 font-semibold text-ink">
              <Icon name="navigation" className="size-3.5 text-brand-600" />
              {formatDistance(s.distanceKm)} từ điểm xuất phát
            </span>
            {!isList && s.order > 1 && <span>↳ cách điểm trước {formatDistance(s.legKm)}</span>}
            {p.address && <span className="truncate">{p.address}</span>}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {p.isDemo && <DemoBadge />}
            {price && (
              <Pill>
                <Icon name="tag" className="size-3" /> {price}
                {p.priceLevel ? '/người' : ''} · ước tính
              </Pill>
            )}
            {s.reasons.map((r) => (
              <Pill key={r} tone="brand">
                {r}
              </Pill>
            ))}
          </div>
          {s.tip && (
            <p className="rounded-2xl bg-amber-50 px-3 py-2 text-sm text-amber-900 ring-1 ring-amber-200">
              💡 <span className="font-medium">Gợi ý chụp ảnh:</span> {s.tip}
            </p>
          )}
          <div className="mt-auto flex flex-wrap gap-2 pt-1 text-sm font-semibold">
            <Link href={`/dia-diem/${p.slug}`} className="rounded-full bg-brand-600 px-4 py-1.5 text-white hover:bg-brand-700">
              Chi tiết
            </Link>
            {dir && (
              <a href={dir} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-canvas px-4 py-1.5 ring-1 ring-line hover:ring-brand-500">
                <Icon name="navigation" className="size-3.5" /> Chỉ đường
              </a>
            )}
            {canSwap && (
              <button type="button" onClick={onSwap} className="inline-flex items-center gap-1 rounded-full bg-canvas px-4 py-1.5 ring-1 ring-line hover:ring-brand-500">
                ↻ Đổi địa điểm khác
              </button>
            )}
          </div>
        </div>
      </article>
    </div>
  );
}

function EmptyHint({ intent }: { intent: IntentConfig }) {
  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-3xl bg-surface ring-1 ring-line">
        <div className="grid gap-0 sm:grid-cols-3">
          {[
            { n: 1, t: 'Chọn điểm xuất phát', d: 'Vị trí của bạn, một tỉnh/thành hoặc địa điểm cụ thể.' },
            { n: 2, t: 'Cho biết mong muốn', d: intent.id === 'travel' ? 'Phong cách, thời gian, khoảng cách.' : 'Ngân sách, thời gian, sở thích.' },
            { n: 3, t: 'Nhận gợi ý trên bản đồ', d: intent.id === 'travel' ? 'Điểm chụp ảnh sắp từ gần đến xa.' : 'Lịch trình đánh số, đổi được từng điểm.' },
          ].map((s) => (
            <div key={s.n} className="border-line p-5 sm:border-r last:sm:border-r-0">
              <span className="grid size-9 place-items-center rounded-full bg-brand-50 font-bold text-brand-700">{s.n}</span>
              <p className="mt-3 font-semibold">{s.t}</p>
              <p className="mt-1 text-sm text-muted">{s.d}</p>
            </div>
          ))}
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-muted">Hoặc thử nhu cầu khác</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {INTENTS.filter((i) => i.id !== intent.id).map((i) => (
            <Link key={i.id} href={`/goi-y/${i.slug}`} className="rounded-full bg-surface px-4 py-2 text-sm font-semibold ring-1 ring-line hover:ring-brand-500">
              {i.title}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
