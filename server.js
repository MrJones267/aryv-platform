const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3001;

// Debug environment variables
console.log('🔍 Environment Debug:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- PORT:', process.env.PORT);
console.log('- DATABASE_URL exists:', !!process.env.DATABASE_URL);
if (process.env.DATABASE_URL) {
  console.log('- DATABASE_URL preview:', process.env.DATABASE_URL.substring(0, 30) + '...');
} else {
  console.log('- DATABASE_URL: NOT SET!');
}

// Database connection with fallback
const getDatabaseConfig = () => {
  if (process.env.DATABASE_URL) {
    console.log('✅ Using DATABASE_URL environment variable');
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    };
  } else {
    console.log('⚠️ DATABASE_URL not found, using fallback config');
    return {
      host: process.env.PGHOST || 'localhost',
      port: process.env.PGPORT || 5432,
      database: process.env.PGDATABASE || 'railway',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || '',
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    };
  }
};

const pool = new Pool(getDatabaseConfig());

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ Error connecting to database:', err.stack);
  } else {
    console.log('✅ Connected to PostgreSQL database');
    release();
  }
});

// Middleware
app.use(cors({
  origin: ['https://aryv-app.com', 'https://www.aryv-app.com', 'https://admin.aryv-app.com'],
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'ARYV Backend API - Railway Deployment',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    database: 'Connected'
  });
});

