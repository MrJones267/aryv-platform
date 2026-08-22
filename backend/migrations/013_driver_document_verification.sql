-- =====================================================================
-- Migration 013: Driver Document Verification
-- Author: Oabona-Majoko
-- Created: 2026-08-22
--
-- Purpose:
--   Driver vetting existed only in the mobile client, where it ran against
--   simulated OCR behind __DEV__ and hit non-existent routes in release
--   builds. This adds the server-side record so documents are actually
--   submitted, reviewed by a human, and gate driving.
--
--   Deliberately NOT automated: no OCR, no scoring, no auto-approval. A
--   review decision is always attributable to a named admin. Automated
--   pre-screening can be layered on later without changing this schema.
-- =====================================================================

-- 1. Submitted identity / vehicle documents awaiting or having had review
CREATE TABLE IF NOT EXISTS driver_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- drivers_license, passport, national_id, vehicle_registration,
  -- insurance_card, background_check, bank_statement, utility_bill
  document_type VARCHAR(40) NOT NULL,

  -- uploaded -> under_review -> approved | rejected | requires_resubmission
  -- expired is set by the scheduled sweep once expires_at passes.
  status VARCHAR(30) NOT NULL DEFAULT 'uploaded',

  -- Storage key, not a public URL. Documents are identity papers and are
  -- served only through the authenticated, ownership-checked file route.
  storage_key VARCHAR(500) NOT NULL,
  original_filename VARCHAR(255) NULL,
  mime_type VARCHAR(100) NULL,
  file_size_bytes INTEGER NULL,

  -- Document's own expiry, where the type has one (licence, insurance).
  document_expires_at TIMESTAMP WITH TIME ZONE NULL,

  -- Review outcome. reviewed_by is an admin user id; a decision without one
  -- should not exist, which the CHECK below enforces.
  reviewed_by UUID NULL REFERENCES users(id),
  reviewed_at TIMESTAMP WITH TIME ZONE NULL,
  rejection_reason TEXT NULL,
  admin_notes TEXT NULL,

  -- Resubmission tracking. Attempts are capped so a rejected applicant
  -- cannot grind the review queue indefinitely.
  attempt_number INTEGER NOT NULL DEFAULT 1,

  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_driver_documents_status CHECK (
    status IN ('uploaded', 'under_review', 'approved', 'rejected',
               'requires_resubmission', 'expired')
  ),
  CONSTRAINT chk_driver_documents_decision_attributed CHECK (
    (status NOT IN ('approved', 'rejected', 'requires_resubmission'))
    OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
  ),
  CONSTRAINT chk_driver_documents_rejection_reason CHECK (
    status <> 'rejected' OR rejection_reason IS NOT NULL
  )
);

CREATE INDEX IF NOT EXISTS idx_driver_documents_user
  ON driver_documents (user_id);
CREATE INDEX IF NOT EXISTS idx_driver_documents_status
  ON driver_documents (status);
CREATE INDEX IF NOT EXISTS idx_driver_documents_review_queue
  ON driver_documents (status, submitted_at)
  WHERE status IN ('uploaded', 'under_review');
CREATE INDEX IF NOT EXISTS idx_driver_documents_expiry
  ON driver_documents (document_expires_at)
  WHERE status = 'approved';

-- Only one live document per type per user. Superseded submissions are kept
-- for audit, so the constraint is partial rather than a plain unique index.
CREATE UNIQUE INDEX IF NOT EXISTS uq_driver_documents_live_per_type
  ON driver_documents (user_id, document_type)
  WHERE status IN ('uploaded', 'under_review', 'approved');

-- 2. Driver-level verification state on the user record.
--    Derived from the documents above, but stored so that the hot path
--    (can this user create a ride?) is a single column read.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS driver_verification_status VARCHAR(20) NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS driver_verified_at TIMESTAMP WITH TIME ZONE NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_users_driver_verification_status'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT chk_users_driver_verification_status CHECK (
      driver_verification_status IN ('unverified', 'pending', 'verified', 'rejected', 'suspended')
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_users_driver_verification_status
  ON users (driver_verification_status);
