-- Migration: Create delivery_tiers table
-- Author: Claude-Code
-- Created: 2025-01-25

CREATE TABLE IF NOT EXISTS delivery_tiers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tier_type VARCHAR(20) NOT NULL UNIQUE,
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

-- Create indexes
CREATE INDEX idx_delivery_tiers_tier_type ON delivery_tiers (tier_type);
CREATE INDEX idx_delivery_tiers_is_active ON delivery_tiers (is_active);
CREATE INDEX idx_delivery_tiers_base_price_multiplier ON delivery_tiers (base_price_multiplier);

-- Insert default delivery tiers
INSERT INTO delivery_tiers (
    tier_type, 
    tier_name, 
    description, 
    min_delivery_hours, 
    max_delivery_hours, 
    base_price_multiplier, 
    platform_fee_percentage, 
    sla_guarantee, 
    is_active
) VALUES 
    (
        'lightning', 
        'Lightning', 
        '1-2 hour guaranteed delivery for urgent packages', 
        1, 
        2, 
        3.0, 
        40.0, 
        95.0, 
        true
    ),
    (
        'express', 
        'Express', 
        '2-4 hour delivery for important packages', 
        2, 
        4, 
        2.0, 
        32.5, 
        95.0, 
        true
    ),
    (
        'standard', 
        'Standard', 
        '4-8 hour same-day delivery', 
        4, 
        8, 
        1.3, 
        27.5, 
        90.0, 
        true
    ),
    (
        'economy', 
        'Economy', 
        '8-12 hour budget-friendly delivery', 
        8, 
        12, 
        1.0, 
        22.5, 
        85.0, 
        true
    )
ON CONFLICT (tier_type) DO NOTHING;