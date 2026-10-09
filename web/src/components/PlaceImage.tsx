import { hueFor, illustrationFor, illustrationSrc, type Illustration } from '@/lib/images';
import type { Photo, PlaceSummary } from '@/lib/types';

interface Props {
  place?: Pick<PlaceSummary, 'slug' | 'name' | 'category' | 'tags'> & { photo?: Photo | null };
  /** Ảnh truyền trực tiếp (vd. thẻ lựa chọn ở trang chủ). */
  photo?: Photo | null;
  /** Ảnh vẽ dự phòng khi chưa có ảnh thật. */
  illustration?: Illustration;
  className?: string;
  /** Mức hiển thị ghi công: full = dòng chữ, compact = nút ©, none = ẩn (chỉ dùng khi ghi công ở chỗ khác). */
  credit?: 'full' | 'compact' | 'none';
  priority?: boolean;
}

/**
 * Ảnh địa điểm: ưu tiên ảnh thật có giấy phép tự do (Wikimedia Commons) kèm ghi công tác giả/giấy phép.
 * Chưa có ảnh → dùng ảnh vẽ dự phòng và ghi rõ "Ảnh minh họa".
 */
export function PlaceImage({ place, photo, illustration, className = '', credit = 'compact', priority }: Props) {
  const real = photo ?? place?.photo ?? null;
  const fallback = illustration ?? (place ? illustrationFor(place) : 'lake');
  const hue = !real && place ? hueFor(place.slug) : 0;
  const creditText = real ? `Ảnh: ${real.author} · ${real.license} · Wikimedia Commons${real.match === 'topic' ? ' (ảnh minh họa món/chủ đề, không phải ảnh của địa điểm)' : ''}` : 'Ảnh vẽ minh họa – chưa có ảnh thật';

  // Không ép "relative" khi nơi dùng đã đặt "absolute" (nếu không khung ảnh sẽ cao 0)
  const position = /(^|\s)(absolute|fixed)(\s|$)/.test(className) ? '' : 'relative';
  return (
    <div className={`${position} overflow-hidden bg-brand-900 ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- ảnh từ Wikimedia đã là thumbnail, không qua tối ưu ảnh của Next */}
      <img
        src={real ? real.url : illustrationSrc(fallback)}
        alt=""
        aria-hidden
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        referrerPolicy="no-referrer"
        className="absolute inset-0 size-full object-cover transition duration-500 group-hover:scale-105"
        style={hue ? { filter: `hue-rotate(${hue}deg)` } : undefined}
      />
      {credit === 'full' && (
        <p className="absolute inset-x-0 bottom-0 z-10 truncate bg-gradient-to-t from-black/70 to-transparent px-2.5 pb-1.5 pt-5 text-[10px] text-white/85">
          {real ? (
            <a href={real.pageUrl} target="_blank" rel="noreferrer" className="hover:underline">
              {real.match === 'topic' && <span className="mr-1 rounded bg-white/20 px-1">Ảnh minh họa món</span>}
              Ảnh: {real.author} · {real.license} · Wikimedia Commons
            </a>
          ) : (
            'Ảnh vẽ minh họa'
          )}
        </p>
      )}
      {credit === 'compact' &&
        (real ? (
          <a
            href={real.pageUrl}
            target="_blank"
            rel="noreferrer"
            title={creditText}
            aria-label={creditText}
            className="absolute bottom-1.5 right-1.5 z-10 rounded-full bg-black/50 px-1.5 py-0.5 text-[9px] font-semibold text-white/90 backdrop-blur-sm hover:bg-black/70"
          >
            © {real.match === 'topic' ? 'minh họa' : real.license}
          </a>
        ) : (
          <span title={creditText} className="absolute bottom-1.5 right-1.5 rounded-full bg-black/45 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wide text-white/90 backdrop-blur-sm">
            Ảnh vẽ
          </span>
        ))}
    </div>
  );
}
