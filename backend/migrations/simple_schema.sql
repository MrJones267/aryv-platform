-- Simplified Database Schema without PostGIS
-- For development with standard PostgreSQL

-- Create custom types
CREATE TYPE user_role AS ENUM ('passenger', 'driver', 'admin');
CREATE TYPE ride_status AS ENUM ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled');
CREATE TYPE booking_status AS ENUM ('pending', 'confirmed', 'cancelled', 'completed');
CREATE TYPE payment_status AS ENUM ('pending', 'completed', 'failed', 'refunded');
CREATE TYPE vehicle_type AS ENUM ('sedan', 'suv', 'hatchback', 'minivan', 'luxury', 'electric');

-- Users table
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone_number VARCHAR(20),
    date_of_birth DATE,
    role user_role NOT NULL DEFAULT 'passenger',
    profile_image VARCHAR(500),
    profile_picture VARCHAR(500), -- Alias for profile_image used by some endpoints
    rating DECIMAL(3,2) DEFAULT 5.0 CHECK (rating >= 0 AND rating <= 5),
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Vehicles table
CREATE TABLE vehicles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    make VARCHAR(50) NOT NULL,
    model VARCHAR(50) NOT NULL,
    year INTEGER NOT NULL CHECK (year >= 1900 AND year <= EXTRACT(YEAR FROM CURRENT_DATE) + 1),
    color VARCHAR(30) NOT NULL,
    license_plate VARCHAR(20) UNIQUE NOT NULL,
    vehicle_type vehicle_type NOT NULL,
    seats_available INTEGER NOT NULL CHECK (seats_available >= 1 AND seats_available <= 8),
    insurance_expiry DATE,
    registration_expiry DATE,
    is_verified BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Drivers table
CREATE TABLE drivers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    current_vehicle_id INTEGER REFERENCES vehicles(id),
    license_number VARCHAR(50) UNIQUE NOT NULL,
    license_expiry DATE NOT NULL,
    is_available BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'offline', 'busy')),
    current_lat DECIMAL(10,8),
    current_lng DECIMAL(11,8),
    rating DECIMAL(3,2) DEFAULT 5.0 CHECK (rating >= 0 AND rating <= 5),
    total_rides INTEGER DEFAULT 0,
    total_earnings DECIMAL(10,2) DEFAULT 0.00,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_documents JSONB,
    ai_compatibility_scores JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Rides table
CREATE TABLE rides (
    id SERIAL PRIMARY KEY,
    driver_id INTEGER NOT NULL REFERENCES users(id),
    vehicle_id INTEGER REFERENCES vehicles(id), -- Made optional for flexibility
    origin_address VARCHAR(500) NOT NULL,
    origin_lat DECIMAL(10,8) DEFAULT 0,
    origin_lng DECIMAL(11,8) DEFAULT 0,
    destination_address VARCHAR(500) NOT NULL,
    destination_lat DECIMAL(10,8) DEFAULT 0,
    destination_lng DECIMAL(11,8) DEFAULT 0,
    departure_time TIMESTAMP WITH TIME ZONE NOT NULL,
    arrival_time TIMESTAMP WITH TIME ZONE,
    available_seats INTEGER NOT NULL CHECK (available_seats >= 1),
    price_per_seat DECIMAL(8,2) NOT NULL CHECK (price_per_seat >= 0),
    distance DECIMAL(8,2), -- in kilometers
    estimated_duration INTEGER, -- in minutes
    actual_duration INTEGER, -- in minutes
    actual_route JSONB, -- Store actual route taken
    status ride_status NOT NULL DEFAULT 'pending',
    description TEXT,
    preferences JSONB, -- Added for ride preferences (no smoking, pets allowed, etc.)
    special_requirements TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Bookings table
CREATE TABLE bookings (
    id SERIAL PRIMARY KEY,
    ride_id INTEGER NOT NULL REFERENCES rides(id) ON DELETE CASCADE,
    passenger_id INTEGER NOT NULL REFERENCES users(id),
    seats_booked INTEGER NOT NULL CHECK (seats_booked >= 1),
    total_amount DECIMAL(8,2) NOT NULL CHECK (total_amount >= 0),
    platform_fee DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    pickup_address VARCHAR(500),
    pickup_lat DECIMAL(10,8),
    pickup_lng DECIMAL(11,8),
    dropoff_address VARCHAR(500),
    dropoff_lat DECIMAL(10,8),
    dropoff_lng DECIMAL(11,8),
    pickup_time TIMESTAMP WITH TIME ZONE,
    dropoff_time TIMESTAMP WITH TIME ZONE,
    status booking_status NOT NULL DEFAULT 'pending',
    special_requests TEXT,
    cancel_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Payments table
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER NOT NULL REFERENCES bookings(id),
    payer_id INTEGER NOT NULL REFERENCES users(id),
    recipient_id INTEGER NOT NULL REFERENCES users(id),
    amount DECIMAL(8,2) NOT NULL CHECK (amount >= 0),
    platform_fee DECIMAL(8,2) NOT NULL DEFAULT 0.00,
    payment_method VARCHAR(50) NOT NULL,
    payment_provider VARCHAR(50), -- stripe, paypal, etc.
    provider_payment_id VARCHAR(100),
    status payment_status NOT NULL DEFAULT 'pending',
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Reviews table
CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    booking_id INTEGER NOT NULL REFERENCES bookings(id),
    reviewer_id INTEGER NOT NULL REFERENCES users(id),
    reviewed_user_id INTEGER NOT NULL REFERENCES users(id),
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    is_anonymous BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Notifications table
CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) NOT NULL,
    data JSONB,
    is_read BOOLEAN DEFAULT FALSE,
    is_sent BOOLEAN DEFAULT FALSE,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_phone ON users(phone_number);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);

