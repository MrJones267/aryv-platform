-- ARYV Platform - Database Initialization Script
-- Author: Claude-Code
-- Created: 2025-01-27
-- Description: Creates database schema with PostGIS extension for geospatial data

-- Enable PostGIS extension for geospatial data
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create enum types
CREATE TYPE user_status AS ENUM ('pending', 'active', 'suspended', 'banned');
CREATE TYPE user_role AS ENUM ('user', 'driver', 'admin', 'courier');
CREATE TYPE ride_status AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled');
CREATE TYPE vehicle_type AS ENUM ('car', 'motorcycle', 'bicycle', 'van', 'truck');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE package_status AS ENUM ('created', 'picked_up', 'in_transit', 'delivered', 'failed');

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    status user_status DEFAULT 'pending',
    role user_role DEFAULT 'user',
    profile_picture_url TEXT,
    date_of_birth DATE,
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    rating DECIMAL(3,2) DEFAULT 5.00,
    total_rides INTEGER DEFAULT 0,
    total_drives INTEGER DEFAULT 0,
    emergency_contact_name VARCHAR(200),
    emergency_contact_phone VARCHAR(20),
    preferences JSONB DEFAULT '{}',
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- User addresses
CREATE TABLE user_addresses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    label VARCHAR(50) NOT NULL, -- 'home', 'work', 'other'
    address_line_1 VARCHAR(255) NOT NULL,
    address_line_2 VARCHAR(255),
    city VARCHAR(100) NOT NULL,
    state VARCHAR(100) NOT NULL,
    postal_code VARCHAR(20) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'United States',
    location GEOGRAPHY(POINT, 4326),
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Vehicles table
CREATE TABLE vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    make VARCHAR(50) NOT NULL,
    model VARCHAR(50) NOT NULL,
    year INTEGER NOT NULL,
    color VARCHAR(30) NOT NULL,
    license_plate VARCHAR(20) UNIQUE NOT NULL,
    vehicle_type vehicle_type NOT NULL,
    capacity INTEGER NOT NULL DEFAULT 4,
    is_verified BOOLEAN DEFAULT FALSE,
    insurance_expiry DATE,
    registration_expiry DATE,
    inspection_expiry DATE,
    photos JSONB DEFAULT '[]',
    features JSONB DEFAULT '[]', -- ['air_conditioning', 'wifi', 'bluetooth', etc.]
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rides table
CREATE TABLE rides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rider_id UUID NOT NULL REFERENCES users(id),
    driver_id UUID REFERENCES users(id),
    vehicle_id UUID REFERENCES vehicles(id),
    status ride_status DEFAULT 'pending',
    
    -- Location data
    pickup_location GEOGRAPHY(POINT, 4326) NOT NULL,
    pickup_address TEXT NOT NULL,
    destination_location GEOGRAPHY(POINT, 4326) NOT NULL,
    destination_address TEXT NOT NULL,
    
    -- Timing
    requested_pickup_time TIMESTAMP WITH TIME ZONE NOT NULL,
    actual_pickup_time TIMESTAMP WITH TIME ZONE,
    estimated_arrival_time TIMESTAMP WITH TIME ZONE,
    actual_arrival_time TIMESTAMP WITH TIME ZONE,
    
    -- Pricing
    estimated_fare DECIMAL(10,2),
    final_fare DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',
    surge_multiplier DECIMAL(3,2) DEFAULT 1.00,
    
    -- Trip details
    estimated_distance_km DECIMAL(8,3),
    actual_distance_km DECIMAL(8,3),
    estimated_duration_minutes INTEGER,
    actual_duration_minutes INTEGER,
    passenger_count INTEGER DEFAULT 1,
    
    -- Preferences and requirements
    preferences JSONB DEFAULT '{}', -- smoking, temperature, music, etc.
    special_requirements TEXT,
    
    -- Ratings and feedback
    rider_rating INTEGER CHECK (rider_rating BETWEEN 1 AND 5),
    driver_rating INTEGER CHECK (driver_rating BETWEEN 1 AND 5),
    rider_feedback TEXT,
    driver_feedback TEXT,
    
    -- Metadata
    cancellation_reason TEXT,
    cancelled_by UUID REFERENCES users(id),
    cancelled_at TIMESTAMP WITH TIME ZONE,
    route_data JSONB, -- Store route information
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Real-time location tracking
CREATE TABLE ride_locations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ride_id UUID NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
    location GEOGRAPHY(POINT, 4326) NOT NULL,
    heading DECIMAL(5,2), -- Compass heading in degrees
    speed_kmh DECIMAL(5,2), -- Speed in km/h
    accuracy_meters DECIMAL(6,2), -- GPS accuracy
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Index for efficient queries
    CONSTRAINT unique_ride_timestamp UNIQUE (ride_id, timestamp)
);

