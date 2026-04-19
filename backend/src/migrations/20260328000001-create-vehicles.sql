-- Migration: create vehicles table
-- Created: 2026-03-28

DO $$ BEGIN
  CREATE TYPE vehicle_type AS ENUM ('sedan', 'suv', 'van', 'truck', 'motorcycle', 'minibus', 'other');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE vehicle_status AS ENUM ('active', 'inactive', 'pending_verification', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS vehicles (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                     UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  make                        VARCHAR(50) NOT NULL,
  model                       VARCHAR(50) NOT NULL,
  year                        INTEGER NOT NULL CHECK (year >= 1900 AND year <= EXTRACT(YEAR FROM NOW()) + 1),
  color                       VARCHAR(30) NOT NULL,
  license_plate               VARCHAR(20) NOT NULL UNIQUE,
  vehicle_type                vehicle_type NOT NULL DEFAULT 'sedan',
  seats_available             INTEGER NOT NULL CHECK (seats_available >= 1 AND seats_available <= 20),
  status                      vehicle_status NOT NULL DEFAULT 'pending_verification',
  is_verified                 BOOLEAN NOT NULL DEFAULT FALSE,
  registration_document       VARCHAR(500),
  insurance_document          VARCHAR(500),
  inspection_expiry           DATE,
  verification_submitted_at   TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_vehicles_user_id ON vehicles (user_id);
CREATE INDEX IF NOT EXISTS idx_vehicles_status  ON vehicles (status);
