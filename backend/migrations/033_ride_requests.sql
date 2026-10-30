-- =====================================================================
-- Migration 033: Ride requests drivers can see
-- Author: Oabona-Majoko
-- Created: 2026-10-30
--
-- Purpose:
--   A passenger who finds no ride can post what they need: where from,
--   where to, when, how many seats and what they will pay. Requests used to
--   live in Redis for 24 hours, visible to nobody but the passenger, so
--   "post a ride request so drivers can find you" reached no driver.
--
--   Drivers now list open requests near them, and a passenger is told when
--   a ride that fits their request is published. notified_ride_ids records
--   which rides they were already told about, so a ride is announced once.
--
--   Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS ride_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  passenger_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  origin_address VARCHAR(500) NOT NULL,
  origin_coordinates GEOMETRY(POINT, 4326) NOT NULL,
  destination_address VARCHAR(500) NOT NULL,
  destination_coordinates GEOMETRY(POINT, 4326) NOT NULL,
  departure_time TIMESTAMP WITH TIME ZONE NOT NULL,
  seats INTEGER NOT NULL CHECK (seats BETWEEN 1 AND 8),
  max_price DECIMAL(10, 2) CHECK (max_price IS NULL OR max_price >= 0),
  currency VARCHAR(3) NOT NULL DEFAULT 'BWP',
  note VARCHAR(500),
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  notified_ride_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ride_requests_passenger_id ON ride_requests (passenger_id);
CREATE INDEX IF NOT EXISTS idx_ride_requests_status_departure ON ride_requests (status, departure_time);
CREATE INDEX IF NOT EXISTS idx_ride_requests_origin ON ride_requests USING GIST (origin_coordinates);
CREATE INDEX IF NOT EXISTS idx_ride_requests_destination ON ride_requests USING GIST (destination_coordinates);
