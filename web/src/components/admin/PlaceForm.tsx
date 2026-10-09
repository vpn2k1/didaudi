'use client';

import { useState } from 'react';
import { ApiError } from '@/lib/api';
import { WEEKDAYS } from '@/lib/format';
import type { Meta, Province } from '@/lib/types';
import type { AdminPlace, AdminPlaceInput } from './adminApi';

interface Props {
  initial: AdminPlace | null;
  meta: Pick<Meta, 'categories' | 'tags'>;
  provinces: Pick<Province, 'slug' | 'name'>[];
  onSubmit: (input: AdminPlaceInput) => Promise<void>;
  onCancel: () => void;
}

type DayHours = { enabled: boolean; open: string; close: string };

const empty: AdminPlaceInput = {
  name: '',
  description: null,
  mustTry: null,
  category: 'food',
  provinceSlug: 'ha-noi',
  area: null,
  address: null,
  latitude: 21.0285,
  longitude: 105.8542,
  priceMin: null,
  priceMax: null,
  tags: [],
  openingHours: null,
  website: null,
  phone: null,
  publicationStatus: 'draft',
  verificationStatus: 'unverified',
  isDemo: false,
  editorPick: false,
  providerRefs: [],
};

const inputCls = 'mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm focus:border-brand-500 aria-[invalid=true]:border-danger';