-- Payments table
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ride_id UUID NOT NULL REFERENCES rides(id),
    user_id UUID NOT NULL REFERENCES users(id),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status payment_status DEFAULT 'pending',
    payment_method VARCHAR(50) NOT NULL, -- 'card', 'wallet', 'cash'
    transaction_id VARCHAR(255) UNIQUE,
    stripe_payment_intent_id VARCHAR(255),
    stripe_charge_id VARCHAR(255),
    failure_reason TEXT,
    refund_amount DECIMAL(10,2) DEFAULT 0.00,
    platform_fee DECIMAL(10,2) DEFAULT 0.00,
    driver_earnings DECIMAL(10,2) DEFAULT 0.00,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Courier service tables
CREATE TABLE packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID NOT NULL REFERENCES users(id),
    courier_id UUID REFERENCES users(id),
    receiver_id UUID REFERENCES users(id),
    
    -- Package details
    title VARCHAR(200) NOT NULL,
    description TEXT,
    weight_kg DECIMAL(5,2),
    dimensions JSONB, -- {length, width, height}
    package_value DECIMAL(10,2),
    is_fragile BOOLEAN DEFAULT FALSE,
    
    -- Locations
    pickup_location GEOGRAPHY(POINT, 4326) NOT NULL,
    pickup_address TEXT NOT NULL,
    delivery_location GEOGRAPHY(POINT, 4326) NOT NULL,
    delivery_address TEXT NOT NULL,
    
    -- Status and timing
    status package_status DEFAULT 'created',
    pickup_window_start TIMESTAMP WITH TIME ZONE,
    pickup_window_end TIMESTAMP WITH TIME ZONE,
    delivery_window_start TIMESTAMP WITH TIME ZONE,
    delivery_window_end TIMESTAMP WITH TIME ZONE,
    picked_up_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    
    -- Blockchain and security
    smart_contract_address VARCHAR(42), -- Ethereum address
    qr_code_data TEXT, -- Encrypted QR code for pickup/delivery
    verification_photos JSONB DEFAULT '[]',
    
    -- Pricing
    delivery_fee DECIMAL(10,2) NOT NULL,
    insurance_fee DECIMAL(10,2) DEFAULT 0.00,
    total_fee DECIMAL(10,2) NOT NULL,
    courier_earnings DECIMAL(10,2),
    platform_fee DECIMAL(10,2),
    
    -- Instructions and notes
    pickup_instructions TEXT,
    delivery_instructions TEXT,
    special_handling TEXT,
    courier_notes TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Package tracking events
CREATE TABLE package_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    package_id UUID NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL, -- 'created', 'picked_up', 'in_transit', 'delivered', 'exception'
    event_description TEXT,
    location GEOGRAPHY(POINT, 4326),
    address TEXT,
    user_id UUID REFERENCES users(id), -- Who triggered the event
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL, -- 'ride_update', 'payment', 'system', 'package_update'
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}', -- Additional structured data
    is_read BOOLEAN DEFAULT FALSE,
    is_pushed BOOLEAN DEFAULT FALSE, -- Whether push notification was sent
    push_response JSONB, -- Response from push notification service
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    read_at TIMESTAMP WITH TIME ZONE
);

