#\!/bin/bash

echo "🚀 ARYV Production Deployment Setup"
echo "===================================="

# Create Railway project configuration
cat > railway.json << 'RAILWAY_EOF'
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm ci && npm run build",
    "watchPatterns": ["**/*.js", "**/*.ts", "**/*.json"]
  },
  "deploy": {
    "startCommand": "node backend/server-simple.js",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
RAILWAY_EOF

# Create production environment file
cat > .env.production << 'ENV_EOF'
NODE_ENV=production
PORT=3001

# Database - Railway will provide these via environment variables
DATABASE_URL=${DATABASE_URL}
PGDATABASE=${PGDATABASE}
PGHOST=${PGHOST}
PGPASSWORD=${PGPASSWORD}
PGPORT=${PGPORT}
PGUSER=${PGUSER}

# JWT Configuration
JWT_SECRET=aryv_super_secure_jwt_secret_key_production_2024
JWT_EXPIRES_IN=7d

# CORS Origins
CORS_ORIGINS=https://aryv-app.com,https://aryv-admin-professional.majokoobo.workers.dev

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# Security
BCRYPT_ROUNDS=12
SESSION_SECRET=aryv_session_secret_production_key

# API Configuration
API_VERSION=v1
MAX_REQUEST_SIZE=10mb
ENV_EOF

# Create production database migration script
cat > production-db-setup.sql << 'SQL_EOF'
-- ARYV Production Database Setup
-- PostgreSQL with production-ready configuration

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- Create optimized schema
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    user_type VARCHAR(20) DEFAULT 'passenger',
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_type ON users(user_type);

-- Driver profiles
CREATE TABLE IF NOT EXISTS drivers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    license_number VARCHAR(50) NOT NULL,
    vehicle_id UUID,
    status VARCHAR(20) DEFAULT 'offline',
    rating DECIMAL(3,2) DEFAULT 5.00,
    total_rides INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(license_number)
);

CREATE INDEX idx_drivers_status ON drivers(status);
CREATE INDEX idx_drivers_rating ON drivers(rating);

-- Vehicles
CREATE TABLE IF NOT EXISTS vehicles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    make VARCHAR(50) NOT NULL,
    model VARCHAR(50) NOT NULL,
    year INTEGER NOT NULL,
    color VARCHAR(30) NOT NULL,
    license_plate VARCHAR(20) UNIQUE NOT NULL,
    capacity INTEGER DEFAULT 4,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Rides with geospatial support
CREATE TABLE IF NOT EXISTS rides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    passenger_id UUID REFERENCES users(id),
    driver_id UUID REFERENCES drivers(id),
    pickup_latitude DECIMAL(10,8) NOT NULL,
    pickup_longitude DECIMAL(11,8) NOT NULL,
    pickup_address TEXT,
    destination_latitude DECIMAL(10,8) NOT NULL,
    destination_longitude DECIMAL(11,8) NOT NULL,
    destination_address TEXT,
    status VARCHAR(20) DEFAULT 'requested',
    fare_amount DECIMAL(10,2),
    distance_km DECIMAL(8,2),
    duration_minutes INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_rides_status ON rides(status);
CREATE INDEX idx_rides_passenger ON rides(passenger_id);
CREATE INDEX idx_rides_driver ON rides(driver_id);
CREATE INDEX idx_rides_created ON rides(created_at);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ride_id UUID REFERENCES rides(id),
    user_id UUID REFERENCES users(id),
    status VARCHAR(20) DEFAULT 'pending',
    booking_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    special_requests TEXT
);

-- Payments
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ride_id UUID REFERENCES rides(id),
    user_id UUID REFERENCES users(id),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    payment_method VARCHAR(50),
    transaction_id VARCHAR(255),
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Package delivery system
CREATE TABLE IF NOT EXISTS packages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID REFERENCES users(id),
    recipient_name VARCHAR(255) NOT NULL,
    recipient_phone VARCHAR(20),
    pickup_latitude DECIMAL(10,8) NOT NULL,
    pickup_longitude DECIMAL(11,8) NOT NULL,
    pickup_address TEXT NOT NULL,
    delivery_latitude DECIMAL(10,8) NOT NULL,
    delivery_longitude DECIMAL(11,8) NOT NULL,
    delivery_address TEXT NOT NULL,
    package_size VARCHAR(20) DEFAULT 'medium',
    weight_kg DECIMAL(5,2),
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    courier_id UUID REFERENCES drivers(id),
    tracking_number VARCHAR(50) UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    picked_up_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX idx_packages_status ON packages(status);
CREATE INDEX idx_packages_tracking ON packages(tracking_number);

-- Reviews and ratings
CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ride_id UUID REFERENCES rides(id),
    reviewer_id UUID REFERENCES users(id),
    reviewed_id UUID REFERENCES users(id),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info',
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert production sample data
INSERT INTO users (email, password_hash, first_name, last_name, user_type) VALUES
('admin@aryv-app.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPXig2kMzpFHm', 'Admin', 'User', 'admin'),
('john.doe@example.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPXig2kMzpFHm', 'John', 'Doe', 'passenger'),
('driver1@aryv-app.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPXig2kMzpFHm', 'Mike', 'Johnson', 'driver'),
('courier1@aryv-app.com', '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBPXig2kMzpFHm', 'Sarah', 'Wilson', 'courier')
ON CONFLICT (email) DO NOTHING;

-- Production performance optimization
VACUUM ANALYZE;

-- Create performance monitoring views
CREATE OR REPLACE VIEW ride_analytics AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as total_rides,
    AVG(fare_amount) as avg_fare,
    SUM(fare_amount) as total_revenue
FROM rides 
WHERE created_at >= NOW() - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date;

GRANT SELECT ON ride_analytics TO PUBLIC;
SQL_EOF

echo "✅ Production deployment files created:"
echo "  📄 railway.json - Railway deployment configuration"
echo "  🔧 .env.production - Production environment variables"
echo "  🗄️ production-db-setup.sql - Database migration script"
echo ""
echo "🚀 Next steps:"
echo "  1. Deploy to Railway: railway up"
echo "  2. Add PostgreSQL service in Railway dashboard"
echo "  3. Run database migration"
echo "  4. Update CORS origins for production domains"
echo ""
echo "💡 Railway Commands:"
echo "  railway login"
echo "  railway link"
echo "  railway up"
echo "  railway variables set NODE_ENV=production"

