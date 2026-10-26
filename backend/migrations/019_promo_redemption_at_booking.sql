-- =====================================================================
-- Migration 019: Apply and record promo codes at booking
-- Author: Oabona-Majoko
-- Created: 2026-08-23
--
-- Purpose:
--   Promo codes were validated and never applied. /promos/validate computed a
--   discount and returned it; nothing in the booking path consumed one, so a
--   code reduced nothing. Redemption was recorded in a Redis key with a
--   year-long TTL and an increment of used_count — separate from the booking,
--   so a code could be redeemed without booking, or a booking made without the
--   redemption ever being recorded.
--
--   Applying it at booking makes the discount real and the redemption durable,
--   both inside the transaction that creates the booking.
--
--   Who pays for the discount is the substantive question. On a cash ride the
--   rider hands the fare to the driver, so reducing the total takes money from
--   the driver rather than the platform. The discount is therefore capped at
--   the platform's own take on the booking, which is the only part the
--   platform can give away without owing the driver the difference. See
--   PROMO_FUNDING in RideController for the consequence: a promo larger than
--   that margin cannot be honoured in full until there is a way to reimburse
--   drivers.
-- =====================================================================

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS promo_code VARCHAR(20) NULL,
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00;

CREATE INDEX IF NOT EXISTS idx_bookings_promo_code
  ON bookings (promo_code)
  WHERE promo_code IS NOT NULL;

-- Durable redemption record. This lived in Redis, which is a cache: a flush or
-- an eviction handed everybody their one-per-user promo back.
CREATE TABLE IF NOT EXISTS promo_redemptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  promo_code_id UUID NOT NULL REFERENCES promo_codes(id),
  user_id UUID NOT NULL REFERENCES users(id),
  booking_id UUID NULL REFERENCES bookings(id),

  -- What was actually taken off, which may be less than the promo's face value
  -- once capped against the platform's margin.
  discount_amount DECIMAL(10, 2) NOT NULL,
  order_amount DECIMAL(10, 2) NOT NULL,

  redeemed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- One redemption per code per user, enforced by the database rather than by a
-- cache lookup that can disappear.
CREATE UNIQUE INDEX IF NOT EXISTS uq_promo_redemptions_user_code
  ON promo_redemptions (promo_code_id, user_id);

CREATE INDEX IF NOT EXISTS idx_promo_redemptions_booking
  ON promo_redemptions (booking_id);
