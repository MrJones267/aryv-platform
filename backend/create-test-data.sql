-- Test data for ARYV platform user management testing
-- Author: Claude-Code
-- Created: 2025-01-25

-- Insert sample users with various roles and statuses
INSERT INTO users (
    id,
    email,
    password_hash,
    phone,
    first_name,
    last_name,
    role,
    status,
    is_email_verified,
    is_phone_verified,
    date_of_birth,
    created_at,
    updated_at
) VALUES 
-- Active drivers
(
    gen_random_uuid(),
    'john.driver@aryv-app.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LLlOvOtqj/k8JGFCm', -- password: test123
    '+1234567001',
    'John',
    'Driver',
    'driver',
    'active',
    true,
    true,
    '1985-05-15',
    NOW() - INTERVAL '30 days',
    NOW() - INTERVAL '30 days'
),
(
    gen_random_uuid(),
    'sarah.wilson@aryv-app.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LLlOvOtqj/k8JGFCm',
    '+1234567002',
    'Sarah',
    'Wilson',
    'driver',
    'active',
    true,
    false,
    '1990-08-22',
    NOW() - INTERVAL '15 days',
    NOW() - INTERVAL '15 days'
),
-- Active passengers
(
    gen_random_uuid(),
    'mike.passenger@aryv-app.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LLlOvOtqj/k8JGFCm',
    '+1234567003',
    'Mike',
    'Johnson',
    'passenger',
    'active',
    true,
    true,
    '1988-03-10',
    NOW() - INTERVAL '20 days',
    NOW() - INTERVAL '5 days'
),
(
    gen_random_uuid(),
    'emma.smith@aryv-app.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LLlOvOtqj/k8JGFCm',
    '+1234567004',
    'Emma',
    'Smith',
    'passenger',
    'active',
    false,
    true,
    '1992-11-30',
    NOW() - INTERVAL '10 days',
    NOW() - INTERVAL '2 days'
),
-- Suspended users
(
    gen_random_uuid(),
    'blocked.user@aryv-app.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LLlOvOtqj/k8JGFCm',
    '+1234567005',
    'Blocked',
    'User',
    'driver',
    'suspended',
    true,
    true,
    '1987-07-20',
    NOW() - INTERVAL '45 days',
    NOW() - INTERVAL '3 days'
),
-- Deactivated users
(
    gen_random_uuid(),
    'inactive.user@aryv-app.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LLlOvOtqj/k8JGFCm',
    '+1234567006',
    'Inactive',
    'User',
    'passenger',
    'deactivated',
    false,
    false,
    '1995-12-05',
    NOW() - INTERVAL '60 days',
    NOW() - INTERVAL '30 days'
),
-- New unverified users
(
    gen_random_uuid(),
    'new.user1@aryv-app.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LLlOvOtqj/k8JGFCm',
    '+1234567007',
    'New',
    'User1',
    'passenger',
    'active',
    false,
    false,
    '1993-04-18',
    NOW() - INTERVAL '2 days',
    NOW() - INTERVAL '1 day'
),
(
    gen_random_uuid(),
    'new.user2@aryv-app.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LLlOvOtqj/k8JGFCm',
    '+1234567008',
    'New',
    'User2',
    'driver',
    'active',
    true,
    false,
    '1989-09-25',
    NOW() - INTERVAL '1 day',
    NOW() - INTERVAL '1 day'
),
-- Additional test users
(
    gen_random_uuid(),
    'alice.cooper@aryv-app.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LLlOvOtqj/k8JGFCm',
    '+1234567009',
    'Alice',
    'Cooper',
    'driver',
    'active',
    true,
    true,
    '1986-01-12',
    NOW() - INTERVAL '25 days',
    NOW() - INTERVAL '1 day'
),
(
    gen_random_uuid(),
    'bob.tester@aryv-app.com',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LLlOvOtqj/k8JGFCm',
    '+1234567010',
    'Bob',
    'Tester',
    'passenger',
    'active',
    true,
    false,
    '1991-06-08',
    NOW() - INTERVAL '12 days',
    NOW() - INTERVAL '2 hours'
);

