-- =====================================================================
-- Migration 040: A face photo from today, for each side of a booking
-- Author: Oabona-Majoko
-- Created: 2026-11-09
--
-- Purpose:
--   A profile photo can be months old, so it does not show who is
--   actually getting into the car. The passenger now takes a selfie when
--   booking and the driver when accepting. Each side sees the other's
--   once the booking is confirmed.
--
--   One row per side of a booking: a retake replaces the earlier photo.
--   Rows are deleted, with their files, a day after the trip ends, unless
--   a report or SOS involving the two people is still open.
--
--   New table only; nothing existing reads it. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS trip_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(10) NOT NULL,
  storage_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT trip_photos_role_check CHECK (role IN ('passenger', 'driver'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_trip_photos_booking_role ON trip_photos (booking_id, role);
