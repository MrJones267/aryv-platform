-- =====================================================================
-- Migration 039: Documents as their own kind of package
-- Author: Oabona-Majoko
-- Created: 2026-11-07
--
-- Purpose:
--   A document was priced as a small parcel, so an envelope sent between
--   towns was quoted like a box (P1,800+ for 430 km). Documents now have
--   their own flat pricing (P30 within 30 km, P80 beyond, door to door),
--   which needs to know what a package is.
--
--   Additive with a default: existing packages are parcels, and code that
--   does not know the column is unaffected, so this is applied before the
--   code that requires it deploys. Safe to re-run.
-- =====================================================================

ALTER TABLE packages
  ADD COLUMN IF NOT EXISTS package_type VARCHAR(16) NOT NULL DEFAULT 'parcel';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'packages_package_type_check' AND conrelid = 'packages'::regclass
  ) THEN
    ALTER TABLE packages
      ADD CONSTRAINT packages_package_type_check CHECK (package_type IN ('parcel', 'document'));
  END IF;
END
$$;
