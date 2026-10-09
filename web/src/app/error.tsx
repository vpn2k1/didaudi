'use client';

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-lg px-4 py-20 text-center" role="alert">
      <p className="text-5xl" aria-hidden>
        ⚠️
      </p>
      <h1 className="mt-4 text-2xl font-bold">Có lỗi khi tải dữ liệu</h1>
      <p className="mt-2 text-muted">Máy chủ dữ liệu đang không phản hồi. Vui lòng thử lại sau ít phút.</p>
      <button type="button" onClick={reset} className="mt-6 rounded-xl bg-brand-600 px-4 py-2.5 font-semibold text-white hover:bg-brand-700">
        Thử lại
      </button>
    </div>
  );
}
