'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as GLMap, Marker } from 'maplibre-gl';
import { publicEnv } from '@/config/env';
import type { Category, LatLng, PlaceSummary } from '@/lib/types';

type GL = typeof import('maplibre-gl');
const ICON: Record<Category, string> = { food: '🍜', cafe: '☕', sight: '🏛️', fun: '🎡' };

async function loadGL(): Promise<{ gl: GL; style: string }> {
  if (publicEnv.mapProvider === 'mapbox') {
    if (!publicEnv.mapboxToken) throw new Error('Thiếu NEXT_PUBLIC_MAPBOX_TOKEN');
    const [{ default: mapboxgl }] = await Promise.all([import('mapbox-gl'), import('mapbox-gl/dist/mapbox-gl.css')]);
    mapboxgl.accessToken = publicEnv.mapboxToken;
    return { gl: mapboxgl as unknown as GL, style: 'mapbox://styles/mapbox/streets-v12' };
  }
  const [gl] = await Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')]);
  // Worker được copy sang public/maplibre/ (xem scripts/copy-maplibre-worker.mjs)
  gl.setWorkerUrl('/maplibre/maplibre-gl-worker.mjs');
  return { gl: gl as GL, style: publicEnv.mapStyleUrl };
}

interface Props {
  places: PlaceSummary[];
  center: LatLng;
  zoom?: number;
  userLoc?: LatLng | null;
  selectedSlug?: string | null;
  highlightSlug?: string | null;
  onSelect?: (slug: string) => void;
  /** Dữ liệu của provider chỉ được hiển thị trên bản đồ của chính provider (vd. Google). */
  disabledReason?: string | null;
  className?: string;
  label?: string;
  /** Số thứ tự hiển thị trên marker (lịch trình gợi ý). */
  numbers?: Record<string, number>;
  /** Đường nối các điểm theo thứ tự (lộ trình gợi ý, đường chim bay). */
  route?: LatLng[] | null;
  userLabel?: string;
}

