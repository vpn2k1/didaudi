import path from 'node:path';
import type { NextConfig } from 'next';

const backend = (process.env.BACKEND_URL || 'http://localhost:4000').replace(/\/$/, '');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Repo có nhiều lockfile (be/, web/, root) → chỉ định rõ thư mục app
  outputFileTracingRoot: path.join(__dirname),
  // Trình duyệt chỉ gọi /api trên cùng domain → cookie admin SameSite=Strict hoạt động, không cần CORS
  async rewrites() {
    return [{ source: '/api/:path*', destination: `${backend}/api/:path*` }];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Chỉ trang của chính site được xin quyền vị trí
          { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(), microphone=()' },
        ],
      },
      { source: '/admin/:path*', headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] },
    ];
  },
};

export default nextConfig;