CREATE INDEX idx_vehicles_user_id ON vehicles(user_id);
CREATE INDEX idx_vehicles_license_plate ON vehicles(license_plate);
CREATE INDEX idx_vehicles_active ON vehicles(is_active);

CREATE INDEX idx_drivers_user_id ON drivers(user_id);
CREATE INDEX idx_drivers_available ON drivers(is_available);
CREATE INDEX idx_drivers_status ON drivers(status);

CREATE INDEX idx_rides_driver_id ON rides(driver_id);
CREATE INDEX idx_rides_departure_time ON rides(departure_time);
CREATE INDEX idx_rides_status ON rides(status);

CREATE INDEX idx_bookings_ride_id ON bookings(ride_id);
CREATE INDEX idx_bookings_passenger_id ON bookings(passenger_id);
CREATE INDEX idx_bookings_status ON bookings(status);

CREATE INDEX idx_payments_booking_id ON payments(booking_id);
CREATE INDEX idx_payments_status ON payments(status);

CREATE INDEX idx_reviews_reviewer_id ON reviews(reviewer_id);
CREATE INDEX idx_reviews_reviewed_user_id ON reviews(reviewed_user_id);

CREATE INDEX idx_notifications_user_id ON notifications(user_id);

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_vehicles_updated_at BEFORE UPDATE ON vehicles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_drivers_updated_at BEFORE UPDATE ON drivers FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_rides_updated_at BEFORE UPDATE ON rides FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_payments_updated_at BEFORE UPDATE ON payments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reviews_updated_at BEFORE UPDATE ON reviews FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample admin user
INSERT INTO users (email, password_hash, first_name, last_name, role, is_verified, is_active)
VALUES 
  ('admin@aryv-app.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LedhMFQJqN8/LedhMF', 'ARYV', 'Admin', 'admin', true, true),
  ('test@aryv-app.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LedhMFQJqN8/LedhMF', 'Test', 'User', 'passenger', true, true);

-- Insert sample data for testing
INSERT INTO vehicles (user_id, make, model, year, color, license_plate, vehicle_type, seats_available, is_verified)
VALUES 
  (2, 'Toyota', 'Camry', 2020, 'Blue', 'ABC123', 'sedan', 4, true);

INSERT INTO drivers (user_id, license_number, license_expiry, is_verified)
VALUES 
  (2, 'DL123456789', '2026-12-31', true);

-- Add courier users
INSERT INTO users (email, password_hash, first_name, last_name, phone_number, role, is_verified, is_active)
VALUES 
  ('courier@aryv-app.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LedhMFQJqN8/LedhMF', 'John', 'Courier', '+1234567892', 'driver', true, true),
  ('sender@aryv-app.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LedhMFQJqN8/LedhMF', 'Jane', 'Sender', '+1234567893', 'passenger', true, true);

-- Sample rides (using correct column names matching table definition)
INSERT INTO rides (driver_id, vehicle_id, origin_lat, origin_lng, destination_lat, destination_lng, origin_address, destination_address, departure_time, available_seats, price_per_seat, distance, status) VALUES
(2, 1, 40.7589, -73.9851, 40.6892, -73.9442, 'Times Square, New York', 'Brooklyn Bridge, New York', '2025-01-25 14:00:00+00', 3, 25.00, 12.5, 'pending'),
(2, 1, 34.0522, -118.2437, 34.1478, -118.1445, 'Downtown LA', 'Pasadena', '2025-01-25 16:30:00+00', 2, 18.50, 15.2, 'pending');

-- Courier service tables
CREATE TYPE package_size AS ENUM ('small', 'medium', 'large', 'custom');
CREATE TYPE delivery_status AS ENUM ('pending_pickup', 'in_transit', 'completed', 'disputed', 'cancelled');