-- Driver documents for verification
CREATE TABLE driver_documents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL, -- 'license', 'insurance', 'registration', 'background_check'
    document_url TEXT NOT NULL,
    document_number VARCHAR(100),
    issue_date DATE,
    expiry_date DATE,
    verification_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected'
    verified_by UUID REFERENCES users(id),
    verified_at TIMESTAMP WITH TIME ZONE,
    rejection_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System settings and configuration
CREATE TABLE system_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key VARCHAR(100) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT FALSE, -- Whether setting can be accessed by frontend
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Audit trail for important actions
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL, -- 'user', 'ride', 'payment', 'package'
    resource_id UUID,
    old_values JSONB,
    new_values JSONB,
    ip_address INET,
    user_agent TEXT,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Performance tracking
CREATE TABLE performance_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,6) NOT NULL,
    dimensions JSONB DEFAULT '{}', -- Additional dimensions like region, service, etc.
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================
-- INDEXES FOR PERFORMANCE
-- ============================

-- Users indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_created_at ON users(created_at);

-- User addresses indexes
CREATE INDEX idx_user_addresses_user_id ON user_addresses(user_id);
CREATE INDEX idx_user_addresses_location ON user_addresses USING GIST(location);
CREATE INDEX idx_user_addresses_default ON user_addresses(user_id, is_default);

-- Vehicles indexes
CREATE INDEX idx_vehicles_user_id ON vehicles(user_id);
CREATE INDEX idx_vehicles_license_plate ON vehicles(license_plate);
CREATE INDEX idx_vehicles_type ON vehicles(vehicle_type);
CREATE INDEX idx_vehicles_active ON vehicles(is_active);

-- Rides indexes
CREATE INDEX idx_rides_rider_id ON rides(rider_id);
CREATE INDEX idx_rides_driver_id ON rides(driver_id);
CREATE INDEX idx_rides_status ON rides(status);
CREATE INDEX idx_rides_pickup_location ON rides USING GIST(pickup_location);
CREATE INDEX idx_rides_destination_location ON rides USING GIST(destination_location);
CREATE INDEX idx_rides_pickup_time ON rides(requested_pickup_time);
CREATE INDEX idx_rides_created_at ON rides(created_at);

-- Ride locations indexes
CREATE INDEX idx_ride_locations_ride_id ON ride_locations(ride_id);
CREATE INDEX idx_ride_locations_timestamp ON ride_locations(timestamp);
CREATE INDEX idx_ride_locations_location ON ride_locations USING GIST(location);

-- Payments indexes
CREATE INDEX idx_payments_ride_id ON payments(ride_id);
CREATE INDEX idx_payments_user_id ON payments(user_id);
CREATE INDEX idx_payments_status ON payments(status);
CREATE INDEX idx_payments_transaction_id ON payments(transaction_id);
CREATE INDEX idx_payments_created_at ON payments(created_at);

-- Packages indexes
CREATE INDEX idx_packages_sender_id ON packages(sender_id);
CREATE INDEX idx_packages_courier_id ON packages(courier_id);
CREATE INDEX idx_packages_receiver_id ON packages(receiver_id);
CREATE INDEX idx_packages_status ON packages(status);
CREATE INDEX idx_packages_pickup_location ON packages USING GIST(pickup_location);
CREATE INDEX idx_packages_delivery_location ON packages USING GIST(delivery_location);
CREATE INDEX idx_packages_created_at ON packages(created_at);

-- Package events indexes
CREATE INDEX idx_package_events_package_id ON package_events(package_id);
CREATE INDEX idx_package_events_timestamp ON package_events(timestamp);
CREATE INDEX idx_package_events_type ON package_events(event_type);

-- Notifications indexes
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);

-- Audit logs indexes
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_resource ON audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp);

-- Performance metrics indexes
CREATE INDEX idx_performance_metrics_name ON performance_metrics(metric_name);
CREATE INDEX idx_performance_metrics_timestamp ON performance_metrics(timestamp);

