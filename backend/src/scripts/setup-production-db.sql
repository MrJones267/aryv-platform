-- ARYV Platform — Complete Production Database Setup
-- Run once on a fresh PostgreSQL instance.
-- All statements are idempotent (CREATE IF NOT EXISTS / DO blocks).

-- ─── Extensions ──────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ─── ENUM TYPES ──────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE user_role        AS ENUM ('passenger','driver','admin','courier');
  CREATE TYPE user_status      AS ENUM ('active','suspended','pending_verification','deactivated');
  CREATE TYPE vehicle_type     AS ENUM ('sedan','suv','hatchback','minivan','motorcycle','bicycle');
  CREATE TYPE vehicle_status   AS ENUM ('active','inactive','maintenance','suspended','pending_verification');
  CREATE TYPE ride_status      AS ENUM ('pending','confirmed','in_progress','completed','cancelled');
  CREATE TYPE booking_status   AS ENUM ('pending','confirmed','cancelled','completed');
  CREATE TYPE admin_role       AS ENUM ('super_admin','admin','moderator');
  CREATE TYPE package_size     AS ENUM ('small','medium','large','custom');
  CREATE TYPE delivery_status  AS ENUM ('pending_pickup','in_transit','completed','disputed','cancelled');
  CREATE TYPE dispute_type     AS ENUM ('package_not_delivered','package_damaged','incorrect_location','wrong_recipient','late_delivery','courier_no_show','other');
  CREATE TYPE dispute_status   AS ENUM ('open','under_review','resolved','closed');
  CREATE TYPE qr_status        AS ENUM ('active','used','expired');
  CREATE TYPE tier_type        AS ENUM ('lightning','express','standard','economy');
  CREATE TYPE urgency_level    AS ENUM ('LOW','NORMAL','HIGH','URGENT');
  CREATE TYPE cash_pay_status  AS ENUM ('pending_verification','driver_confirmed','rider_confirmed','both_confirmed','disputed','completed','failed','expired');
  CREATE TYPE wallet_status    AS ENUM ('active','suspended','closed');
  CREATE TYPE kyc_level        AS ENUM ('basic','enhanced','full');
  CREATE TYPE wallet_txn_type  AS ENUM ('load','payment','refund','transfer','escrow_hold','escrow_release','fee','bonus');
  CREATE TYPE wallet_txn_src   AS ENUM ('agent','kiosk','partner_store','mobile_money','voucher','bank_transfer','ride_payment','refund');
  CREATE TYPE wallet_txn_stat  AS ENUM ('pending','completed','failed','cancelled');
  CREATE TYPE verif_level      AS ENUM ('basic','verified','premium');
  CREATE TYPE call_type        AS ENUM ('voice','video','emergency');
  CREATE TYPE call_purpose     AS ENUM ('ride_communication','courier_delivery','emergency_call','customer_support');
  CREATE TYPE call_status      AS ENUM ('initiated','ringing','accepted','rejected','ended','failed','missed');
  CREATE TYPE pkg_img_type     AS ENUM ('package','pickup_proof','delivery_proof','damage_evidence');
  CREATE TYPE chat_msg_type    AS ENUM ('text','image','video','audio','file','location','system','poll','announcement');
  CREATE TYPE chat_msg_status  AS ENUM ('sent','delivered','read','deleted','edited');
  CREATE TYPE chat_type        AS ENUM ('ride_group','delivery_group','emergency_group','custom_group');
  CREATE TYPE chat_status      AS ENUM ('active','archived','deleted');
  CREATE TYPE participant_role AS ENUM ('admin','moderator','member');
  CREATE TYPE participant_stat AS ENUM ('active','muted','blocked','left','removed');
  CREATE TYPE courier_msg_type AS ENUM ('text','image','location','system');
  CREATE TYPE notif_type       AS ENUM ('ride_request','ride_accepted','ride_cancelled','ride_started','ride_completed','payment_received','payment_failed','chat_message','incoming_call','call_missed','delivery_request','delivery_accepted','delivery_completed','package_delivered','emergency_alert','system_update','promotion','reminder','ai_suggestion');
  CREATE TYPE notif_priority   AS ENUM ('low','normal','high','urgent','critical');
  CREATE TYPE notif_status     AS ENUM ('pending','sent','delivered','read','dismissed','failed');
  CREATE TYPE notif_freq       AS ENUM ('immediate','digest_hourly','digest_daily','digest_weekly');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ─── USERS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                       UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  email                    VARCHAR(255) NOT NULL UNIQUE,
  password                 VARCHAR(255) NOT NULL,
  first_name               VARCHAR(50)  NOT NULL,
  last_name                VARCHAR(50)  NOT NULL,
  phone_number             VARCHAR(20),
  role                     user_role    NOT NULL DEFAULT 'passenger',
  status                   user_status  NOT NULL DEFAULT 'active',
  profile_image            TEXT,
  date_of_birth            DATE,
  is_email_verified        BOOLEAN      NOT NULL DEFAULT FALSE,
  is_phone_verified        BOOLEAN      NOT NULL DEFAULT FALSE,
  is_verified              BOOLEAN      NOT NULL DEFAULT FALSE,
  is_active                BOOLEAN      NOT NULL DEFAULT TRUE,
  last_login_at            TIMESTAMPTZ,
  refresh_token            TEXT,
  country_code             VARCHAR(2),
  country_name             VARCHAR(100),
  timezone                 VARCHAR(50),
  rating                   DECIMAL(3,2) DEFAULT 5.0,
  total_rides              INTEGER      DEFAULT 0,
  preferences              JSONB        DEFAULT '{}',
  bio                      TEXT,
  gender                   VARCHAR(20),
  address                  TEXT,
  emergency_contact_name   VARCHAR(200),
  emergency_contact_phone  VARCHAR(20),
  deactivated_at           TIMESTAMPTZ,
  deactivation_reason      TEXT,
  created_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_email   ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_role    ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_status  ON users (status);

