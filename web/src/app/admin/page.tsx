import type { Metadata } from 'next';
import { AdminApp } from '@/components/admin/AdminApp';
import { api } from '@/lib/server';

export const metadata: Metadata = { title: 'Quản trị địa điểm', robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

/**
 * Trang này chỉ là giao diện. Bảo mật nằm ở backend: mọi API /api/admin/* đều kiểm tra
 * cookie phiên ký HMAC + header chống CSRF, và trả 503 nếu admin chưa được cấu hình.
 */
export default async function AdminPage() {
  const client = api();
  const [meta, provinces] = await Promise.all([client.meta(), client.provinces()]);
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold tracking-tight">Quản trị địa điểm</h1>
      <p className="mt-1 text-sm text-muted">Thêm, sửa, xóa địa điểm do đội ngũ tự quản lý. Bản nháp không hiển thị công khai.</p>
      <div className="mt-6">
        <AdminApp meta={{ categories: meta.categories, tags: meta.tags }} provinces={provinces.map((p) => ({ slug: p.slug, name: p.name }))} />
      </div>
    </div>
  );
}
