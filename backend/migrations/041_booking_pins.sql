-- =====================================================================
-- Migration 041: The pickup PIN, kept on the server, one per booking
-- Author: Oabona-Majoko
-- Created: 2026-11-09
--
-- Purpose:
--   The passenger reads a PIN to the driver at pickup, so the driver knows
--   the right person is getting in. The PIN only ever existed on the
--   passenger's phone: the driver's phone checked what was typed against
--   its own storage, which never had it, so every PIN was refused.
--
--   Its own table rather than a column on bookings: booking rows are sent
--   to the driver (their passenger list), and the driver must not see it.
--
--   New table only; nothing existing reads it. Safe to re-run.
-- =====================================================================

CREATE TABLE IF NOT EXISTS booking_pins (
  booking_id UUID PRIMARY KEY REFERENCES bookings(id) ON DELETE CASCADE,
  pin VARCHAR(4) NOT NULL,
  failed_attempts INTEGER NOT NULL DEFAULT 0,
  verified_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);
