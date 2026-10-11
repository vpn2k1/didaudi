import type { Photo } from '@/lib/types';

/** Dòng nguồn hiển thị ngay dưới ảnh địa điểm. */
export function PhotoAttribution({ photo, className = '' }: { photo?: Photo | null; className?: string }) {
  return (
    <p className={`text-xs leading-snug text-muted ${className}`}>
      {photo ? (
        <>
          {photo.source === 'google' ? (
            <>
              Ảnh:{' '}
              {photo.authorAvatarUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- ảnh hồ sơ tác giả do Google Places trả về, hiển thị trực tiếp
                <img src={photo.authorAvatarUrl} alt="" aria-hidden className="mr-1 inline-block size-4 rounded-full align-text-bottom" referrerPolicy="no-referrer" />
              )}
              {photo.authorUrl ? <a href={photo.authorUrl} target="_blank" rel="noreferrer" className="relative z-10 underline underline-offset-2 hover:text-brand-700">{photo.author}</a> : photo.author}
              {' '}· <a href={photo.pageUrl} target="_blank" rel="noreferrer" className="relative z-10 underline underline-offset-2 hover:text-brand-700" translate="no">Google Maps ↗</a>
            </>
          ) : (
            <>
              {photo.match === 'topic' ? 'Ảnh minh họa chủ đề' : 'Ảnh địa điểm'}: {photo.author} ·{' '}
              {photo.licenseUrl ? (
                <a href={photo.licenseUrl} target="_blank" rel="noreferrer" className="relative z-10 underline underline-offset-2 hover:text-brand-700">{photo.license}</a>
              ) : photo.license} ·{' '}
              <a href={photo.pageUrl} target="_blank" rel="noreferrer" className="relative z-10 underline underline-offset-2 hover:text-brand-700">
                nguồn Wikimedia Commons
              </a>
            </>
          )}
        </>
      ) : (
        'Ảnh vẽ minh họa · chưa có ảnh địa điểm'
      )}
    </p>
  );
}
