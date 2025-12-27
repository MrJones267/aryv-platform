-- Migration: Add delivery tier fields to packages table
-- Author: Claude-Code
-- Created: 2025-01-25

-- Add new columns to packages table
ALTER TABLE packages 
ADD COLUMN IF NOT EXISTS delivery_tier_id UUID REFERENCES delivery_tiers(id),
ADD COLUMN IF NOT EXISTS requested_delivery_time TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS urgency_level VARCHAR(20) CHECK (urgency_level IN ('LOW', 'NORMAL', 'HIGH', 'URGENT')),
ADD COLUMN IF NOT EXISTS demand_multiplier_applied DECIMAL(4,2) CHECK (demand_multiplier_applied >= 0.5 AND demand_multiplier_applied <= 5.0);

-- Create indexes for new fields
CREATE INDEX IF NOT EXISTS idx_packages_delivery_tier_id ON packages (delivery_tier_id);
CREATE INDEX IF NOT EXISTS idx_packages_urgency_level ON packages (urgency_level);
CREATE INDEX IF NOT EXISTS idx_packages_requested_delivery_time ON packages (requested_delivery_time);

-- Add foreign key constraint comment
COMMENT ON COLUMN packages.delivery_tier_id IS 'References the selected delivery tier for demand-based pricing';
COMMENT ON COLUMN packages.requested_delivery_time IS 'When the sender wants the package delivered';
COMMENT ON COLUMN packages.urgency_level IS 'System-calculated urgency level based on delivery timing';
COMMENT ON COLUMN packages.demand_multiplier_applied IS 'The demand pricing multiplier applied at creation time';