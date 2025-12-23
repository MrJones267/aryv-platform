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