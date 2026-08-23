-- =====================================================================
-- Migration 021: Multi-stop rides
-- Author: Oabona-Majoko
-- Created: 2026-08-23
--
-- Purpose:
--   A ride was a single origin and a single destination. The platform is
--   marketed on intercity travel, where the real journey looks like:
--
--     Francistown → Palapye → Mahalapye → Gaborone
--
--   with four passenger seats, one passenger alighting at Palapye, one at
--   Mahalapye, and two continuing to Gaborone. None of that could be
--   expressed, let alone allocated.
--
--   The hard part is not the stops, it is the seats. A seat is not occupied
--   for a whole ride — it is occupied for the legs between where a passenger
--   boards and where they alight. When the Palapye passenger gets out, that
--   seat is free for Palapye onward, and someone can book it. Availability is
--   therefore a property of a *segment*, not of a ride.
--
--   Intra-city trips are the same model with no intermediate stops, so short
--   journeys keep working exactly as before.
--
--   Rides created before this have no stop rows. They are read as an implicit
--   two-stop journey — origin at sequence 0, destination at sequence 1 — so
--   nothing needs backfilling and existing bookings stay correct.
-- =====================================================================

CREATE TABLE IF NOT EXISTS ride_stops (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,

  -- Position along the route. 0 is always the origin; the highest sequence is
  -- always the final destination. Intermediate stops sit between.
  sequence INTEGER NOT NULL,

  address VARCHAR(500) NOT NULL,
  coordinates GEOMETRY(POINT, 4326) NOT NULL,

  -- Cumulative fare from the origin to this stop, so the fare for any segment
  -- is one subtraction: fare(alight) - fare(board). Storing per-leg prices
  -- instead would need a sum over legs on every availability check.
  -- Zero at the origin.
  fare_from_origin DECIMAL(10, 2) NOT NULL DEFAULT 0.00,

  -- Optional, for display. Not used in allocation.
  estimated_arrival TIMESTAMP WITH TIME ZONE NULL,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_ride_stops_sequence_non_negative CHECK (sequence >= 0),
  CONSTRAINT chk_ride_stops_fare_non_negative CHECK (fare_from_origin >= 0)
);

-- One stop per position per ride, which is also what keeps the ordering total.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ride_stops_ride_sequence
  ON ride_stops (ride_id, sequence);

CREATE INDEX IF NOT EXISTS idx_ride_stops_ride ON ride_stops (ride_id);
CREATE INDEX IF NOT EXISTS idx_ride_stops_coordinates ON ride_stops USING GIST (coordinates);

-- Which part of the journey a booking occupies.
--
-- Nullable, and null means the whole ride: every existing booking predates
-- stops and covers origin to destination, which is exactly what null reads as.
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS boarding_sequence INTEGER NULL,
  ADD COLUMN IF NOT EXISTS alighting_sequence INTEGER NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_bookings_segment_order'
  ) THEN
    -- A passenger must alight after they board. Either both are set or
    -- neither is.
    ALTER TABLE bookings ADD CONSTRAINT chk_bookings_segment_order CHECK (
      (boarding_sequence IS NULL AND alighting_sequence IS NULL)
      OR (boarding_sequence IS NOT NULL AND alighting_sequence IS NOT NULL
          AND alighting_sequence > boarding_sequence)
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookings_segment
  ON bookings (ride_id, boarding_sequence, alighting_sequence);

COMMENT ON TABLE ride_stops IS
  'Ordered stops along a ride. Sequence 0 is the origin, the highest is the destination.';
COMMENT ON COLUMN bookings.boarding_sequence IS
  'Stop sequence the passenger boards at. Null means the whole ride.';
