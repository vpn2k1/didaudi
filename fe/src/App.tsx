import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapView, { MAP_PROVIDER } from './MapView';
import { api, directionsUrl, formatDistance, googleSearchUrl, osmUrl, PRICE_LABEL } from './api';
import type { Category, Meta, Place, UserLoc } from './types';

const HO_GUOM: UserLoc = { lat: 21.0287, lng: 105.8524, source: 'default' };
const RADII = [1, 2, 5, 10, 0];
const FAR_FROM_CITY_KM = 50;

function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = Math.PI / 180;
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  const y = (b.lat - a.lat) * r;
  return Math.sqrt(x * x + y * y) * 6371;
}

export default function App() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [category, setCategory] = useState<Category | 'all'>('all');
  const [tags, setTags] = useState<string[]>([]);
  const [radius, setRadius] = useState(0);
  const [maxPrice, setMaxPrice] = useState(0);
  const [q, setQ] = useState('');
  const [userLoc, setUserLoc] = useState<UserLoc>(HO_GUOM);
  const [notice, setNotice] = useState('Đang dùng vị trí mặc định: Hồ Gươm');
  const [places, setPlaces] = useState<Place[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [pickMode, setPickMode] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.meta().then(setMeta).catch(() => setError('Không kết nối được API. Hãy chạy backend (cd be && npm run dev).'));
  }, []);

  const locate = useCallback(() => {
    if (!navigator.geolocation) return setNotice('Trình duyệt không hỗ trợ định vị');
    setNotice('Đang lấy vị trí…');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const here = { lat: coords.latitude, lng: coords.longitude };
        if (distanceKm(here, HO_GUOM) > FAR_FROM_CITY_KM) {
          setUserLoc(HO_GUOM);
          setNotice('Bạn đang ở ngoài Hà Nội → dùng vị trí giả lập Hồ Gươm. Có thể bấm "Chọn trên bản đồ".');
        } else {
          setUserLoc({ ...here, source: 'gps' });
          setNotice(`Vị trí của bạn (sai số ~${Math.round(coords.accuracy)} m)`);
        }
      },
      () => setNotice('Không lấy được vị trí (đã từ chối quyền?) → dùng Hồ Gươm'),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, []);

  useEffect(() => {
    locate();
  }, [locate]);

  useEffect(() => {
    const t = setTimeout(() => {
      api
        .places({
          lat: userLoc.lat,
          lng: userLoc.lng,
          category: category === 'all' ? undefined : category,
          tags: tags.join(',') || undefined,
          radius: radius || undefined,
          maxPrice: maxPrice || undefined,
          q: q.trim() || undefined,
        })
        .then((r) => {
          setPlaces(r.items);
          setError('');
        })
        .catch((e) => setError(e.message));
    }, 200);
    return () => clearTimeout(t);
  }, [userLoc, category, tags, radius, maxPrice, q]);

  const visibleTags = useMemo(() => {
    if (!meta) return [];
    const cats = category === 'all' ? (Object.keys(meta.tagsByCategory) as Category[]) : [category];
    return [...new Set(cats.flatMap((c) => meta.tagsByCategory[c] ?? []))];
  }, [meta, category]);

  const selected = places.find((p) => p.id === selectedId) ?? null;

  const changeCategory = (c: Category | 'all') => {
    setCategory(c);
    setTags([]);
  };

  const toggleTag = (t: string) => setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const randomFood = async () => {
    try {
      const p = await api.random({ lat: userLoc.lat, lng: userLoc.lng, radius: radius || 3 });
      setCategory('food');
      setTags([]);
      setQ('');
      setSelectedId(p.id);
    } catch (e) {
      setNotice((e as Error).message);
    }
  };

  const pick = (lat: number, lng: number) => {
    setUserLoc({ lat, lng, source: 'manual' });
    setPickMode(false);
    setNotice('Đang dùng vị trí bạn chọn trên bản đồ');
  };

  if (!meta) return <div className="splash">{error || 'Đang tải…'}</div>;

  return (
    <div className="app">
      <aside className="panel">
        <header className="brand">
          <h1>🍜 Ăn Đâu Chơi Đâu</h1>
          <span className="city">{meta.city.name}</span>
        </header>

        <input className="search" placeholder="Tìm quán, món, địa điểm… (gõ không dấu được)" value={q} onChange={(e) => setQ(e.target.value)} />

        <div className="tabs" role="tablist">
          <button role="tab" aria-selected={category === 'all'} className={category === 'all' ? 'on' : ''} onClick={() => changeCategory('all')}>
            Tất cả
          </button>
          {(Object.keys(meta.categories) as Category[]).map((c) => (
            <button key={c} role="tab" aria-selected={category === c} className={category === c ? 'on' : ''} onClick={() => changeCategory(c)}>
              {meta.categories[c].icon} {meta.categories[c].label}
            </button>
          ))}
        </div>

        <div className="chips">
          {visibleTags.map((t) => (
            <button key={t} className={`chip${tags.includes(t) ? ' on' : ''}`} onClick={() => toggleTag(t)}>
              {meta.tags[t] ?? t}
            </button>
          ))}
        </div>

        <div className="row">
          <label>
            Bán kính
            <select value={radius} onChange={(e) => setRadius(+e.target.value)}>
              {RADII.map((r) => (
                <option key={r} value={r}>
                  {r ? `${r} km` : 'Tất cả'}
                </option>
              ))}
            </select>
          </label>
          <label>
            Giá
            <select value={maxPrice} onChange={(e) => setMaxPrice(+e.target.value)}>
              <option value={0}>Mọi mức</option>
              <option value={1}>Bình dân</option>
              <option value={2}>Tầm trung</option>
            </select>
          </label>
          <button className="random" onClick={randomFood}>
            🎲 Hôm nay ăn gì?
          </button>
        </div>

        <div className="loc">
          <span className="loc-text">📍 {notice}</span>
          <div className="loc-actions">
            <button onClick={locate}>Vị trí của tôi</button>
            <button className={pickMode ? 'on' : ''} onClick={() => setPickMode((v) => !v)}>
              {pickMode ? 'Bấm lên bản đồ…' : 'Chọn trên bản đồ'}
            </button>
            <button
              onClick={() => {
                setUserLoc({ ...HO_GUOM, source: 'manual' });
                setNotice('Đang dùng vị trí: Hồ Gươm');
              }}
            >
              Hồ Gươm
            </button>
          </div>
        </div>

        {error && <div className="error">{error}</div>}

        {selected ? (
          <PlaceDetail place={selected} meta={meta} onBack={() => setSelectedId(null)} />
        ) : (
          <>
            <div className="count">{places.length} địa điểm{radius ? ` trong ${radius} km` : ''}</div>
            <ul className="list">
              {places.map((p) => (
                <li key={p.id}>
                  <button className="card" onClick={() => setSelectedId(p.id)}>
                    <span className={`icon icon-${p.category}`}>{meta.categories[p.category].icon}</span>
                    <span className="card-body">
                      <strong>{p.name}</strong>
                      <small>
                        {p.mustTry ?? p.area} · {p.tags.slice(0, 2).map((t) => meta.tags[t]).join(', ')}
                      </small>
                    </span>
                    <span className="dist">{formatDistance(p.distanceKm)}</span>
                  </button>
                </li>
              ))}
              {!places.length && <li className="empty">Không có địa điểm phù hợp. Thử tăng bán kính hoặc bỏ bớt bộ lọc.</li>}
            </ul>
          </>
        )}

        <footer className="foot">
          Bản đồ: {MAP_PROVIDER} · Dữ liệu © OpenStreetMap · Bản demo, hãy kiểm tra lại thông tin trước khi đi
        </footer>
      </aside>

      <main className="map-wrap">
        <MapView
          meta={meta}
          places={places}
          userLoc={userLoc}
          radiusKm={radius}
          selectedId={selectedId}
          pickMode={pickMode}
          onSelect={setSelectedId}
          onPick={pick}
        />
      </main>
    </div>
  );
}

