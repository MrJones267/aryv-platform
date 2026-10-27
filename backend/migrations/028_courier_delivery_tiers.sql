-- =====================================================================
-- Migration 028: Delivery tiers and demand metrics for courier pricing
-- Author: Oabona-Majoko
-- Created: 2026-10-27
--
-- Purpose:
--   Creating a courier package goes through DemandPricingEngine, which reads
--   `delivery_tiers` and writes `demand_metrics`. Neither table exists in
--   production. Their migrations were written in src/migrations/ (the
--   20250125120000-2 files), a directory the migration runner does not read,
--   so they never ran. Production's tables were built from the models loaded
--   by src/models during the cutover, and DeliveryTier and DemandMetrics are
--   not among them.
--
--   This creates both tables as those files described them, seeds the four
--   tiers DemandPricingEngine.initializeDefaultTiers() defines, and adds the
--   package columns the Package model already writes, in case an environment
--   lacks them. Every statement is guarded, so it is a no-op wherever any of
--   it already exists, and it does not overwrite tiers someone has edited.
--
--   tier_type stays VARCHAR with a CHECK rather than a Postgres ENUM, as the
--   original migration had it: Sequelize reads and writes it as a string
--   either way, and a CHECK is far easier to extend than an ENUM.
-- =====================================================================

CREATE TABLE IF NOT EXISTS delivery_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier_type VARCHAR(20) NOT NULL UNIQUE
        CHECK (tier_type IN ('lightning', 'express', 'standard', 'economy')),
    tier_name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    min_delivery_hours INTEGER NOT NULL CHECK (min_delivery_hours >= 1 AND min_delivery_hours <= 48),
    max_delivery_hours INTEGER NOT NULL CHECK (max_delivery_hours >= 1 AND max_delivery_hours <= 48),
    base_price_multiplier DECIMAL(4,2) NOT NULL CHECK (base_price_multiplier >= 0.1 AND base_price_multiplier <= 10.0),
    platform_fee_percentage DECIMAL(5,2) NOT NULL CHECK (platform_fee_percentage >= 5.0 AND platform_fee_percentage <= 50.0),
    sla_guarantee DECIMAL(5,2) NOT NULL CHECK (sla_guarantee >= 50.0 AND sla_guarantee <= 100.0),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT check_delivery_hours CHECK (max_delivery_hours >= min_delivery_hours)
);

CREATE INDEX IF NOT EXISTS idx_delivery_tiers_is_active ON delivery_tiers (is_active);
CREATE INDEX IF NOT EXISTS idx_delivery_tiers_base_price_multiplier ON delivery_tiers (base_price_multiplier);

-- The same four tiers DemandPricingEngine.initializeDefaultTiers() creates.
INSERT INTO delivery_tiers (
    tier_type, tier_name, description,
    min_delivery_hours, max_delivery_hours,
    base_price_multiplier, platform_fee_percentage, sla_guarantee, is_active
) VALUES
    ('lightning', 'Lightning', '1-2 hour guaranteed delivery for urgent packages', 1, 2, 3.0, 40.0, 95.0, true),
    ('express', 'Express', '2-4 hour delivery for important packages', 2, 4, 2.0, 32.5, 95.0, true),
    ('standard', 'Standard', '4-8 hour same-day delivery', 4, 8, 1.3, 27.5, 90.0, true),
    ('economy', 'Economy', '8-12 hour budget-friendly delivery', 8, 12, 1.0, 22.5, 85.0, true)
ON CONFLICT (tier_type) DO NOTHING;

CREATE TABLE IF NOT EXISTS demand_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_hash VARCHAR(50) NOT NULL,
    time_slot TIMESTAMP WITH TIME ZONE NOT NULL,
    available_couriers INTEGER NOT NULL DEFAULT 0 CHECK (available_couriers >= 0),
    active_demand INTEGER NOT NULL DEFAULT 0 CHECK (active_demand >= 0),
    completed_deliveries INTEGER NOT NULL DEFAULT 0 CHECK (completed_deliveries >= 0),
    average_delivery_time DECIMAL(8,2) NOT NULL DEFAULT 0.00 CHECK (average_delivery_time >= 0),
    demand_multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.00 CHECK (demand_multiplier >= 0.5 AND demand_multiplier <= 5.0),
    weather_conditions VARCHAR(100),
    event_modifier DECIMAL(4,2) NOT NULL DEFAULT 1.00 CHECK (event_modifier >= 0.5 AND event_modifier <= 3.0),
    calculated_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT unique_location_time_slot UNIQUE (location_hash, time_slot)
);

CREATE INDEX IF NOT EXISTS idx_demand_metrics_time_slot ON demand_metrics (time_slot);
CREATE INDEX IF NOT EXISTS idx_demand_metrics_calculated_at ON demand_metrics (calculated_at);
CREATE INDEX IF NOT EXISTS idx_demand_metrics_demand_multiplier ON demand_metrics (demand_multiplier);

-- Columns the Package model writes on every create. Present wherever packages
-- was built from the model; added here for any environment where it was not.
ALTER TABLE packages
    ADD COLUMN IF NOT EXISTS delivery_tier_id UUID REFERENCES delivery_tiers(id),
    ADD COLUMN IF NOT EXISTS requested_delivery_time TIMESTAMP WITH TIME ZONE,
    ADD COLUMN IF NOT EXISTS urgency_level VARCHAR(20),
    ADD COLUMN IF NOT EXISTS demand_multiplier_applied DECIMAL(4,2);

CREATE INDEX IF NOT EXISTS idx_packages_delivery_tier_id ON packages (delivery_tier_id);
