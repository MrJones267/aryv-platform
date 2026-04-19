-- Migration: create rides table
-- Created: 2026-03-28

DO $$ BEGIN
  CREATE TYPE ride_status AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS rides (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id               UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  vehicle_id              UUID NOT NULL REFERENCES vehicles (id) ON DELETE RESTRICT,
  origin_address          TEXT NOT NULL,
  origin_coordinates      GEOMETRY(POINT, 4326) NOT NULL,
  destination_address     TEXT NOT NULL,
  destination_coordinates GEOMETRY(POINT, 4326) NOT NULL,
  departure_time          TIMESTAMPTZ NOT NULL,
  estimated_duration      INTEGER,         -- minutes
  distance                DECIMAL(8, 2),   -- km
  available_seats         INTEGER NOT NULL CHECK (available_seats >= 0),
  price_per_seat          DECIMAL(10, 2) NOT NULL CHECK (price_per_seat >= 0),
  status                  ride_status NOT NULL DEFAULT 'pending',
  description             TEXT,
  route                   JSON,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rides_driver_id      ON rides (driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_status         ON rides (status);
CREATE INDEX IF NOT EXISTS idx_rides_departure_time ON rides (departure_time);
-- PostGIS spatial indexes
CREATE INDEX IF NOT EXISTS idx_rides_origin_coords      ON rides USING GIST (origin_coordinates);
CREATE INDEX IF NOT EXISTS idx_rides_destination_coords ON rides USING GIST (destination_coordinates);
