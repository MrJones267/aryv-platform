-- Hitch Platform - Courier Service Schema Migration
-- Migration: 002_courier_service_schema
-- Author: Claude-Code
-- Created: 2025-01-24
-- Description: Add courier service tables and types for automated delivery agreements

BEGIN;

-- Create custom types for courier service
CREATE TYPE package_size AS ENUM ('small', 'medium', 'large', 'custom');
CREATE TYPE delivery_status AS ENUM ('pending_pickup', 'in_transit', 'completed', 'disputed', 'cancelled');
CREATE TYPE dispute_status AS ENUM ('open', 'under_review', 'resolved', 'closed');
CREATE TYPE qr_code_status AS ENUM ('active', 'used', 'expired');

-- Packages table
CREATE TABLE packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    description TEXT,
    dimensions_length DECIMAL(6,2), -- in cm
    dimensions_width DECIMAL(6,2), -- in cm  
    dimensions_height DECIMAL(6,2), -- in cm
    weight DECIMAL(8,3), -- in kg
    package_size package_size NOT NULL DEFAULT 'medium',
    fragile BOOLEAN DEFAULT FALSE,
    valuable BOOLEAN DEFAULT FALSE,
    special_instructions TEXT,
    pickup_address VARCHAR(500) NOT NULL,
    pickup_coordinates GEOMETRY(POINT, 4326) NOT NULL,
    pickup_contact_name VARCHAR(100),
    pickup_contact_phone VARCHAR(20),
    dropoff_address VARCHAR(500) NOT NULL,
    dropoff_coordinates GEOMETRY(POINT, 4326) NOT NULL,
    dropoff_contact_name VARCHAR(100),
    dropoff_contact_phone VARCHAR(20),
    package_images JSONB, -- Array of image URLs
    distance DECIMAL(8,2), -- in kilometers
    sender_price_offer DECIMAL(8,2) NOT NULL CHECK (sender_price_offer > 0),
    system_suggested_price DECIMAL(8,2), -- AI-calculated suggestion
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Delivery agreements table (the core state machine)
CREATE TABLE delivery_agreements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
    courier_id UUID NOT NULL REFERENCES users(id),
    agreed_price DECIMAL(8,2) NOT NULL CHECK (agreed_price > 0),
    platform_fee DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    status delivery_status NOT NULL DEFAULT 'pending_pickup',
    escrow_payment_id VARCHAR(100), -- Payment provider reference
    escrow_amount DECIMAL(8,2) NOT NULL,
    escrow_held_at TIMESTAMP WITH TIME ZONE,
    pickup_confirmed_at TIMESTAMP WITH TIME ZONE,
    pickup_location GEOMETRY(POINT, 4326),
    delivery_confirmed_at TIMESTAMP WITH TIME ZONE,
    delivery_location GEOMETRY(POINT, 4326),
    payment_released_at TIMESTAMP WITH TIME ZONE,
    qr_code_token VARCHAR(100) UNIQUE, -- For delivery verification
    qr_code_expires_at TIMESTAMP WITH TIME ZONE,
    event_log JSONB NOT NULL DEFAULT '[]', -- Immutable audit trail
    chat_channel_id UUID,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- QR codes table for delivery verification
CREATE TABLE delivery_qr_codes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_agreement_id UUID NOT NULL REFERENCES delivery_agreements(id) ON DELETE CASCADE,
    qr_token VARCHAR(100) UNIQUE NOT NULL,
    status qr_code_status NOT NULL DEFAULT 'active',
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    scanned_at TIMESTAMP WITH TIME ZONE,
    scanned_by_user_id UUID REFERENCES users(id),
    scan_location GEOMETRY(POINT, 4326),
    verification_data JSONB -- Additional verification metadata
);

