-- =====================================================================
-- Migration 014: Delivery handover codes
-- Author: Oabona-Majoko
-- Created: 2026-08-23
--
-- Purpose:
--   Completes the delivery confirmation protocol. Codes were modelled in
--   delivery_qr_codes but never generated: generateDeliveryQRCode had no
--   callers, so POST /courier/verify-qr/:token could only ever answer
--   "QR code not found" and no delivery could be completed without an admin.
--
--   The protocol: a code is issued when the courier confirms pickup and sent
--   by SMS to the recipient — never returned to the courier. At handover the
--   recipient reads it out, the courier submits it, and the escrow releases.
--   The security property is that the courier cannot know the code in advance,
--   so submitting it is evidence they met the recipient.
--
--   Codes are therefore short enough to read aloud, which makes brute force
--   the thing to defend against: hence the attempt counter below.
-- =====================================================================

ALTER TABLE delivery_qr_codes
  -- Failed submissions against this code. Enforced against a cap in
  -- DeliveryHandoverService; past it the code locks and the delivery has to
  -- go through dispute resolution.
  ADD COLUMN IF NOT EXISTS failed_attempts INTEGER NOT NULL DEFAULT 0,

  -- Which number the code was sent to, and whether the carrier accepted it.
  -- Without this there is no way to answer "the recipient says they never got
  -- a code" during a dispute.
  ADD COLUMN IF NOT EXISTS sent_to_phone VARCHAR(32) NULL,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMP WITH TIME ZONE NULL,
  ADD COLUMN IF NOT EXISTS delivery_channel VARCHAR(20) NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_delivery_qr_codes_channel'
  ) THEN
    ALTER TABLE delivery_qr_codes ADD CONSTRAINT chk_delivery_qr_codes_channel CHECK (
      delivery_channel IS NULL
      OR delivery_channel IN ('recipient_sms', 'sender_sms', 'none')
    );
  END IF;
END $$;

-- The verification path looks a code up directly, so it needs to be indexed
-- and unique. Codes are short, so a collision is possible in principle;
-- issuing retries on conflict.
CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_qr_codes_token
  ON delivery_qr_codes (qr_token);

-- One active code per agreement at a time; superseded ones are kept for audit.
CREATE INDEX IF NOT EXISTS idx_delivery_qr_codes_active
  ON delivery_qr_codes (delivery_agreement_id, status)
  WHERE status = 'active';