function PlaceDetail({ place: p, meta, onBack }: { place: Place; meta: Meta; onBack: () => void }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [p.id]);
  return (
    <article className="detail" ref={ref}>
      <button className="back" onClick={onBack}>
        ← Danh sách
      </button>
      <div className="detail-head">
        <span className={`icon icon-${p.category}`}>{meta.categories[p.category].icon}</span>
        <div>
          <h2>{p.name}</h2>
          <div className="sub">
            {meta.categories[p.category].label} · {p.area}
            {p.distanceKm != null && ` · cách ${formatDistance(p.distanceKm)}`}
          </div>
        </div>
      </div>

      {p.verified ? (
        <div className="badge ok" title={`Khớp với OSM: ${p.osm?.name}`}>
          ✓ Tọa độ đã đối chiếu với OpenStreetMap
        </div>
      ) : (
        <div className="badge warn">⚠ Tọa độ chưa xác minh, hãy so với Google Maps</div>
      )}

      <p>{p.description}</p>
      <dl>
        <dt>Địa chỉ</dt>
        <dd>{p.address}</dd>
        {p.mustTry && (
          <>
            <dt>Nên thử</dt>
            <dd>{p.mustTry}</dd>
          </>
        )}
        {p.price && (
          <>
            <dt>Mức giá</dt>
            <dd>{PRICE_LABEL[p.price]}</dd>
          </>
        )}
        {p.fee && (
          <>
            <dt>Vé</dt>
            <dd>{p.fee}</dd>
          </>
        )}
        <dt>Thẻ</dt>
        <dd>{p.tags.map((t) => meta.tags[t]).join(', ')}</dd>
      </dl>

      <div className="actions">
        <a className="btn primary" href={directionsUrl(p)} target="_blank" rel="noreferrer">
          🧭 Chỉ đường
        </a>
        <a className="btn" href={googleSearchUrl(p)} target="_blank" rel="noreferrer">
          ⭐ Xem đánh giá trên Google Maps
        </a>
        <a className="btn" href={osmUrl(p)} target="_blank" rel="noreferrer">
          🗺️ Xem trên OpenStreetMap
        </a>
      </div>
    </article>
  );
}
