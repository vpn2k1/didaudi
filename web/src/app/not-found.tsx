import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center">
      <p className="text-5xl" aria-hidden>
        🧭
      </p>
      <h1 className="mt-4 text-2xl font-bold">Không tìm thấy trang</h1>
      <p className="mt-2 text-muted">Địa điểm hoặc tỉnh/thành này không tồn tại, hoặc chưa được công bố.</p>
      <div className="mt-6 flex justify-center gap-2">
        <Link href="/" className="rounded-xl bg-brand-600 px-4 py-2.5 font-semibold text-white hover:bg-brand-700">
          Về trang khám phá
        </Link>
        <Link href="/tinh-thanh" className="rounded-xl border border-line px-4 py-2.5 font-semibold hover:border-brand-500">
          Chọn tỉnh/thành
        </Link>
      </div>
    </div>
  );
}