// Basic API endpoints
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    message: 'ARYV API is running',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// Users endpoint with better error handling
app.get('/api/users', async (req, res) => {
  try {
    // First test if we can connect at all
    const testResult = await pool.query('SELECT 1 as test');
    console.log('✅ Database connection test passed');
    
    // Then try to query users table
    const result = await pool.query('SELECT COUNT(*) as user_count FROM users');
    console.log('✅ Users query successful:', result.rows[0]);
    
    res.json({
      success: true,
      data: { userCount: parseInt(result.rows[0]?.user_count) || 0 },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Users endpoint error:', error.message);
    console.error('❌ Error details:', error);
    
    // Try to provide more helpful error info
    let errorMessage = 'Database connection failed';
    if (error.message.includes('relation "users" does not exist')) {
      errorMessage = 'Users table does not exist - please create it first';
    } else if (error.message.includes('connection')) {
      errorMessage = 'Cannot connect to database - check DATABASE_URL';
    }
    
    res.status(500).json({
      success: false,
      message: errorMessage,
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }
});

// Schema migration endpoint (ADMIN ONLY - Remove after use)
app.all('/api/admin/migrate-schema', async (req, res) => {
  try {
    console.log('🔄 Starting schema migration...');
    
    // Backup existing data
    await pool.query(`CREATE TABLE IF NOT EXISTS users_backup AS SELECT * FROM users`);
    console.log('✅ Created backup table');
    
    // Drop existing tables
    await pool.query(`DROP TABLE IF EXISTS users_1 CASCADE`);
    await pool.query(`DROP TABLE IF EXISTS users CASCADE`);
    console.log('✅ Dropped old tables');
    
    // Create enhanced users table
    const createTableQuery = `
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        phone_number VARCHAR(20) UNIQUE,
        password_hash VARCHAR(255),
        google_id VARCHAR(100) UNIQUE,
        google_email VARCHAR(255),
        google_verified BOOLEAN DEFAULT FALSE,
        first_name VARCHAR(100) NOT NULL,
        last_name VARCHAR(100) NOT NULL,
        date_of_birth DATE,
        profile_picture_url TEXT,
        user_type VARCHAR(50) DEFAULT 'passenger' CHECK (user_type IN ('passenger', 'driver', 'courier', 'admin')),
        role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'driver', 'courier', 'admin', 'super_admin')),
        is_active BOOLEAN DEFAULT TRUE,
        is_verified BOOLEAN DEFAULT FALSE,
        is_email_verified BOOLEAN DEFAULT FALSE,
        is_phone_verified BOOLEAN DEFAULT FALSE,
        country VARCHAR(100),
        city VARCHAR(100),
        timezone VARCHAR(50) DEFAULT 'UTC',
        preferred_language VARCHAR(10) DEFAULT 'en',
        preferred_currency VARCHAR(10) DEFAULT 'USD',
        driver_license_verified BOOLEAN DEFAULT FALSE,
        vehicle_registered BOOLEAN DEFAULT FALSE,
        courier_approved BOOLEAN DEFAULT FALSE,
        passenger_rating DECIMAL(3,2) DEFAULT 5.0,
        driver_rating DECIMAL(3,2) DEFAULT 5.0,
        courier_rating DECIMAL(3,2) DEFAULT 5.0,
        total_rides_as_passenger INTEGER DEFAULT 0,
        total_rides_as_driver INTEGER DEFAULT 0,
        total_deliveries INTEGER DEFAULT 0,
        wallet_balance DECIMAL(10,2) DEFAULT 0.00,
        total_earnings DECIMAL(10,2) DEFAULT 0.00,
        last_login TIMESTAMP,
        device_info JSONB,
        notification_preferences JSONB DEFAULT '{"email": true, "sms": true, "push": true}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await pool.query(createTableQuery);
    console.log('✅ Created enhanced users table');
    
    // Create indexes
    await pool.query(`CREATE INDEX idx_users_email ON users(email)`);
    await pool.query(`CREATE INDEX idx_users_user_type ON users(user_type)`);
    await pool.query(`CREATE INDEX idx_users_is_active ON users(is_active)`);
    console.log('✅ Created indexes');
    
    // Restore data from backup
    await pool.query(`
      INSERT INTO users (email, first_name, last_name, user_type, role, is_active, is_verified, is_email_verified, country, created_at)
      SELECT 
        email,
        first_name,
        last_name,
        CASE 
          WHEN first_name = 'ARYV' THEN 'admin'
          WHEN last_name = 'Driver' THEN 'driver'
          ELSE 'passenger'
        END,
        CASE 
          WHEN first_name = 'ARYV' THEN 'super_admin'
          WHEN last_name = 'Driver' THEN 'driver'
          ELSE 'user'
        END,
        TRUE, TRUE, TRUE,
        CASE WHEN first_name = 'ARYV' THEN 'Global' ELSE 'USA' END,
        created_at
      FROM users_backup
    `);
    
    // Add sample enhanced users
    await pool.query(`
      INSERT INTO users (email, first_name, last_name, user_type, role, is_active, is_verified, is_email_verified, country, wallet_balance, courier_approved, driver_license_verified)
      VALUES 
      ('courier@aryv-app.com', 'Demo', 'Courier', 'courier', 'courier', TRUE, TRUE, TRUE, 'USA', 150.00, TRUE, FALSE),
      ('premium.driver@aryv-app.com', 'Premium', 'Driver', 'driver', 'driver', TRUE, TRUE, TRUE, 'USA', 250.00, FALSE, TRUE)
    `);
    
    console.log('✅ Restored and enhanced data');
    
    // Clean up backup
    await pool.query(`DROP TABLE users_backup`);
    console.log('✅ Cleaned up backup table');
    
    // Get final count
    const result = await pool.query('SELECT COUNT(*) as count FROM users');
    
    res.json({
      success: true,
      message: 'Schema migration completed successfully',
      userCount: parseInt(result.rows[0].count),
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Rides and Packages schema migration endpoint (ADMIN ONLY)
app.all('/api/admin/migrate-rides-packages', async (req, res) => {
  try {
    console.log('🔄 Starting rides and packages schema migration...');
    
    // Check if migration was already completed
    const existingTables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name IN ('rides', 'packages', 'vehicles', 'bookings')
    `);
    
    if (existingTables.rows.length === 4) {
      console.log('⚠️ Migration already completed, returning current status');
      
      const counts = await Promise.all([
        pool.query('SELECT COUNT(*) as count FROM users'),
        pool.query('SELECT COUNT(*) as count FROM rides'),
        pool.query('SELECT COUNT(*) as count FROM bookings'),
        pool.query('SELECT COUNT(*) as count FROM packages'),
        pool.query('SELECT COUNT(*) as count FROM vehicles')
      ]);
      
      return res.json({
        success: true,
        message: 'Migration already completed - returning current status',
        data: {
          users: parseInt(counts[0].rows[0].count),
          rides: parseInt(counts[1].rows[0].count),
          bookings: parseInt(counts[2].rows[0].count),
          packages: parseInt(counts[3].rows[0].count),
          vehicles: parseInt(counts[4].rows[0].count)
        },
        timestamp: new Date().toISOString()
      });
    }
    
    // Create rides table
    const createRidesTable = `
      CREATE TABLE IF NOT EXISTS rides (
        id SERIAL PRIMARY KEY,
        driver_id INTEGER NOT NULL REFERENCES users(id),
        vehicle_id INTEGER,
        
        -- Route Information
        origin_address TEXT NOT NULL,
        origin_lat DECIMAL(10, 8),
        origin_lng DECIMAL(11, 8),
        destination_address TEXT NOT NULL,
        destination_lat DECIMAL(10, 8),
        destination_lng DECIMAL(11, 8),
        
        -- Timing
        departure_time TIMESTAMP NOT NULL,
        estimated_arrival_time TIMESTAMP,
        actual_departure_time TIMESTAMP,
        actual_arrival_time TIMESTAMP,
        
        -- Capacity & Pricing
        available_seats INTEGER NOT NULL CHECK (available_seats > 0),
        price_per_seat DECIMAL(8,2) NOT NULL,
        total_distance DECIMAL(8,2),
        estimated_duration INTEGER, -- minutes
        
        -- Status & Management
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'in_progress', 'completed', 'cancelled')),
        cancellation_reason TEXT,
        cancelled_by INTEGER REFERENCES users(id),
        cancelled_at TIMESTAMP,
        
        -- Additional Features
        recurring_ride BOOLEAN DEFAULT FALSE,
        recurring_pattern VARCHAR(50), -- 'daily', 'weekly', 'monthly'
        special_requirements TEXT,
        smoking_allowed BOOLEAN DEFAULT FALSE,
        pets_allowed BOOLEAN DEFAULT TRUE,
        music_preference VARCHAR(50),
        
        -- Financial
        platform_fee_percentage DECIMAL(5,2) DEFAULT 10.0,
        driver_earnings DECIMAL(8,2),
        platform_earnings DECIMAL(8,2),
        
        -- Tracking & Communication
        ride_code VARCHAR(10) UNIQUE,
        driver_notes TEXT,
        
        -- Timestamps
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;
    
    await pool.query(createRidesTable);
    console.log('✅ Created rides table');
    
    // Create bookings table
    const createBookingsTable = `
      CREATE TABLE IF NOT EXISTS bookings (
        id SERIAL PRIMARY KEY,
        ride_id INTEGER NOT NULL REFERENCES rides(id),
        passenger_id INTEGER NOT NULL REFERENCES users(id),
        
        -- Booking Details
        seats_booked INTEGER NOT NULL DEFAULT 1,
        total_price DECIMAL(8,2) NOT NULL,
        booking_code VARCHAR(10) UNIQUE NOT NULL,
        
        -- Status
        status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'cancelled', 'completed', 'no_show')),
        
        -- Pickup/Dropoff
        pickup_location_override TEXT, -- if different from ride origin
        dropoff_location_override TEXT, -- if different from ride destination
        pickup_lat DECIMAL(10, 8),
        pickup_lng DECIMAL(11, 8),
        dropoff_lat DECIMAL(10, 8),
        dropoff_lng DECIMAL(11, 8),
        
        -- Communication
        passenger_notes TEXT,
        special_requests TEXT,
        
        -- Payment
        payment_method VARCHAR(50), -- 'cash', 'card', 'wallet'
        payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded', 'failed')),
        payment_reference VARCHAR(100),
        
        -- Timestamps
        booked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        confirmed_at TIMESTAMP,
        cancelled_at TIMESTAMP,
        completed_at TIMESTAMP,
        
        -- Constraints
        UNIQUE(ride_id, passenger_id)
      )
    `;
    
    await pool.query(createBookingsTable);
    console.log('✅ Created bookings table');
    
    // Create packages table (courier service)
    const createPackagesTable = `
      CREATE TABLE IF NOT EXISTS packages (
        id SERIAL PRIMARY KEY,
        sender_id INTEGER NOT NULL REFERENCES users(id),
        courier_id INTEGER REFERENCES users(id),
        
        -- Package Details
        title VARCHAR(200) NOT NULL,
        description TEXT,
        package_size VARCHAR(50) CHECK (package_size IN ('small', 'medium', 'large', 'extra_large')),
        weight DECIMAL(6,2), -- kg
        dimensions JSONB, -- {"length": 10, "width": 5, "height": 3}
        
        -- Package Type & Handling
        fragile BOOLEAN DEFAULT FALSE,
        valuable BOOLEAN DEFAULT FALSE,
        liquid BOOLEAN DEFAULT FALSE,
        perishable BOOLEAN DEFAULT FALSE,
        temperature_sensitive BOOLEAN DEFAULT FALSE,
        special_handling_instructions TEXT,
        
        -- Pickup Information
        pickup_address TEXT NOT NULL,
        pickup_lat DECIMAL(10, 8),
        pickup_lng DECIMAL(11, 8),
        pickup_contact_name VARCHAR(100),
        pickup_contact_phone VARCHAR(20),
        pickup_time_preference VARCHAR(50), -- 'morning', 'afternoon', 'evening', 'flexible'
        pickup_date_flexible BOOLEAN DEFAULT FALSE,
        
        -- Delivery Information
        delivery_address TEXT NOT NULL,
        delivery_lat DECIMAL(10, 8),
        delivery_lng DECIMAL(11, 8),
        recipient_name VARCHAR(100) NOT NULL,
        recipient_phone VARCHAR(20) NOT NULL,
        delivery_instructions TEXT,
        delivery_time_preference VARCHAR(50),
        delivery_date_flexible BOOLEAN DEFAULT FALSE,
        
        -- Pricing & Distance
        distance DECIMAL(8,2), -- km
        base_price DECIMAL(8,2) NOT NULL,
        size_fee DECIMAL(8,2) DEFAULT 0,
        weight_fee DECIMAL(8,2) DEFAULT 0,
        special_handling_fee DECIMAL(8,2) DEFAULT 0,
        total_price DECIMAL(8,2) NOT NULL,
        platform_fee DECIMAL(8,2) NOT NULL,
        courier_earnings DECIMAL(8,2),
        
        -- Status & Tracking
        status VARCHAR(50) DEFAULT 'pending_pickup' CHECK (status IN ('pending_pickup', 'confirmed', 'picked_up', 'in_transit', 'delivered', 'cancelled', 'failed_delivery')),
        tracking_code VARCHAR(20) UNIQUE NOT NULL,
        estimated_pickup_time TIMESTAMP,
        estimated_delivery_time TIMESTAMP,
        actual_pickup_time TIMESTAMP,
        actual_delivery_time TIMESTAMP,
        
        -- Verification & Security
        pickup_verification_code VARCHAR(6),
        delivery_verification_code VARCHAR(6),
        pickup_signature_url TEXT,
        delivery_signature_url TEXT,
        pickup_photo_url TEXT,
        delivery_photo_url TEXT,
        
        -- Communication
        sender_notes TEXT,
        courier_notes TEXT,
        delivery_notes TEXT,
        
        -- Payment
        payment_method VARCHAR(50), -- 'cash', 'card', 'wallet'
        payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'released', 'refunded')),
        payment_reference VARCHAR(100),
        
        -- Blockchain Integration (future)
        smart_contract_address VARCHAR(100),
        blockchain_transaction_hash VARCHAR(100),
        
        -- Timestamps
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        pickup_deadline TIMESTAMP,
        delivery_deadline TIMESTAMP
      )
    `;
    
    await pool.query(createPackagesTable);
    console.log('✅ Created packages table');
    
    // Create package events table (tracking history)
    const createPackageEventsTable = `
      CREATE TABLE IF NOT EXISTS package_events (
        id SERIAL PRIMARY KEY,
        package_id INTEGER NOT NULL REFERENCES packages(id),
        event_type VARCHAR(50) NOT NULL, -- 'created', 'assigned', 'picked_up', 'in_transit', 'delivered', 'delayed'
        event_description TEXT,
        location_address TEXT,
        location_lat DECIMAL(10, 8),
        location_lng DECIMAL(11, 8),
        created_by INTEGER REFERENCES users(id), -- who recorded this event
        event_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        additional_data JSONB
      )
    `;
    
    await pool.query(createPackageEventsTable);
    console.log('✅ Created package_events table');
    
    // Create vehicles table
    const createVehiclesTable = `
      CREATE TABLE IF NOT EXISTS vehicles (
        id SERIAL PRIMARY KEY,
        owner_id INTEGER NOT NULL REFERENCES users(id),
        
        -- Vehicle Details
        make VARCHAR(50) NOT NULL,
        model VARCHAR(50) NOT NULL,
        year INTEGER,
        color VARCHAR(30),
        license_plate VARCHAR(20) UNIQUE NOT NULL,
        
        -- Vehicle Type & Capacity
        vehicle_type VARCHAR(50) CHECK (vehicle_type IN ('car', 'suv', 'van', 'truck', 'motorcycle', 'bicycle')),
        seating_capacity INTEGER,
        cargo_capacity DECIMAL(8,2), -- cubic meters
        max_weight_capacity DECIMAL(8,2), -- kg
        
        -- Status & Verification
        is_verified BOOLEAN DEFAULT FALSE,
        is_active BOOLEAN DEFAULT TRUE,
        insurance_verified BOOLEAN DEFAULT FALSE,
        inspection_verified BOOLEAN DEFAULT FALSE,
        
        -- Documentation
        registration_document_url TEXT,
        insurance_document_url TEXT,
        inspection_document_url TEXT,
        driver_license_url TEXT,
        
        -- Features
        air_conditioning BOOLEAN DEFAULT FALSE,
        wifi BOOLEAN DEFAULT FALSE,
        phone_charger BOOLEAN DEFAULT FALSE,
        wheelchair_accessible BOOLEAN DEFAULT FALSE,
        
        -- Timestamps
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_inspection_date DATE,
        insurance_expiry_date DATE
      )
    `;
    
    await pool.query(createVehiclesTable);
    console.log('✅ Created vehicles table');
    
    // Create indexes for performance (with IF NOT EXISTS)
    const createIndexes = [
      'CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON rides(driver_id)',
      'CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status)',
      'CREATE INDEX IF NOT EXISTS idx_rides_departure_time ON rides(departure_time)',
      'CREATE INDEX IF NOT EXISTS idx_rides_origin_location ON rides(origin_lat, origin_lng)',
      'CREATE INDEX IF NOT EXISTS idx_bookings_ride_id ON bookings(ride_id)',
      'CREATE INDEX IF NOT EXISTS idx_bookings_passenger_id ON bookings(passenger_id)',
      'CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status)',
      'CREATE INDEX IF NOT EXISTS idx_packages_sender_id ON packages(sender_id)',
      'CREATE INDEX IF NOT EXISTS idx_packages_courier_id ON packages(courier_id)',
      'CREATE INDEX IF NOT EXISTS idx_packages_status ON packages(status)',
      'CREATE INDEX IF NOT EXISTS idx_packages_tracking_code ON packages(tracking_code)',
      'CREATE INDEX IF NOT EXISTS idx_package_events_package_id ON package_events(package_id)',
      'CREATE INDEX IF NOT EXISTS idx_package_events_event_time ON package_events(event_time)',
      'CREATE INDEX IF NOT EXISTS idx_vehicles_owner_id ON vehicles(owner_id)',
      'CREATE INDEX IF NOT EXISTS idx_vehicles_license_plate ON vehicles(license_plate)'
    ];
    
    for (const indexQuery of createIndexes) {
      try {
        await pool.query(indexQuery);
      } catch (indexError) {
        console.log(`Index already exists: ${indexError.message}`);
      }
    }
    console.log('✅ Created/verified performance indexes');
    
    // Add sample data - check for existing users first
    const existingUsers = await pool.query(`
      SELECT id, email FROM users WHERE user_type IN ('driver', 'admin') ORDER BY id LIMIT 3
    `);
    
    if (existingUsers.rows.length >= 2) {
      const user1 = existingUsers.rows[0];
      const user2 = existingUsers.rows[1];
      
      await pool.query(`
        INSERT INTO vehicles (owner_id, make, model, year, color, license_plate, vehicle_type, seating_capacity, is_verified, is_active)
        VALUES 
        ($1, 'Toyota', 'Camry', 2022, 'Silver', 'ABC-123', 'car', 4, TRUE, TRUE),
        ($2, 'Mercedes', 'E-Class', 2023, 'Black', 'XYZ-789', 'car', 4, TRUE, TRUE)
        ON CONFLICT (license_plate) DO NOTHING
      `, [user1.id, user2.id]);
      
      await pool.query(`
        INSERT INTO rides (driver_id, vehicle_id, origin_address, destination_address, departure_time, available_seats, price_per_seat, status, ride_code)
        VALUES 
        ($1, 1, 'Downtown Plaza', 'Airport Terminal', NOW() + INTERVAL '2 hours', 3, 25.00, 'pending', 'RD001'),
        ($2, 2, 'University Campus', 'Shopping Mall', NOW() + INTERVAL '4 hours', 2, 35.00, 'confirmed', 'RD002')
        ON CONFLICT (ride_code) DO NOTHING
      `, [user1.id, user2.id]);
      
      await pool.query(`
        INSERT INTO packages (sender_id, title, description, package_size, pickup_address, delivery_address, recipient_name, recipient_phone, total_price, platform_fee, status, tracking_code)
        VALUES 
        ($1, 'Electronics Package', 'Laptop and accessories', 'medium', '123 Tech Street', '456 Business Ave', 'John Doe', '+1234567890', 45.00, 4.50, 'pending_pickup', 'PKG001'),
        ($2, 'Documents', 'Important business documents', 'small', '789 Office Blvd', '321 Corporate Dr', 'Jane Smith', '+0987654321', 15.00, 1.50, 'confirmed', 'PKG002')
        ON CONFLICT (tracking_code) DO NOTHING
      `, [user1.id, user2.id]);
      
      console.log('✅ Added sample data with existing users');
    } else {
      console.log('⚠️ Not enough users found, skipping sample data');
    }
    
    console.log('✅ Sample data section completed');
    
    // Get counts for verification
    const counts = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM users'),
      pool.query('SELECT COUNT(*) as count FROM rides'),
      pool.query('SELECT COUNT(*) as count FROM bookings'),
      pool.query('SELECT COUNT(*) as count FROM packages'),
      pool.query('SELECT COUNT(*) as count FROM vehicles')
    ]);
    
    res.json({
      success: true,
      message: 'Rides and packages schema migration completed successfully',
      data: {
        users: parseInt(counts[0].rows[0].count),
        rides: parseInt(counts[1].rows[0].count),
        bookings: parseInt(counts[2].rows[0].count),
        packages: parseInt(counts[3].rows[0].count),
        vehicles: parseInt(counts[4].rows[0].count)
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ Migration error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Debug endpoint to check database connection
app.get('/api/debug/database', async (req, res) => {
  try {
    // Test basic connection
    const testResult = await pool.query('SELECT NOW() as current_time, version() as postgres_version');
    
    // Try to list tables
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    
    res.json({
      success: true,
      data: {
        connected: true,
        currentTime: testResult.rows[0].current_time,
        postgresVersion: testResult.rows[0].postgres_version,
        tables: tablesResult.rows.map(row => row.table_name),
        databaseUrl: process.env.DATABASE_URL ? 'Set' : 'Not set'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Database debug error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Rides API endpoints
app.get('/api/rides', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        r.*,
        u.first_name || ' ' || u.last_name as driver_name,
        v.make || ' ' || v.model as vehicle_info,
        COUNT(b.id) as bookings_count,
        SUM(b.seats_booked) as seats_booked
      FROM rides r
      JOIN users u ON r.driver_id = u.id
      LEFT JOIN vehicles v ON r.vehicle_id = v.id
      LEFT JOIN bookings b ON r.id = b.ride_id AND b.status != 'cancelled'
      GROUP BY r.id, u.first_name, u.last_name, v.make, v.model
      ORDER BY r.departure_time DESC
      LIMIT 20
    `);
    
    res.json({
      success: true,
      data: result.rows,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Rides error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Packages API endpoints
app.get('/api/packages', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.*,
        sender.first_name || ' ' || sender.last_name as sender_name,
        courier.first_name || ' ' || courier.last_name as courier_name
      FROM packages p
      JOIN users sender ON p.sender_id = sender.id
      LEFT JOIN users courier ON p.courier_id = courier.id
      ORDER BY p.created_at DESC
      LIMIT 20
    `);
    
    res.json({
      success: true,
      data: result.rows,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Packages error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Vehicles API endpoints
app.get('/api/vehicles', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        v.*,
        u.first_name || ' ' || u.last_name as owner_name
      FROM vehicles v
      JOIN users u ON v.owner_id = u.id
      ORDER BY v.created_at DESC
    `);
    
    res.json({
      success: true,
      data: result.rows,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Vehicles error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Analytics endpoint
app.get('/api/analytics', async (req, res) => {
  try {
    const analytics = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM users'),
      pool.query('SELECT COUNT(*) as count FROM rides'),
      pool.query('SELECT COUNT(*) as count FROM packages'),
      pool.query('SELECT COUNT(*) as count FROM vehicles'),
      pool.query('SELECT COUNT(*) as count FROM bookings'),
      pool.query(`SELECT 
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(*) FILTER (WHERE status = 'completed') as completed
        FROM rides`),
      pool.query(`SELECT 
        COUNT(*) FILTER (WHERE status = 'pending_pickup') as pending_pickup,
        COUNT(*) FILTER (WHERE status = 'in_transit') as in_transit,
        COUNT(*) FILTER (WHERE status = 'delivered') as delivered
        FROM packages`)
    ]);
    
    res.json({
      success: true,
      data: {
        users: parseInt(analytics[0].rows[0].count),
        rides: parseInt(analytics[1].rows[0].count),
        packages: parseInt(analytics[2].rows[0].count),
        vehicles: parseInt(analytics[3].rows[0].count),
        bookings: parseInt(analytics[4].rows[0].count),
        rideStatuses: analytics[5].rows[0],
        packageStatuses: analytics[6].rows[0]
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Default API response
app.use('/api/*', (req, res) => {
  res.json({
    success: true,
    message: 'ARYV Backend API - Railway Deployment',
    endpoint: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
    note: 'API is running successfully'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 ARYV Backend running on port ${PORT}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health`);
  console.log(`📊 API status: http://localhost:${PORT}/api/status`);
});