export function PlaceForm({ initial, meta, provinces, onSubmit, onCancel }: Props) {
  const [form, setForm] = useState<AdminPlaceInput>(() => (initial ? { ...empty, ...initial } : empty));
  const [hours, setHours] = useState<DayHours[]>(() =>
    WEEKDAYS.map((_, day) => {
      const p = initial?.openingHours?.periods.find((x) => x.day === day);
      return p ? { enabled: true, open: p.open, close: p.close } : { enabled: false, open: '07:00', close: '21:00' };
    }),
  );
  const [hasHours, setHasHours] = useState(!!initial?.openingHours);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof AdminPlaceInput>(key: K, value: AdminPlaceInput[K]) => setForm((f) => ({ ...f, [key]: value }));
  const text = (v: string) => (v.trim() ? v : null);
  const num = (v: string) => (v === '' ? null : Number(v));
  const err = (field: string) => (errors[field] ? { 'aria-invalid': true, 'aria-describedby': `${field}-error` } : {});
  const ErrorText = ({ field }: { field: string }) =>
    errors[field] ? (
      <p id={`${field}-error`} className="mt-1 text-xs text-danger">
        {errors[field]}
      </p>
    ) : null;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setErrors({});
    setFormError(null);
    // Lưu giờ mở cửa = người quản trị xác nhận vừa kiểm tra → verifiedAt là hôm nay
    const openingHours = hasHours
      ? { periods: hours.flatMap((h, day) => (h.enabled ? [{ day, open: h.open, close: h.close }] : [])), verifiedAt: new Date().toISOString() }
      : null;
    try {
      await onSubmit({ ...form, slug: form.slug || undefined, openingHours: openingHours?.periods.length ? openingHours : null });
    } catch (e) {
      if (e instanceof ApiError && e.issues?.length) {
        setErrors(Object.fromEntries(e.issues.map((i) => [String(i.path[0] ?? 'form'), i.message])));
      }
      setFormError(e instanceof Error ? e.message : 'Không lưu được');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-6 rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">{initial ? `Sửa: ${initial.name}` : 'Thêm địa điểm'}</h2>
        <button type="button" onClick={onCancel} className="text-sm font-medium text-muted hover:text-ink">
          ← Quay lại danh sách
        </button>
      </div>

      {formError && (
        <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">
          {formError}
        </p>
      )}

      <fieldset className="grid gap-4 md:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold text-muted">Thông tin chính</legend>
        <label className="text-sm font-medium">
          Tên địa điểm *
          <input required value={form.name} onChange={(e) => set('name', e.target.value)} className={inputCls} {...err('name')} />
          <ErrorText field="name" />
        </label>
        <label className="text-sm font-medium">
          Slug (để trống = tự tạo)
          <input value={form.slug ?? initial?.slug ?? ''} onChange={(e) => set('slug', e.target.value)} placeholder="vd: pho-thin-lo-duc" className={inputCls} {...err('slug')} />
          <ErrorText field="slug" />
        </label>
        <label className="text-sm font-medium">
          Danh mục *
          <select value={form.category} onChange={(e) => set('category', e.target.value as AdminPlaceInput['category'])} className={inputCls}>
            {meta.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          Tỉnh/thành *
          <select value={form.provinceSlug} onChange={(e) => set('provinceSlug', e.target.value)} className={inputCls} {...err('provinceSlug')}>
            {provinces.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
          <ErrorText field="provinceSlug" />
        </label>
        <label className="text-sm font-medium md:col-span-2">
          Mô tả (nội dung tự biên tập)
          <textarea rows={3} value={form.description ?? ''} onChange={(e) => set('description', text(e.target.value))} className={inputCls} {...err('description')} />
          <ErrorText field="description" />
        </label>
        <label className="text-sm font-medium">
          Nên thử
          <input value={form.mustTry ?? ''} onChange={(e) => set('mustTry', text(e.target.value))} className={inputCls} />
        </label>
        <label className="text-sm font-medium">
          Khu vực
          <input value={form.area ?? ''} onChange={(e) => set('area', text(e.target.value))} placeholder="vd: Phố cổ" className={inputCls} />
        </label>
      </fieldset>

      <fieldset className="grid gap-4 md:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold text-muted">Vị trí</legend>
        <label className="text-sm font-medium md:col-span-3">
          Địa chỉ
          <input value={form.address ?? ''} onChange={(e) => set('address', text(e.target.value))} className={inputCls} />
        </label>
        <label className="text-sm font-medium">
          Vĩ độ (latitude) *
          <input type="number" step="any" value={form.latitude} onChange={(e) => set('latitude', Number(e.target.value))} className={inputCls} {...err('latitude')} />
          <ErrorText field="latitude" />
        </label>
        <label className="text-sm font-medium">
          Kinh độ (longitude) *
          <input type="number" step="any" value={form.longitude} onChange={(e) => set('longitude', Number(e.target.value))} className={inputCls} {...err('longitude')} />
          <ErrorText field="longitude" />
        </label>
        <p className="self-end text-xs text-muted">
          Kiểm tra trên{' '}
          <a className="underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${form.latitude}&mlon=${form.longitude}#map=18/${form.latitude}/${form.longitude}`}>
            OpenStreetMap
          </a>
        </p>
      </fieldset>

      <fieldset className="grid gap-4 md:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold text-muted">Giá & liên hệ (chỉ nhập khi đã kiểm chứng)</legend>
        <label className="text-sm font-medium">
          Giá thấp nhất (VND/người)
          <input type="number" min={0} step={1000} value={form.priceMin ?? ''} onChange={(e) => set('priceMin', num(e.target.value))} className={inputCls} {...err('priceMin')} />
          <ErrorText field="priceMin" />
        </label>
        <label className="text-sm font-medium">
          Giá cao nhất (VND/người)
          <input type="number" min={0} step={1000} value={form.priceMax ?? ''} onChange={(e) => set('priceMax', num(e.target.value))} className={inputCls} {...err('priceMax')} />
          <ErrorText field="priceMax" />
        </label>
        <label className="text-sm font-medium">
          Website
          <input type="url" value={form.website ?? ''} onChange={(e) => set('website', text(e.target.value))} placeholder="https://" className={inputCls} {...err('website')} />
          <ErrorText field="website" />
        </label>
        <label className="text-sm font-medium">
          Điện thoại
          <input type="tel" value={form.phone ?? ''} onChange={(e) => set('phone', text(e.target.value))} className={inputCls} {...err('phone')} />
          <ErrorText field="phone" />
        </label>
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-muted">Giờ mở cửa</legend>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={hasHours} onChange={(e) => setHasHours(e.target.checked)} />
          Có dữ liệu giờ mở cửa đã kiểm chứng (lưu = xác nhận kiểm tra hôm nay; sau 180 ngày sẽ tự ẩn)
        </label>
        {hasHours && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {hours.map((h, day) => (
              <div key={day} className="flex items-center gap-2 text-sm">
                <label className="flex w-28 items-center gap-2">
                  <input type="checkbox" checked={h.enabled} onChange={(e) => setHours((hs) => hs.map((x, i) => (i === day ? { ...x, enabled: e.target.checked } : x)))} />
                  {WEEKDAYS[day]}
                </label>
                <input
                  type="time"
                  aria-label={`${WEEKDAYS[day]} mở cửa`}
                  disabled={!h.enabled}
                  value={h.open}
                  onChange={(e) => setHours((hs) => hs.map((x, i) => (i === day ? { ...x, open: e.target.value } : x)))}
                  className="rounded-lg border border-line px-2 py-1 disabled:opacity-40"
                />
                –
                <input
                  type="time"
                  aria-label={`${WEEKDAYS[day]} đóng cửa`}
                  disabled={!h.enabled}
                  value={h.close}
                  onChange={(e) => setHours((hs) => hs.map((x, i) => (i === day ? { ...x, close: e.target.value } : x)))}
                  className="rounded-lg border border-line px-2 py-1 disabled:opacity-40"
                />
              </div>
            ))}
          </div>
        )}
        <ErrorText field="openingHours" />
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-muted">Thẻ</legend>
        <div className="flex flex-wrap gap-2">
          {Object.entries(meta.tags).map(([id, label]) => (
            <label key={id} className={`cursor-pointer rounded-full border px-3 py-1 text-sm ${form.tags.includes(id) ? 'border-brand-600 bg-brand-50 text-brand-700' : 'border-line'}`}>
              <input
                type="checkbox"
                className="sr-only"
                checked={form.tags.includes(id)}
                onChange={(e) => set('tags', e.target.checked ? [...form.tags, id] : form.tags.filter((t) => t !== id))}
              />
              {label}
            </label>
          ))}
        </div>
        <ErrorText field="tags" />
      </fieldset>

      <fieldset className="grid gap-4 md:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold text-muted">Trạng thái</legend>
        <label className="text-sm font-medium">
          Xuất bản
          <select value={form.publicationStatus} onChange={(e) => set('publicationStatus', e.target.value as 'draft' | 'published')} className={inputCls}>
            <option value="draft">Bản nháp (chỉ admin thấy)</option>
            <option value="published">Công khai</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          Xác minh
          <select value={form.verificationStatus} onChange={(e) => set('verificationStatus', e.target.value as AdminPlaceInput['verificationStatus'])} className={inputCls}>
            <option value="unverified">Chưa xác minh</option>
            <option value="coordinates_checked">Đã đối chiếu tọa độ</option>
            <option value="verified">Đã xác minh thực tế</option>
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isDemo} onChange={(e) => set('isDemo', e.target.checked)} />
          Dữ liệu minh họa (hiện nhãn &ldquo;Dữ liệu minh họa&rdquo;, không index)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.editorPick} onChange={(e) => set('editorPick', e.target.checked)} />
          Được biên tập chọn
        </label>
      </fieldset>

      <div className="flex justify-end gap-2 border-t border-line pt-4">
        <button type="button" onClick={onCancel} className="rounded-xl border border-line px-4 py-2 text-sm font-semibold">
          Hủy
        </button>
        <button type="submit" disabled={saving} className="rounded-xl bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
          {saving ? 'Đang lưu…' : 'Lưu'}
        </button>
      </div>
    </form>
  );
}
