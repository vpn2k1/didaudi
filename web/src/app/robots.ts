import type { MetadataRoute } from 'next';
import { publicEnv } from '@/config/env';

export default function robots(): MetadataRoute.Robots {
  if (!publicEnv.allowIndexing) return { rules: { userAgent: '*', disallow: '/' } };
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] },
    sitemap: `${publicEnv.siteUrl}/sitemap.xml`,
  };
}
