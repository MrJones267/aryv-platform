-- Migration: Create demand_metrics table
-- Author: Claude-Code
-- Created: 2025-01-25

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

-- Create indexes
CREATE INDEX idx_demand_metrics_location_hash ON demand_metrics (location_hash);
CREATE INDEX idx_demand_metrics_time_slot ON demand_metrics (time_slot);
CREATE INDEX idx_demand_metrics_calculated_at ON demand_metrics (calculated_at);
CREATE INDEX idx_demand_metrics_demand_multiplier ON demand_metrics (demand_multiplier);
CREATE INDEX idx_demand_metrics_location_time ON demand_metrics (location_hash, time_slot);