-- Courier profiles (extends users for courier-specific data)
CREATE TABLE courier_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_courier_active BOOLEAN DEFAULT FALSE,
    courier_rating DECIMAL(3,2) DEFAULT 5.0 CHECK (courier_rating >= 0 AND courier_rating <= 5),
    total_deliveries INTEGER DEFAULT 0,
    successful_deliveries INTEGER DEFAULT 0,
    total_courier_earnings DECIMAL(10,2) DEFAULT 0.00,
    preferred_package_sizes package_size[],
    max_package_weight DECIMAL(8,3), -- in kg
    delivery_radius DECIMAL(8,2), -- in km from current location
    is_available_for_deliveries BOOLEAN DEFAULT FALSE,
    verification_documents JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Disputes table for handling delivery conflicts
CREATE TABLE delivery_disputes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_agreement_id UUID NOT NULL REFERENCES delivery_agreements(id) ON DELETE CASCADE,
    raised_by_user_id UUID NOT NULL REFERENCES users(id),
    dispute_type VARCHAR(50) NOT NULL, -- 'package_not_delivered', 'package_damaged', 'incorrect_location', etc.
    description TEXT NOT NULL,
    evidence_images JSONB, -- Array of image URLs
    status dispute_status NOT NULL DEFAULT 'open',
    admin_notes TEXT,
    resolution_amount DECIMAL(8,2), -- Amount to be paid out in resolution
    resolved_by_admin_id UUID REFERENCES users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Courier location tracking (for real-time tracking during delivery)
CREATE TABLE courier_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_agreement_id UUID NOT NULL REFERENCES delivery_agreements(id) ON DELETE CASCADE,
    courier_id UUID NOT NULL REFERENCES users(id),
    location GEOMETRY(POINT, 4326) NOT NULL,
    accuracy DECIMAL(6,2), -- GPS accuracy in meters
    speed DECIMAL(6,2), -- Speed in km/h
    heading DECIMAL(5,2), -- Direction in degrees
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Package images table (for detailed package documentation)
CREATE TABLE package_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
    image_url VARCHAR(500) NOT NULL,
    image_type VARCHAR(20) DEFAULT 'package' CHECK (image_type IN ('package', 'pickup_proof', 'delivery_proof', 'damage_evidence')),
    uploaded_by_user_id UUID NOT NULL REFERENCES users(id),
    uploaded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    metadata JSONB -- Image metadata like dimensions, file size, etc.
);

-- Chat messages for courier service (extends existing messages table concept)
CREATE TABLE courier_chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    delivery_agreement_id UUID NOT NULL REFERENCES delivery_agreements(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES users(id),
    recipient_id UUID NOT NULL REFERENCES users(id),
    message_type VARCHAR(20) DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'location', 'system')),
    content TEXT NOT NULL,
    attachment_url VARCHAR(500),
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Pricing configuration table (for dynamic pricing calculations)
CREATE TABLE courier_pricing_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    base_fare DECIMAL(6,2) NOT NULL DEFAULT 5.00,
    price_per_km DECIMAL(6,2) NOT NULL DEFAULT 1.50,
    small_package_multiplier DECIMAL(3,2) NOT NULL DEFAULT 1.0,
    medium_package_multiplier DECIMAL(3,2) NOT NULL DEFAULT 1.2,
    large_package_multiplier DECIMAL(3,2) NOT NULL DEFAULT 1.5,
    custom_package_multiplier DECIMAL(3,2) NOT NULL DEFAULT 2.0,
    fragile_surcharge DECIMAL(6,2) NOT NULL DEFAULT 2.00,
    valuable_surcharge DECIMAL(6,2) NOT NULL DEFAULT 5.00,
    platform_fee_percentage DECIMAL(4,2) NOT NULL DEFAULT 10.00,
    is_active BOOLEAN DEFAULT TRUE,
    effective_from TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    effective_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_packages_sender_id ON packages(sender_id);
CREATE INDEX idx_packages_active ON packages(is_active);
CREATE INDEX idx_packages_pickup_location ON packages USING GIST(pickup_coordinates);
CREATE INDEX idx_packages_dropoff_location ON packages USING GIST(dropoff_coordinates);
CREATE INDEX idx_packages_size ON packages(package_size);
CREATE INDEX idx_packages_created_at ON packages(created_at);