export function MapView({
  places,
  center,
  zoom = 13,
  userLoc,
  selectedSlug,
  highlightSlug,
  onSelect,
  disabledReason,
  className = '',
  label = 'Bản đồ địa điểm',
  numbers,
  route,
  userLabel = 'Vị trí của bạn',
}: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<GLMap | null>(null);
  const gl = useRef<GL | null>(null);
  const markers = useRef(new Map<string, Marker>());
  const userMarker = useRef<Marker | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const off = publicEnv.mapProvider === 'none' ? 'Bản đồ chưa được cấu hình (NEXT_PUBLIC_MAP_PROVIDER=none).' : disabledReason;

  useEffect(() => {
    if (off) return;
    let cancelled = false;
    let loaded = false;
    const ro = new ResizeObserver(() => map.current?.resize());
    const markerStore = markers.current;
    loadGL()
      .then(({ gl: lib, style }) => {
        if (cancelled || !container.current) return;
        gl.current = lib;
        const m = new lib.Map({ container: container.current, style, center: [center.lng, center.lat], zoom, attributionControl: { compact: true } });
        m.addControl(new lib.NavigationControl({ showCompass: false }), 'top-right');
        m.on('error', (e) => {
          if (!loaded) setFailed(`Không tải được bản đồ: ${(e as unknown as { error?: { message?: string } }).error?.message ?? 'lỗi không rõ'}`);
        });
        m.on('load', () => {
          loaded = true;
          // OpenFreeMap mặc định hiển thị tên Latin → ưu tiên tên tiếng Việt từ OSM
          if (publicEnv.mapProvider === 'maplibre') {
            for (const layer of m.getStyle().layers) {
              if (layer.type === 'symbol' && m.getLayoutProperty(layer.id, 'text-field')) {
                m.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:vi'], ['get', 'name']]);
              }
            }
          }
          m.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
          m.addLayer({ id: 'route-casing', type: 'line', source: 'route', paint: { 'line-color': '#ffcd00', 'line-width': 7, 'line-opacity': 0.85 } });
          m.addLayer({ id: 'route-line', type: 'line', source: 'route', paint: { 'line-color': '#b3141c', 'line-width': 3.5, 'line-dasharray': [1.5, 1.5] } });
          setReady(true);
        });
        map.current = m;
        ro.observe(container.current);
      })
      .catch((e: Error) => !cancelled && setFailed(`Không khởi tạo được bản đồ: ${e.message}`));
    return () => {
      cancelled = true;
      ro.disconnect();
      markerStore.clear();
      userMarker.current = null;
      map.current?.remove();
      map.current = null;
      setReady(false);
    };
    // Bản đồ chỉ khởi tạo 1 lần; center/zoom thay đổi được xử lý ở effect riêng
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [off]);

  // Marker: thêm/bớt theo danh sách hiện tại (chỉ trang kết quả đang xem, không tải hàng trăm marker)
  useEffect(() => {
    const m = map.current;
    const lib = gl.current;
    if (!ready || !m || !lib) return;
    const keep = new Set<string>();
    for (const p of places) {
      if (p.latitude == null || p.longitude == null) continue;
      keep.add(p.slug);
      const n = numbers?.[p.slug];
      const existing = markers.current.get(p.slug);
      if (existing) {
        // Cập nhật số thứ tự khi lịch trình thay đổi (đổi phương án)
        const el = existing.getElement();
        el.textContent = n != null ? String(n) : ICON[p.category];
        el.dataset.numbered = String(n != null);
        continue;
      }
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'map-marker';
      el.dataset.category = p.category;
      el.dataset.unverified = String(p.verificationStatus === 'unverified');
      el.dataset.numbered = String(n != null);
      el.textContent = n != null ? String(n) : ICON[p.category];
      el.setAttribute('aria-label', p.name);
      el.setAttribute('aria-pressed', 'false');
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        onSelectRef.current?.(p.slug);
      });
      markers.current.set(p.slug, new lib.Marker({ element: el }).setLngLat([p.longitude, p.latitude]).addTo(m));
    }
    for (const [slug, mk] of markers.current) {
      if (!keep.has(slug)) {
        mk.remove();
        markers.current.delete(slug);
      }
    }
    // Căn khung theo các marker khi chưa chọn địa điểm nào
    const pts = places.filter((p) => p.latitude != null && p.longitude != null);
    if (pts.length > 1 && !selectedSlug) {
      // Gồm cả điểm xuất phát khi đang hiển thị lịch trình
      const extra = numbers && userLoc ? [userLoc] : [];
      const lngs = [...pts.map((p) => p.longitude!), ...extra.map((x) => x.lng)];
      const lats = [...pts.map((p) => p.latitude!), ...extra.map((x) => x.lat)];
      m.fitBounds(
        [
          [Math.min(...lngs), Math.min(...lats)],
          [Math.max(...lngs), Math.max(...lats)],
        ],
        { padding: 60, maxZoom: 15, duration: 600 },
      );
    } else if (pts.length === 1 && !selectedSlug) {
      m.flyTo({ center: [pts[0]!.longitude!, pts[0]!.latitude!], zoom: 15 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places, ready, numbers]);

  useEffect(() => {
    const m = map.current;
    if (!ready || !m) return;
    const src = m.getSource('route') as import('maplibre-gl').GeoJSONSource | undefined;
    src?.setData({
      type: 'FeatureCollection',
      features: route && route.length > 1 ? [{ type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: route.map((p) => [p.lng, p.lat]) } }] : [],
    });
  }, [route, ready]);

  useEffect(() => {
    for (const [slug, mk] of markers.current) {
      const el = mk.getElement();
      el.setAttribute('aria-pressed', String(slug === selectedSlug));
      el.dataset.highlight = String(slug === highlightSlug);
    }
    const p = places.find((x) => x.slug === selectedSlug);
    if (ready && p?.latitude != null && p.longitude != null) {
      map.current?.flyTo({ center: [p.longitude, p.latitude], zoom: Math.max(map.current.getZoom(), 15), duration: 600 });
    }
  }, [selectedSlug, highlightSlug, places, ready]);

  useEffect(() => {
    const m = map.current;
    const lib = gl.current;
    if (!ready || !m || !lib) return;
    if (!userLoc) {
      userMarker.current?.remove();
      userMarker.current = null;
      return;
    }
    if (!userMarker.current) {
      const el = document.createElement('div');
      el.className = 'user-dot';
      el.setAttribute('aria-label', userLabel);
      el.title = userLabel;
      userMarker.current = new lib.Marker({ element: el }).setLngLat([userLoc.lng, userLoc.lat]).addTo(m);
    } else userMarker.current.setLngLat([userLoc.lng, userLoc.lat]);
  }, [userLoc, ready, userLabel]);

  useEffect(() => {
    if (ready && !selectedSlug && !places.length) map.current?.flyTo({ center: [center.lng, center.lat], zoom });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [center.lat, center.lng, ready]);

  if (off || failed) {
    return (
      <div className={`grid place-items-center rounded-2xl border border-dashed border-line bg-surface p-6 text-center ${className}`}>
        <div className="max-w-xs text-sm text-muted">
          <p className="text-2xl" aria-hidden>
            🗺️
          </p>
          <p className="mt-2 font-medium text-ink">Bản đồ tạm thời không hiển thị</p>
          <p className="mt-1">{off ?? failed}</p>
          <p className="mt-1">Bạn vẫn có thể dùng danh sách và nút “Mở trên Google Maps”.</p>
        </div>
      </div>
    );
  }

  return <div ref={container} role="region" aria-label={label} className={`overflow-hidden rounded-2xl ${className}`} />;
}