-- ─── ADMIN USERS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_users (
  id                     UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  email                  VARCHAR(255) NOT NULL UNIQUE,
  password_hash          VARCHAR(255) NOT NULL,
  first_name             VARCHAR(100) NOT NULL,
  last_name              VARCHAR(100) NOT NULL,
  role                   admin_role   NOT NULL DEFAULT 'admin',
  permissions            JSONB        NOT NULL DEFAULT '[]',
  is_active              BOOLEAN      NOT NULL DEFAULT TRUE,
  last_login             TIMESTAMPTZ,
  failed_login_attempts  INTEGER      NOT NULL DEFAULT 0,
  lockout_until          TIMESTAMPTZ,
  two_factor_secret      VARCHAR(255),
  two_factor_enabled     BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_users_role ON admin_users (role);

-- ─── VEHICLES ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vehicles (
  id                       UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id                UUID           NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  make                     VARCHAR(50)    NOT NULL,
  model                    VARCHAR(50)    NOT NULL,
  year                     INTEGER        NOT NULL,
  color                    VARCHAR(30)    NOT NULL,
  license_plate            VARCHAR(20)    NOT NULL UNIQUE,
  vehicle_type             vehicle_type   NOT NULL,
  seats_available          INTEGER        NOT NULL,
  status                   vehicle_status NOT NULL DEFAULT 'inactive',
  is_verified              BOOLEAN        NOT NULL DEFAULT FALSE,
  registration_document    TEXT,
  insurance_document       TEXT,
  inspection_expiry        DATE,
  verification_submitted_at TIMESTAMPTZ,
  created_at               TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_vehicles_driver_id ON vehicles (driver_id);

-- ─── RIDES ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rides (
  id                       UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  driver_id                UUID        NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  vehicle_id               UUID        NOT NULL REFERENCES vehicles (id) ON DELETE RESTRICT,
  origin_address           TEXT        NOT NULL,
  origin_coordinates       GEOMETRY(Point, 4326) NOT NULL,
  destination_address      TEXT        NOT NULL,
  destination_coordinates  GEOMETRY(Point, 4326) NOT NULL,
  departure_time           TIMESTAMPTZ NOT NULL,
  estimated_duration       INTEGER,
  distance                 DECIMAL(8,2),
  available_seats          INTEGER     NOT NULL,
  price_per_seat           DECIMAL(10,2) NOT NULL,
  status                   ride_status NOT NULL DEFAULT 'pending',
  description              TEXT,
  route                    JSONB,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_rides_driver_id     ON rides (driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_status        ON rides (status);
CREATE INDEX IF NOT EXISTS idx_rides_departure     ON rides (departure_time);
CREATE INDEX IF NOT EXISTS idx_rides_origin_coords ON rides USING GIST (origin_coordinates);

-- ─── BOOKINGS ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bookings (
  id                  UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  ride_id             UUID            NOT NULL REFERENCES rides (id) ON DELETE RESTRICT,
  passenger_id        UUID            NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  seats_booked        INTEGER         NOT NULL,
  total_amount        DECIMAL(10,2)   NOT NULL,
  platform_fee        DECIMAL(10,2)   NOT NULL DEFAULT 0,
  status              booking_status  NOT NULL DEFAULT 'pending',
  pickup_address      TEXT,
  dropoff_address     TEXT,
  special_requests    TEXT,
  payment_intent_id   VARCHAR(255)    UNIQUE,
  cancel_reason       TEXT,
  rating_given        INTEGER,
  review_text         TEXT,
  created_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  UNIQUE (ride_id, passenger_id)
);
CREATE INDEX IF NOT EXISTS idx_bookings_ride_id      ON bookings (ride_id);
CREATE INDEX IF NOT EXISTS idx_bookings_passenger_id ON bookings (passenger_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status       ON bookings (status);

-- ─── CURRENCIES ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS currencies (
  id              UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  code            VARCHAR(3)    NOT NULL UNIQUE,
  name            VARCHAR(100)  NOT NULL,
  symbol          VARCHAR(5)    NOT NULL,
  decimal_places  INTEGER       NOT NULL DEFAULT 2,
  is_active       BOOLEAN       NOT NULL DEFAULT TRUE,
  exchange_rate   DECIMAL(15,6) NOT NULL DEFAULT 1.0,
  last_updated    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  country_code    VARCHAR(2),
  flag            VARCHAR(10),
  region          VARCHAR(50),
  is_popular      BOOLEAN       DEFAULT FALSE,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ─── USER CURRENCIES ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_currencies (
  id                  UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID        NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  currency_id         UUID        NOT NULL REFERENCES currencies (id) ON DELETE CASCADE,
  is_primary          BOOLEAN     NOT NULL DEFAULT FALSE,
  is_payment_enabled  BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, currency_id)
);

-- ─── USER WALLETS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_wallets (
  id                          UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                     UUID          NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  available_balance           DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  pending_balance             DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  escrow_balance              DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  daily_cash_limit            DECIMAL(8,2)  NOT NULL DEFAULT 100.00,
  weekly_cash_limit           DECIMAL(8,2)  NOT NULL DEFAULT 500.00,
  monthly_cash_limit          DECIMAL(8,2)  NOT NULL DEFAULT 2000.00,
  daily_cash_used             DECIMAL(8,2)  NOT NULL DEFAULT 0.00,
  weekly_cash_used            DECIMAL(8,2)  NOT NULL DEFAULT 0.00,
  monthly_cash_used           DECIMAL(8,2)  NOT NULL DEFAULT 0.00,
  last_reset_date             TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  verification_level          verif_level   NOT NULL DEFAULT 'basic',
  phone_verified              BOOLEAN       NOT NULL DEFAULT FALSE,
  id_verified                 BOOLEAN       NOT NULL DEFAULT FALSE,
  address_verified            BOOLEAN       NOT NULL DEFAULT FALSE,
  trust_score                 INTEGER       NOT NULL DEFAULT 50,
  completed_cash_transactions INTEGER       NOT NULL DEFAULT 0,
  disputed_transactions       INTEGER       NOT NULL DEFAULT 0,
  successful_transactions     INTEGER       NOT NULL DEFAULT 0,
  total_transaction_value     DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  average_transaction_value   DECIMAL(8,2)  NOT NULL DEFAULT 0.00,
  last_trust_score_update     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  is_suspended                BOOLEAN       NOT NULL DEFAULT FALSE,
  suspension_reason           TEXT,
  suspended_until             TIMESTAMPTZ,
  created_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ─── CASH WALLETS ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cash_wallets (
  id                   UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID          NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  balance              DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  currency             VARCHAR(3)    NOT NULL DEFAULT 'USD',
  status               wallet_status NOT NULL DEFAULT 'active',
  daily_load_limit     DECIMAL(10,2) NOT NULL DEFAULT 500.00,
  monthly_load_limit   DECIMAL(12,2) NOT NULL DEFAULT 10000.00,
  daily_spend_limit    DECIMAL(10,2) NOT NULL DEFAULT 1000.00,
  monthly_spend_limit  DECIMAL(12,2) NOT NULL DEFAULT 15000.00,
  kyc_level            kyc_level     NOT NULL DEFAULT 'basic',
  is_verified          BOOLEAN       NOT NULL DEFAULT FALSE,
  last_transaction_at  TIMESTAMPTZ,
  frozen_balance       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  escrow_balance       DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

-- ─── CASH WALLET TRANSACTIONS ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cash_wallet_transactions (
  id                UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id         UUID           NOT NULL REFERENCES cash_wallets (id) ON DELETE RESTRICT,
  type              wallet_txn_type NOT NULL,
  amount            DECIMAL(10,2)  NOT NULL,
  currency          VARCHAR(3)     NOT NULL DEFAULT 'USD',
  balance_before    DECIMAL(12,2)  NOT NULL,
  balance_after     DECIMAL(12,2)  NOT NULL,
  status            wallet_txn_stat NOT NULL DEFAULT 'pending',
  source            wallet_txn_src  NOT NULL,
  source_reference  VARCHAR(255),
  description       TEXT           NOT NULL,
  metadata          JSONB          DEFAULT '{}',
  processed_at      TIMESTAMPTZ,
  expires_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cash_wallet_txns_wallet_id ON cash_wallet_transactions (wallet_id);

-- ─── CASH TRANSACTIONS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cash_transactions (
  id                        UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  booking_id                UUID           NOT NULL REFERENCES bookings (id) ON DELETE RESTRICT,
  rider_id                  UUID           NOT NULL REFERENCES users (id),
  driver_id                 UUID           NOT NULL REFERENCES users (id),
  amount                    DECIMAL(8,2)   NOT NULL,
  platform_fee              DECIMAL(8,2)   NOT NULL DEFAULT 0.00,
  expected_amount           DECIMAL(8,2)   NOT NULL,
  actual_amount_claimed     DECIMAL(8,2),
  status                    cash_pay_status NOT NULL DEFAULT 'pending_verification',
  rider_confirmed_at        TIMESTAMPTZ,
  driver_confirmed_at       TIMESTAMPTZ,
  rider_confirmation_code   VARCHAR(6)     NOT NULL,
  driver_confirmation_code  VARCHAR(6)     NOT NULL,
  verification_photo        VARCHAR(500),
  gps_location_confirmed    BOOLEAN        NOT NULL DEFAULT FALSE,
  transaction_location      JSONB,
  dispute_reason            TEXT,
  dispute_resolved_at       TIMESTAMPTZ,
  dispute_resolution        VARCHAR(20),
  risk_score                INTEGER        NOT NULL DEFAULT 0,
  fraud_flags               JSONB,
  metadata                  JSONB,
  expires_at                TIMESTAMPTZ    NOT NULL,
  created_at                TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cash_txns_booking_id ON cash_transactions (booking_id);

-- ─── COUNTRIES ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS countries (
  id             UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  code           VARCHAR(2)   NOT NULL UNIQUE,
  name           VARCHAR(100) NOT NULL,
  name_official  VARCHAR(200),
  flag           VARCHAR(10),
  continent      VARCHAR(50)  NOT NULL,
  region         VARCHAR(100) NOT NULL,
  sub_region     VARCHAR(100),
  capital        VARCHAR(100),
  phone_prefix   VARCHAR(10),
  timezones      TEXT[]       NOT NULL DEFAULT ARRAY['UTC'],
  languages      TEXT[]       NOT NULL DEFAULT ARRAY['en'],
  is_active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- ─── COURIER PROFILES ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courier_profiles (
  id                          UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                     UUID        NOT NULL UNIQUE REFERENCES users (id) ON DELETE CASCADE,
  is_courier_active           BOOLEAN     NOT NULL DEFAULT FALSE,
  courier_rating              DECIMAL(3,2) NOT NULL DEFAULT 5.0,
  total_deliveries            INTEGER     NOT NULL DEFAULT 0,
  successful_deliveries       INTEGER     NOT NULL DEFAULT 0,
  total_courier_earnings      DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  preferred_package_sizes     TEXT[]      NOT NULL DEFAULT ARRAY['small','medium'],
  max_package_weight          DECIMAL(8,3),
  delivery_radius             DECIMAL(8,2),
  is_available_for_deliveries BOOLEAN     NOT NULL DEFAULT FALSE,
  verification_documents      JSONB,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── DELIVERY TIERS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_tiers (
  id                       UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  tier_type                tier_type   NOT NULL UNIQUE,
  tier_name                VARCHAR(100) NOT NULL,
  description              TEXT        NOT NULL,
  max_delivery_hours       INTEGER     NOT NULL,
  min_delivery_hours       INTEGER     NOT NULL,
  base_price_multiplier    DECIMAL(4,2) NOT NULL,
  platform_fee_percentage  DECIMAL(5,2) NOT NULL,
  sla_guarantee            DECIMAL(5,2) NOT NULL,
  is_active                BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── DEMAND METRICS ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS demand_metrics (
  id                    UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_hash         VARCHAR(50)   NOT NULL,
  time_slot             TIMESTAMPTZ   NOT NULL,
  available_couriers    INTEGER       NOT NULL DEFAULT 0,
  active_demand         INTEGER       NOT NULL DEFAULT 0,
  completed_deliveries  INTEGER       NOT NULL DEFAULT 0,
  average_delivery_time DECIMAL(8,2)  NOT NULL DEFAULT 0.00,
  demand_multiplier     DECIMAL(4,2)  NOT NULL DEFAULT 1.00,
  weather_conditions    VARCHAR(100),
  event_modifier        DECIMAL(4,2)  NOT NULL DEFAULT 1.00,
  calculated_at         TIMESTAMPTZ   NOT NULL,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (location_hash, time_slot)
);

-- ─── PACKAGES ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS packages (
  id                      UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  sender_id               UUID           NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  title                   VARCHAR(200)   NOT NULL,
  description             TEXT,
  dimensions_length       DECIMAL(6,2),
  dimensions_width        DECIMAL(6,2),
  dimensions_height       DECIMAL(6,2),
  weight                  DECIMAL(8,3),
  package_size            package_size   NOT NULL DEFAULT 'medium',
  fragile                 BOOLEAN        NOT NULL DEFAULT FALSE,
  valuable                BOOLEAN        NOT NULL DEFAULT FALSE,
  special_instructions    TEXT,
  pickup_address          VARCHAR(500)   NOT NULL,
  pickup_coordinates      GEOMETRY(Point, 4326) NOT NULL,
  pickup_contact_name     VARCHAR(100),
  pickup_contact_phone    VARCHAR(20),
  dropoff_address         VARCHAR(500)   NOT NULL,
  dropoff_coordinates     GEOMETRY(Point, 4326) NOT NULL,
  dropoff_contact_name    VARCHAR(100),
  dropoff_contact_phone   VARCHAR(20),
  package_images          JSONB,
  distance                DECIMAL(8,2),
  sender_price_offer      DECIMAL(8,2)   NOT NULL,
  system_suggested_price  DECIMAL(8,2),
  delivery_tier_id        UUID           REFERENCES delivery_tiers (id),
  requested_delivery_time TIMESTAMPTZ,
  urgency_level           urgency_level,
  demand_multiplier_applied DECIMAL(4,2),
  is_active               BOOLEAN        NOT NULL DEFAULT TRUE,
  expires_at              TIMESTAMPTZ,
  created_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_packages_sender_id ON packages (sender_id);
CREATE INDEX IF NOT EXISTS idx_packages_is_active ON packages (is_active);

-- ─── PACKAGE IMAGES ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS package_images (
  id                  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  package_id          UUID         NOT NULL REFERENCES packages (id) ON DELETE CASCADE,
  image_url           VARCHAR(500) NOT NULL,
  image_type          pkg_img_type NOT NULL DEFAULT 'package',
  uploaded_by_user_id UUID         NOT NULL REFERENCES users (id),
  uploaded_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  metadata            JSONB
);
CREATE INDEX IF NOT EXISTS idx_package_images_package_id ON package_images (package_id);

-- ─── DELIVERY AGREEMENTS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_agreements (
  id                    UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
  package_id            UUID             NOT NULL REFERENCES packages (id) ON DELETE RESTRICT,
  courier_id            UUID             NOT NULL REFERENCES users (id) ON DELETE RESTRICT,
  agreed_price          DECIMAL(8,2)     NOT NULL,
  platform_fee          DECIMAL(8,2)     NOT NULL DEFAULT 0.00,
  status                delivery_status  NOT NULL DEFAULT 'pending_pickup',
  escrow_payment_id     VARCHAR(100),
  escrow_amount         DECIMAL(8,2)     NOT NULL,
  escrow_held_at        TIMESTAMPTZ,
  pickup_confirmed_at   TIMESTAMPTZ,
  pickup_location       GEOMETRY(Point, 4326),
  delivery_confirmed_at TIMESTAMPTZ,
  delivery_location     GEOMETRY(Point, 4326),
  payment_released_at   TIMESTAMPTZ,
  qr_code_token         VARCHAR(100)     UNIQUE,
  qr_code_expires_at    TIMESTAMPTZ,
  event_log             JSONB            NOT NULL DEFAULT '[]',
  chat_channel_id       UUID,
  courier_locations     JSONB            DEFAULT '[]',
  created_at            TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_delivery_agreements_package_id  ON delivery_agreements (package_id);
CREATE INDEX IF NOT EXISTS idx_delivery_agreements_courier_id  ON delivery_agreements (courier_id);
CREATE INDEX IF NOT EXISTS idx_delivery_agreements_status      ON delivery_agreements (status);

-- ─── DELIVERY DISPUTES ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_disputes (
  id                      UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_agreement_id   UUID           NOT NULL REFERENCES delivery_agreements (id) ON DELETE RESTRICT,
  raised_by_user_id       UUID           NOT NULL REFERENCES users (id),
  dispute_type            dispute_type   NOT NULL,
  description             TEXT           NOT NULL,
  evidence_images         JSONB,
  status                  dispute_status NOT NULL DEFAULT 'open',
  admin_notes             TEXT,
  resolution_amount       DECIMAL(8,2),
  resolved_by_admin_id    UUID           REFERENCES users (id),
  resolved_at             TIMESTAMPTZ,
  created_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ─── DELIVERY QR CODES ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS delivery_qr_codes (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_agreement_id UUID        NOT NULL REFERENCES delivery_agreements (id) ON DELETE CASCADE,
  qr_token              VARCHAR(100) NOT NULL UNIQUE,
  status                qr_status   NOT NULL DEFAULT 'active',
  generated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at            TIMESTAMPTZ NOT NULL,
  scanned_at            TIMESTAMPTZ,
  scanned_by_user_id    UUID        REFERENCES users (id),
  scan_location         GEOMETRY(Point, 4326),
  verification_data     JSONB
);

-- ─── COURIER CHAT MESSAGES ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courier_chat_messages (
  id                      UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_agreement_id   UUID             NOT NULL REFERENCES delivery_agreements (id) ON DELETE CASCADE,
  sender_id               UUID             NOT NULL REFERENCES users (id),
  recipient_id            UUID             NOT NULL REFERENCES users (id),
  message_type            courier_msg_type NOT NULL DEFAULT 'text',
  content                 TEXT             NOT NULL,
  attachment_url          VARCHAR(500),
  is_read                 BOOLEAN          NOT NULL DEFAULT FALSE,
  read_at                 TIMESTAMPTZ,
  created_at              TIMESTAMPTZ      NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_courier_msgs_agreement_id ON courier_chat_messages (delivery_agreement_id);

-- ─── COURIER LOCATIONS ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS courier_locations (
  id                    UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  delivery_agreement_id UUID        NOT NULL REFERENCES delivery_agreements (id) ON DELETE CASCADE,
  courier_id            UUID        NOT NULL REFERENCES users (id),
  location              GEOMETRY(Point, 4326) NOT NULL,
  accuracy              DECIMAL(6,2),
  speed                 DECIMAL(6,2),
  heading               DECIMAL(5,2),
  timestamp             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_courier_locations_agreement_id ON courier_locations (delivery_agreement_id);
CREATE INDEX IF NOT EXISTS idx_courier_locations_geom         ON courier_locations USING GIST (location);

-- ─── CALLS ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS calls (
  id                  UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  caller_id           UUID         NOT NULL REFERENCES users (id),
  callee_id           UUID         NOT NULL REFERENCES users (id),
  call_type           call_type    NOT NULL DEFAULT 'voice',
  call_purpose        call_purpose NOT NULL DEFAULT 'ride_communication',
  status              call_status  NOT NULL DEFAULT 'initiated',
  ride_id             UUID         REFERENCES rides (id),
  delivery_id         UUID         REFERENCES delivery_agreements (id),
  is_emergency        BOOLEAN      NOT NULL DEFAULT FALSE,
  started_at          TIMESTAMPTZ,
  ended_at            TIMESTAMPTZ,
  duration            INTEGER,
  recording_url       TEXT,
  recording_enabled   BOOLEAN      NOT NULL DEFAULT FALSE,
  quality             INTEGER      NOT NULL DEFAULT 5,
  metadata            JSONB        NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_calls_caller_id ON calls (caller_id);
CREATE INDEX IF NOT EXISTS idx_calls_callee_id ON calls (callee_id);

-- ─── GROUP CHATS ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS group_chats (
  id               UUID         PRIMARY KEY DEFAULT uuid_generate_v4(),
  name             VARCHAR(100) NOT NULL,
  description      TEXT,
  type             chat_type    NOT NULL,
  status           chat_status  NOT NULL DEFAULT 'active',
  created_by       UUID         NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  avatar_url       VARCHAR(500),
  settings         JSONB        NOT NULL DEFAULT '{}',
  metadata         JSONB        NOT NULL DEFAULT '{}',
  ride_id          UUID         REFERENCES rides (id) ON DELETE CASCADE,
  delivery_id      UUID         REFERENCES delivery_agreements (id) ON DELETE CASCADE,
  max_participants INTEGER      NOT NULL DEFAULT 50,
  is_public        BOOLEAN      NOT NULL DEFAULT FALSE,
  join_code        VARCHAR(10)  UNIQUE,
  last_message_at  TIMESTAMPTZ,
  last_message_id  UUID,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_group_chats_created_by ON group_chats (created_by);

-- ─── GROUP CHAT PARTICIPANTS ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS group_chat_participants (
  id                    UUID             PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_chat_id         UUID             NOT NULL REFERENCES group_chats (id) ON DELETE CASCADE,
  user_id               UUID             NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  role                  participant_role NOT NULL DEFAULT 'member',
  status                participant_stat NOT NULL DEFAULT 'active',
  nickname              VARCHAR(50),
  joined_at             TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  left_at               TIMESTAMPTZ,
  last_seen_at          TIMESTAMPTZ,
  last_read_message_id  UUID,
  muted_until           TIMESTAMPTZ,
  permissions           JSONB            NOT NULL DEFAULT '{}',
  metadata              JSONB            NOT NULL DEFAULT '{}',
  invited_by            UUID             REFERENCES users (id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ      NOT NULL DEFAULT NOW(),
  UNIQUE (group_chat_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_group_chat_participants_user_id ON group_chat_participants (user_id);

-- ─── GROUP CHAT MESSAGES ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS group_chat_messages (
  id                       UUID            PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_chat_id            UUID            NOT NULL REFERENCES group_chats (id) ON DELETE CASCADE,
  sender_id                UUID            NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  reply_to_message_id      UUID            REFERENCES group_chat_messages (id) ON DELETE SET NULL,
  type                     chat_msg_type   NOT NULL DEFAULT 'text',
  status                   chat_msg_status NOT NULL DEFAULT 'sent',
  content                  TEXT            NOT NULL,
  metadata                 JSONB           NOT NULL DEFAULT '{}',
  attachments              JSONB           NOT NULL DEFAULT '[]',
  mentions                 JSONB           NOT NULL DEFAULT '[]',
  reactions                JSONB           NOT NULL DEFAULT '{}',
  is_edited                BOOLEAN         NOT NULL DEFAULT FALSE,
  edited_at                TIMESTAMPTZ,
  deleted_at               TIMESTAMPTZ,
  deleted_by               UUID            REFERENCES users (id) ON DELETE SET NULL,
  expires_at               TIMESTAMPTZ,
  is_pinned                BOOLEAN         NOT NULL DEFAULT FALSE,
  pinned_by                UUID            REFERENCES users (id) ON DELETE SET NULL,
  pinned_at                TIMESTAMPTZ,
  forwarded_from           UUID,
  forwarded_from_message_id UUID,
  read_by                  JSONB           NOT NULL DEFAULT '{}',
  delivered_to             JSONB           NOT NULL DEFAULT '{}',
  created_at               TIMESTAMPTZ     NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ     NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_group_chat_messages_group_id ON group_chat_messages (group_chat_id);
CREATE INDEX IF NOT EXISTS idx_group_chat_messages_sender   ON group_chat_messages (sender_id);

-- ─── NOTIFICATIONS ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id                   UUID          PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID          NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type                 notif_type    NOT NULL,
  priority             notif_priority NOT NULL DEFAULT 'normal',
  status               notif_status  NOT NULL DEFAULT 'pending',
  channel              JSONB         NOT NULL DEFAULT '["push","in_app"]',
  title                VARCHAR(255)  NOT NULL,
  body                 TEXT          NOT NULL,
  data                 JSONB         NOT NULL DEFAULT '{}',
  metadata             JSONB         NOT NULL DEFAULT '{}',
  actionable           BOOLEAN       NOT NULL DEFAULT FALSE,
  actions              JSONB         NOT NULL DEFAULT '[]',
  image_url            VARCHAR(500),
  deep_link            VARCHAR(500),
  expires_at           TIMESTAMPTZ,
  scheduled_at         TIMESTAMPTZ,
  sent_at              TIMESTAMPTZ,
  read_at              TIMESTAMPTZ,
  dismissed_at         TIMESTAMPTZ,
  delivery_attempts    INTEGER       NOT NULL DEFAULT 0,
  last_delivery_attempt TIMESTAMPTZ,
  related_entity_type  VARCHAR(50),
  related_entity_id    UUID,
  batch_id             UUID,
  campaign_id          UUID,
  ai_score             DECIMAL(5,2),
  user_engagement_score DECIMAL(5,2),
  created_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status  ON notifications (status);

-- ─── NOTIFICATION PREFERENCES ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_preferences (
  id                   UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id              UUID           NOT NULL REFERENCES users (id) ON DELETE CASCADE,
  type                 notif_type     NOT NULL,
  enabled              BOOLEAN        NOT NULL DEFAULT TRUE,
  channels             JSONB          NOT NULL DEFAULT '["push","in_app"]',
  quiet_hours_enabled  BOOLEAN        NOT NULL DEFAULT FALSE,
  quiet_hours_start    VARCHAR(5),
  quiet_hours_end      VARCHAR(5),
  timezone             VARCHAR(50)    NOT NULL DEFAULT 'UTC',
  min_priority         notif_priority NOT NULL DEFAULT 'normal',
  frequency            notif_freq     NOT NULL DEFAULT 'immediate',
  custom_settings      JSONB          NOT NULL DEFAULT '{}',
  created_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, type)
);

-- ─── PROMO CODES ─────────────────────────────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE promo_type AS ENUM ('percentage', 'fixed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS promo_codes (
  id               UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
  code             VARCHAR(20) NOT NULL UNIQUE,
  type             promo_type  NOT NULL,
  value            DECIMAL(10,2) NOT NULL,
  max_discount     DECIMAL(10,2),
  min_order_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  usage_limit      INTEGER,
  used_count       INTEGER     NOT NULL DEFAULT 0,
  expires_at       TIMESTAMPTZ,
  is_active        BOOLEAN     NOT NULL DEFAULT TRUE,
  description      TEXT,
  created_by       UUID        REFERENCES users (id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_promo_codes_code      ON promo_codes (code);
CREATE INDEX IF NOT EXISTS idx_promo_codes_is_active ON promo_codes (is_active);

-- ─── USERS — new columns (idempotent) ────────────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS passenger_rating       DECIMAL(3,2) DEFAULT 5.0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS total_passenger_ratings INTEGER      DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_code          VARCHAR(12)  UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by            UUID         REFERENCES users (id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS referral_credits       DECIMAL(10,2) DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_users_referral_code ON users (referral_code);

-- ─── BOOKINGS — new columns (idempotent) ─────────────────────────────────────
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS passenger_rating_given INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS passenger_review_text  TEXT;

-- ─── DELIVERY AGREEMENTS — new columns (idempotent) ──────────────────────────
ALTER TABLE delivery_agreements ADD COLUMN IF NOT EXISTS courier_rating DECIMAL(3,2);
ALTER TABLE delivery_agreements ADD COLUMN IF NOT EXISTS courier_review  TEXT;
ALTER TABLE delivery_agreements ADD COLUMN IF NOT EXISTS sender_rating   DECIMAL(3,2);
ALTER TABLE delivery_agreements ADD COLUMN IF NOT EXISTS sender_review   TEXT;

-- ─── NOTIFICATION TEMPLATES ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_templates (
  id                   UUID           PRIMARY KEY DEFAULT uuid_generate_v4(),
  name                 VARCHAR(100)   NOT NULL UNIQUE,
  type                 notif_type     NOT NULL,
  title                VARCHAR(255)   NOT NULL,
  body                 TEXT           NOT NULL,
  priority             notif_priority NOT NULL DEFAULT 'normal',
  channels             JSONB          NOT NULL DEFAULT '["push","in_app"]',
  actionable           BOOLEAN        NOT NULL DEFAULT FALSE,
  actions              JSONB          NOT NULL DEFAULT '[]',
  variables            JSONB          NOT NULL DEFAULT '[]',
  image_url            VARCHAR(500),
  deep_link_template   VARCHAR(500),
  metadata             JSONB          NOT NULL DEFAULT '{}',
  is_active            BOOLEAN        NOT NULL DEFAULT TRUE,
  version              INTEGER        NOT NULL DEFAULT 1,
  localization         JSONB          NOT NULL DEFAULT '{}',
  ai_optimized         BOOLEAN        NOT NULL DEFAULT FALSE,
  engagement_score     DECIMAL(5,2),
  created_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);
