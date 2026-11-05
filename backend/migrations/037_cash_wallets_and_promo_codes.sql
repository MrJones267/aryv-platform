-- =====================================================================
-- Migration 037: cash_wallets, cash_wallet_transactions, promo_codes
-- Author: Oabona-Majoko
-- Created: 2026-11-05
--
-- Purpose:
--   Three tables the code uses had no migration. CashWallet and PromoCode
--   are defined as models, and the only SQL for them was in
--   src/scripts/setup-production-db.sql, which the migration runner does not
--   apply. CashWallet is not registered in src/models/index.ts either, so
--   scripts/build-schema.ts never created the wallet tables. As a result, a
--   database built from migrations had none of the three, and migration 025
--   skipped its wallet idempotency index because the table was missing.
--
--   Column for column, this is what the models define. Sequelize's own
--   createTable/addIndex generated the DDL, so names and types match a
--   schema built from the models. Every statement is IF NOT EXISTS, so it
--   changes nothing where the tables already exist.
--
--   Foreign keys follow each model's `references` (ON DELETE RESTRICT). A
--   wallet holds money and must not vanish with its owner or lose its
--   history.
-- =====================================================================

-- Enum types, named as Sequelize names them (enum_<table>_<column>).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_cash_wallets_status') THEN
    CREATE TYPE "public"."enum_cash_wallets_status" AS ENUM ('active', 'suspended', 'closed');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_cash_wallets_kyc_level') THEN
    CREATE TYPE "public"."enum_cash_wallets_kyc_level" AS ENUM ('basic', 'enhanced', 'full');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_cash_wallet_transactions_type') THEN
    CREATE TYPE "public"."enum_cash_wallet_transactions_type" AS ENUM
      ('load', 'payment', 'refund', 'transfer', 'escrow_hold', 'escrow_release', 'fee', 'bonus');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_cash_wallet_transactions_status') THEN
    CREATE TYPE "public"."enum_cash_wallet_transactions_status" AS ENUM
      ('pending', 'completed', 'failed', 'cancelled');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_cash_wallet_transactions_source') THEN
    CREATE TYPE "public"."enum_cash_wallet_transactions_source" AS ENUM
      ('agent', 'kiosk', 'partner_store', 'mobile_money', 'voucher', 'bank_transfer', 'ride_payment', 'refund');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_promo_codes_type') THEN
    CREATE TYPE "public"."enum_promo_codes_type" AS ENUM ('percentage', 'fixed');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "cash_wallets" (
  "id" UUID,
  "user_id" UUID NOT NULL UNIQUE,
  "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
  "status" "public"."enum_cash_wallets_status" NOT NULL DEFAULT 'active',
  "daily_load_limit" DECIMAL(10,2) NOT NULL DEFAULT 500,
  "monthly_load_limit" DECIMAL(12,2) NOT NULL DEFAULT 10000,
  "daily_spend_limit" DECIMAL(10,2) NOT NULL DEFAULT 1000,
  "monthly_spend_limit" DECIMAL(12,2) NOT NULL DEFAULT 15000,
  "kyc_level" "public"."enum_cash_wallets_kyc_level" NOT NULL DEFAULT 'basic',
  "is_verified" BOOLEAN NOT NULL DEFAULT false,
  "last_transaction_at" TIMESTAMP WITH TIME ZONE,
  "frozen_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "escrow_balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "cash_wallet_transactions" (
  "id" UUID,
  "wallet_id" UUID NOT NULL,
  "type" "public"."enum_cash_wallet_transactions_type" NOT NULL,
  "amount" DECIMAL(10,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
  "balance_before" DECIMAL(12,2) NOT NULL,
  "balance_after" DECIMAL(12,2) NOT NULL,
  "status" "public"."enum_cash_wallet_transactions_status" NOT NULL DEFAULT 'pending',
  "source" "public"."enum_cash_wallet_transactions_source" NOT NULL,
  "source_reference" VARCHAR(255),
  "description" TEXT NOT NULL,
  "metadata" JSONB DEFAULT '{}',
  "processed_at" TIMESTAMP WITH TIME ZONE,
  "expires_at" TIMESTAMP WITH TIME ZONE,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "promo_codes" (
  "id" UUID,
  "code" VARCHAR(20) NOT NULL UNIQUE,
  "type" "public"."enum_promo_codes_type" NOT NULL,
  "value" DECIMAL(10,2) NOT NULL,
  "max_discount" DECIMAL(10,2),
  "min_order_amount" DECIMAL(10,2) NOT NULL DEFAULT 0,
  "usage_limit" INTEGER,
  "used_count" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMP WITH TIME ZONE,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "description" TEXT,
  "created_by" UUID,
  "created_at" TIMESTAMP WITH TIME ZONE NOT NULL,
  "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "cash_wallets_user_id" ON "cash_wallets" ("user_id");
CREATE INDEX IF NOT EXISTS "cash_wallets_status" ON "cash_wallets" ("status");
CREATE INDEX IF NOT EXISTS "cash_wallets_kyc_level" ON "cash_wallets" ("kyc_level");

CREATE INDEX IF NOT EXISTS "cash_wallet_transactions_wallet_id" ON "cash_wallet_transactions" ("wallet_id");
CREATE INDEX IF NOT EXISTS "cash_wallet_transactions_type" ON "cash_wallet_transactions" ("type");
CREATE INDEX IF NOT EXISTS "cash_wallet_transactions_status" ON "cash_wallet_transactions" ("status");
CREATE INDEX IF NOT EXISTS "cash_wallet_transactions_source" ON "cash_wallet_transactions" ("source");
CREATE INDEX IF NOT EXISTS "cash_wallet_transactions_source_reference" ON "cash_wallet_transactions" ("source_reference");
CREATE INDEX IF NOT EXISTS "cash_wallet_transactions_created_at" ON "cash_wallet_transactions" ("created_at");
CREATE INDEX IF NOT EXISTS "cash_wallet_transactions_processed_at" ON "cash_wallet_transactions" ("processed_at");
CREATE INDEX IF NOT EXISTS "cash_wallet_transactions_expires_at" ON "cash_wallet_transactions" ("expires_at");

-- The guarantee migration 025 adds, which it skips when the table is missing:
-- one credit per external load reference, so a replayed webhook cannot pay
-- twice. The table was just created empty, so there are no duplicates to stop it.
CREATE UNIQUE INDEX IF NOT EXISTS "cash_wallet_transactions_load_reference_unique"
  ON "cash_wallet_transactions" ("source", "source_reference")
  WHERE "type" = 'load';

CREATE UNIQUE INDEX IF NOT EXISTS "promo_codes_code" ON "promo_codes" ("code");
CREATE INDEX IF NOT EXISTS "promo_codes_is_active" ON "promo_codes" ("is_active");
CREATE INDEX IF NOT EXISTS "promo_codes_expires_at" ON "promo_codes" ("expires_at");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cash_wallets_user_id') THEN
    ALTER TABLE "cash_wallets"
      ADD CONSTRAINT "fk_cash_wallets_user_id"
      FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_cash_wallet_transactions_wallet_id') THEN
    ALTER TABLE "cash_wallet_transactions"
      ADD CONSTRAINT "fk_cash_wallet_transactions_wallet_id"
      FOREIGN KEY ("wallet_id") REFERENCES "cash_wallets" ("id") ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;
END
$$;
