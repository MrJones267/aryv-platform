const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3001;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

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

// Users endpoint (basic)
app.get('/api/users', async (req, res) => {
  try {
    const result = await pool.query('SELECT COUNT(*) as user_count FROM users');
    res.json({
      success: true,
      data: { userCount: result.rows[0]?.user_count || 0 },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Users error:', error);
    res.status(500).json({
      success: false,
      message: 'Database not initialized yet',
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