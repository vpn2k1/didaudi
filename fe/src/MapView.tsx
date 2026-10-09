import { useEffect, useRef, useState } from 'react';
import type { Map as MlMap, Marker, GeoJSONSource } from 'maplibre-gl';
import type { Meta, Place, UserLoc } from './types';

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string | undefined;
export const MAP_PROVIDER = MAPBOX_TOKEN ? 'Mapbox' : 'MapLibre + OpenFreeMap';

// mapbox-gl và maplibre-gl có API gần như giống nhau → dùng chung 1 kiểu
type GL = typeof import('maplibre-gl');

async function loadGL(): Promise<{ gl: GL; style: string }> {
  if (MAPBOX_TOKEN) {
    const [{ default: mapboxgl }] = await Promise.all([import('mapbox-gl'), import('mapbox-gl/dist/mapbox-gl.css')]);
    mapboxgl.accessToken = MAPBOX_TOKEN;
    return { gl: mapboxgl as unknown as GL, style: 'mapbox://styles/mapbox/streets-v12' };
  }
  const [gl] = await Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl.css')]);
  return { gl: gl as GL, style: 'https://tiles.openfreemap.org/styles/liberty' };
}

function circle(lat: number, lng: number, km: number): GeoJSON.Feature<GeoJSON.Polygon> {
  const pts: [number, number][] = [];
  for (let i = 0; i <= 64; i++) {
    const a = (i / 64) * 2 * Math.PI;
    pts.push([lng + (km / (111.32 * Math.cos((lat * Math.PI) / 180))) * Math.cos(a), lat + (km / 110.57) * Math.sin(a)]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [pts] } };
}

interface Props {
  meta: Meta;
  places: Place[];
  userLoc: UserLoc;
  radiusKm: number;
  selectedId: string | null;
  pickMode: boolean;
  onSelect: (id: string) => void;
  onPick: (lat: number, lng: number) => void;
}

export default function MapView({ meta, places, userLoc, radiusKm, selectedId, pickMode, onSelect, onPick }: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<MlMap | null>(null);
  const glRef = useRef<GL | null>(null);
  const markers = useRef(new Map<string, Marker>());
  const userMarker = useRef<Marker | null>(null);
  const handlers = useRef({ onSelect, onPick, pickMode });
  handlers.current = { onSelect, onPick, pickMode };
  const [ready, setReady] = useState(false);

  // Khởi tạo bản đồ 1 lần
  useEffect(() => {
    let cancelled = false;
    loadGL().then(({ gl, style }) => {
      if (cancelled || !container.current) return;
      glRef.current = gl;
      const m = new gl.Map({ container: container.current, style, center: [meta.city.center[1], meta.city.center[0]], zoom: 14 });
      m.addControl(new gl.NavigationControl({ showCompass: false }), 'top-right');
      m.on('click', (e) => {
        if (handlers.current.pickMode) handlers.current.onPick(e.lngLat.lat, e.lngLat.lng);
      });
      m.on('load', () => {
        // OpenFreeMap mặc định hiện tên Latin/Anh → ưu tiên tên tiếng Việt gốc
        if (!MAPBOX_TOKEN) {
          for (const layer of m.getStyle().layers) {
            if (layer.type === 'symbol' && m.getLayoutProperty(layer.id, 'text-field')) {
              m.setLayoutProperty(layer.id, 'text-field', ['coalesce', ['get', 'name:vi'], ['get', 'name']]);
            }
          }
        }
        m.addSource('radius', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        m.addLayer({ id: 'radius-fill', type: 'fill', source: 'radius', paint: { 'fill-color': '#e8590c', 'fill-opacity': 0.06 } });
        m.addLayer({ id: 'radius-line', type: 'line', source: 'radius', paint: { 'line-color': '#e8590c', 'line-width': 1.5, 'line-dasharray': [2, 2] } });
        setReady(true);
      });
      map.current = m;
      ro.observe(container.current);
    });
    const ro = new ResizeObserver(() => map.current?.resize());
    return () => {
      cancelled = true;
      ro.disconnect();
      map.current?.remove();
      map.current = null;
    };
  }, [meta]);

  // Marker địa điểm
  useEffect(() => {
    const m = map.current;
    const gl = glRef.current;
    if (!ready || !m || !gl) return;
    markers.current.forEach((mk) => mk.remove());
    markers.current.clear();
    for (const p of places) {
      const el = document.createElement('button');
      el.className = `marker marker-${p.category}${p.verified === false ? ' marker-unverified' : ''}`;
      el.textContent = meta.categories[p.category].icon;
      el.title = p.name;
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        handlers.current.onSelect(p.id);
      });
      markers.current.set(p.id, new gl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(m));
    }
  }, [places, ready, meta]);

  // Vị trí user + vòng bán kính
  useEffect(() => {
    const m = map.current;
    const gl = glRef.current;
    if (!ready || !m || !gl) return;
    if (!userMarker.current) {
      const el = document.createElement('div');
      el.className = 'user-dot';
      userMarker.current = new gl.Marker({ element: el }).setLngLat([userLoc.lng, userLoc.lat]).addTo(m);
    } else userMarker.current.setLngLat([userLoc.lng, userLoc.lat]);
    (m.getSource('radius') as GeoJSONSource).setData({
      type: 'FeatureCollection',
      features: radiusKm ? [circle(userLoc.lat, userLoc.lng, radiusKm)] : [],
    });
  }, [userLoc, radiusKm, ready]);

  useEffect(() => {
    if (ready && userLoc.source !== 'default') map.current?.flyTo({ center: [userLoc.lng, userLoc.lat], zoom: 15 });
  }, [userLoc, ready]);

  // Highlight + bay tới địa điểm đang chọn
  useEffect(() => {
    markers.current.forEach((mk, id) => mk.getElement().classList.toggle('marker-selected', id === selectedId));
    const p = places.find((x) => x.id === selectedId);
    if (p && map.current) map.current.flyTo({ center: [p.lng, p.lat], zoom: Math.max(map.current.getZoom(), 16) });
  }, [selectedId, places, ready]);

  useEffect(() => {
    map.current?.getCanvas().style.setProperty('cursor', pickMode ? 'crosshair' : '');
  }, [pickMode, ready]);

  return <div ref={container} className="map" />;
}
