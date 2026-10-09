'use client';

import { useCallback, useEffect, useState } from 'react';
import type { LatLng } from '@/lib/types';

export type LocationStatus = 'idle' | 'locating' | 'active' | 'denied' | 'unavailable' | 'timeout' | 'insecure';
const KEY = 'ddvn:loc';

/**
 * Vị trí người dùng – chỉ xin quyền khi người dùng bấm "Tìm quanh tôi".
 * Vị trí chính xác chỉ lưu trong sessionStorage của trình duyệt (mất khi đóng tab), không gửi lên server.
 */
export function useUserLocation() {
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [loc, setLoc] = useState<LatLng | null>(null);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  // Khôi phục vị trí người dùng đã đồng ý chia sẻ trong phiên này (không hiện hộp thoại xin quyền)
  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
      if (saved && typeof saved.lat === 'number' && typeof saved.lng === 'number') {
        setLoc({ lat: saved.lat, lng: saved.lng });
        setStatus('active');
      }
    } catch {}
  }, []);

  const locate = useCallback(() => {
    if (!window.isSecureContext) return setStatus('insecure');
    if (!('geolocation' in navigator)) return setStatus('unavailable');
    setStatus('locating');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const next = { lat: coords.latitude, lng: coords.longitude };
        setLoc(next);
        setAccuracy(coords.accuracy);
        setStatus('active');
        try {
          sessionStorage.setItem(KEY, JSON.stringify(next));
        } catch {}
      },
      (err) => setStatus(err.code === err.PERMISSION_DENIED ? 'denied' : err.code === err.TIMEOUT ? 'timeout' : 'unavailable'),
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60_000 },
    );
  }, []);

  const clear = useCallback(() => {
    setLoc(null);
    setAccuracy(null);
    setStatus('idle');
    try {
      sessionStorage.removeItem(KEY);
    } catch {}
  }, []);

  return { status, loc, accuracy, locate, clear };
}

export function readSavedLocation(): LatLng | null {
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY) ?? 'null');
    return saved && typeof saved.lat === 'number' ? saved : null;
  } catch {
    return null;
  }
}
