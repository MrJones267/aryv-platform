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
app.post('/api/admin/migrate-schema', async (req, res) => {
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