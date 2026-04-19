-- Migration: create users table
-- Created: 2026-03-28

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('passenger', 'driver', 'both', 'admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended', 'pending_verification', 'deactivated');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS users (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email                   VARCHAR(255) NOT NULL UNIQUE,
  password_hash           VARCHAR(255) NOT NULL,
  phone_number            VARCHAR(20),
  first_name              VARCHAR(100) NOT NULL,
  last_name               VARCHAR(100) NOT NULL,
  role                    user_role NOT NULL DEFAULT 'passenger',
  status                  user_status NOT NULL DEFAULT 'active',
  profile_image           VARCHAR(500),
  date_of_birth           DATE,
  is_verified             BOOLEAN DEFAULT FALSE,
  is_active               BOOLEAN DEFAULT TRUE,
  last_login              TIMESTAMPTZ,
  refresh_token           TEXT,
  country_code            CHAR(2),
  country_name            VARCHAR(100),
  timezone                VARCHAR(60),
  deactivated_at          TIMESTAMPTZ,
  deactivation_reason     TEXT,
  rating                  DECIMAL(3, 2) DEFAULT 5.00,
  total_rides             INTEGER DEFAULT 0,
  preferences             JSONB DEFAULT '{}',
  emergency_contact_name  VARCHAR(200),
  emergency_contact_phone VARCHAR(20),
  address                 TEXT,
  driving_license         VARCHAR(500),
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email   ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_phone   ON users (phone_number);
CREATE INDEX IF NOT EXISTS idx_users_role    ON users (role);
CREATE INDEX IF NOT EXISTS idx_users_status  ON users (status);
CREATE INDEX IF NOT EXISTS idx_users_country ON users (country_code);