CREATE INDEX idx_delivery_agreements_package_id ON delivery_agreements(package_id);
CREATE INDEX idx_delivery_agreements_courier_id ON delivery_agreements(courier_id);
CREATE INDEX idx_delivery_agreements_status ON delivery_agreements(status);
CREATE INDEX idx_delivery_agreements_qr_token ON delivery_agreements(qr_code_token);
CREATE INDEX idx_delivery_agreements_created_at ON delivery_agreements(created_at);

CREATE INDEX idx_delivery_qr_codes_agreement_id ON delivery_qr_codes(delivery_agreement_id);
CREATE INDEX idx_delivery_qr_codes_token ON delivery_qr_codes(qr_token);
CREATE INDEX idx_delivery_qr_codes_status ON delivery_qr_codes(status);
CREATE INDEX idx_delivery_qr_codes_expires_at ON delivery_qr_codes(expires_at);

CREATE INDEX idx_courier_profiles_user_id ON courier_profiles(user_id);
CREATE INDEX idx_courier_profiles_active ON courier_profiles(is_courier_active);
CREATE INDEX idx_courier_profiles_available ON courier_profiles(is_available_for_deliveries);

CREATE INDEX idx_delivery_disputes_agreement_id ON delivery_disputes(delivery_agreement_id);
CREATE INDEX idx_delivery_disputes_raised_by ON delivery_disputes(raised_by_user_id);
CREATE INDEX idx_delivery_disputes_status ON delivery_disputes(status);

CREATE INDEX idx_courier_locations_agreement_id ON courier_locations(delivery_agreement_id);
CREATE INDEX idx_courier_locations_courier_id ON courier_locations(courier_id);
CREATE INDEX idx_courier_locations_location ON courier_locations USING GIST(location);
CREATE INDEX idx_courier_locations_timestamp ON courier_locations(timestamp);

CREATE INDEX idx_package_images_package_id ON package_images(package_id);
CREATE INDEX idx_package_images_type ON package_images(image_type);

CREATE INDEX idx_courier_chat_agreement_id ON courier_chat_messages(delivery_agreement_id);
CREATE INDEX idx_courier_chat_sender_id ON courier_chat_messages(sender_id);
CREATE INDEX idx_courier_chat_unread ON courier_chat_messages(recipient_id, is_read) WHERE is_read = FALSE;

CREATE INDEX idx_courier_pricing_active ON courier_pricing_config(is_active);
CREATE INDEX idx_courier_pricing_effective ON courier_pricing_config(effective_from, effective_until);

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_packages_updated_at BEFORE UPDATE ON packages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_delivery_agreements_updated_at BEFORE UPDATE ON delivery_agreements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_courier_profiles_updated_at BEFORE UPDATE ON courier_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_delivery_disputes_updated_at BEFORE UPDATE ON delivery_disputes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create functions for courier service logic

-- Function to calculate suggested price
CREATE OR REPLACE FUNCTION calculate_suggested_delivery_price(
    p_distance DECIMAL,
    p_package_size package_size,
    p_is_fragile BOOLEAN DEFAULT FALSE,
    p_is_valuable BOOLEAN DEFAULT FALSE
) RETURNS DECIMAL AS $$
DECLARE
    config RECORD;
    base_price DECIMAL;
    size_multiplier DECIMAL;
    final_price DECIMAL;
BEGIN
    -- Get current pricing config
    SELECT * INTO config FROM courier_pricing_config WHERE is_active = TRUE ORDER BY effective_from DESC LIMIT 1;
    
    IF config IS NULL THEN
        RAISE EXCEPTION 'No active pricing configuration found';
    END IF;
    
    -- Calculate base price
    base_price := config.base_fare + (p_distance * config.price_per_km);
    
    -- Apply size multiplier
    size_multiplier := CASE p_package_size
        WHEN 'small' THEN config.small_package_multiplier
        WHEN 'medium' THEN config.medium_package_multiplier
        WHEN 'large' THEN config.large_package_multiplier
        WHEN 'custom' THEN config.custom_package_multiplier
        ELSE 1.0
    END;
    
    final_price := base_price * size_multiplier;
    
    -- Add surcharges
    IF p_is_fragile THEN
        final_price := final_price + config.fragile_surcharge;
    END IF;
    
    IF p_is_valuable THEN
        final_price := final_price + config.valuable_surcharge;
    END IF;
    
    -- Round to 2 decimal places
    RETURN ROUND(final_price, 2);