-- ============================
-- FUNCTIONS AND TRIGGERS
-- ============================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_addresses_updated_at BEFORE UPDATE ON user_addresses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rides_updated_at BEFORE UPDATE ON rides
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_packages_updated_at BEFORE UPDATE ON packages
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_driver_documents_updated_at BEFORE UPDATE ON driver_documents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_settings_updated_at BEFORE UPDATE ON system_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate distance between two points
CREATE OR REPLACE FUNCTION calculate_distance_km(
    lat1 DOUBLE PRECISION,
    lon1 DOUBLE PRECISION,
    lat2 DOUBLE PRECISION,
    lon2 DOUBLE PRECISION
) RETURNS DOUBLE PRECISION AS $$
BEGIN
    RETURN ST_Distance(
        ST_GeogFromText('POINT(' || lon1 || ' ' || lat1 || ')'),
        ST_GeogFromText('POINT(' || lon2 || ' ' || lat2 || ')')
    ) / 1000.0; -- Convert meters to kilometers
END;
$$ LANGUAGE plpgsql;

-- Function to find nearby drivers
CREATE OR REPLACE FUNCTION find_nearby_drivers(
    pickup_lat DOUBLE PRECISION,
    pickup_lon DOUBLE PRECISION,
    radius_km DOUBLE PRECISION DEFAULT 10
) RETURNS TABLE (
    user_id UUID,
    distance_km DOUBLE PRECISION
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id,
        ST_Distance(
            ST_GeogFromText('POINT(' || pickup_lon || ' ' || pickup_lat || ')'),
            rl.location
        ) / 1000.0 AS distance_km
    FROM users u
    JOIN vehicles v ON u.id = v.user_id
    JOIN LATERAL (
        SELECT location
        FROM ride_locations rl2
        WHERE rl2.ride_id IN (
            SELECT id FROM rides r WHERE r.driver_id = u.id AND r.status = 'in_progress'
        )
        ORDER BY timestamp DESC
        LIMIT 1
    ) rl ON TRUE
    WHERE u.role = 'driver'
        AND u.status = 'active'
        AND v.is_active = TRUE
        AND v.is_verified = TRUE
        AND ST_DWithin(
            ST_GeogFromText('POINT(' || pickup_lon || ' ' || pickup_lat || ')'),
            rl.location,
            radius_km * 1000
        )
    ORDER BY distance_km;
END;
$$ LANGUAGE plpgsql;

-- ============================
-- INITIAL SYSTEM SETTINGS
-- ============================

INSERT INTO system_settings (key, value, description, is_public) VALUES
('surge_pricing_enabled', 'true', 'Enable dynamic surge pricing', true),
('base_fare_usd', '2.50', 'Base fare in USD', true),
('per_km_rate_usd', '1.20', 'Rate per kilometer in USD', true),
('per_minute_rate_usd', '0.25', 'Rate per minute in USD', true),
('max_surge_multiplier', '3.0', 'Maximum surge pricing multiplier', true),
('courier_platform_fee_percent', '10', 'Platform fee percentage for courier services', false),
('max_delivery_radius_km', '50', 'Maximum delivery radius in kilometers', true),
('driver_background_check_required', 'true', 'Whether background checks are required for drivers', false),
('notification_push_enabled', 'true', 'Enable push notifications', false);

-- ============================
-- SAMPLE DATA (for development)
-- ============================

-- Create admin user
INSERT INTO users (id, email, password_hash, first_name, last_name, role, status, email_verified) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'admin@aryv-app.com', '$2b$10$rQ1K8/NQ9X.x/xXa/xXa/OQrQqQqQqQqQqQqQqQqQqQqQqQqQqQqQ', 'Admin', 'User', 'admin', 'active', true);

-- Create sample system performance metrics
INSERT INTO performance_metrics (metric_name, metric_value, dimensions) VALUES
('api_response_time_ms', 150.5, '{"endpoint": "/api/rides", "method": "GET"}'),
('active_rides_count', 25, '{"region": "downtown"}'),
('driver_utilization_percent', 75.2, '{"region": "downtown"}'),
('database_connection_count', 15, '{"database": "primary"}');

COMMIT;