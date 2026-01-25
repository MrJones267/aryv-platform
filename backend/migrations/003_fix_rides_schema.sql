-- Migration: 003_fix_rides_schema
-- Description: Fix rides table schema to match API expectations
-- Created: 2025-01-26

-- Add missing columns to users table if they don't exist
DO $$
BEGIN
    -- Add rating column to users
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='rating') THEN
        ALTER TABLE users ADD COLUMN rating DECIMAL(3,2) DEFAULT 5.0 CHECK (rating >= 0 AND rating <= 5);
    END IF;

    -- Add profile_picture column to users (alias for profile_image)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='profile_picture') THEN
        ALTER TABLE users ADD COLUMN profile_picture VARCHAR(500);
    END IF;
END $$;

-- Fix rides table if it exists with wrong schema
DO $$
BEGIN
    -- Check if rides table exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name='rides') THEN
        -- Add preferences column if missing
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rides' AND column_name='preferences') THEN
            ALTER TABLE rides ADD COLUMN preferences JSONB;
        END IF;

        -- Make vehicle_id nullable if it's NOT NULL
        -- This allows rides without a specific vehicle assigned
        ALTER TABLE rides ALTER COLUMN vehicle_id DROP NOT NULL;

        -- Add origin_lat if missing (check for pickup_latitude vs origin_lat naming)
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rides' AND column_name='origin_lat') THEN
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rides' AND column_name='pickup_latitude') THEN
                -- Rename old columns to new naming convention
                ALTER TABLE rides RENAME COLUMN pickup_latitude TO origin_lat;
                ALTER TABLE rides RENAME COLUMN pickup_longitude TO origin_lng;
                ALTER TABLE rides RENAME COLUMN dropoff_latitude TO destination_lat;
                ALTER TABLE rides RENAME COLUMN dropoff_longitude TO destination_lng;
                ALTER TABLE rides RENAME COLUMN pickup_address TO origin_address;
                ALTER TABLE rides RENAME COLUMN dropoff_address TO destination_address;
            ELSE
                -- Add columns with defaults
                ALTER TABLE rides ADD COLUMN origin_lat DECIMAL(10,8) DEFAULT 0;
                ALTER TABLE rides ADD COLUMN origin_lng DECIMAL(11,8) DEFAULT 0;
                ALTER TABLE rides ADD COLUMN destination_lat DECIMAL(10,8) DEFAULT 0;
                ALTER TABLE rides ADD COLUMN destination_lng DECIMAL(11,8) DEFAULT 0;
            END IF;
        END IF;
    END IF;
END $$;

-- Create rides table if it doesn't exist
CREATE TABLE IF NOT EXISTS rides (
    id SERIAL PRIMARY KEY,
    driver_id INTEGER NOT NULL REFERENCES users(id),
    vehicle_id INTEGER REFERENCES vehicles(id),
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
    distance DECIMAL(8,2),
    estimated_duration INTEGER,
    actual_duration INTEGER,
    actual_route JSONB,
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    description TEXT,
    preferences JSONB,
    special_requirements TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create bookings table if it doesn't exist
CREATE TABLE IF NOT EXISTS bookings (
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
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    special_requests TEXT,
    cancel_reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON rides(driver_id);
CREATE INDEX IF NOT EXISTS idx_rides_departure_time ON rides(departure_time);
CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);
CREATE INDEX IF NOT EXISTS idx_bookings_ride_id ON bookings(ride_id);
CREATE INDEX IF NOT EXISTS idx_bookings_passenger_id ON bookings(passenger_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);

-- Insert sample rides if none exist
INSERT INTO rides (driver_id, vehicle_id, origin_address, origin_lat, origin_lng, destination_address, destination_lat, destination_lng, departure_time, available_seats, price_per_seat, distance, status)
SELECT
    (SELECT id FROM users WHERE role = 'driver' OR email = 'test@aryv-app.com' LIMIT 1),
    (SELECT id FROM vehicles LIMIT 1),
    'Times Square, New York',
    40.7589,
    -73.9851,
    'Brooklyn Bridge, New York',
    40.6892,
    -73.9442,
    NOW() + INTERVAL '2 hours',
    3,
    25.00,
    12.5,
    'pending'
WHERE NOT EXISTS (SELECT 1 FROM rides LIMIT 1)
AND EXISTS (SELECT 1 FROM users LIMIT 1);

COMMIT;