-- Simplified packages table (without PostGIS)
CREATE TABLE packages (
    id SERIAL PRIMARY KEY,
    sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    courier_id INTEGER REFERENCES users(id),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    package_size package_size NOT NULL DEFAULT 'medium',
    weight DECIMAL(8,3), -- in kg
    fragile BOOLEAN DEFAULT FALSE,
    valuable BOOLEAN DEFAULT FALSE,
    pickup_address VARCHAR(500) NOT NULL,
    pickup_latitude DECIMAL(10,8) NOT NULL,
    pickup_longitude DECIMAL(11,8) NOT NULL,
    pickup_contact_name VARCHAR(100),
    pickup_contact_phone VARCHAR(20),
    dropoff_address VARCHAR(500) NOT NULL,
    dropoff_latitude DECIMAL(10,8) NOT NULL,
    dropoff_longitude DECIMAL(11,8) NOT NULL,
    dropoff_contact_name VARCHAR(100),
    dropoff_contact_phone VARCHAR(20),
    distance DECIMAL(8,2), -- in kilometers
    price DECIMAL(8,2) NOT NULL CHECK (price > 0),
    platform_fee DECIMAL(8,2) DEFAULT 0.00,
    status delivery_status NOT NULL DEFAULT 'pending_pickup',
    pickup_confirmed_at TIMESTAMP WITH TIME ZONE,
    delivery_confirmed_at TIMESTAMP WITH TIME ZONE,
    special_instructions TEXT,
    tracking_code VARCHAR(50) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Courier profiles table
CREATE TABLE courier_profiles (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_active BOOLEAN DEFAULT FALSE,
    rating DECIMAL(3,2) DEFAULT 5.0 CHECK (rating >= 0 AND rating <= 5),
    total_deliveries INTEGER DEFAULT 0,
    successful_deliveries INTEGER DEFAULT 0,
    earnings DECIMAL(10,2) DEFAULT 0.00,
    vehicle_type VARCHAR(50),
    max_weight_capacity DECIMAL(8,3), -- in kg
    delivery_radius DECIMAL(8,2), -- in km
    is_available BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Package tracking events
CREATE TABLE package_events (
    id SERIAL PRIMARY KEY,
    package_id INTEGER NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    event_description TEXT,
    location_latitude DECIMAL(10,8),
    location_longitude DECIMAL(11,8),
    event_time TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id)
);

-- Create triggers for courier tables
CREATE TRIGGER update_packages_updated_at BEFORE UPDATE ON packages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_courier_profiles_updated_at BEFORE UPDATE ON courier_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Sample courier data
INSERT INTO courier_profiles (user_id, is_active, rating, total_deliveries, successful_deliveries, earnings, vehicle_type, max_weight_capacity, delivery_radius, is_available) VALUES
(3, true, 4.8, 156, 152, 2450.75, 'motorcycle', 25.0, 15.0, true);

-- Sample packages
INSERT INTO packages (sender_id, courier_id, title, description, package_size, weight, fragile, pickup_address, pickup_latitude, pickup_longitude, pickup_contact_name, pickup_contact_phone, dropoff_address, dropoff_latitude, dropoff_longitude, dropoff_contact_name, dropoff_contact_phone, distance, price, platform_fee, status, tracking_code, special_instructions) VALUES
(4, 3, 'Birthday Gift Package', 'Small birthday present for my sister', 'small', 1.2, false, '123 Main St, New York, NY', 40.7589, -73.9851, 'Jane Sender', '+1234567893', '456 Oak Ave, Brooklyn, NY', 40.6892, -73.9442, 'Sarah Smith', '+1234567894', 12.5, 15.50, 1.55, 'in_transit', 'PKG001GIFT2025', 'Ring doorbell on delivery'),
(4, NULL, 'Important Documents', 'Legal documents that need same-day delivery', 'small', 0.5, true, '789 Business Blvd, Manhattan, NY', 40.7505, -73.9934, 'Jane Sender', '+1234567893', '321 Corporate Plaza, Queens, NY', 40.7282, -73.7949, 'Mike Johnson', '+1234567895', 18.3, 22.75, 2.28, 'pending_pickup', 'PKG002DOCS2025', 'Signature required - business hours only');

-- Sample package events
INSERT INTO package_events (package_id, event_type, event_description, location_latitude, location_longitude, created_by) VALUES
(1, 'pickup_confirmed', 'Package picked up by courier', 40.7589, -73.9851, 3),
(1, 'in_transit', 'Package in transit to destination', 40.7200, -73.9600, 3),
(2, 'created', 'Package created and awaiting courier assignment', 40.7505, -73.9934, 4);

-- Create indexes for courier tables
CREATE INDEX idx_packages_sender_id ON packages(sender_id);
CREATE INDEX idx_packages_courier_id ON packages(courier_id);
CREATE INDEX idx_packages_status ON packages(status);
CREATE INDEX idx_packages_tracking_code ON packages(tracking_code);
CREATE INDEX idx_courier_profiles_user_id ON courier_profiles(user_id);
CREATE INDEX idx_courier_profiles_active ON courier_profiles(is_active, is_available);
CREATE INDEX idx_package_events_package_id ON package_events(package_id);
CREATE INDEX idx_package_events_type ON package_events(event_type);

COMMIT;