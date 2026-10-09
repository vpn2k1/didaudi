-- Schema PostgreSQL + PostGIS cho giai đoạn sau MVP.
-- CHƯA được dùng: MVP lưu dữ liệu trong data/places.json qua JsonPlaceRepository.
-- Khi chuyển, viết PostgresPlaceRepository implement interface PlaceRepository.

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE provinces (
  code             text PRIMARY KEY,
  slug             text NOT NULL UNIQUE,
  name             text NOT NULL,
  type             text NOT NULL CHECK (type IN ('city', 'province')),
  center_latitude  double precision,
  center_longitude double precision
);

CREATE TABLE places (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug                text NOT NULL UNIQUE,
  name                text NOT NULL,
  description         text,
  must_try            text,
  category            text NOT NULL CHECK (category IN ('food', 'cafe', 'sight', 'fun')),
  province_slug       text NOT NULL REFERENCES provinces (slug),
  area                text,
  address             text,
  location            geography(Point, 4326) NOT NULL,
  price_min           integer CHECK (price_min >= 0),
  price_max           integer CHECK (price_max >= price_min),
  tags                text[] NOT NULL DEFAULT '{}',
  opening_hours       jsonb,          -- {"periods":[{"day":1,"open":"07:00","close":"21:00"}],"verifiedAt":"..."}
  website             text,
  phone               text,
  verification_status text NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified', 'coordinates_checked', 'verified')),
  publication_status  text NOT NULL DEFAULT 'draft' CHECK (publication_status IN ('draft', 'published')),
  is_demo             boolean NOT NULL DEFAULT false,
  editor_pick         boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX places_location_gix ON places USING gist (location);
CREATE INDEX places_province_category_idx ON places (province_slug, category) WHERE publication_status = 'published';

-- Chỉ lưu ID tham chiếu + metadata tối thiểu được phép theo điều khoản provider.
-- KHÔNG lưu rating/review/ảnh của Google.
CREATE TABLE place_provider_refs (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  place_id          uuid NOT NULL REFERENCES places (id) ON DELETE CASCADE,
  provider          text NOT NULL CHECK (provider IN ('osm', 'google')),
  provider_place_id text NOT NULL,
  label             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, provider_place_id)
);

-- Ví dụ truy vấn "quanh tôi" trong bán kính 5 km:
-- SELECT id, name, ST_Distance(location, ST_MakePoint($lng, $lat)::geography) AS meters
-- FROM places
-- WHERE publication_status = 'published'
--   AND ST_DWithin(location, ST_MakePoint($lng, $lat)::geography, 5000)
-- ORDER BY meters LIMIT 24;
