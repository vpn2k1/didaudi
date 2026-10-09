'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { clientApi } from '@/lib/api';
import type { LocationMode } from '@/lib/intents';
import type { LocationSuggestion, Province } from '@/lib/types';
import { Icon } from '../Icon';
import type { useUserLocation } from '../useUserLocation';

export type LocationValue =
  | { mode: 'gps' }
  | { mode: 'province'; province: string }
  | { mode: 'place'; label: string; lat: number; lng: number }
  | null;

const MODE_LABEL: Record<LocationMode, string> = { gps: 'Vị trí tôi', province: 'Chọn tỉnh', place: 'Nhập điểm' };
const MODE_TITLE: Record<LocationMode, string> = { gps: 'Dùng vị trí hiện tại của tôi', province: 'Chọn 1 trong 34 tỉnh/thành', place: 'Nhập địa điểm, khu vực' };
const MODE_ICON = { gps: 'locate', province: 'map', place: 'search' } as const;

interface Props {
  label: string;
  modes: LocationMode[];
  value: LocationValue;
  onChange: (v: LocationValue) => void;
  provinces: Pick<Province, 'slug' | 'name' | 'placeCount'>[];
  gps: ReturnType<typeof useUserLocation>;
}

export function LocationPicker({ label, modes, value, onChange, provinces, gps }: Props) {
  const [mode, setMode] = useState<LocationMode>(value?.mode ?? modes[0]!);
  const groupId = useId();

  useEffect(() => {
    if (value?.mode && value.mode !== mode) setMode(value.mode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value?.mode]);

  return (
    <fieldset>
      <legend className="text-sm font-semibold">{label}</legend>
      <div role="tablist" aria-label={label} className="mt-2 grid grid-cols-3 gap-1 rounded-2xl bg-canvas p-1 ring-1 ring-line">
        {modes.map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            id={`${groupId}-${m}`}
            aria-selected={mode === m}
            title={MODE_TITLE[m]}
            onClick={() => {
              setMode(m);
              if (m === 'gps' && gps.status === 'active') onChange({ mode: 'gps' });
              else if (m !== value?.mode) onChange(null);
            }}
            className={`flex items-center justify-center gap-1.5 rounded-xl px-2 py-2 text-xs font-semibold transition sm:text-sm ${
              mode === m ? 'bg-surface text-brand-700 shadow-sm ring-1 ring-line' : 'text-muted hover:text-ink'
            }`}
          >
            <Icon name={MODE_ICON[m]} className="size-4 shrink-0" />
            <span className="truncate">{MODE_LABEL[m]}</span>
          </button>
        ))}
      </div>

      <div className="mt-3" role="tabpanel" aria-labelledby={`${groupId}-${mode}`}>
        {mode === 'gps' && <GpsPanel gps={gps} onReady={() => onChange({ mode: 'gps' })} />}
        {mode === 'province' && (
          <label className="relative block">
            <span className="sr-only">Tỉnh/thành</span>
            <Icon name="pin" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-brand-600" />
            <select
              value={value?.mode === 'province' ? value.province : ''}
              onChange={(e) => onChange(e.target.value ? { mode: 'province', province: e.target.value } : null)}
              className="h-12 w-full appearance-none rounded-2xl bg-surface pl-10 pr-9 font-medium ring-1 ring-line focus:ring-2 focus:ring-brand-500"
            >
              <option value="">— Chọn 1 trong 34 tỉnh/thành —</option>
              {provinces.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.name}
                  {p.placeCount ? ` (${p.placeCount} địa điểm)` : ' – chưa có dữ liệu'}
                </option>
              ))}
            </select>
            <Icon name="chevron" className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 rotate-90 text-muted" />
          </label>
        )}
        {mode === 'place' && <PlaceSearch value={value?.mode === 'place' ? value : null} onPick={(s) => onChange(s.type === 'province' ? { mode: 'province', province: s.provinceSlug } : { mode: 'place', label: s.label, lat: s.lat, lng: s.lng })} />}
      </div>
    </fieldset>
  );
}