END;
$$ LANGUAGE plpgsql;

-- Function to log delivery agreement events
CREATE OR REPLACE FUNCTION log_delivery_event(
    p_agreement_id UUID,
    p_event_type VARCHAR,
    p_event_data JSONB DEFAULT '{}'::JSONB,
    p_user_id UUID DEFAULT NULL
) RETURNS VOID AS $$
DECLARE
    event_entry JSONB;
BEGIN
    event_entry := jsonb_build_object(
        'timestamp', CURRENT_TIMESTAMP,
        'event_type', p_event_type,
        'user_id', p_user_id,
        'data', p_event_data
    );
    
    UPDATE delivery_agreements 
    SET event_log = event_log || event_entry
    WHERE id = p_agreement_id;
END;
$$ LANGUAGE plpgsql;

-- Function to generate unique QR token
CREATE OR REPLACE FUNCTION generate_qr_token() RETURNS VARCHAR AS $$
BEGIN
    RETURN upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 12));
END;
$$ LANGUAGE plpgsql;

-- Create views for common courier service queries

-- Active packages view
CREATE VIEW active_packages AS
SELECT 
    p.*,
    u.first_name as sender_first_name,
    u.last_name as sender_last_name,
    u.phone_number as sender_phone,
    ST_Distance(p.pickup_coordinates::geography, p.dropoff_coordinates::geography) / 1000 as calculated_distance_km
FROM packages p
JOIN users u ON p.sender_id = u.id
WHERE p.is_active = TRUE 
AND (p.expires_at IS NULL OR p.expires_at > CURRENT_TIMESTAMP)
AND NOT EXISTS (
    SELECT 1 FROM delivery_agreements da 
    WHERE da.package_id = p.id 
    AND da.status NOT IN ('cancelled', 'disputed')
);

-- Available couriers view
CREATE VIEW available_couriers AS
SELECT 
    cp.*,
    u.first_name,
    u.last_name,
    u.phone_number,
    d.current_location,
    d.rating as driver_rating
FROM courier_profiles cp
JOIN users u ON cp.user_id = u.id
LEFT JOIN drivers d ON cp.user_id = d.user_id
WHERE cp.is_courier_active = TRUE 
AND cp.is_available_for_deliveries = TRUE
AND u.is_active = TRUE;

-- Delivery agreements with details view
CREATE VIEW delivery_agreements_detailed AS
SELECT 
    da.*,
    p.title as package_title,
    p.pickup_address,
    p.dropoff_address,
    p.special_instructions,
    sender.first_name as sender_first_name,
    sender.last_name as sender_last_name,
    sender.phone_number as sender_phone,
    courier.first_name as courier_first_name,
    courier.last_name as courier_last_name,
    courier.phone_number as courier_phone
FROM delivery_agreements da
JOIN packages p ON da.package_id = p.id
JOIN users sender ON p.sender_id = sender.id
JOIN users courier ON da.courier_id = courier.id;

-- Insert initial pricing configuration
INSERT INTO courier_pricing_config (
    base_fare,
    price_per_km,
    small_package_multiplier,
    medium_package_multiplier,
    large_package_multiplier,
    custom_package_multiplier,
    fragile_surcharge,
    valuable_surcharge,
    platform_fee_percentage
) VALUES (
    5.00,  -- base fare
    1.50,  -- price per km
    1.0,   -- small package multiplier
    1.2,   -- medium package multiplier
    1.5,   -- large package multiplier
    2.0,   -- custom package multiplier
    2.00,  -- fragile surcharge
    5.00,  -- valuable surcharge
    10.00  -- platform fee percentage
);

-- Insert migration record
INSERT INTO ai_predictions (service_name, prediction_data, created_at)
VALUES ('migration', '{"migration": "002_courier_service_schema", "version": "1.0.0"}', CURRENT_TIMESTAMP);

COMMIT;