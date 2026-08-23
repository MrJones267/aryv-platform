-- =====================================================================
-- Migration 022: Emergency contacts and alerts
-- Author: Oabona-Majoko
-- Created: 2026-08-23
--
-- Purpose:
--   The SOS button did not work. The app posted to /locations/emergency
--   while the route was /locations/emergency-alert, so every alert 404'd
--   and the failure was caught and shown as a passive notice. Even had the
--   path matched, the two types the button actually sends — 'panic' and
--   'harassment' — were not in the endpoint's allowed list and would have
--   been rejected as invalid.
--
--   Behind that, the endpoint built an alert object with an id made from
--   Date.now(), wrote it to a log line, and dropped it. Nothing was stored.
--   So there was no way to see active emergencies, no way to resolve one,
--   nothing for an operator to act on, and no record afterwards.
--
--   It also read the user's emergency contact from their profile and then
--   never used it: the only notification went to the user who pressed the
--   button, on the phone they were holding.
--
--   Two tables fix the substance of that.
--
--   emergency_contacts replaces the single name/phone pair on users. One
--   contact is not enough for a feature whose whole job is reaching
--   somebody — the one contact may not answer. The old pair is copied over
--   below so nobody loses what they had set.
--
--   emergency_alerts makes an alert a real record with a lifecycle:
--   raised, acknowledged, resolved. It carries the last known location,
--   updated as the person moves, so responders can follow rather than
--   getting a single stale point.
-- =====================================================================

CREATE TABLE IF NOT EXISTS emergency_contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  name VARCHAR(200) NOT NULL,
  -- Stored E.164 so it can be dialled and texted without re-parsing.
  phone VARCHAR(20) NOT NULL,
  relationship VARCHAR(100) NULL,

  -- Contacted first, and the one the app offers to dial. Exactly one per
  -- user, enforced by the partial unique index below.
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,

  -- Order the rest are contacted in.
  priority INTEGER NOT NULL DEFAULT 100,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_emergency_contacts_phone_e164 CHECK (phone ~ '^\+[1-9][0-9]{6,17}$')
);

CREATE INDEX IF NOT EXISTS idx_emergency_contacts_user
  ON emergency_contacts (user_id, priority);

-- At most one primary per user. A partial index rather than a constraint so
-- the many non-primary rows are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS uq_emergency_contacts_primary
  ON emergency_contacts (user_id) WHERE is_primary;

-- Nobody should end up with fewer contacts than they had before this ran.
-- Only rows with a plausible phone are carried across; the rest are left for
-- the user to re-enter, since a contact that cannot be dialled is worse than
-- an obviously missing one.
INSERT INTO emergency_contacts (user_id, name, phone, relationship, is_primary, priority)
SELECT
  id,
  COALESCE(NULLIF(TRIM(emergency_contact_name), ''), 'Emergency contact'),
  TRIM(emergency_contact_phone),
  'Emergency contact',
  TRUE,
  0
FROM users
WHERE emergency_contact_phone IS NOT NULL
  AND TRIM(emergency_contact_phone) ~ '^\+[1-9][0-9]{6,17}$'
  AND NOT EXISTS (
    SELECT 1 FROM emergency_contacts ec WHERE ec.user_id = users.id
  );


CREATE TABLE IF NOT EXISTS emergency_alerts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- What the person said is happening. 'panic' and 'harassment' are here
  -- because they are what the SOS button sends; the old endpoint rejected
  -- both.
  alert_type VARCHAR(20) NOT NULL,

  -- raised   → nobody has picked it up yet
  -- acknowledged → an operator has it
  -- resolved → dealt with
  -- false_alarm → stood down by the person who raised it
  status VARCHAR(20) NOT NULL DEFAULT 'raised',

  message VARCHAR(500) NULL,

  -- Where they were when they raised it, and where they are now. Both are
  -- kept: the first is where responders were sent, the second is where to
  -- look. Overwriting the first would lose the trail.
  raised_coordinates GEOMETRY(POINT, 4326) NOT NULL,
  last_coordinates GEOMETRY(POINT, 4326) NOT NULL,
  last_location_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  ride_id UUID NULL REFERENCES rides(id) ON DELETE SET NULL,

  -- Who was told, and whether the message actually left. An alert whose
  -- notifications all failed is worse than useless if it looks delivered,
  -- so the count is recorded rather than inferred.
  contacts_notified INTEGER NOT NULL DEFAULT 0,
  notify_error TEXT NULL,

  acknowledged_by UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMP WITH TIME ZONE NULL,
  resolved_at TIMESTAMP WITH TIME ZONE NULL,
  resolution_note VARCHAR(500) NULL,

  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_emergency_alerts_type CHECK (
    alert_type IN ('panic', 'harassment', 'accident', 'medical', 'breakdown', 'safety', 'other')
  ),
  CONSTRAINT chk_emergency_alerts_status CHECK (
    status IN ('raised', 'acknowledged', 'resolved', 'false_alarm')
  )
);

-- The operator view: what is open, oldest first.
CREATE INDEX IF NOT EXISTS idx_emergency_alerts_open
  ON emergency_alerts (status, created_at)
  WHERE status IN ('raised', 'acknowledged');

CREATE INDEX IF NOT EXISTS idx_emergency_alerts_user
  ON emergency_alerts (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_emergency_alerts_ride ON emergency_alerts (ride_id);

CREATE INDEX IF NOT EXISTS idx_emergency_alerts_last_coordinates
  ON emergency_alerts USING GIST (last_coordinates);

COMMENT ON TABLE emergency_alerts IS
  'SOS alerts with a lifecycle. Previously alerts existed only as a log line.';
COMMENT ON COLUMN emergency_alerts.raised_coordinates IS
  'Where the alert was raised. Never updated — last_coordinates tracks movement.';
COMMENT ON COLUMN emergency_alerts.contacts_notified IS
  'How many emergency contacts were actually reached, not how many were tried.';