function GpsPanel({ gps, onReady }: { gps: Props['gps']; onReady: () => void }) {
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;
  useEffect(() => {
    if (gps.status === 'active') onReadyRef.current();
  }, [gps.status]);

  if (gps.status === 'active') {
    return (
      <div className="flex items-center justify-between gap-2 rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-900 ring-1 ring-brand-100">
        <span className="flex items-center gap-2">
          <Icon name="locate" className="size-4 text-brand-600" />
          Đã lấy vị trí{gps.accuracy != null && ` (±${Math.round(gps.accuracy)} m)`}
        </span>
        <button type="button" onClick={gps.locate} className="text-xs font-semibold underline">
          Lấy lại
        </button>
      </div>
    );
  }
  const msg: Record<string, string> = {
    denied: 'Bạn đã từ chối quyền vị trí – hãy chọn tỉnh/thành hoặc nhập địa điểm.',
    unavailable: 'Không xác định được vị trí trên thiết bị này.',
    timeout: 'Lấy vị trí quá lâu, thử lại nhé.',
    insecure: 'Trình duyệt chỉ cho lấy vị trí trên HTTPS hoặc localhost.',
  };
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={gps.locate}
        disabled={gps.status === 'locating'}
        className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-surface font-semibold text-brand-700 ring-1 ring-brand-500 transition hover:bg-brand-50 disabled:opacity-60"
      >
        <Icon name="locate" className={`size-5 ${gps.status === 'locating' ? 'animate-spin' : ''}`} />
        {gps.status === 'locating' ? 'Đang xác định vị trí…' : 'Dùng vị trí hiện tại'}
      </button>
      {msg[gps.status] && (
        <p role="status" className="text-xs text-warn">
          {msg[gps.status]}
        </p>
      )}
      <p className="text-xs text-muted">Vị trí chính xác chỉ dùng trên máy bạn; máy chủ chỉ nhận vị trí làm tròn ~1 km.</p>
    </div>
  );
}

function PlaceSearch({ value, onPick }: { value: { label: string } | null; onPick: (s: LocationSuggestion) => void }) {
  const [q, setQ] = useState(value?.label ?? '');
  const [items, setItems] = useState<LocationSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);
  const listId = useId();

  useEffect(() => {
    const term = q.trim();
    if (!term || term === value?.label) {
      setItems([]);
      return;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => {
      setLoading(true);
      clientApi
        .suggest(term, ctrl.signal)
        .then((r) => {
          setItems(r.items);
          setActive(0);
          setOpen(true);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }, 250);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q, value?.label]);

  const pick = (s: LocationSuggestion) => {
    setQ(s.label);
    setOpen(false);
    onPick(s);
  };

  return (
    <div className="relative">
      <label className="relative block">
        <span className="sr-only">Nhập địa điểm, khu vực hoặc tỉnh/thành</span>
        <Icon name="search" className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
        <input
          role="combobox"
          aria-expanded={open && items.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && items[active] ? `${listId}-${active}` : undefined}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onFocus={() => items.length && setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={(e) => {
            if (!open || !items.length) return;
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => (a + 1) % items.length);
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => (a - 1 + items.length) % items.length);
            } else if (e.key === 'Enter') {
              e.preventDefault();
              pick(items[active]!);
            } else if (e.key === 'Escape') setOpen(false);
          }}
          placeholder="VD: Hồ Tây, Phố cổ, Hội An, Văn Miếu…"
          className="h-12 w-full rounded-2xl bg-surface pl-10 pr-3 ring-1 ring-line focus:ring-2 focus:ring-brand-500"
        />
      </label>
      {loading && <p className="mt-1 text-xs text-muted">Đang tìm…</p>}
      {value && !open && (
        <p className="mt-1.5 flex items-center gap-1 text-xs font-medium text-brand-700">
          <Icon name="pin" className="size-3.5" /> Xuất phát từ: {value.label}
        </p>
      )}
      {open && (
        <ul id={listId} role="listbox" className="absolute inset-x-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-2xl bg-surface p-1 shadow-xl ring-1 ring-line">
          {items.length === 0 && <li className="px-3 py-2 text-sm text-muted">Không tìm thấy – thử tên khu vực hoặc tỉnh/thành.</li>}
          {items.map((s, i) => (
            <li
              key={`${s.type}-${s.label}-${i}`}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(s);
              }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 ${i === active ? 'bg-brand-50' : ''}`}
            >
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-canvas text-brand-600">
                <Icon name={s.type === 'province' ? 'map' : s.type === 'area' ? 'pin' : 'sparkles'} className="size-4" />
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{s.label}</span>
                <span className="block truncate text-xs text-muted">{s.sublabel}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