-- Add some vehicles for drivers
INSERT INTO vehicles (
    id,
    driver_id,
    make,
    model,
    year,
    color,
    license_plate,
    vehicle_type,
    seats,
    is_verified,
    is_active,
    created_at,
    updated_at
)
SELECT 
    gen_random_uuid(),
    u.id,
    CASE 
        WHEN u.first_name = 'John' THEN 'Toyota'
        WHEN u.first_name = 'Sarah' THEN 'Honda'
        WHEN u.first_name = 'Alice' THEN 'Ford'
        ELSE 'Nissan'
    END,
    CASE 
        WHEN u.first_name = 'John' THEN 'Camry'
        WHEN u.first_name = 'Sarah' THEN 'Accord'
        WHEN u.first_name = 'Alice' THEN 'Focus'
        ELSE 'Altima'
    END,
    2020 + (RANDOM() * 4)::INTEGER,
    CASE 
        WHEN u.first_name = 'John' THEN 'Blue'
        WHEN u.first_name = 'Sarah' THEN 'Red'
        WHEN u.first_name = 'Alice' THEN 'White'
        ELSE 'Black'
    END,
    'TEST' || LPAD((ROW_NUMBER() OVER())::TEXT, 3, '0'),
    'sedan',
    4,
    true,
    CASE WHEN u.status = 'active' THEN true ELSE false END,
    u.created_at,
    u.updated_at
FROM users u 
WHERE u.role = 'driver';

-- Add some sample rides
INSERT INTO rides (
    id,
    driver_id,
    vehicle_id,
    origin_address,
    origin_coordinates,
    destination_address,
    destination_coordinates,
    departure_time,
    available_seats,
    price_per_seat,
    status,
    description,
    estimated_duration,
    distance,
    created_at,
    updated_at
)
SELECT 
    gen_random_uuid(),
    u.id,
    v.id,
    'Downtown City Center',
    ST_GeomFromText('POINT(-73.935242 40.730610)', 4326), -- NYC coordinates
    'Airport Terminal',
    ST_GeomFromText('POINT(-73.778138 40.641311)', 4326), -- JFK coordinates
    NOW() + INTERVAL '2 hours' + (RANDOM() * INTERVAL '48 hours'),
    3,
    25.50,
    CASE 
        WHEN RANDOM() < 0.3 THEN 'pending'
        WHEN RANDOM() < 0.6 THEN 'confirmed'
        WHEN RANDOM() < 0.8 THEN 'completed'
        ELSE 'cancelled'
    END,
    'Comfortable ride to airport',
    45,
    18.5,
    u.created_at + INTERVAL '1 day',
    u.updated_at
FROM users u
JOIN vehicles v ON u.id = v.driver_id
WHERE u.role = 'driver' AND u.status = 'active'
LIMIT 5;

-- Add some sample bookings
INSERT INTO bookings (
    id,
    ride_id,
    passenger_id,
    seats_booked,
    total_amount,
    platform_fee,
    status,
    pickup_address,
    dropoff_address,
    created_at,
    updated_at
)
SELECT 
    gen_random_uuid(),
    r.id,
    u.id,
    1,
    r.price_per_seat + 2.50, -- price + platform fee
    2.50,
    CASE 
        WHEN r.status = 'completed' THEN 'completed'
        WHEN r.status = 'cancelled' THEN 'cancelled'
        ELSE 'confirmed'
    END,
    'Near Downtown',
    'Airport Pickup Area',
    r.created_at + INTERVAL '30 minutes',
    r.updated_at
FROM rides r
CROSS JOIN users u
WHERE u.role = 'passenger' 
  AND u.status = 'active'
  AND RANDOM() < 0.6 -- Only create bookings for 60% of combinations
LIMIT 8;

-- Update some users with last login times
UPDATE users 
SET last_login_at = NOW() - (RANDOM() * INTERVAL '7 days')
WHERE status = 'active' AND RANDOM() < 0.8;

COMMIT;