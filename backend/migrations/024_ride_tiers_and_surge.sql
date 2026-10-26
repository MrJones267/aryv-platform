-- =====================================================================
-- Migration 024: Ride tiers and surge periods
-- Author: Oabona-Majoko
-- Created: 2026-08-24
--
-- Purpose:
--
--   TIERS
--   A tier belongs to the ride, set by the driver from the vehicle they are
--   actually driving. It is not something a passenger picks: they are booking
--   one named driver's one specific car, so "upgrade to Premium" has nothing
--   to upgrade. What a tier does is let a passenger filter and know what they
--   are getting, and let the price suggestion compare like with like — a
--   Premium sedan should not be advised to charge what a shared minibus does.
--
--   SURGE
--   Demand around public holidays is real and predictable: the Thursday before
--   Christmas out of Gaborone is not an ordinary Thursday. Surge periods are
--   therefore an explicit, dated calendar rather than something inferred at
--   request time — which is what makes them auditable. Anyone can see why a
--   multiplier applied, and to what dates, before it happens.
--
--   The multiplier informs the *suggested* price shown to a driver, and is
--   labelled where a passenger can see it. It does not silently alter what is
--   charged: the driver sets the fare and the server charges that. Keeping it
--   advisory is what stops the displayed price and the billed price diverging,
--   which is exactly the bug the previous client-side pricing model caused.
-- =====================================================================

-- ---------------------------------------------------------------------------
-- Tiers
-- ---------------------------------------------------------------------------

ALTER TABLE rides
  ADD COLUMN IF NOT EXISTS tier VARCHAR(20) NOT NULL DEFAULT 'standard';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_rides_tier') THEN
    -- 'shared' is a minibus or similar with many seats and a lower fare.
    -- 'standard' is an ordinary car, and the default so every existing ride
    -- lands somewhere sensible without a backfill.
    ALTER TABLE rides ADD CONSTRAINT chk_rides_tier CHECK (
      tier IN ('shared', 'standard', 'comfort', 'premium')
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rides_tier ON rides (tier);

COMMENT ON COLUMN rides.tier IS
  'Service level of this ride, set by the driver from their vehicle. Not a passenger choice.';


-- ---------------------------------------------------------------------------
-- Surge periods
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS surge_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Shown to drivers and passengers as the reason, so a multiplier is never
  -- unexplained. e.g. 'Independence Day weekend'.
  name VARCHAR(120) NOT NULL,

  starts_at TIMESTAMP WITH TIME ZONE NOT NULL,
  ends_at TIMESTAMP WITH TIME ZONE NOT NULL,

  -- 1.00 means no change. Capped at 3 by the check below: an uncapped
  -- multiplier on a public holiday is how a platform ends up in the news.
  multiplier DECIMAL(4, 2) NOT NULL DEFAULT 1.00,

  -- Optional. When set, the period only applies to rides starting within
  -- radius_metres of this point — a Gaborone holiday rush need not raise
  -- suggestions in Maun.
  centre GEOMETRY(POINT, 4326) NULL,
  radius_metres INTEGER NULL,

  -- Lets a period be prepared ahead of time and switched on deliberately.
  is_active BOOLEAN NOT NULL DEFAULT TRUE,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_surge_periods_window CHECK (ends_at > starts_at),
  CONSTRAINT chk_surge_periods_multiplier CHECK (multiplier >= 1.00 AND multiplier <= 3.00),
  CONSTRAINT chk_surge_periods_radius CHECK (
    (centre IS NULL AND radius_metres IS NULL)
    OR (centre IS NOT NULL AND radius_metres IS NOT NULL AND radius_metres > 0)
  )
);

CREATE INDEX IF NOT EXISTS idx_surge_periods_window
  ON surge_periods (starts_at, ends_at) WHERE is_active;

CREATE INDEX IF NOT EXISTS idx_surge_periods_centre
  ON surge_periods USING GIST (centre);

COMMENT ON TABLE surge_periods IS
  'Dated, named multipliers for predictable demand. Advisory: informs the suggested price, does not alter the charged fare.';


-- ---------------------------------------------------------------------------
-- Botswana public holidays
--
-- Seeded through to the end of 2027. Dates are the gazetted holidays; where
-- one falls on a Sunday the following Monday is also a holiday, and both are
-- listed. Easter-linked dates move each year and are listed individually
-- rather than computed.
--
-- Multipliers are modest and deliberately uniform at this stage: 1.3 for the
-- travel days around a long weekend, 1.5 for the Christmas and New Year peak,
-- when intercity demand is highest and drivers are scarcest. They start
-- conservative because they are easier to raise on evidence than to lower
-- after complaints.
--
-- Each period runs from the evening before, which is when people actually
-- travel, to the end of the holiday itself.
-- ---------------------------------------------------------------------------

INSERT INTO surge_periods (name, starts_at, ends_at, multiplier)
SELECT v.name, v.starts_at::timestamptz, v.ends_at::timestamptz, v.multiplier
FROM (VALUES
    -- 2026
    ('Independence Day 2026',    '2026-09-29 12:00+02', '2026-10-01 23:59+02', 1.30),
    ('Christmas 2026',           '2026-12-23 12:00+02', '2026-12-26 23:59+02', 1.50),
    ('New Year 2027',            '2026-12-30 12:00+02', '2027-01-02 23:59+02', 1.50),
    -- 2027
    ('New Year holiday 2027',    '2027-01-01 00:00+02', '2027-01-02 23:59+02', 1.30),
    ('Easter 2027',              '2027-03-25 12:00+02', '2027-03-29 23:59+02', 1.30),
    ('Labour Day 2027',          '2027-04-30 12:00+02', '2027-05-01 23:59+02', 1.30),
    ('Ascension Day 2027',       '2027-05-05 12:00+02', '2027-05-06 23:59+02', 1.30),
    ('Sir Seretse Khama Day 2027','2027-06-30 12:00+02', '2027-07-01 23:59+02', 1.30),
    ('President''s Day 2027',    '2027-07-18 12:00+02', '2027-07-20 23:59+02', 1.30),
    ('Independence Day 2027',    '2027-09-29 12:00+02', '2027-10-01 23:59+02', 1.30),
    ('Christmas 2027',           '2027-12-23 12:00+02', '2027-12-27 23:59+02', 1.50)
) AS v(name, starts_at, ends_at, multiplier)
WHERE NOT EXISTS (
  SELECT 1 FROM surge_periods sp WHERE sp.name = v.name
);
