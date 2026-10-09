import Link from 'next/link';
import { brand } from '@/config/brand';
import { Logo } from './SiteHeader';

export function SiteFooter() {
  return (
    <footer className="mt-16 bg-brand-900 text-gold-100/80">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 text-sm md:grid-cols-[1.2fr_1fr_1fr]">
        <div>
          <p className="flex items-center gap-2.5 text-base font-bold text-white">
            <Logo />
            {brand.name}
          </p>
          <p className="mt-3 max-w-xs">{brand.tagline}</p>
        </div>
        <div>
          <p className="font-semibold text-white">Về dữ liệu</p>
          <p className="mt-2 leading-relaxed">
            Bản MVP dùng <strong className="text-white">dữ liệu minh họa</strong> do đội ngũ tự biên tập, chưa xác minh thực tế. Không hiển thị đánh giá, giá hay giờ
            mở cửa khi chưa có nguồn đáng tin cậy.
          </p>
        </div>
        <div>
          <p className="font-semibold text-white">Bản đồ & liên kết</p>
          <p className="mt-2 leading-relaxed">
            Dữ liệu bản đồ ©{' '}
            <a className="underline hover:text-white" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
              OpenStreetMap contributors
            </a>
            . Chỉ đường mở trên Google Maps.
          </p>
          <p className="mt-3 flex gap-4">
            <Link href="/" className="hover:text-white">
              Khám phá
            </Link>
            <Link href="/tinh-thanh" className="hover:text-white">
              34 tỉnh/thành
            </Link>
          </p>
        </div>
      </div>
      <div className="border-t border-white/10 py-4 text-center text-xs text-gold-100/50">© {new Date().getFullYear()} {brand.name} · Bản thử nghiệm</div>
    </footer>
  );
}
