'use client';

import { useEffect, useState } from 'react';
import { formatDistance, haversineKm } from '@/lib/geo';
import type { LatLng, PlaceSummary } from '@/lib/types';
import { MapView } from './MapView';
import { readSavedLocation } from './useUserLocation';

/** Khoảng cách chỉ hiển thị nếu người dùng đã chủ động chia sẻ vị trí trong phiên này. */
export function DistanceFromUser({ lat, lng }: { lat: number; lng: number }) {
  const [km, setKm] = useState<number | null>(null);
  useEffect(() => {
    const loc = readSavedLocation();
    if (loc) setKm(haversineKm(loc, { lat, lng }));
  }, [lat, lng]);
  if (km == null) return null;
  return <span> · cách bạn {formatDistance(km)}</span>;
}

export function PlaceMap({ place, disabledReason }: { place: PlaceSummary; disabledReason: string | null }) {
  const [userLoc, setUserLoc] = useState<LatLng | null>(null);
  useEffect(() => setUserLoc(readSavedLocation()), []);
  if (place.latitude == null || place.longitude == null) return null;
  return (
    <MapView
      places={[place]}
      center={{ lat: place.latitude, lng: place.longitude }}
      zoom={16}
      userLoc={userLoc}
      selectedSlug={place.slug}
      disabledReason={disabledReason}
      className="h-72 rounded-3xl shadow-xl shadow-ink/5 ring-1 ring-line md:h-[520px]"
      label={`Vị trí ${place.name} trên bản đồ`}
    />
  );
}
