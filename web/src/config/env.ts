/** Biến môi trường công khai (NEXT_PUBLIC_*) – an toàn để dùng ở client. */
export const publicEnv = {
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000').replace(/\/$/, ''),
  allowIndexing: process.env.NEXT_PUBLIC_ALLOW_INDEXING === 'true',
  mapProvider: (['maplibre', 'mapbox', 'none'].includes(process.env.NEXT_PUBLIC_MAP_PROVIDER ?? '')
    ? process.env.NEXT_PUBLIC_MAP_PROVIDER
    : 'maplibre') as 'maplibre' | 'mapbox' | 'none',
  mapStyleUrl: process.env.NEXT_PUBLIC_MAP_STYLE_URL || 'https://tiles.openfreemap.org/styles/liberty',
  mapboxToken: process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '',
};

/** Chỉ dùng ở server. */
export const backendUrl = () => (process.env.BACKEND_URL || 'http://localhost:4000').replace(/\/$/, '');
