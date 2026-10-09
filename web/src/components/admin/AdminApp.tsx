'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ApiError } from '@/lib/api';
import { formatDate, VERIFICATION_LABEL } from '@/lib/format';
import { normalizeText } from '@/lib/text';
import type { Meta, Province } from '@/lib/types';
import { Notice, Skeleton } from '../ui';
import { adminApi, type AdminPlace, type AdminPlaceRow } from './adminApi';
import { PlaceForm } from './PlaceForm';

type Session = { enabled: boolean; authenticated: boolean } | null;

export function AdminApp({ meta, provinces }: { meta: Pick<Meta, 'categories' | 'tags'>; provinces: Pick<Province, 'slug' | 'name'>[] }) {
  const [session, setSession] = useState<Session>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    adminApi
      .session()
      .then(setSession)
      .catch(() => setSessionError('Không kết nối được máy chủ.'));
  }, []);
  useEffect(refresh, [refresh]);

  if (sessionError) return <Notice tone="error">{sessionError}</Notice>;
  if (!session) return <Skeleton className="h-40 w-full" />;
  if (!session.enabled) {
    return (
      <Notice tone="warn">
        <p className="font-semibold">Trang quản trị chưa được bật.</p>
        <p className="mt-1">
          Đặt <code>ADMIN_PASSWORD</code> (≥ 12 ký tự) và <code>ADMIN_SESSION_SECRET</code> (≥ 32 ký tự) trong <code>be/.env</code> rồi khởi động lại backend. Khi chưa bật,
          mọi API ghi dữ liệu đều bị từ chối.
        </p>
      </Notice>
    );
  }
  if (!session.authenticated) return <LoginForm onDone={refresh} />;
  return <Dashboard meta={meta} provinces={provinces} onLogout={() => adminApi.logout().then(refresh)} />;
}

