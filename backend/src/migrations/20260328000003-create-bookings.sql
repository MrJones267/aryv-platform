-- Migration: create bookings table
-- Created: 2026-03-28

DO $$ BEGIN
  CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed', 'no_show');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS bookings (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ride_id             UUID NOT NULL REFERENCES rides (id) ON DELETE RESTRICT,
  passenger_id        UUID NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  seats_booked        INTEGER NOT NULL CHECK (seats_booked >= 1),
  total_amount        DECIMAL(10, 2) NOT NULL CHECK (total_amount >= 0),
  platform_fee        DECIMAL(10, 2) NOT NULL DEFAULT 0 CHECK (platform_fee >= 0),
  status              booking_status NOT NULL DEFAULT 'pending',
  pickup_address      TEXT,
  dropoff_address     TEXT,
  special_requests    TEXT,
  payment_intent_id   VARCHAR(255) UNIQUE,
  cancel_reason       TEXT,
  rating_given        INTEGER CHECK (rating_given >= 1 AND rating_given <= 5),
  review_text         TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (ride_id, passenger_id)
);

CREATE INDEX IF NOT EXISTS idx_bookings_ride_id      ON bookings (ride_id);
CREATE INDEX IF NOT EXISTS idx_bookings_passenger_id ON bookings (passenger_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status       ON bookings (status);
CREATE INDEX IF NOT EXISTS idx_bookings_created_at   ON bookings (created_at DESC);