function LoginForm({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <form
      className="mx-auto max-w-sm space-y-4 rounded-2xl border border-line bg-surface p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError(null);
        try {
          await adminApi.login(password);
          onDone();
        } catch (e) {
          setError(e instanceof ApiError ? e.message : 'Không đăng nhập được');
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2 className="text-lg font-semibold">Đăng nhập quản trị</h2>
      <label className="block text-sm font-medium">
        Mật khẩu
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 w-full rounded-lg border border-line px-3 py-2"
          aria-invalid={!!error}
          aria-describedby={error ? 'login-error' : undefined}
        />
      </label>
      {error && (
        <p id="login-error" role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      <button type="submit" disabled={busy || !password} className="w-full rounded-xl bg-brand-600 py-2.5 font-semibold text-white disabled:opacity-60">
        {busy ? 'Đang kiểm tra…' : 'Đăng nhập'}
      </button>
    </form>
  );
}

function Dashboard({ meta, provinces, onLogout }: { meta: Pick<Meta, 'categories' | 'tags'>; provinces: Pick<Province, 'slug' | 'name'>[]; onLogout: () => void }) {
  const [rows, setRows] = useState<AdminPlaceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminPlace | 'new' | null>(null);
  const [filter, setFilter] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<AdminPlaceRow | null>(null);

  const load = useCallback(() => {
    adminApi
      .list()
      .then(setRows)
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Không tải được danh sách'));
  }, []);
  useEffect(load, [load]);

  const shown = useMemo(() => {
    const f = normalizeText(filter);
    return (rows ?? []).filter((r) => !f || normalizeText(`${r.name} ${r.slug} ${r.provinceSlug}`).includes(f));
  }, [rows, filter]);
  const provinceName = (slug: string) => provinces.find((p) => p.slug === slug)?.name ?? slug;
  const catLabel = (id: string) => meta.categories.find((c) => c.id === id)?.label ?? id;

  if (editing) {
    return (
      <PlaceForm
        initial={editing === 'new' ? null : editing}
        meta={meta}
        provinces={provinces}
        onCancel={() => setEditing(null)}
        onSubmit={async (input) => {
          const saved = editing === 'new' ? await adminApi.create(input) : await adminApi.update(editing.id, input);
          setMessage(`Đã lưu “${saved.name}” (${saved.publicationStatus === 'published' ? 'công khai' : 'bản nháp'}).`);
          setEditing(null);
          load();
        }}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Lọc theo tên, slug, tỉnh…" aria-label="Lọc danh sách" className="h-10 flex-1 rounded-lg border border-line px-3" />
        <button type="button" onClick={() => setEditing('new')} className="h-10 rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white hover:bg-brand-700">
          + Thêm địa điểm
        </button>
        <button type="button" onClick={onLogout} className="h-10 rounded-xl border border-line px-4 text-sm font-semibold">
          Đăng xuất
        </button>
      </div>
      {message && <Notice>{message}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      {confirmDelete && (
        <div role="alertdialog" aria-labelledby="del-title" className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p id="del-title" className="font-semibold text-red-900">
            Xóa vĩnh viễn “{confirmDelete.name}”?
          </p>
          <p className="mt-1 text-sm text-red-900/80">Không thể hoàn tác. Nếu chỉ muốn ẩn, hãy chuyển về bản nháp.</p>
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              className="rounded-lg bg-danger px-4 py-2 text-sm font-semibold text-white"
              onClick={async () => {
                try {
                  await adminApi.remove(confirmDelete.id);
                  setMessage(`Đã xóa “${confirmDelete.name}”.`);
                  load();
                } catch (e) {
                  setError(e instanceof ApiError ? e.message : 'Không xóa được');
                }
                setConfirmDelete(null);
              }}
            >
              Xóa
            </button>
            <button type="button" className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold" onClick={() => setConfirmDelete(null)} autoFocus>
              Hủy
            </button>
          </div>
        </div>
      )}

      {!rows ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[720px] text-left text-sm">
            <caption className="sr-only">Danh sách địa điểm</caption>
            <thead className="border-b border-line bg-canvas text-xs uppercase tracking-wide text-muted">
              <tr>
                <th scope="col" className="px-4 py-3">Tên</th>
                <th scope="col" className="px-4 py-3">Tỉnh/thành</th>
                <th scope="col" className="px-4 py-3">Danh mục</th>
                <th scope="col" className="px-4 py-3">Trạng thái</th>
                <th scope="col" className="px-4 py-3">Cập nhật</th>
                <th scope="col" className="px-4 py-3"><span className="sr-only">Thao tác</span></th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.id} className="border-b border-line last:border-0">
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.name}</p>
                    <p className="text-xs text-muted">/{r.slug}</p>
                  </td>
                  <td className="px-4 py-3">{provinceName(r.provinceSlug)}</td>
                  <td className="px-4 py-3">{catLabel(r.category)}</td>
                  <td className="space-y-1 px-4 py-3 text-xs">
                    <span className={`inline-block rounded-md px-1.5 py-0.5 font-semibold ${r.publicationStatus === 'published' ? 'bg-green-50 text-ok' : 'bg-canvas text-muted'}`}>
                      {r.publicationStatus === 'published' ? 'Công khai' : 'Nháp'}
                    </span>{' '}
                    {r.isDemo && <span className="inline-block rounded-md bg-amber-50 px-1.5 py-0.5 font-semibold text-amber-800">Demo</span>}
                    <p className="text-muted">{VERIFICATION_LABEL[r.verificationStatus].label}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-muted">{formatDate(r.updatedAt)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <button
                      type="button"
                      className="rounded-lg px-2 py-1 font-medium text-brand-700 hover:bg-brand-50"
                      onClick={async () => {
                        try {
                          setEditing(await adminApi.get(r.id));
                        } catch (e) {
                          setError(e instanceof ApiError ? e.message : 'Không mở được địa điểm');
                        }
                      }}
                    >
                      Sửa
                    </button>
                    <button type="button" className="rounded-lg px-2 py-1 font-medium text-danger hover:bg-red-50" onClick={() => setConfirmDelete(r)}>
                      Xóa
                    </button>
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted">
                    Không có địa điểm nào khớp.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
