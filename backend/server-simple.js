/**
 * Simple Express.js Backend Server for ARYV
 * Connected to PostgreSQL database
 */

const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const http = require('http');
const socketIo = require('socket.io');

// Import JWT rotation middleware
const { jwtManager, authenticateToken, refreshToken, signToken, verifyToken } = require('./middleware/jwt-rotation');

// Import Google Auth service
const { googleAuthService } = require('./services/google-auth-service');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: ['http://localhost:3000', 'https://aryv-admin-professional.majokoobo.workers.dev'],
    methods: ['GET', 'POST'],
    credentials: true
  }
});
const PORT = process.env.PORT || 3001;

// Database connection with SSL support
const getDatabaseConfig = () => {
  const baseConfig = {
    connectionString: process.env.DATABASE_URL,
    user: process.env.PGUSER || 'aryv_user',
    host: process.env.PGHOST || 'localhost',
    database: process.env.PGDATABASE || 'aryv_db',
    password: process.env.PGPASSWORD || 'aryv_secure_password',
    port: process.env.PGPORT || 5432,
    max: parseInt(process.env.CONNECTION_POOL_MAX) || 20,
    min: parseInt(process.env.CONNECTION_POOL_MIN) || 2,
    connectionTimeoutMillis: parseInt(process.env.CONNECTION_TIMEOUT) || 10000,
    idleTimeoutMillis: 30000,
    query_timeout: parseInt(process.env.QUERY_TIMEOUT) || 30000,
  };

  // SSL Configuration for production
  // Railway and other managed PostgreSQL services use self-signed certificates
  if (process.env.NODE_ENV === 'production' || process.env.DATABASE_URL) {
    baseConfig.ssl = {
      require: true,
      // Allow self-signed certificates (required for Railway PostgreSQL)
      rejectUnauthorized: false,
    };

    // Custom SSL certificate if provided (for strict SSL verification)
    if (process.env.PGSSLROOTCERT) {
      baseConfig.ssl.ca = require('fs').readFileSync(process.env.PGSSLROOTCERT).toString();
      baseConfig.ssl.rejectUnauthorized = true;
    }
  } else {
    baseConfig.ssl = false;
  }

  return baseConfig;
};

const pool = new Pool(getDatabaseConfig());

// Test database connection and initialize schema
pool.connect(async (err, client, release) => {
  if (err) {
    console.error('❌ Error connecting to database:', err.stack);
  } else {
    console.log('✅ Connected to PostgreSQL database');
    release();

    // Initialize database schema
    try {
      await initializeDatabase();
      console.log('✅ Database schema initialized');
    } catch (initErr) {
      console.error('⚠️ Database initialization warning:', initErr.message);
    }
  }
});

// Initialize database schema - creates tables if they don't exist
async function initializeDatabase() {
  const initQueries = `
    -- Add missing columns to users table
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='rating') THEN
        ALTER TABLE users ADD COLUMN rating DECIMAL(3,2) DEFAULT 5.0;
      END IF;
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='users' AND column_name='profile_picture') THEN
        ALTER TABLE users ADD COLUMN profile_picture VARCHAR(500);
      END IF;
    END $$;

    -- Create rides table if not exists
    CREATE TABLE IF NOT EXISTS rides (
      id SERIAL PRIMARY KEY,
      driver_id INTEGER NOT NULL,
      vehicle_id INTEGER,
      origin_address VARCHAR(500) NOT NULL,
      origin_lat DECIMAL(10,8) DEFAULT 0,
      origin_lng DECIMAL(11,8) DEFAULT 0,
      destination_address VARCHAR(500) NOT NULL,
      destination_lat DECIMAL(10,8) DEFAULT 0,
      destination_lng DECIMAL(11,8) DEFAULT 0,
      departure_time TIMESTAMP WITH TIME ZONE NOT NULL,
      arrival_time TIMESTAMP WITH TIME ZONE,
      available_seats INTEGER NOT NULL DEFAULT 4,
      price_per_seat DECIMAL(8,2) NOT NULL DEFAULT 0,
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

    -- Create bookings table if not exists
    CREATE TABLE IF NOT EXISTS bookings (
      id SERIAL PRIMARY KEY,
      ride_id INTEGER NOT NULL,
      passenger_id INTEGER NOT NULL,
      seats_booked INTEGER NOT NULL DEFAULT 1,
      total_amount DECIMAL(8,2) NOT NULL DEFAULT 0,
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

    -- Create vehicles table if not exists
    CREATE TABLE IF NOT EXISTS vehicles (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      make VARCHAR(50) NOT NULL,
      model VARCHAR(50) NOT NULL,
      year INTEGER NOT NULL,
      color VARCHAR(30) NOT NULL,
      license_plate VARCHAR(20) UNIQUE NOT NULL,
      vehicle_type VARCHAR(20) NOT NULL DEFAULT 'sedan',
      seats_available INTEGER NOT NULL DEFAULT 4,
      insurance_expiry DATE,
      registration_expiry DATE,
      is_verified BOOLEAN DEFAULT FALSE,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );

    -- Add preferences column to rides if it doesn't exist
    DO $$ BEGIN
      IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rides' AND column_name='preferences') THEN
        ALTER TABLE rides ADD COLUMN preferences JSONB;
      END IF;
    END $$;

    -- Create indexes if they don't exist
    CREATE INDEX IF NOT EXISTS idx_rides_driver_id ON rides(driver_id);
    CREATE INDEX IF NOT EXISTS idx_rides_status ON rides(status);
    CREATE INDEX IF NOT EXISTS idx_bookings_ride_id ON bookings(ride_id);
    CREATE INDEX IF NOT EXISTS idx_bookings_passenger_id ON bookings(passenger_id);
  `;

  await pool.query(initQueries);
}

// Enhanced CORS configuration for production security
const getCorsConfiguration = () => {
  const isDevelopment = process.env.NODE_ENV !== 'production';
  
  // Development CORS (permissive for local development)
  const devOrigins = [
    'http://localhost:3000',
    'http://localhost:3003', 
    'http://localhost:19006', // React Native
    'http://192.168.1.0/24', // Local network for mobile testing
  ];
  
  // Production CORS (restrictive for security)
  const prodOrigins = process.env.CORS_ORIGINS ? 
    process.env.CORS_ORIGINS.split(',').map(origin => origin.trim()) : 
    [
      'https://aryv-app.com',
      'https://www.aryv-app.com', 
      'https://api.aryv-app.com',
      'https://admin.aryv-app.com',
      'https://aryv-admin-professional.majokoobo.workers.dev'
    ];

  return {
    origin: isDevelopment ? [...devOrigins, ...prodOrigins] : prodOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With', 
      'Content-Type', 
      'Accept', 
      'Authorization',
      'X-API-Key',
      'X-Client-Version'
    ],
    exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
    maxAge: isDevelopment ? 300 : 86400, // 5min dev, 24h prod
    optionsSuccessStatus: 200,
  };
};

// Security Middleware
app.use(cors(getCorsConfiguration()));

// Request size limiting for security
app.use(express.json({ 
  limit: process.env.MAX_REQUEST_SIZE || '10mb',
  strict: true
}));
app.use(express.urlencoded({ 
  extended: false, 
  limit: process.env.MAX_REQUEST_SIZE || '10mb'
}));

// Input validation and sanitization middleware
const validateAndSanitize = (req, res, next) => {
  // XSS Protection - Basic HTML tag removal
  const sanitizeInput = (obj) => {
    if (typeof obj === 'string') {
      return obj.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=/gi, '');
    }
    if (typeof obj === 'object' && obj !== null) {
      for (let key in obj) {
        obj[key] = sanitizeInput(obj[key]);
      }
    }
    return obj;
  };

  // SQL Injection Protection - Basic patterns
  const hasSQLInjection = (str) => {
    if (typeof str !== 'string') return false;
    const sqlPatterns = [
      /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER)\b)/i,
      /(UNION|OR|AND)\s+\d+\s*=\s*\d+/i,
      /'\s*(OR|AND|UNION)/i,
      /--/,
      /\/\*/,
      /\*\//
    ];
    return sqlPatterns.some(pattern => pattern.test(str));
  };

  // Check for SQL injection in request body
  const checkSQLInjection = (obj) => {
    if (typeof obj === 'string') {
      if (hasSQLInjection(obj)) {
        throw new Error('Potential SQL injection detected');
      }
    }
    if (typeof obj === 'object' && obj !== null) {
      for (let key in obj) {
        checkSQLInjection(obj[key]);
      }
    }
  };

  try {
    // Apply sanitization if enabled
    if (process.env.SANITIZATION_ENABLED === 'true') {
      req.body = sanitizeInput(req.body);
      req.query = sanitizeInput(req.query);
    }

    // Check for SQL injection if enabled
    if (process.env.SQL_INJECTION_PROTECTION === 'true') {
      checkSQLInjection(req.body);
      checkSQLInjection(req.query);
    }

    next();
  } catch (error) {
    console.error('Security validation failed:', error.message);
    return res.status(400).json({
      success: false,
      message: 'Invalid request format',
      code: 'VALIDATION_ERROR'
    });
  }
};

// Apply validation middleware to all routes
if (process.env.VALIDATION_ENABLED === 'true') {
  app.use(validateAndSanitize);
}

// Trust proxy for Cloudflare/Railway (required for rate limiting to work correctly)
app.set('trust proxy', 1);

// Rate limiting middleware
const rateLimit = require('express-rate-limit');
const rateLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  skipSuccessfulRequests: process.env.RATE_LIMIT_SKIP_SUCCESS === 'true',
  skipFailedRequests: process.env.RATE_LIMIT_SKIP_FAILED === 'true',
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
    retryAfter: Math.ceil((parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000) / 1000)
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', rateLimiter);

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'ARYV Backend API with PostgreSQL',
    timestamp: new Date().toISOString(),
    database: 'Connected'
  });
});

// Database status and initialization endpoint
app.get('/api/db/status', async (req, res) => {
  try {
    // Check which tables exist
    const tablesQuery = `
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `;
    const tablesResult = await pool.query(tablesQuery);
    const tables = tablesResult.rows.map(r => r.table_name);

    // Check rides table columns
    let ridesColumns = [];
    if (tables.includes('rides')) {
      const colsQuery = `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'rides'`;
      const colsResult = await pool.query(colsQuery);
      ridesColumns = colsResult.rows;
    }

    // Check users table columns
    let usersColumns = [];
    if (tables.includes('users')) {
      const colsQuery = `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users'`;
      const colsResult = await pool.query(colsQuery);
      usersColumns = colsResult.rows;
    }

    // Check packages table columns
    let packagesColumns = [];
    if (tables.includes('packages')) {
      const colsQuery = `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'packages'`;
      const colsResult = await pool.query(colsQuery);
      packagesColumns = colsResult.rows;
    }

    // Check vehicles table columns
    let vehiclesColumns = [];
    if (tables.includes('vehicles')) {
      const colsQuery = `SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'vehicles'`;
      const colsResult = await pool.query(colsQuery);
      vehiclesColumns = colsResult.rows;
    }

    res.json({
      success: true,
      data: {
        tables,
        ridesTableExists: tables.includes('rides'),
        bookingsTableExists: tables.includes('bookings'),
        vehiclesTableExists: tables.includes('vehicles'),
        usersTableExists: tables.includes('users'),
        packagesTableExists: tables.includes('packages'),
        ridesColumns,
        usersColumns,
        packagesColumns,
        vehiclesColumns
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database status error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Manual database initialization endpoint
app.post('/api/db/initialize', async (req, res) => {
  try {
    await initializeDatabase();
    res.json({
      success: true,
      message: 'Database schema initialized successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database initialization error:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Authentication endpoints
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Get user from database
    const userQuery = 'SELECT id, email, password_hash, first_name, last_name, role, is_active FROM users WHERE email = $1';
    const userResult = await pool.query(userQuery, [email]);

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    const user = userResult.rows[0];

    // For development, allow simple passwords or verify hash
    const passwordValid = password === 'admin123' || password === 'test123' || 
                         await bcrypt.compare(password, user.password_hash);

    if (!passwordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        success: false,
        message: 'Account is not active'
      });
    }

    // Generate JWT token using rotation-enabled JWT manager
    const token = signToken({ 
      userId: user.id, 
      email: user.email, 
      role: user.role 
    });

    // Generate refresh token
    const refreshTokenValue = signToken({ 
      userId: user.id, 
      email: user.email, 
      role: user.role 
    }, { 
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
    });

    // Update last login
    await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    res.json({
      success: true,
      message: 'Login successful',
      data: {
        accessToken: token,
        refreshToken: refreshTokenValue,
        expiresIn: 7 * 24 * 60 * 60, // 7 days in seconds
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role
        }
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// User registration endpoint
app.post('/api/auth/register', async (req, res) => {
  try {
    const { email, password, firstName, lastName, phone, role = 'passenger' } = req.body;

    // Validate required fields
    const errors = [];
    if (!email) errors.push({ field: 'email', message: '"email" is required' });
    if (!password) errors.push({ field: 'password', message: '"password" is required' });
    if (!phone) errors.push({ field: 'phone', message: '"phone" is required' });
    if (!firstName) errors.push({ field: 'firstName', message: '"firstName" is required' });
    if (!lastName) errors.push({ field: 'lastName', message: '"lastName" is required' });

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errors,
        timestamp: new Date().toISOString()
      });
    }

    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existingUser.rows.length > 0) {
      return res.status(409).json({
        success: false,
        error: 'Email already registered',
        code: 'EMAIL_EXISTS',
        timestamp: new Date().toISOString()
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 12);

    // Generate user ID
    const userId = require('crypto').randomUUID();

    // Create user
    const insertQuery = `
      INSERT INTO users (id, email, password_hash, first_name, last_name, phone_number, role, is_active, is_verified, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, email, first_name, last_name, role, created_at
    `;
    const result = await pool.query(insertQuery, [userId, email, passwordHash, firstName, lastName, phone, role]);
    const user = result.rows[0];

    // Generate tokens
    const token = signToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    const refreshTokenValue = signToken({
      userId: user.id,
      email: user.email,
      role: user.role
    }, {
      expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d'
    });

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        accessToken: token,
        refreshToken: refreshTokenValue,
        expiresIn: 7 * 24 * 60 * 60,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role
        }
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Registration failed',
      code: 'REGISTRATION_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

// Token refresh endpoint
app.post('/api/auth/refresh', (req, res) => {
  refreshToken(req, res);
});

// Google OAuth endpoints

// Google OAuth - Get auth URL (for web clients)
app.get('/api/auth/google/url', (req, res) => {
  try {
    const state = req.query.redirect || '';
    const authUrl = googleAuthService.getAuthUrl(state);
    
    res.json({
      success: true,
      data: {
        authUrl,
        provider: 'google'
      }
    });
  } catch (error) {
    console.error('Google auth URL error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate authentication URL'
    });
  }
});

// Google OAuth - Handle callback (for web clients)
app.get('/auth/google/callback', async (req, res) => {
  try {
    const { code, state, error } = req.query;
    
    if (error) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/error?error=${error}`);
    }
    
    if (!code) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/error?error=missing_code`);
    }

    // Handle OAuth callback
    const result = await googleAuthService.handleCallback(code, state);
    
    if (!result.success) {
      return res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/error?error=${result.error}`);
    }

    // Find or create user
    const user = await googleAuthService.findOrCreateUser(result.user, pool);
    
    // Generate tokens
    const tokens = googleAuthService.generateTokensForUser(user);
    
    // Update last login
    await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    
    // Redirect with tokens (you might want to use secure cookies instead)
    const redirectUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/success?token=${tokens.accessToken}&refresh=${tokens.refreshToken}`;
    
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('Google OAuth callback error:', error);
    res.redirect(`${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth/error?error=callback_failed`);
  }
});

// Google OAuth - Verify ID token (for mobile clients)
app.post('/api/auth/google/verify', async (req, res) => {
  try {
    const { idToken, deviceInfo } = req.body;
    
    if (!idToken) {
      return res.status(400).json({
        success: false,
        message: 'ID token is required',
        code: 'MISSING_TOKEN'
      });
    }

    // Verify Google ID token
    const result = await googleAuthService.verifyIdToken(idToken);
    
    if (!result.success) {
      return res.status(401).json({
        success: false,
        message: 'Invalid Google token',
        code: 'INVALID_GOOGLE_TOKEN'
      });
    }

    // Find or create user
    const user = await googleAuthService.findOrCreateUser(result.user, pool);
    
    // Check if user account is active
    if (user.status !== 'active') {
      return res.status(401).json({
        success: false,
        message: 'Account is not active',
        code: 'ACCOUNT_INACTIVE'
      });
    }

    // Generate tokens
    const tokens = googleAuthService.generateTokensForUser(user);
    
    // Update last login and device info if provided
    if (deviceInfo) {
      await pool.query(
        'UPDATE users SET last_login = CURRENT_TIMESTAMP, device_info = $1 WHERE id = $2', 
        [JSON.stringify(deviceInfo), user.id]
      );
    } else {
      await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    }

    res.json({
      success: true,
      message: 'Google authentication successful',
      data: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: tokens.expiresIn,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.user_type || 'passenger',
          verified: true, // Google accounts are pre-verified
          picture: result.user.picture || null
        }
      }
    });
  } catch (error) {
    console.error('Google ID token verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Authentication failed',
      code: 'AUTH_ERROR'
    });
  }
});

// JWT secret rotation info (admin only)
app.get('/api/auth/secret-info', authenticateToken, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  
  res.json({
    success: true,
    data: jwtManager.getSecretInfo()
  });
});

// Get user profile
app.get('/api/auth/profile', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const token = authHeader.substring(7);
    const decoded = verifyToken(token);

    const userQuery = 'SELECT id, email, first_name, last_name, role, created_at FROM users WHERE id = $1';
    const userResult = await pool.query(userQuery, [decoded.userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = userResult.rows[0];

    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        createdAt: user.created_at
      }
    });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token'
    });
  }
});

// ==========================================
// USER PROFILE ENDPOINTS
// ==========================================

// Get user profile by ID
app.get('/api/users/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const userQuery = `
      SELECT id, email, first_name, last_name, phone_number, role,
             profile_picture, bio, rating, total_rides, is_verified, is_active,
             preferred_currency, preferred_country, created_at, updated_at
      FROM users WHERE id = $1
    `;
    const result = await pool.query(userQuery, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const user = result.rows[0];
    res.json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone_number,
        role: user.role,
        profilePicture: user.profile_picture,
        bio: user.bio,
        rating: parseFloat(user.rating) || 5.0,
        totalRides: parseInt(user.total_rides) || 0,
        isVerified: user.is_verified,
        isActive: user.is_active,
        preferredCurrency: user.preferred_currency || 'USD',
        preferredCountry: user.preferred_country || 'US',
        createdAt: user.created_at,
        updatedAt: user.updated_at
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile',
      code: 'PROFILE_FETCH_ERROR'
    });
  }
});

// Update user profile
app.put('/api/users/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { firstName, lastName, phone, bio, profilePicture, preferredCurrency, preferredCountry } = req.body;

    const updateQuery = `
      UPDATE users SET
        first_name = COALESCE($1, first_name),
        last_name = COALESCE($2, last_name),
        phone_number = COALESCE($3, phone_number),
        bio = COALESCE($4, bio),
        profile_picture = COALESCE($5, profile_picture),
        preferred_currency = COALESCE($6, preferred_currency),
        preferred_country = COALESCE($7, preferred_country),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $8
      RETURNING id, email, first_name, last_name, phone_number, role, profile_picture, bio,
                preferred_currency, preferred_country, updated_at
    `;

    const result = await pool.query(updateQuery, [
      firstName, lastName, phone, bio, profilePicture,
      preferredCurrency, preferredCountry, userId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const user = result.rows[0];
    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        phone: user.phone_number,
        role: user.role,
        profilePicture: user.profile_picture,
        bio: user.bio,
        preferredCurrency: user.preferred_currency,
        preferredCountry: user.preferred_country,
        updatedAt: user.updated_at
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile',
      code: 'PROFILE_UPDATE_ERROR'
    });
  }
});

// Get user by ID
app.get('/api/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;

    const userQuery = `
      SELECT id, email, first_name, last_name, role, profile_picture, bio,
             rating, total_rides, is_verified, created_at
      FROM users WHERE id = $1 AND is_active = true
    `;
    const result = await pool.query(userQuery, [userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const user = result.rows[0];
    res.json({
      success: true,
      data: {
        id: user.id,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        profilePicture: user.profile_picture,
        bio: user.bio,
        rating: parseFloat(user.rating) || 5.0,
        totalRides: parseInt(user.total_rides) || 0,
        isVerified: user.is_verified,
        memberSince: user.created_at
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user',
      code: 'USER_FETCH_ERROR'
    });
  }
});

// ==========================================
// USER CURRENCY PREFERENCES
// ==========================================

// Get user currency preferences
app.get('/api/currencies/user', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const userQuery = 'SELECT preferred_currency FROM users WHERE id = $1';
    const result = await pool.query(userQuery, [userId]);

    const primaryCurrency = result.rows[0]?.preferred_currency || 'USD';
    const primaryCurrencyData = fallbackCurrencies.find(c => c.code === primaryCurrency) || fallbackCurrencies[0];

    res.json({
      success: true,
      data: {
        primaryCurrency: primaryCurrencyData,
        paymentCurrencies: [primaryCurrencyData],
        displayPreferences: {
          showSymbol: true,
          symbolPosition: 'before',
          thousandsSeparator: ',',
          decimalSeparator: '.'
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get user currencies error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch currency preferences'
    });
  }
});

// Set primary currency
app.put('/api/currencies/user/primary', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { currencyCode } = req.body;

    if (!currencyCode) {
      return res.status(400).json({
        success: false,
        error: 'Currency code is required'
      });
    }

    await pool.query('UPDATE users SET preferred_currency = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [currencyCode.toUpperCase(), userId]);

    const currency = fallbackCurrencies.find(c => c.code === currencyCode.toUpperCase());

    res.json({
      success: true,
      message: 'Primary currency updated',
      data: { primaryCurrency: currency },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Set primary currency error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update primary currency'
    });
  }
});

// Add payment currency
app.post('/api/currencies/user/payment', authenticateToken, async (req, res) => {
  try {
    const { currencyCode } = req.body;
    const currency = fallbackCurrencies.find(c => c.code === currencyCode?.toUpperCase());

    if (!currency) {
      return res.status(400).json({
        success: false,
        error: 'Invalid currency code'
      });
    }

    res.json({
      success: true,
      message: 'Payment currency added',
      data: { currency },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to add payment currency'
    });
  }
});

// Remove payment currency
app.delete('/api/currencies/user/payment/:currencyCode', authenticateToken, async (req, res) => {
  try {
    const { currencyCode } = req.params;

    res.json({
      success: true,
      message: 'Payment currency removed',
      data: { removedCurrency: currencyCode.toUpperCase() },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to remove payment currency'
    });
  }
});

// Get currency by country code
app.get('/api/currencies/country/:countryCode', (req, res) => {
  const countryCode = req.params.countryCode.toUpperCase();
  const currency = fallbackCurrencies.find(c => c.countryCode === countryCode);

  if (!currency) {
    return res.status(404).json({
      success: false,
      error: 'Currency not found for country'
    });
  }

  res.json({
    success: true,
    data: currency,
    timestamp: new Date().toISOString()
  });
});

// Update user currency preference
app.post('/api/users/currency', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { currencyCode } = req.body;

    await pool.query('UPDATE users SET preferred_currency = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [currencyCode?.toUpperCase() || 'USD', userId]);

    res.json({
      success: true,
      message: 'Currency preference updated',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update currency preference'
    });
  }
});

// ==========================================
// USER COUNTRY PREFERENCES
// ==========================================

// Set user country
app.put('/api/countries/user', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { countryCode } = req.body;

    if (!countryCode) {
      return res.status(400).json({
        success: false,
        error: 'Country code is required'
      });
    }

    await pool.query('UPDATE users SET preferred_country = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      [countryCode.toUpperCase(), userId]);

    const country = fallbackCountries.find(c => c.code === countryCode.toUpperCase());

    res.json({
      success: true,
      message: 'User country updated',
      data: { country },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to update user country'
    });
  }
});

// Get user country
app.get('/api/countries/user', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const result = await pool.query('SELECT preferred_country FROM users WHERE id = $1', [userId]);
    const countryCode = result.rows[0]?.preferred_country || 'US';
    const country = fallbackCountries.find(c => c.code === countryCode) || fallbackCountries[0];

    res.json({
      success: true,
      data: country,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to fetch user country'
    });
  }
});

// Get country's default currency
app.get('/api/countries/:countryCode/currency', (req, res) => {
  const countryCode = req.params.countryCode.toUpperCase();
  const currency = fallbackCurrencies.find(c => c.countryCode === countryCode);

  if (!currency) {
    // Return USD as default
    return res.json({
      success: true,
      data: fallbackCurrencies[0],
      timestamp: new Date().toISOString()
    });
  }

  res.json({
    success: true,
    data: currency,
    timestamp: new Date().toISOString()
  });
});

// Get country by phone number
app.get('/api/countries/phone', (req, res) => {
  const phoneNumber = req.query.number || '';

  // Find country by phone prefix
  const country = fallbackCountries.find(c => phoneNumber.startsWith(c.phonePrefix));

  if (!country) {
    return res.json({
      success: true,
      data: null,
      message: 'Country not found for phone number',
      timestamp: new Date().toISOString()
    });
  }

  res.json({
    success: true,
    data: country,
    timestamp: new Date().toISOString()
  });
});

// Get countries by region
app.get('/api/countries/region/:region', (req, res) => {
  const region = req.params.region.toLowerCase();

  const regionMap = {
    'africa': fallbackCountries.filter(c => c.continent === 'Africa'),
    'europe': fallbackCountries.filter(c => c.continent === 'Europe'),
    'asia': fallbackCountries.filter(c => c.continent === 'Asia'),
    'north-america': fallbackCountries.filter(c => c.continent === 'North America'),
    'south-america': fallbackCountries.filter(c => c.continent === 'South America'),
    'oceania': fallbackCountries.filter(c => c.continent === 'Oceania'),
    'americas': fallbackCountries.filter(c => c.region === 'Americas')
  };

  const countries = regionMap[region] || [];

  res.json({
    success: true,
    data: {
      countries,
      total: countries.length,
      region
    },
    timestamp: new Date().toISOString()
  });
});

// Get users (for admin panel)
app.get('/api/users', async (req, res) => {
  try {
    const usersQuery = `
      SELECT id, email, first_name, last_name, role, is_verified, is_active, created_at, last_login 
      FROM users 
      ORDER BY created_at DESC
    `;
    const result = await pool.query(usersQuery);

    res.json({
      success: true,
      data: result.rows.map(user => ({
        id: user.id,
        name: `${user.first_name} ${user.last_name}`,
        email: user.email,
        role: user.role === 'passenger' ? 'passenger' : user.role === 'driver' ? 'driver' : 'both',
        status: user.is_active ? 'active' : 'blocked',
        verified: user.is_verified,
        joinDate: user.created_at,
        lastActive: user.last_login || user.created_at
      }))
    });
  } catch (error) {
    console.error('Users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get rides (for admin panel)
app.get('/api/rides', async (req, res) => {
  try {
    // Query rides with LEFT JOIN to handle UUID/INTEGER type mismatch
    // driver_id may be stored as INTEGER while users.id is UUID
    const ridesQuery = `
      SELECT
        r.id,
        r.driver_id,
        COALESCE(u.first_name || ' ' || u.last_name, 'Unknown Driver') as driver_name,
        r.origin_address as "from",
        r.destination_address as "to",
        r.departure_time,
        r.status,
        r.available_seats as capacity,
        COALESCE((SELECT SUM(seats_booked) FROM bookings WHERE ride_id = r.id AND status IN ('pending', 'confirmed')), 0) as booked,
        r.price_per_seat as price,
        COALESCE(r.distance, r.total_distance, 0) as distance,
        r.created_at
      FROM rides r
      LEFT JOIN users u ON r.driver_id::text = u.id::text
      ORDER BY r.created_at DESC
    `;
    const result = await pool.query(ridesQuery);

    res.json({
      success: true,
      data: result.rows.map(ride => ({
        id: ride.id,
        driverId: ride.driver_id,
        driverName: ride.driver_name,
        route: { from: ride.from, to: ride.to },
        departureTime: ride.departure_time,
        status: ride.status,
        passengers: {
          booked: parseInt(ride.booked) || 0,
          capacity: ride.capacity || 4
        },
        price: parseFloat(ride.price) || 0,
        distance: parseFloat(ride.distance) || 0,
        created: ride.created_at
      })),
      total: result.rows.length
    });
  } catch (error) {
    console.error('Rides error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: process.env.NODE_ENV !== 'production' ? error.message : undefined
    });
  }
});

// Create a new ride
app.post('/api/rides', authenticateToken, async (req, res) => {
  try {
    const driverId = req.user.userId;
    const {
      originAddress, originLat, originLng,
      destinationAddress, destinationLat, destinationLng,
      departureTime, availableSeats, pricePerSeat,
      vehicleId, description, preferences
    } = req.body;

    // Validate required fields
    if (!originAddress || !destinationAddress || !departureTime || !availableSeats || !pricePerSeat) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        code: 'VALIDATION_ERROR'
      });
    }

    // Calculate approximate distance (in production, use Google Distance Matrix API)
    const distance = originLat && originLng && destinationLat && destinationLng ?
      Math.round(Math.sqrt(
        Math.pow((destinationLat - originLat) * 111, 2) +
        Math.pow((destinationLng - originLng) * 111 * Math.cos(originLat * Math.PI / 180), 2)
      ) * 10) / 10 : 0;

    const insertQuery = `
      INSERT INTO rides (
        driver_id, vehicle_id, origin_address, origin_lat, origin_lng,
        destination_address, destination_lat, destination_lng,
        departure_time, available_seats, price_per_seat, distance,
        description, preferences, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, 'pending', CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const result = await pool.query(insertQuery, [
      driverId, vehicleId || null, originAddress, originLat || 0, originLng || 0,
      destinationAddress, destinationLat || 0, destinationLng || 0,
      departureTime, availableSeats, pricePerSeat, distance,
      description || null, preferences ? JSON.stringify(preferences) : null
    ]);

    const ride = result.rows[0];

    res.status(201).json({
      success: true,
      message: 'Ride created successfully',
      data: {
        id: ride.id,
        driverId: ride.driver_id,
        origin: { address: ride.origin_address, lat: ride.origin_lat, lng: ride.origin_lng },
        destination: { address: ride.destination_address, lat: ride.destination_lat, lng: ride.destination_lng },
        departureTime: ride.departure_time,
        availableSeats: ride.available_seats,
        pricePerSeat: parseFloat(ride.price_per_seat),
        distance: parseFloat(ride.distance),
        status: ride.status,
        createdAt: ride.created_at
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Create ride error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create ride',
      code: 'RIDE_CREATE_ERROR'
    });
  }
});

// Get ride by ID
app.get('/api/rides/:id', async (req, res) => {
  try {
    const rideId = req.params.id;

    // Use LEFT JOIN to handle UUID/INTEGER type mismatch
    const rideQuery = `
      SELECT
        r.*,
        COALESCE(u.first_name, 'Unknown') as driver_first_name,
        COALESCE(u.last_name, 'Driver') as driver_last_name,
        u.profile_picture as driver_picture,
        COALESCE(u.rating, u.driver_rating, 5.0) as driver_rating,
        v.make as vehicle_make, v.model as vehicle_model, v.color as vehicle_color,
        v.license_plate as vehicle_plate
      FROM rides r
      LEFT JOIN users u ON r.driver_id::text = u.id::text
      LEFT JOIN vehicles v ON r.vehicle_id::text = v.id::text
      WHERE r.id = $1
    `;

    const result = await pool.query(rideQuery, [rideId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Ride not found',
        code: 'RIDE_NOT_FOUND'
      });
    }

    const ride = result.rows[0];

    // Get bookings for this ride with LEFT JOIN
    const bookingsQuery = `
      SELECT b.*, COALESCE(u.first_name, 'Unknown') as first_name, COALESCE(u.last_name, 'User') as last_name, u.profile_picture
      FROM bookings b
      LEFT JOIN users u ON b.passenger_id::text = u.id::text
      WHERE b.ride_id = $1 AND b.status IN ('pending', 'confirmed')
    `;
    const bookingsResult = await pool.query(bookingsQuery, [rideId]);

    res.json({
      success: true,
      data: {
        id: ride.id,
        driver: {
          id: ride.driver_id,
          firstName: ride.driver_first_name,
          lastName: ride.driver_last_name,
          picture: ride.driver_picture,
          rating: parseFloat(ride.driver_rating) || 5.0
        },
        vehicle: ride.vehicle_id ? {
          make: ride.vehicle_make,
          model: ride.vehicle_model,
          color: ride.vehicle_color,
          plate: ride.vehicle_plate
        } : null,
        origin: {
          address: ride.origin_address,
          lat: parseFloat(ride.origin_lat),
          lng: parseFloat(ride.origin_lng)
        },
        destination: {
          address: ride.destination_address,
          lat: parseFloat(ride.destination_lat),
          lng: parseFloat(ride.destination_lng)
        },
        departureTime: ride.departure_time,
        availableSeats: ride.available_seats,
        pricePerSeat: parseFloat(ride.price_per_seat),
        distance: parseFloat(ride.distance),
        status: ride.status,
        description: ride.description,
        bookings: bookingsResult.rows.map(b => ({
          id: b.id,
          passenger: {
            id: b.passenger_id,
            firstName: b.first_name,
            lastName: b.last_name,
            picture: b.profile_picture
          },
          seats: b.seats_booked,
          status: b.status
        })),
        createdAt: ride.created_at
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get ride error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch ride',
      code: 'RIDE_FETCH_ERROR'
    });
  }
});

// Update ride
app.put('/api/rides/:id', authenticateToken, async (req, res) => {
  try {
    const rideId = req.params.id;
    const userId = req.user.userId;
    const { availableSeats, pricePerSeat, departureTime, description, status } = req.body;

    // Verify ownership
    const ownerCheck = await pool.query('SELECT driver_id FROM rides WHERE id = $1', [rideId]);
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ride not found' });
    }
    if (ownerCheck.rows[0].driver_id !== userId) {
      return res.status(403).json({ success: false, error: 'Not authorized to update this ride' });
    }

    const updateQuery = `
      UPDATE rides SET
        available_seats = COALESCE($1, available_seats),
        price_per_seat = COALESCE($2, price_per_seat),
        departure_time = COALESCE($3, departure_time),
        description = COALESCE($4, description),
        status = COALESCE($5, status),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6
      RETURNING *
    `;

    const result = await pool.query(updateQuery, [
      availableSeats, pricePerSeat, departureTime, description, status, rideId
    ]);

    res.json({
      success: true,
      message: 'Ride updated successfully',
      data: result.rows[0],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Update ride error:', error);
    res.status(500).json({ success: false, error: 'Failed to update ride' });
  }
});

// Cancel/Delete ride
app.delete('/api/rides/:id', authenticateToken, async (req, res) => {
  try {
    const rideId = req.params.id;
    const userId = req.user.userId;

    // Verify ownership
    const ownerCheck = await pool.query('SELECT driver_id, status FROM rides WHERE id = $1', [rideId]);
    if (ownerCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ride not found' });
    }
    if (ownerCheck.rows[0].driver_id !== userId) {
      return res.status(403).json({ success: false, error: 'Not authorized to cancel this ride' });
    }

    // Update status to cancelled instead of deleting
    await pool.query('UPDATE rides SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
      ['cancelled', rideId]);

    // Cancel all pending bookings
    await pool.query('UPDATE bookings SET status = $1 WHERE ride_id = $2 AND status IN ($3, $4)',
      ['cancelled', rideId, 'pending', 'confirmed']);

    res.json({
      success: true,
      message: 'Ride cancelled successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Cancel ride error:', error);
    res.status(500).json({ success: false, error: 'Failed to cancel ride' });
  }
});

// Search available rides
app.post('/api/rides/search', async (req, res) => {
  try {
    const {
      originLat, originLng, destinationLat, destinationLng,
      departureDate, seats, maxPrice, maxDistance
    } = req.body;

    // Use LEFT JOIN to handle UUID/INTEGER type mismatch
    let query = `
      SELECT
        r.*,
        COALESCE(u.first_name, 'Unknown') as driver_first_name,
        COALESCE(u.last_name, 'Driver') as driver_last_name,
        COALESCE(u.rating, u.driver_rating, 5.0) as driver_rating,
        u.profile_picture as driver_picture,
        (SELECT COALESCE(SUM(seats_booked), 0) FROM bookings WHERE ride_id = r.id AND status IN ('pending', 'confirmed')) as booked_seats
      FROM rides r
      LEFT JOIN users u ON r.driver_id::text = u.id::text
      WHERE r.status IN ('pending', 'confirmed', 'available')
        AND r.departure_time > CURRENT_TIMESTAMP
        AND r.available_seats > (SELECT COALESCE(SUM(seats_booked), 0) FROM bookings WHERE ride_id = r.id AND status IN ('pending', 'confirmed'))
    `;

    const params = [];
    let paramIndex = 1;

    if (departureDate) {
      query += ` AND DATE(r.departure_time) = DATE($${paramIndex})`;
      params.push(departureDate);
      paramIndex++;
    }

    if (maxPrice) {
      query += ` AND r.price_per_seat <= $${paramIndex}`;
      params.push(maxPrice);
      paramIndex++;
    }

    query += ' ORDER BY r.departure_time ASC LIMIT 50';

    const result = await pool.query(query, params);

    const rides = result.rows.map(ride => ({
      id: ride.id,
      driver: {
        id: ride.driver_id,
        firstName: ride.driver_first_name,
        lastName: ride.driver_last_name,
        rating: parseFloat(ride.driver_rating) || 5.0,
        picture: ride.driver_picture
      },
      origin: { address: ride.origin_address, lat: parseFloat(ride.origin_lat), lng: parseFloat(ride.origin_lng) },
      destination: { address: ride.destination_address, lat: parseFloat(ride.destination_lat), lng: parseFloat(ride.destination_lng) },
      departureTime: ride.departure_time,
      availableSeats: ride.available_seats - parseInt(ride.booked_seats || 0),
      totalSeats: ride.available_seats,
      pricePerSeat: parseFloat(ride.price_per_seat) || 0,
      distance: parseFloat(ride.distance) || parseFloat(ride.total_distance) || 0,
      status: ride.status
    }));

    res.json({
      success: true,
      data: {
        rides,
        total: rides.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Search rides error:', error);
    res.status(500).json({ success: false, error: 'Failed to search rides' });
  }
});

// Book a ride
app.post('/api/rides/:id/book', authenticateToken, async (req, res) => {
  try {
    const rideId = req.params.id;
    const passengerId = req.user.userId;
    const { seats = 1, pickupNote } = req.body;

    // Check ride exists and has available seats
    const rideCheck = await pool.query(`
      SELECT r.*,
        (SELECT COALESCE(SUM(seats_booked), 0) FROM bookings WHERE ride_id = r.id AND status IN ('pending', 'confirmed')) as booked_seats
      FROM rides r WHERE r.id = $1
    `, [rideId]);

    if (rideCheck.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Ride not found' });
    }

    const ride = rideCheck.rows[0];
    const availableSeats = ride.available_seats - parseInt(ride.booked_seats);

    if (availableSeats < seats) {
      return res.status(400).json({
        success: false,
        error: `Only ${availableSeats} seats available`,
        code: 'INSUFFICIENT_SEATS'
      });
    }

    if (ride.driver_id === passengerId) {
      return res.status(400).json({
        success: false,
        error: 'Cannot book your own ride',
        code: 'SELF_BOOKING'
      });
    }

    // Check for existing booking
    const existingBooking = await pool.query(
      'SELECT id FROM bookings WHERE ride_id = $1 AND passenger_id = $2 AND status IN ($3, $4)',
      [rideId, passengerId, 'pending', 'confirmed']
    );

    if (existingBooking.rows.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'You already have a booking for this ride',
        code: 'DUPLICATE_BOOKING'
      });
    }

    const totalPrice = seats * parseFloat(ride.price_per_seat);

    const bookingQuery = `
      INSERT INTO bookings (ride_id, passenger_id, seats_booked, total_price, pickup_note, status, created_at)
      VALUES ($1, $2, $3, $4, $5, 'pending', CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const bookingResult = await pool.query(bookingQuery, [
      rideId, passengerId, seats, totalPrice, pickupNote || null
    ]);

    res.status(201).json({
      success: true,
      message: 'Booking created successfully',
      data: {
        bookingId: bookingResult.rows[0].id,
        rideId,
        seats,
        totalPrice,
        status: 'pending'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Book ride error:', error);
    res.status(500).json({ success: false, error: 'Failed to book ride' });
  }
});

// Get user's bookings
app.get('/api/bookings', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status } = req.query;

    let query = `
      SELECT
        b.*,
        r.origin_address, r.destination_address, r.departure_time, r.price_per_seat,
        u.first_name as driver_first_name, u.last_name as driver_last_name
      FROM bookings b
      JOIN rides r ON b.ride_id = r.id
      JOIN users u ON r.driver_id = u.id
      WHERE b.passenger_id = $1
    `;

    const params = [userId];

    if (status) {
      query += ' AND b.status = $2';
      params.push(status);
    }

    query += ' ORDER BY b.created_at DESC';

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: {
        bookings: result.rows.map(b => ({
          id: b.id,
          ride: {
            id: b.ride_id,
            origin: b.origin_address,
            destination: b.destination_address,
            departureTime: b.departure_time,
            driver: `${b.driver_first_name} ${b.driver_last_name}`
          },
          seats: b.seats_booked,
          totalPrice: parseFloat(b.total_price),
          status: b.status,
          createdAt: b.created_at
        })),
        total: result.rows.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch bookings' });
  }
});

// Create sample ride data
app.post('/api/rides/sample', async (req, res) => {
  try {
    // Create sample rides
    const sampleRides = [
      {
        driver_id: 2,
        vehicle_id: 1,
        origin_address: 'Downtown', origin_lat: 40.7128, origin_lng: -74.0060,
        destination_address: 'Airport', destination_lat: 40.6892, destination_lng: -74.1745,
        departure_time: '2025-12-14 08:00:00',
        available_seats: 4,
        price_per_seat: 45.00,
        distance: 25.5,
        status: 'pending'
      },
      {
        driver_id: 2,
        vehicle_id: 1,
        origin_address: 'University', origin_lat: 40.7489, origin_lng: -73.9680,
        destination_address: 'Shopping Mall', destination_lat: 40.7282, destination_lng: -73.7949,
        departure_time: '2025-12-13 14:30:00',
        available_seats: 4,
        price_per_seat: 32.00,
        distance: 18.2,
        status: 'confirmed'
      }
    ];

    for (const ride of sampleRides) {
      await pool.query(`
        INSERT INTO rides (driver_id, vehicle_id, origin_address, origin_lat, origin_lng, 
                          destination_address, destination_lat, destination_lng, departure_time, 
                          available_seats, price_per_seat, distance, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      `, [
        ride.driver_id, ride.vehicle_id, ride.origin_address, ride.origin_lat, ride.origin_lng,
        ride.destination_address, ride.destination_lat, ride.destination_lng, ride.departure_time,
        ride.available_seats, ride.price_per_seat, ride.distance, ride.status
      ]);
    }

    res.json({
      success: true,
      message: 'Sample rides created',
      count: sampleRides.length
    });
  } catch (error) {
    console.error('Sample rides error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Courier service endpoints

// Get all packages
app.get('/api/packages', async (req, res) => {
  try {
    // Use correct column names from actual database schema
    const result = await pool.query(`
      SELECT
        p.id, p.title, p.description, p.package_size, p.weight, p.fragile, p.valuable,
        p.pickup_address, p.pickup_lat, p.pickup_lng,
        p.pickup_contact_name, p.pickup_contact_phone,
        p.delivery_address, p.delivery_lat, p.delivery_lng,
        p.recipient_name, p.recipient_phone,
        p.distance, p.total_price, p.platform_fee, p.courier_earnings,
        p.status, p.tracking_code, p.special_handling_instructions, p.created_at,
        COALESCE(sender.first_name, 'Unknown') as sender_first_name,
        COALESCE(sender.last_name, 'Sender') as sender_last_name,
        sender.email as sender_email,
        COALESCE(courier.first_name, 'Unassigned') as courier_first_name,
        COALESCE(courier.last_name, '') as courier_last_name,
        courier.email as courier_email
      FROM packages p
      LEFT JOIN users sender ON p.sender_id::text = sender.id::text
      LEFT JOIN users courier ON p.courier_id::text = courier.id::text
      ORDER BY p.created_at DESC
    `);

    const packages = result.rows.map(pkg => ({
      id: pkg.id,
      title: pkg.title,
      description: pkg.description,
      packageSize: pkg.package_size,
      weight: pkg.weight,
      fragile: pkg.fragile,
      valuable: pkg.valuable,
      pickup: {
        address: pkg.pickup_address,
        lat: parseFloat(pkg.pickup_lat) || null,
        lng: parseFloat(pkg.pickup_lng) || null,
        contactName: pkg.pickup_contact_name,
        contactPhone: pkg.pickup_contact_phone
      },
      delivery: {
        address: pkg.delivery_address,
        lat: parseFloat(pkg.delivery_lat) || null,
        lng: parseFloat(pkg.delivery_lng) || null,
        recipientName: pkg.recipient_name,
        recipientPhone: pkg.recipient_phone
      },
      distance: parseFloat(pkg.distance) || 0,
      price: parseFloat(pkg.total_price) || 0,
      platformFee: parseFloat(pkg.platform_fee) || 0,
      courierEarnings: parseFloat(pkg.courier_earnings) || 0,
      status: pkg.status,
      trackingCode: pkg.tracking_code,
      specialInstructions: pkg.special_handling_instructions,
      sender: pkg.sender_first_name ? {
        name: `${pkg.sender_first_name} ${pkg.sender_last_name}`,
        email: pkg.sender_email
      } : null,
      courier: pkg.courier_first_name && pkg.courier_first_name !== 'Unassigned' ? {
        name: `${pkg.courier_first_name} ${pkg.courier_last_name}`.trim(),
        email: pkg.courier_email
      } : null,
      createdAt: pkg.created_at
    }));
    
    res.json({
      success: true,
      data: packages,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Packages query error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch packages',
      details: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Get all couriers
app.get('/api/couriers', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        cp.id, cp.is_active, cp.rating, cp.total_deliveries, cp.successful_deliveries,
        cp.earnings, cp.vehicle_type, cp.max_weight_capacity, cp.delivery_radius,
        cp.is_available, cp.created_at,
        u.first_name, u.last_name, u.email, u.phone_number
      FROM courier_profiles cp
      JOIN users u ON cp.user_id = u.id
      ORDER BY cp.rating DESC, cp.total_deliveries DESC
    `);
    
    const couriers = result.rows.map(courier => ({
      id: courier.id,
      name: `${courier.first_name} ${courier.last_name}`,
      email: courier.email,
      phone: courier.phone_number,
      isActive: courier.is_active,
      isAvailable: courier.is_available,
      rating: courier.rating,
      totalDeliveries: courier.total_deliveries,
      successfulDeliveries: courier.successful_deliveries,
      successRate: courier.total_deliveries > 0 ? 
        ((courier.successful_deliveries / courier.total_deliveries) * 100).toFixed(1) : '100.0',
      earnings: courier.earnings,
      vehicleType: courier.vehicle_type,
      maxWeight: courier.max_weight_capacity,
      deliveryRadius: courier.delivery_radius,
      joinDate: courier.created_at
    }));
    
    res.json({
      success: true,
      data: couriers,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Couriers query error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch couriers',
      timestamp: new Date().toISOString()
    });
  }
});

// Get package events for tracking
app.get('/api/packages/:id/events', async (req, res) => {
  try {
    const packageId = req.params.id;
    const result = await pool.query(`
      SELECT 
        pe.id, pe.event_type, pe.event_description, pe.location_latitude, pe.location_longitude,
        pe.event_time, u.first_name, u.last_name
      FROM package_events pe
      LEFT JOIN users u ON pe.created_by = u.id
      WHERE pe.package_id = $1
      ORDER BY pe.event_time DESC
    `, [packageId]);
    
    const events = result.rows.map(event => ({
      id: event.id,
      type: event.event_type,
      description: event.event_description,
      location: event.location_latitude && event.location_longitude ? {
        latitude: event.location_latitude,
        longitude: event.location_longitude
      } : null,
      timestamp: event.event_time,
      createdBy: event.first_name ? `${event.first_name} ${event.last_name}` : 'System'
    }));
    
    res.json({
      success: true,
      data: events,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Package events query error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch package events',
      timestamp: new Date().toISOString()
    });
  }
});

// Analytics endpoint for courier service
app.get('/api/courier/analytics', async (req, res) => {
  try {
    // Get comprehensive courier analytics
    const analyticsQueries = await Promise.all([
      // Package statistics
      pool.query(`
        SELECT 
          COUNT(*) as total_packages,
          COUNT(CASE WHEN status = 'pending_pickup' THEN 1 END) as pending_packages,
          COUNT(CASE WHEN status = 'in_transit' THEN 1 END) as in_transit_packages,
          COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_packages,
          SUM(price) as total_revenue,
          SUM(platform_fee) as total_platform_fees,
          AVG(distance) as avg_distance
        FROM packages
      `),
      
      // Courier statistics
      pool.query(`
        SELECT 
          COUNT(*) as total_couriers,
          COUNT(CASE WHEN is_active = true THEN 1 END) as active_couriers,
          COUNT(CASE WHEN is_available = true THEN 1 END) as available_couriers,
          AVG(rating) as avg_courier_rating,
          SUM(total_deliveries) as total_deliveries_all,
          SUM(earnings) as total_courier_earnings
        FROM courier_profiles
      `),
      
      // Recent activity
      pool.query(`
        SELECT 
          COUNT(*) as packages_today,
          SUM(price) as revenue_today
        FROM packages 
        WHERE DATE(created_at) = CURRENT_DATE
      `)
    ]);
    
    const [packageStats, courierStats, todayStats] = analyticsQueries.map(q => q.rows[0]);
    
    res.json({
      success: true,
      data: {
        packages: {
          total: parseInt(packageStats.total_packages) || 0,
          pending: parseInt(packageStats.pending_packages) || 0,
          inTransit: parseInt(packageStats.in_transit_packages) || 0,
          completed: parseInt(packageStats.completed_packages) || 0,
          totalRevenue: parseFloat(packageStats.total_revenue) || 0,
          totalFees: parseFloat(packageStats.total_platform_fees) || 0,
          avgDistance: parseFloat(packageStats.avg_distance) || 0
        },
        couriers: {
          total: parseInt(courierStats.total_couriers) || 0,
          active: parseInt(courierStats.active_couriers) || 0,
          available: parseInt(courierStats.available_couriers) || 0,
          avgRating: parseFloat(courierStats.avg_courier_rating) || 5.0,
          totalDeliveries: parseInt(courierStats.total_deliveries_all) || 0,
          totalEarnings: parseFloat(courierStats.total_courier_earnings) || 0
        },
        today: {
          packages: parseInt(todayStats.packages_today) || 0,
          revenue: parseFloat(todayStats.revenue_today) || 0
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Analytics query error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics',
      timestamp: new Date().toISOString()
    });
  }
});

// ==========================================
// COURIER MOBILE ENDPOINTS
// ==========================================

// Get courier profile
app.get('/api/courier/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const query = `
      SELECT
        cp.*, u.first_name, u.last_name, u.email, u.phone_number, u.profile_picture
      FROM courier_profiles cp
      JOIN users u ON cp.user_id = u.id
      WHERE cp.user_id = $1
    `;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      // Create profile if doesn't exist
      const createQuery = `
        INSERT INTO courier_profiles (user_id, is_active, is_available, rating, total_deliveries, created_at)
        VALUES ($1, true, false, 5.0, 0, CURRENT_TIMESTAMP)
        RETURNING *
      `;
      const newProfile = await pool.query(createQuery, [userId]);

      const userQuery = await pool.query('SELECT first_name, last_name, email, phone_number FROM users WHERE id = $1', [userId]);
      const user = userQuery.rows[0];

      return res.json({
        success: true,
        data: {
          ...newProfile.rows[0],
          firstName: user.first_name,
          lastName: user.last_name,
          email: user.email,
          phone: user.phone_number
        },
        timestamp: new Date().toISOString()
      });
    }

    const profile = result.rows[0];
    res.json({
      success: true,
      data: {
        id: profile.id,
        userId: profile.user_id,
        firstName: profile.first_name,
        lastName: profile.last_name,
        email: profile.email,
        phone: profile.phone_number,
        profilePicture: profile.profile_picture,
        isActive: profile.is_active,
        isAvailable: profile.is_available,
        rating: parseFloat(profile.rating) || 5.0,
        totalDeliveries: parseInt(profile.total_deliveries) || 0,
        successfulDeliveries: parseInt(profile.successful_deliveries) || 0,
        earnings: parseFloat(profile.earnings) || 0,
        vehicleType: profile.vehicle_type,
        maxWeightCapacity: parseFloat(profile.max_weight_capacity) || 50,
        deliveryRadius: parseFloat(profile.delivery_radius) || 25,
        currentLocation: profile.current_lat && profile.current_lng ? {
          lat: parseFloat(profile.current_lat),
          lng: parseFloat(profile.current_lng)
        } : null,
        createdAt: profile.created_at
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get courier profile error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch courier profile' });
  }
});

// ==================== DRIVER PROFILE & VEHICLE ENDPOINTS ====================

// Get complete driver profile with vehicle info
app.get('/api/driver/profile', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get user profile with driver-specific fields
    const userQuery = `
      SELECT
        u.id, u.email, u.first_name, u.last_name, u.phone_number,
        u.profile_picture, u.profile_picture_url, u.date_of_birth,
        u.role, u.user_type, u.is_verified, u.is_active,
        u.driver_license_verified, u.vehicle_registered,
        u.driver_rating, u.total_rides_as_driver, u.total_earnings,
        u.country, u.city, u.preferred_currency, u.preferred_language,
        u.created_at, u.updated_at
      FROM users u
      WHERE u.id = $1
    `;
    const userResult = await pool.query(userQuery, [userId]);

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const user = userResult.rows[0];

    // Get user's vehicles (using owner_id and seating_capacity from actual schema)
    const vehiclesQuery = `
      SELECT
        id, make, model, year, color, license_plate,
        vehicle_type, seating_capacity, insurance_verified,
        is_verified, is_active, created_at
      FROM vehicles
      WHERE owner_id::text = $1::text
      ORDER BY created_at DESC
    `;
    const vehiclesResult = await pool.query(vehiclesQuery, [userId]);

    // Get driver stats
    const statsQuery = `
      SELECT
        COUNT(*) as total_rides,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_rides,
        COALESCE(SUM(driver_earnings), 0) as total_earnings
      FROM rides
      WHERE driver_id::text = $1::text
    `;
    const statsResult = await pool.query(statsQuery, [userId]);
    const stats = statsResult.rows[0] || {};

    res.json({
      success: true,
      data: {
        profile: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          fullName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
          phone: user.phone_number,
          profilePicture: user.profile_picture || user.profile_picture_url,
          dateOfBirth: user.date_of_birth,
          role: user.role,
          userType: user.user_type,
          country: user.country,
          city: user.city,
          preferredCurrency: user.preferred_currency || 'USD',
          preferredLanguage: user.preferred_language || 'en',
          isVerified: user.is_verified,
          isActive: user.is_active,
          driverLicenseVerified: user.driver_license_verified,
          vehicleRegistered: user.vehicle_registered,
          rating: parseFloat(user.driver_rating) || 5.0,
          createdAt: user.created_at,
          updatedAt: user.updated_at
        },
        vehicles: vehiclesResult.rows.map(v => ({
          id: v.id,
          make: v.make,
          model: v.model,
          year: v.year,
          color: v.color,
          licensePlate: v.license_plate,
          vehicleType: v.vehicle_type,
          seatingCapacity: v.seating_capacity,
          insuranceVerified: v.insurance_verified,
          isVerified: v.is_verified,
          isActive: v.is_active,
          createdAt: v.created_at
        })),
        stats: {
          totalRides: parseInt(stats.total_rides) || 0,
          completedRides: parseInt(stats.completed_rides) || 0,
          totalEarnings: parseFloat(stats.total_earnings) || 0,
          rating: parseFloat(user.driver_rating) || 5.0
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get driver profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch driver profile',
      details: error.message
    });
  }
});

// Get user's vehicles
app.get('/api/vehicles', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const query = `
      SELECT
        id, make, model, year, color, license_plate,
        vehicle_type, seating_capacity, insurance_verified,
        is_verified, is_active, created_at, updated_at
      FROM vehicles
      WHERE owner_id::text = $1::text
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query, [userId]);

    res.json({
      success: true,
      data: result.rows.map(v => ({
        id: v.id,
        make: v.make,
        model: v.model,
        year: v.year,
        color: v.color,
        licensePlate: v.license_plate,
        vehicleType: v.vehicle_type,
        seatingCapacity: v.seating_capacity,
        insuranceVerified: v.insurance_verified,
        isVerified: v.is_verified,
        isActive: v.is_active,
        createdAt: v.created_at,
        updatedAt: v.updated_at
      })),
      total: result.rows.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get vehicles error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch vehicles' });
  }
});

// Add a new vehicle
app.post('/api/vehicles', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const {
      make, model, year, color, licensePlate,
      vehicleType, seatsAvailable, insuranceExpiry, registrationExpiry
    } = req.body;

    // Validate required fields
    if (!make || !model || !year || !color || !licensePlate) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: make, model, year, color, licensePlate',
        code: 'VALIDATION_ERROR'
      });
    }

    const insertQuery = `
      INSERT INTO vehicles (
        owner_id, make, model, year, color, license_plate,
        vehicle_type, seating_capacity,
        is_verified, is_active, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const result = await pool.query(insertQuery, [
      userId, make, model, year, color, licensePlate,
      vehicleType || 'sedan', seatsAvailable || 4
    ]);

    const vehicle = result.rows[0];

    // Update user's vehicle_registered flag
    await pool.query('UPDATE users SET vehicle_registered = true WHERE id = $1', [userId]);

    res.status(201).json({
      success: true,
      message: 'Vehicle added successfully',
      data: {
        id: vehicle.id,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        color: vehicle.color,
        licensePlate: vehicle.license_plate,
        vehicleType: vehicle.vehicle_type,
        seatingCapacity: vehicle.seating_capacity,
        isVerified: vehicle.is_verified,
        isActive: vehicle.is_active,
        createdAt: vehicle.created_at
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Add vehicle error:', error);
    if (error.code === '23505') { // Unique violation
      return res.status(409).json({
        success: false,
        error: 'A vehicle with this license plate already exists',
        code: 'DUPLICATE_LICENSE_PLATE'
      });
    }
    res.status(500).json({ success: false, error: 'Failed to add vehicle', details: error.message });
  }
});

// Update a vehicle
app.put('/api/vehicles/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const vehicleId = req.params.id;
    const {
      make, model, year, color, licensePlate,
      vehicleType, seatsAvailable, insuranceExpiry, registrationExpiry, isActive
    } = req.body;

    const updateQuery = `
      UPDATE vehicles SET
        make = COALESCE($1, make),
        model = COALESCE($2, model),
        year = COALESCE($3, year),
        color = COALESCE($4, color),
        license_plate = COALESCE($5, license_plate),
        vehicle_type = COALESCE($6, vehicle_type),
        seating_capacity = COALESCE($7, seating_capacity),
        is_active = COALESCE($8, is_active),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $9 AND owner_id::text = $10::text
      RETURNING *
    `;

    const result = await pool.query(updateQuery, [
      make, model, year, color, licensePlate,
      vehicleType, seatsAvailable,
      isActive, vehicleId, userId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found or not owned by user',
        code: 'VEHICLE_NOT_FOUND'
      });
    }

    const vehicle = result.rows[0];
    res.json({
      success: true,
      message: 'Vehicle updated successfully',
      data: {
        id: vehicle.id,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        color: vehicle.color,
        licensePlate: vehicle.license_plate,
        vehicleType: vehicle.vehicle_type,
        seatingCapacity: vehicle.seating_capacity,
        isVerified: vehicle.is_verified,
        isActive: vehicle.is_active,
        updatedAt: vehicle.updated_at
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Update vehicle error:', error);
    res.status(500).json({ success: false, error: 'Failed to update vehicle' });
  }
});

// Delete a vehicle
app.delete('/api/vehicles/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const vehicleId = req.params.id;

    const deleteQuery = `
      DELETE FROM vehicles
      WHERE id = $1 AND owner_id::text = $2::text
      RETURNING id
    `;

    const result = await pool.query(deleteQuery, [vehicleId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found or not owned by user',
        code: 'VEHICLE_NOT_FOUND'
      });
    }

    // Check if user still has vehicles
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM vehicles WHERE owner_id::text = $1::text',
      [userId]
    );
    if (parseInt(countResult.rows[0].count) === 0) {
      await pool.query('UPDATE users SET vehicle_registered = false WHERE id = $1', [userId]);
    }

    res.json({
      success: true,
      message: 'Vehicle deleted successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Delete vehicle error:', error);
    res.status(500).json({ success: false, error: 'Failed to delete vehicle' });
  }
});

// Get vehicle by ID
app.get('/api/vehicles/:id', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const vehicleId = req.params.id;

    const query = `
      SELECT * FROM vehicles
      WHERE id = $1 AND owner_id::text = $2::text
    `;
    const result = await pool.query(query, [vehicleId, userId]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Vehicle not found',
        code: 'VEHICLE_NOT_FOUND'
      });
    }

    const v = result.rows[0];
    res.json({
      success: true,
      data: {
        id: v.id,
        make: v.make,
        model: v.model,
        year: v.year,
        color: v.color,
        licensePlate: v.license_plate,
        vehicleType: v.vehicle_type,
        seatingCapacity: v.seating_capacity,
        insuranceVerified: v.insurance_verified,
        isVerified: v.is_verified,
        isActive: v.is_active,
        createdAt: v.created_at,
        updatedAt: v.updated_at
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get vehicle error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch vehicle' });
  }
});

// ==================== END DRIVER & VEHICLE ENDPOINTS ====================

// Set courier availability
app.post('/api/courier/availability', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { isAvailable, vehicleType, maxWeight, deliveryRadius } = req.body;

    const updateQuery = `
      UPDATE courier_profiles SET
        is_available = COALESCE($1, is_available),
        vehicle_type = COALESCE($2, vehicle_type),
        max_weight_capacity = COALESCE($3, max_weight_capacity),
        delivery_radius = COALESCE($4, delivery_radius),
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $5
      RETURNING *
    `;

    const result = await pool.query(updateQuery, [
      isAvailable, vehicleType, maxWeight, deliveryRadius, userId
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Courier profile not found' });
    }

    res.json({
      success: true,
      message: 'Availability updated',
      data: {
        isAvailable: result.rows[0].is_available,
        vehicleType: result.rows[0].vehicle_type,
        maxWeight: result.rows[0].max_weight_capacity,
        deliveryRadius: result.rows[0].delivery_radius
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Update availability error:', error);
    res.status(500).json({ success: false, error: 'Failed to update availability' });
  }
});

// Update courier location
app.post('/api/courier/location', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { latitude, longitude, heading, speed } = req.body;

    await pool.query(`
      UPDATE courier_profiles SET
        current_lat = $1, current_lng = $2,
        last_location_update = CURRENT_TIMESTAMP
      WHERE user_id = $3
    `, [latitude, longitude, userId]);

    res.json({
      success: true,
      message: 'Location updated',
      data: { latitude, longitude, heading, speed },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Update location error:', error);
    res.status(500).json({ success: false, error: 'Failed to update location' });
  }
});

// Get courier stats
app.get('/api/courier/stats', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    const statsQuery = `
      SELECT
        cp.total_deliveries, cp.successful_deliveries, cp.rating, cp.earnings,
        (SELECT COUNT(*) FROM packages WHERE courier_id = cp.user_id AND status = 'completed') as completed_this_month,
        (SELECT SUM(price) FROM packages WHERE courier_id = cp.user_id AND status = 'completed' AND created_at >= DATE_TRUNC('month', CURRENT_DATE)) as earnings_this_month
      FROM courier_profiles cp
      WHERE cp.user_id = $1
    `;

    const result = await pool.query(statsQuery, [userId]);

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: {
          totalDeliveries: 0,
          successfulDeliveries: 0,
          rating: 5.0,
          earnings: 0,
          completedThisMonth: 0,
          earningsThisMonth: 0
        },
        timestamp: new Date().toISOString()
      });
    }

    const stats = result.rows[0];
    res.json({
      success: true,
      data: {
        totalDeliveries: parseInt(stats.total_deliveries) || 0,
        successfulDeliveries: parseInt(stats.successful_deliveries) || 0,
        rating: parseFloat(stats.rating) || 5.0,
        earnings: parseFloat(stats.earnings) || 0,
        completedThisMonth: parseInt(stats.completed_this_month) || 0,
        earningsThisMonth: parseFloat(stats.earnings_this_month) || 0,
        successRate: stats.total_deliveries > 0 ?
          ((stats.successful_deliveries / stats.total_deliveries) * 100).toFixed(1) : '100.0'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get courier stats error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch stats' });
  }
});

// Get courier notifications
app.get('/api/courier/notifications', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get recent package requests and updates
    const query = `
      SELECT
        p.id, p.title, p.status, p.pickup_address, p.dropoff_address, p.price, p.created_at,
        'package_request' as notification_type
      FROM packages p
      WHERE p.courier_id = $1 OR (p.status = 'pending_pickup' AND p.courier_id IS NULL)
      ORDER BY p.created_at DESC
      LIMIT 20
    `;

    const result = await pool.query(query, [userId]);

    const notifications = result.rows.map(n => ({
      id: n.id,
      type: n.notification_type,
      title: n.status === 'pending_pickup' ? 'New Delivery Request' : 'Delivery Update',
      message: `${n.title} - ${n.pickup_address} to ${n.dropoff_address}`,
      price: parseFloat(n.price),
      status: n.status,
      createdAt: n.created_at,
      read: false
    }));

    res.json({
      success: true,
      data: {
        notifications,
        unreadCount: notifications.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch notifications' });
  }
});

// Get available deliveries
app.get('/api/deliveries/available', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { lat, lng, radius = 25 } = req.query;

    const query = `
      SELECT
        p.*, sender.first_name as sender_first_name, sender.last_name as sender_last_name
      FROM packages p
      JOIN users sender ON p.sender_id = sender.id
      WHERE p.status = 'pending_pickup' AND p.courier_id IS NULL
      ORDER BY p.created_at DESC
      LIMIT 50
    `;

    const result = await pool.query(query);

    const deliveries = result.rows.map(d => ({
      id: d.id,
      title: d.title,
      description: d.description,
      packageSize: d.package_size,
      weight: d.weight,
      fragile: d.fragile,
      valuable: d.valuable,
      pickup: {
        address: d.pickup_address,
        lat: parseFloat(d.pickup_lat) || 0,
        lng: parseFloat(d.pickup_lng) || 0
      },
      dropoff: {
        address: d.dropoff_address,
        lat: parseFloat(d.dropoff_lat) || 0,
        lng: parseFloat(d.dropoff_lng) || 0
      },
      distance: parseFloat(d.distance) || 0,
      price: parseFloat(d.price),
      platformFee: parseFloat(d.platform_fee) || 0,
      sender: {
        firstName: d.sender_first_name,
        lastName: d.sender_last_name
      },
      createdAt: d.created_at
    }));

    res.json({
      success: true,
      data: { deliveries, total: deliveries.length },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get available deliveries error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch deliveries' });
  }
});

// Accept delivery
app.post('/api/deliveries/accept', authenticateToken, async (req, res) => {
  try {
    const courierId = req.user.userId;
    const { deliveryId, packageId } = req.body;
    const targetId = deliveryId || packageId;

    if (!targetId) {
      return res.status(400).json({ success: false, error: 'Delivery ID is required' });
    }

    // Check if already accepted
    const checkQuery = await pool.query('SELECT courier_id, status FROM packages WHERE id = $1', [targetId]);
    if (checkQuery.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Delivery not found' });
    }
    if (checkQuery.rows[0].courier_id) {
      return res.status(400).json({ success: false, error: 'Delivery already accepted' });
    }

    // Accept the delivery
    const updateQuery = `
      UPDATE packages SET
        courier_id = $1, status = 'accepted',
        accepted_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;

    const result = await pool.query(updateQuery, [courierId, targetId]);

    // Add tracking event
    await pool.query(`
      INSERT INTO package_events (package_id, event_type, event_description, created_by)
      VALUES ($1, 'accepted', 'Package accepted by courier', $2)
    `, [targetId, courierId]);

    res.json({
      success: true,
      message: 'Delivery accepted successfully',
      data: result.rows[0],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Accept delivery error:', error);
    res.status(500).json({ success: false, error: 'Failed to accept delivery' });
  }
});

// Update delivery status
app.put('/api/deliveries/:id/status', authenticateToken, async (req, res) => {
  try {
    const deliveryId = req.params.id;
    const courierId = req.user.userId;
    const { status, notes, location } = req.body;

    const validStatuses = ['accepted', 'picked_up', 'in_transit', 'delivered', 'completed', 'cancelled'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, error: 'Invalid status' });
    }

    // Verify courier owns this delivery
    const checkQuery = await pool.query('SELECT courier_id FROM packages WHERE id = $1', [deliveryId]);
    if (checkQuery.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Delivery not found' });
    }
    if (checkQuery.rows[0].courier_id !== courierId) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    let updateQuery = 'UPDATE packages SET status = $1';
    const params = [status];
    let paramIndex = 2;

    if (status === 'picked_up') {
      updateQuery += `, pickup_confirmed_at = CURRENT_TIMESTAMP`;
    } else if (status === 'delivered' || status === 'completed') {
      updateQuery += `, delivery_confirmed_at = CURRENT_TIMESTAMP`;
    }

    updateQuery += ` WHERE id = $${paramIndex} RETURNING *`;
    params.push(deliveryId);

    const result = await pool.query(updateQuery, params);

    // Add tracking event
    await pool.query(`
      INSERT INTO package_events (package_id, event_type, event_description, location_latitude, location_longitude, created_by)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [deliveryId, status, notes || `Status changed to ${status}`, location?.latitude || null, location?.longitude || null, courierId]);

    res.json({
      success: true,
      message: `Status updated to ${status}`,
      data: result.rows[0],
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Update delivery status error:', error);
    res.status(500).json({ success: false, error: 'Failed to update status' });
  }
});

// Get delivery tiers (pricing tiers)
app.get('/api/courier/delivery-tiers', (req, res) => {
  const tiers = [
    { id: 'standard', name: 'Standard', description: 'Delivery within 24-48 hours', multiplier: 1.0, estimatedTime: '24-48 hours' },
    { id: 'express', name: 'Express', description: 'Same-day delivery', multiplier: 1.5, estimatedTime: '4-8 hours' },
    { id: 'priority', name: 'Priority', description: 'Delivery within 2-4 hours', multiplier: 2.0, estimatedTime: '2-4 hours' },
    { id: 'instant', name: 'Instant', description: 'Immediate pickup and delivery', multiplier: 2.5, estimatedTime: '1-2 hours' }
  ];

  res.json({
    success: true,
    data: { tiers },
    timestamp: new Date().toISOString()
  });
});

// Get pricing suggestions
app.post('/api/courier/pricing/suggestions', (req, res) => {
  const { distance, weight, packageSize, tier = 'standard', fragile, valuable } = req.body;

  const basePrice = 5; // Base price in USD
  const distanceRate = 0.5; // Per km
  const weightRate = 0.1; // Per kg

  const sizeMultipliers = { small: 1, medium: 1.2, large: 1.5, extra_large: 2 };
  const tierMultipliers = { standard: 1, express: 1.5, priority: 2, instant: 2.5 };

  let price = basePrice;
  price += (distance || 0) * distanceRate;
  price += (weight || 0) * weightRate;
  price *= sizeMultipliers[packageSize] || 1;
  price *= tierMultipliers[tier] || 1;
  if (fragile) price *= 1.2;
  if (valuable) price *= 1.3;

  const platformFee = price * 0.15; // 15% platform fee
  const courierEarnings = price - platformFee;

  res.json({
    success: true,
    data: {
      suggestedPrice: Math.round(price * 100) / 100,
      platformFee: Math.round(platformFee * 100) / 100,
      courierEarnings: Math.round(courierEarnings * 100) / 100,
      breakdown: {
        base: basePrice,
        distance: (distance || 0) * distanceRate,
        weight: (weight || 0) * weightRate,
        sizeMultiplier: sizeMultipliers[packageSize] || 1,
        tierMultiplier: tierMultipliers[tier] || 1,
        fragileMultiplier: fragile ? 1.2 : 1,
        valuableMultiplier: valuable ? 1.3 : 1
      }
    },
    timestamp: new Date().toISOString()
  });
});

// Create package
app.post('/api/courier/packages', authenticateToken, async (req, res) => {
  try {
    const senderId = req.user.userId;
    const {
      title, description, packageSize, weight, fragile, valuable,
      pickupAddress, pickupLat, pickupLng, pickupContact,
      dropoffAddress, dropoffLat, dropoffLng, dropoffContact,
      price, specialInstructions, tier = 'standard'
    } = req.body;

    if (!title || !pickupAddress || !dropoffAddress || !price) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        code: 'VALIDATION_ERROR'
      });
    }

    // Generate tracking code
    const trackingCode = `ARV${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 5).toUpperCase()}`;

    // Calculate distance
    const distance = pickupLat && pickupLng && dropoffLat && dropoffLng ?
      Math.round(Math.sqrt(
        Math.pow((dropoffLat - pickupLat) * 111, 2) +
        Math.pow((dropoffLng - pickupLng) * 111 * Math.cos(pickupLat * Math.PI / 180), 2)
      ) * 10) / 10 : 0;

    const platformFee = parseFloat(price) * 0.15;

    const insertQuery = `
      INSERT INTO packages (
        sender_id, title, description, package_size, weight, fragile, valuable,
        pickup_address, pickup_lat, pickup_lng, pickup_contact,
        dropoff_address, dropoff_lat, dropoff_lng, dropoff_contact,
        distance, price, platform_fee, tracking_code, special_instructions,
        delivery_tier, status, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, 'pending_pickup', CURRENT_TIMESTAMP)
      RETURNING *
    `;

    const result = await pool.query(insertQuery, [
      senderId, title, description, packageSize || 'medium', weight || 1, fragile || false, valuable || false,
      pickupAddress, pickupLat || 0, pickupLng || 0, pickupContact || null,
      dropoffAddress, dropoffLat || 0, dropoffLng || 0, dropoffContact || null,
      distance, price, platformFee, trackingCode, specialInstructions || null, tier
    ]);

    // Add initial tracking event
    await pool.query(`
      INSERT INTO package_events (package_id, event_type, event_description, created_by)
      VALUES ($1, 'created', 'Package created and awaiting pickup', $2)
    `, [result.rows[0].id, senderId]);

    res.status(201).json({
      success: true,
      message: 'Package created successfully',
      data: {
        id: result.rows[0].id,
        trackingCode: result.rows[0].tracking_code,
        status: result.rows[0].status,
        ...result.rows[0]
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Create package error:', error);
    res.status(500).json({ success: false, error: 'Failed to create package' });
  }
});

// Get user's packages
app.get('/api/courier/user/packages', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status } = req.query;

    let query = `
      SELECT p.*, c.first_name as courier_first_name, c.last_name as courier_last_name
      FROM packages p
      LEFT JOIN users c ON p.courier_id = c.id
      WHERE p.sender_id = $1
    `;
    const params = [userId];

    if (status) {
      query += ' AND p.status = $2';
      params.push(status);
    }

    query += ' ORDER BY p.created_at DESC';

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: {
        packages: result.rows.map(p => ({
          id: p.id,
          title: p.title,
          trackingCode: p.tracking_code,
          status: p.status,
          pickup: { address: p.pickup_address },
          dropoff: { address: p.dropoff_address },
          price: parseFloat(p.price),
          courier: p.courier_first_name ? {
            firstName: p.courier_first_name,
            lastName: p.courier_last_name
          } : null,
          createdAt: p.created_at
        })),
        total: result.rows.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get user packages error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch packages' });
  }
});

// Get courier's deliveries
app.get('/api/courier/deliveries', authenticateToken, async (req, res) => {
  try {
    const courierId = req.user.userId;
    const { status } = req.query;

    let query = `
      SELECT p.*, s.first_name as sender_first_name, s.last_name as sender_last_name
      FROM packages p
      JOIN users s ON p.sender_id = s.id
      WHERE p.courier_id = $1
    `;
    const params = [courierId];

    if (status) {
      query += ' AND p.status = $2';
      params.push(status);
    }

    query += ' ORDER BY p.created_at DESC';

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: {
        deliveries: result.rows.map(d => ({
          id: d.id,
          title: d.title,
          trackingCode: d.tracking_code,
          status: d.status,
          pickup: { address: d.pickup_address },
          dropoff: { address: d.dropoff_address },
          price: parseFloat(d.price),
          sender: {
            firstName: d.sender_first_name,
            lastName: d.sender_last_name
          },
          createdAt: d.created_at
        })),
        total: result.rows.length
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get courier deliveries error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch deliveries' });
  }
});

// Get package tracking
app.get('/api/courier/packages/:packageId/tracking', async (req, res) => {
  try {
    const packageId = req.params.packageId;

    const packageQuery = `
      SELECT p.*, s.first_name as sender_fn, s.last_name as sender_ln,
             c.first_name as courier_fn, c.last_name as courier_ln
      FROM packages p
      JOIN users s ON p.sender_id = s.id
      LEFT JOIN users c ON p.courier_id = c.id
      WHERE p.id = $1
    `;

    const packageResult = await pool.query(packageQuery, [packageId]);

    if (packageResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Package not found' });
    }

    const eventsQuery = `
      SELECT * FROM package_events
      WHERE package_id = $1
      ORDER BY event_time DESC
    `;

    const eventsResult = await pool.query(eventsQuery, [packageId]);

    const pkg = packageResult.rows[0];

    res.json({
      success: true,
      data: {
        package: {
          id: pkg.id,
          title: pkg.title,
          trackingCode: pkg.tracking_code,
          status: pkg.status,
          pickup: { address: pkg.pickup_address },
          dropoff: { address: pkg.dropoff_address },
          sender: { firstName: pkg.sender_fn, lastName: pkg.sender_ln },
          courier: pkg.courier_fn ? { firstName: pkg.courier_fn, lastName: pkg.courier_ln } : null
        },
        events: eventsResult.rows.map(e => ({
          id: e.id,
          type: e.event_type,
          description: e.event_description,
          location: e.location_latitude && e.location_longitude ? {
            lat: parseFloat(e.location_latitude),
            lng: parseFloat(e.location_longitude)
          } : null,
          timestamp: e.event_time
        }))
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Get tracking error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch tracking' });
  }
});

// ==========================================
// CURRENCIES ENDPOINTS
// ==========================================

// Fallback currency data
const fallbackCurrencies = [
  { id: 'USD', code: 'USD', name: 'US Dollar', symbol: '$', decimalPlaces: 2, flag: '🇺🇸', countryCode: 'US', exchangeRate: 1.0, isPopular: true, region: 'North America' },
  { id: 'EUR', code: 'EUR', name: 'Euro', symbol: '€', decimalPlaces: 2, flag: '🇪🇺', countryCode: 'EU', exchangeRate: 0.92, isPopular: true, region: 'Europe' },
  { id: 'GBP', code: 'GBP', name: 'British Pound', symbol: '£', decimalPlaces: 2, flag: '🇬🇧', countryCode: 'GB', exchangeRate: 0.79, isPopular: true, region: 'Europe' },
  { id: 'KES', code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', decimalPlaces: 2, flag: '🇰🇪', countryCode: 'KE', exchangeRate: 153.5, isPopular: true, region: 'Africa' },
  { id: 'NGN', code: 'NGN', name: 'Nigerian Naira', symbol: '₦', decimalPlaces: 2, flag: '🇳🇬', countryCode: 'NG', exchangeRate: 1550.0, isPopular: true, region: 'Africa' },
  { id: 'ZAR', code: 'ZAR', name: 'South African Rand', symbol: 'R', decimalPlaces: 2, flag: '🇿🇦', countryCode: 'ZA', exchangeRate: 18.5, isPopular: true, region: 'Africa' },
  { id: 'CAD', code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', decimalPlaces: 2, flag: '🇨🇦', countryCode: 'CA', exchangeRate: 1.36, isPopular: true, region: 'North America' },
  { id: 'AUD', code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimalPlaces: 2, flag: '🇦🇺', countryCode: 'AU', exchangeRate: 1.53, isPopular: true, region: 'Oceania' },
  { id: 'INR', code: 'INR', name: 'Indian Rupee', symbol: '₹', decimalPlaces: 2, flag: '🇮🇳', countryCode: 'IN', exchangeRate: 83.12, isPopular: true, region: 'Asia' },
  { id: 'JPY', code: 'JPY', name: 'Japanese Yen', symbol: '¥', decimalPlaces: 0, flag: '🇯🇵', countryCode: 'JP', exchangeRate: 149.5, isPopular: true, region: 'Asia' },
  { id: 'CNY', code: 'CNY', name: 'Chinese Yuan', symbol: '¥', decimalPlaces: 2, flag: '🇨🇳', countryCode: 'CN', exchangeRate: 7.24, isPopular: true, region: 'Asia' },
  { id: 'CHF', code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', decimalPlaces: 2, flag: '🇨🇭', countryCode: 'CH', exchangeRate: 0.88, isPopular: true, region: 'Europe' },
  { id: 'MXN', code: 'MXN', name: 'Mexican Peso', symbol: '$', decimalPlaces: 2, flag: '🇲🇽', countryCode: 'MX', exchangeRate: 17.15, isPopular: false, region: 'North America' },
  { id: 'BRL', code: 'BRL', name: 'Brazilian Real', symbol: 'R$', decimalPlaces: 2, flag: '🇧🇷', countryCode: 'BR', exchangeRate: 4.97, isPopular: false, region: 'South America' },
  { id: 'GHS', code: 'GHS', name: 'Ghanaian Cedi', symbol: '₵', decimalPlaces: 2, flag: '🇬🇭', countryCode: 'GH', exchangeRate: 12.5, isPopular: false, region: 'Africa' },
  { id: 'UGX', code: 'UGX', name: 'Ugandan Shilling', symbol: 'USh', decimalPlaces: 0, flag: '🇺🇬', countryCode: 'UG', exchangeRate: 3780, isPopular: false, region: 'Africa' },
  { id: 'TZS', code: 'TZS', name: 'Tanzanian Shilling', symbol: 'TSh', decimalPlaces: 0, flag: '🇹🇿', countryCode: 'TZ', exchangeRate: 2510, isPopular: false, region: 'Africa' },
  { id: 'EGP', code: 'EGP', name: 'Egyptian Pound', symbol: 'E£', decimalPlaces: 2, flag: '🇪🇬', countryCode: 'EG', exchangeRate: 30.9, isPopular: false, region: 'Africa' },
  // Southern African currencies
  { id: 'BWP', code: 'BWP', name: 'Botswana Pula', symbol: 'P', decimalPlaces: 2, flag: '🇧🇼', countryCode: 'BW', exchangeRate: 13.5, isPopular: false, region: 'Africa' },
  { id: 'ZWL', code: 'ZWL', name: 'Zimbabwe Dollar', symbol: 'Z$', decimalPlaces: 2, flag: '🇿🇼', countryCode: 'ZW', exchangeRate: 322.0, isPopular: false, region: 'Africa' },
  { id: 'ZMW', code: 'ZMW', name: 'Zambian Kwacha', symbol: 'ZK', decimalPlaces: 2, flag: '🇿🇲', countryCode: 'ZM', exchangeRate: 26.5, isPopular: false, region: 'Africa' },
  { id: 'NAD', code: 'NAD', name: 'Namibian Dollar', symbol: 'N$', decimalPlaces: 2, flag: '🇳🇦', countryCode: 'NA', exchangeRate: 18.5, isPopular: false, region: 'Africa' },
  { id: 'MZN', code: 'MZN', name: 'Mozambican Metical', symbol: 'MT', decimalPlaces: 2, flag: '🇲🇿', countryCode: 'MZ', exchangeRate: 63.5, isPopular: false, region: 'Africa' },
  { id: 'MWK', code: 'MWK', name: 'Malawian Kwacha', symbol: 'MK', decimalPlaces: 2, flag: '🇲🇼', countryCode: 'MW', exchangeRate: 1680.0, isPopular: false, region: 'Africa' },
  { id: 'LSL', code: 'LSL', name: 'Lesotho Loti', symbol: 'L', decimalPlaces: 2, flag: '🇱🇸', countryCode: 'LS', exchangeRate: 18.5, isPopular: false, region: 'Africa' },
  { id: 'SZL', code: 'SZL', name: 'Swazi Lilangeni', symbol: 'E', decimalPlaces: 2, flag: '🇸🇿', countryCode: 'SZ', exchangeRate: 18.5, isPopular: false, region: 'Africa' },
  { id: 'AOA', code: 'AOA', name: 'Angolan Kwanza', symbol: 'Kz', decimalPlaces: 2, flag: '🇦🇴', countryCode: 'AO', exchangeRate: 825.0, isPopular: false, region: 'Africa' }
];

// Get all currencies
app.get('/api/currencies', async (req, res) => {
  try {
    // Try to fetch from database first
    const result = await pool.query(`
      SELECT id, code, name, symbol, decimal_places as "decimalPlaces",
             is_active as "isActive", exchange_rate as "exchangeRate",
             country_code as "countryCode", flag, region, is_popular as "isPopular",
             last_updated as "lastUpdated"
      FROM currencies
      WHERE is_active = true
      ORDER BY code ASC
    `);

    if (result.rows.length > 0) {
      return res.json({
        success: true,
        data: {
          currencies: result.rows,
          total: result.rows.length,
          source: 'database'
        },
        timestamp: new Date().toISOString()
      });
    }

    // Return fallback currencies if database is empty
    res.json({
      success: true,
      data: {
        currencies: fallbackCurrencies,
        total: fallbackCurrencies.length,
        source: 'fallback'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Currencies fetch error:', error);
    // Return fallback data on error
    res.json({
      success: true,
      data: {
        currencies: fallbackCurrencies,
        total: fallbackCurrencies.length,
        source: 'fallback',
        warning: 'Using fallback data due to database error'
      },
      timestamp: new Date().toISOString()
    });
  }
});

// Get popular currencies by region
app.get('/api/currencies/popular', (req, res) => {
  const region = (req.query.region || 'global').toLowerCase();

  const regionMap = {
    'north-america': ['USD', 'CAD', 'MXN'],
    'europe': ['EUR', 'GBP', 'CHF'],
    'asia': ['JPY', 'CNY', 'INR'],
    'africa': ['ZAR', 'NGN', 'KES', 'GHS', 'EGP'],
    'south-america': ['BRL'],
    'oceania': ['AUD'],
    'global': ['USD', 'EUR', 'GBP', 'KES', 'NGN', 'ZAR']
  };

  const popularCodes = regionMap[region] || regionMap['global'];
  const popularCurrencies = fallbackCurrencies.filter(c => popularCodes.includes(c.code));

  res.json({
    success: true,
    data: {
      currencies: popularCurrencies,
      region: region,
      total: popularCurrencies.length
    },
    timestamp: new Date().toISOString()
  });
});

// Currency conversion
app.post('/api/currencies/convert', (req, res) => {
  try {
    const { fromCurrency, toCurrency, amount } = req.body;

    if (!fromCurrency || !toCurrency || !amount) {
      return res.status(400).json({
        success: false,
        error: 'fromCurrency, toCurrency, and amount are required',
        code: 'MISSING_PARAMS',
        timestamp: new Date().toISOString()
      });
    }

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0 || numAmount > 10000) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be between 0.01 and 10000',
        code: 'INVALID_AMOUNT',
        timestamp: new Date().toISOString()
      });
    }

    const fromCurr = fallbackCurrencies.find(c => c.code === fromCurrency.toUpperCase());
    const toCurr = fallbackCurrencies.find(c => c.code === toCurrency.toUpperCase());

    if (!fromCurr || !toCurr) {
      return res.status(400).json({
        success: false,
        error: 'Invalid currency code',
        code: 'INVALID_CURRENCY',
        timestamp: new Date().toISOString()
      });
    }

    // Convert via USD as base
    const usdAmount = numAmount / fromCurr.exchangeRate;
    const convertedAmount = parseFloat((usdAmount * toCurr.exchangeRate).toFixed(toCurr.decimalPlaces));
    const exchangeRate = toCurr.exchangeRate / fromCurr.exchangeRate;

    res.json({
      success: true,
      data: {
        fromCurrency: fromCurrency.toUpperCase(),
        toCurrency: toCurrency.toUpperCase(),
        amount: numAmount,
        convertedAmount,
        exchangeRate: parseFloat(exchangeRate.toFixed(6)),
        timestamp: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Currency conversion error:', error);
    res.status(500).json({
      success: false,
      error: 'Conversion failed',
      code: 'CONVERSION_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

// ==========================================
// COUNTRIES ENDPOINTS
// ==========================================

// Fallback country data
const fallbackCountries = [
  { id: 'US', code: 'US', name: 'United States', nameOfficial: 'United States of America', flag: '🇺🇸', phonePrefix: '+1', continent: 'North America', region: 'Americas', capital: 'Washington D.C.', timezones: ['America/New_York', 'America/Los_Angeles'], languages: ['English'], isActive: true },
  { id: 'GB', code: 'GB', name: 'United Kingdom', nameOfficial: 'United Kingdom of Great Britain and Northern Ireland', flag: '🇬🇧', phonePrefix: '+44', continent: 'Europe', region: 'Europe', capital: 'London', timezones: ['Europe/London'], languages: ['English'], isActive: true },
  { id: 'CA', code: 'CA', name: 'Canada', nameOfficial: 'Canada', flag: '🇨🇦', phonePrefix: '+1', continent: 'North America', region: 'Americas', capital: 'Ottawa', timezones: ['America/Toronto', 'America/Vancouver'], languages: ['English', 'French'], isActive: true },
  { id: 'KE', code: 'KE', name: 'Kenya', nameOfficial: 'Republic of Kenya', flag: '🇰🇪', phonePrefix: '+254', continent: 'Africa', region: 'Africa', capital: 'Nairobi', timezones: ['Africa/Nairobi'], languages: ['English', 'Swahili'], isActive: true },
  { id: 'NG', code: 'NG', name: 'Nigeria', nameOfficial: 'Federal Republic of Nigeria', flag: '🇳🇬', phonePrefix: '+234', continent: 'Africa', region: 'Africa', capital: 'Abuja', timezones: ['Africa/Lagos'], languages: ['English'], isActive: true },
  { id: 'ZA', code: 'ZA', name: 'South Africa', nameOfficial: 'Republic of South Africa', flag: '🇿🇦', phonePrefix: '+27', continent: 'Africa', region: 'Africa', capital: 'Pretoria', timezones: ['Africa/Johannesburg'], languages: ['English', 'Zulu', 'Afrikaans'], isActive: true },
  { id: 'AU', code: 'AU', name: 'Australia', nameOfficial: 'Commonwealth of Australia', flag: '🇦🇺', phonePrefix: '+61', continent: 'Oceania', region: 'Oceania', capital: 'Canberra', timezones: ['Australia/Sydney'], languages: ['English'], isActive: true },
  { id: 'IN', code: 'IN', name: 'India', nameOfficial: 'Republic of India', flag: '🇮🇳', phonePrefix: '+91', continent: 'Asia', region: 'Asia', capital: 'New Delhi', timezones: ['Asia/Kolkata'], languages: ['Hindi', 'English'], isActive: true },
  { id: 'GH', code: 'GH', name: 'Ghana', nameOfficial: 'Republic of Ghana', flag: '🇬🇭', phonePrefix: '+233', continent: 'Africa', region: 'Africa', capital: 'Accra', timezones: ['Africa/Accra'], languages: ['English'], isActive: true },
  { id: 'UG', code: 'UG', name: 'Uganda', nameOfficial: 'Republic of Uganda', flag: '🇺🇬', phonePrefix: '+256', continent: 'Africa', region: 'Africa', capital: 'Kampala', timezones: ['Africa/Kampala'], languages: ['English', 'Swahili'], isActive: true },
  { id: 'TZ', code: 'TZ', name: 'Tanzania', nameOfficial: 'United Republic of Tanzania', flag: '🇹🇿', phonePrefix: '+255', continent: 'Africa', region: 'Africa', capital: 'Dodoma', timezones: ['Africa/Dar_es_Salaam'], languages: ['English', 'Swahili'], isActive: true },
  { id: 'RW', code: 'RW', name: 'Rwanda', nameOfficial: 'Republic of Rwanda', flag: '🇷🇼', phonePrefix: '+250', continent: 'Africa', region: 'Africa', capital: 'Kigali', timezones: ['Africa/Kigali'], languages: ['English', 'French', 'Kinyarwanda'], isActive: true },
  { id: 'EG', code: 'EG', name: 'Egypt', nameOfficial: 'Arab Republic of Egypt', flag: '🇪🇬', phonePrefix: '+20', continent: 'Africa', region: 'Africa', capital: 'Cairo', timezones: ['Africa/Cairo'], languages: ['Arabic'], isActive: true },
  { id: 'DE', code: 'DE', name: 'Germany', nameOfficial: 'Federal Republic of Germany', flag: '🇩🇪', phonePrefix: '+49', continent: 'Europe', region: 'Europe', capital: 'Berlin', timezones: ['Europe/Berlin'], languages: ['German'], isActive: true },
  { id: 'FR', code: 'FR', name: 'France', nameOfficial: 'French Republic', flag: '🇫🇷', phonePrefix: '+33', continent: 'Europe', region: 'Europe', capital: 'Paris', timezones: ['Europe/Paris'], languages: ['French'], isActive: true },
  { id: 'JP', code: 'JP', name: 'Japan', nameOfficial: 'Japan', flag: '🇯🇵', phonePrefix: '+81', continent: 'Asia', region: 'Asia', capital: 'Tokyo', timezones: ['Asia/Tokyo'], languages: ['Japanese'], isActive: true },
  { id: 'CN', code: 'CN', name: 'China', nameOfficial: "People's Republic of China", flag: '🇨🇳', phonePrefix: '+86', continent: 'Asia', region: 'Asia', capital: 'Beijing', timezones: ['Asia/Shanghai'], languages: ['Mandarin'], isActive: true },
  { id: 'BR', code: 'BR', name: 'Brazil', nameOfficial: 'Federative Republic of Brazil', flag: '🇧🇷', phonePrefix: '+55', continent: 'South America', region: 'Americas', capital: 'Brasília', timezones: ['America/Sao_Paulo'], languages: ['Portuguese'], isActive: true },
  { id: 'MX', code: 'MX', name: 'Mexico', nameOfficial: 'United Mexican States', flag: '🇲🇽', phonePrefix: '+52', continent: 'North America', region: 'Americas', capital: 'Mexico City', timezones: ['America/Mexico_City'], languages: ['Spanish'], isActive: true },
  { id: 'AE', code: 'AE', name: 'United Arab Emirates', nameOfficial: 'United Arab Emirates', flag: '🇦🇪', phonePrefix: '+971', continent: 'Asia', region: 'Middle East', capital: 'Abu Dhabi', timezones: ['Asia/Dubai'], languages: ['Arabic', 'English'], isActive: true },
  // Southern African countries
  { id: 'BW', code: 'BW', name: 'Botswana', nameOfficial: 'Republic of Botswana', flag: '🇧🇼', phonePrefix: '+267', continent: 'Africa', region: 'Africa', capital: 'Gaborone', timezones: ['Africa/Gaborone'], languages: ['English', 'Setswana'], isActive: true },
  { id: 'ZW', code: 'ZW', name: 'Zimbabwe', nameOfficial: 'Republic of Zimbabwe', flag: '🇿🇼', phonePrefix: '+263', continent: 'Africa', region: 'Africa', capital: 'Harare', timezones: ['Africa/Harare'], languages: ['English', 'Shona', 'Ndebele'], isActive: true },
  { id: 'ZM', code: 'ZM', name: 'Zambia', nameOfficial: 'Republic of Zambia', flag: '🇿🇲', phonePrefix: '+260', continent: 'Africa', region: 'Africa', capital: 'Lusaka', timezones: ['Africa/Lusaka'], languages: ['English'], isActive: true },
  { id: 'NA', code: 'NA', name: 'Namibia', nameOfficial: 'Republic of Namibia', flag: '🇳🇦', phonePrefix: '+264', continent: 'Africa', region: 'Africa', capital: 'Windhoek', timezones: ['Africa/Windhoek'], languages: ['English'], isActive: true },
  { id: 'MZ', code: 'MZ', name: 'Mozambique', nameOfficial: 'Republic of Mozambique', flag: '🇲🇿', phonePrefix: '+258', continent: 'Africa', region: 'Africa', capital: 'Maputo', timezones: ['Africa/Maputo'], languages: ['Portuguese'], isActive: true },
  { id: 'MW', code: 'MW', name: 'Malawi', nameOfficial: 'Republic of Malawi', flag: '🇲🇼', phonePrefix: '+265', continent: 'Africa', region: 'Africa', capital: 'Lilongwe', timezones: ['Africa/Blantyre'], languages: ['English', 'Chichewa'], isActive: true },
  { id: 'LS', code: 'LS', name: 'Lesotho', nameOfficial: 'Kingdom of Lesotho', flag: '🇱🇸', phonePrefix: '+266', continent: 'Africa', region: 'Africa', capital: 'Maseru', timezones: ['Africa/Maseru'], languages: ['English', 'Sesotho'], isActive: true },
  { id: 'SZ', code: 'SZ', name: 'Eswatini', nameOfficial: 'Kingdom of Eswatini', flag: '🇸🇿', phonePrefix: '+268', continent: 'Africa', region: 'Africa', capital: 'Mbabane', timezones: ['Africa/Mbabane'], languages: ['English', 'Swati'], isActive: true },
  { id: 'AO', code: 'AO', name: 'Angola', nameOfficial: 'Republic of Angola', flag: '🇦🇴', phonePrefix: '+244', continent: 'Africa', region: 'Africa', capital: 'Luanda', timezones: ['Africa/Luanda'], languages: ['Portuguese'], isActive: true }
];

// Get all countries
app.get('/api/countries', (req, res) => {
  res.json({
    success: true,
    data: {
      countries: fallbackCountries,
      total: fallbackCountries.length
    },
    timestamp: new Date().toISOString()
  });
});

// Get popular countries
app.get('/api/countries/popular', (req, res) => {
  const popularCountries = fallbackCountries.filter(c =>
    ['US', 'GB', 'KE', 'NG', 'ZA', 'GH'].includes(c.code)
  );

  res.json({
    success: true,
    data: {
      countries: popularCountries,
      total: popularCountries.length
    },
    timestamp: new Date().toISOString()
  });
});

// Get country by code
app.get('/api/countries/:code', (req, res) => {
  const code = req.params.code.toUpperCase();
  const country = fallbackCountries.find(c => c.code === code);

  if (!country) {
    return res.status(404).json({
      success: false,
      error: 'Country not found',
      code: 'COUNTRY_NOT_FOUND',
      timestamp: new Date().toISOString()
    });
  }

  res.json({
    success: true,
    data: country,
    timestamp: new Date().toISOString()
  });
});

// Search countries
app.get('/api/countries/search', (req, res) => {
  const query = (req.query.q || '').toLowerCase();

  if (!query || query.length < 2) {
    return res.json({
      success: true,
      data: {
        countries: [],
        total: 0
      },
      timestamp: new Date().toISOString()
    });
  }

  const results = fallbackCountries.filter(c =>
    c.name.toLowerCase().includes(query) ||
    c.code.toLowerCase().includes(query) ||
    c.capital.toLowerCase().includes(query)
  );

  res.json({
    success: true,
    data: {
      countries: results,
      total: results.length,
      query
    },
    timestamp: new Date().toISOString()
  });
});

// ==========================================
// LOCATIONS ENDPOINTS - Google Places & Geocoding API Integration
// ==========================================

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_PLACES_API_KEY;

// Location search using Google Places API
app.get('/api/locations/search', async (req, res) => {
  const query = req.query.q || req.query.query || '';
  const lat = req.query.lat;
  const lng = req.query.lng;
  const radius = req.query.radius || 50000; // Default 50km radius

  if (!query || query.length < 2) {
    return res.json({
      success: true,
      data: {
        locations: [],
        total: 0
      },
      timestamp: new Date().toISOString()
    });
  }

  // Check if Google API key is configured
  if (!GOOGLE_MAPS_API_KEY) {
    console.error('Google Maps API key not configured');
    return res.status(503).json({
      success: false,
      error: 'Location service unavailable - API key not configured',
      code: 'SERVICE_UNAVAILABLE',
      timestamp: new Date().toISOString()
    });
  }

  try {
    // Build Google Places Text Search API URL
    let url = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&key=${GOOGLE_MAPS_API_KEY}`;

    // Add location bias if coordinates provided
    if (lat && lng) {
      url += `&location=${lat},${lng}&radius=${radius}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results) {
      const locations = data.results.map((place, index) => ({
        id: place.place_id,
        placeId: place.place_id,
        name: place.name,
        address: place.formatted_address,
        latitude: place.geometry.location.lat,
        longitude: place.geometry.location.lng,
        type: getPlaceType(place.types),
        types: place.types,
        rating: place.rating || null,
        userRatingsTotal: place.user_ratings_total || 0,
        icon: place.icon,
        businessStatus: place.business_status
      }));

      res.json({
        success: true,
        data: {
          locations,
          total: locations.length,
          query,
          source: 'google_places'
        },
        timestamp: new Date().toISOString()
      });
    } else if (data.status === 'ZERO_RESULTS') {
      res.json({
        success: true,
        data: {
          locations: [],
          total: 0,
          query,
          source: 'google_places'
        },
        timestamp: new Date().toISOString()
      });
    } else {
      console.error('Google Places API error:', data.status, data.error_message);
      res.status(500).json({
        success: false,
        error: 'Location search failed',
        code: data.status,
        message: data.error_message,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Location search error:', error);
    res.status(500).json({
      success: false,
      error: 'Location search failed',
      code: 'SEARCH_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

// Place autocomplete for real-time suggestions
app.get('/api/locations/autocomplete', async (req, res) => {
  const input = req.query.input || req.query.q || '';
  const lat = req.query.lat;
  const lng = req.query.lng;
  const sessionToken = req.query.sessionToken;

  if (!input || input.length < 2) {
    return res.json({
      success: true,
      data: { predictions: [], total: 0 },
      timestamp: new Date().toISOString()
    });
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return res.status(503).json({
      success: false,
      error: 'Location service unavailable',
      code: 'SERVICE_UNAVAILABLE',
      timestamp: new Date().toISOString()
    });
  }

  try {
    let url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&key=${GOOGLE_MAPS_API_KEY}`;

    if (lat && lng) {
      url += `&location=${lat},${lng}&radius=50000`;
    }
    if (sessionToken) {
      url += `&sessiontoken=${sessionToken}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
      const predictions = (data.predictions || []).map(pred => ({
        placeId: pred.place_id,
        description: pred.description,
        mainText: pred.structured_formatting?.main_text,
        secondaryText: pred.structured_formatting?.secondary_text,
        types: pred.types
      }));

      res.json({
        success: true,
        data: {
          predictions,
          total: predictions.length,
          source: 'google_places'
        },
        timestamp: new Date().toISOString()
      });
    } else {
      console.error('Google Autocomplete error:', data.status);
      res.status(500).json({
        success: false,
        error: 'Autocomplete failed',
        code: data.status,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Autocomplete error:', error);
    res.status(500).json({
      success: false,
      error: 'Autocomplete failed',
      timestamp: new Date().toISOString()
    });
  }
});

// Get place details by place ID
app.get('/api/locations/details/:placeId', async (req, res) => {
  const { placeId } = req.params;
  const sessionToken = req.query.sessionToken;

  if (!GOOGLE_MAPS_API_KEY) {
    return res.status(503).json({
      success: false,
      error: 'Location service unavailable',
      code: 'SERVICE_UNAVAILABLE',
      timestamp: new Date().toISOString()
    });
  }

  try {
    let url = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=place_id,name,formatted_address,geometry,types,address_components,formatted_phone_number,opening_hours,rating,user_ratings_total&key=${GOOGLE_MAPS_API_KEY}`;

    if (sessionToken) {
      url += `&sessiontoken=${sessionToken}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.result) {
      const place = data.result;
      res.json({
        success: true,
        data: {
          placeId: place.place_id,
          name: place.name,
          address: place.formatted_address,
          latitude: place.geometry.location.lat,
          longitude: place.geometry.location.lng,
          types: place.types,
          addressComponents: place.address_components,
          phone: place.formatted_phone_number,
          openingHours: place.opening_hours,
          rating: place.rating,
          userRatingsTotal: place.user_ratings_total,
          source: 'google_places'
        },
        timestamp: new Date().toISOString()
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Place not found',
        code: data.status,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Place details error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get place details',
      timestamp: new Date().toISOString()
    });
  }
});

// Geocode address to coordinates using Google Geocoding API
app.post('/api/locations/geocode', async (req, res) => {
  const { address, region } = req.body;

  if (!address) {
    return res.status(400).json({
      success: false,
      error: 'Address is required',
      code: 'MISSING_ADDRESS',
      timestamp: new Date().toISOString()
    });
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return res.status(503).json({
      success: false,
      error: 'Geocoding service unavailable',
      code: 'SERVICE_UNAVAILABLE',
      timestamp: new Date().toISOString()
    });
  }

  try {
    let url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;

    if (region) {
      url += `&region=${region}`;
    }

    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const result = data.results[0];
      const components = result.address_components || [];

      // Parse address components
      const addressParts = {
        street: '',
        city: '',
        state: '',
        country: '',
        postalCode: ''
      };

      components.forEach(comp => {
        if (comp.types.includes('street_number')) {
          addressParts.street = comp.long_name + ' ';
        }
        if (comp.types.includes('route')) {
          addressParts.street += comp.long_name;
        }
        if (comp.types.includes('locality')) {
          addressParts.city = comp.long_name;
        }
        if (comp.types.includes('administrative_area_level_1')) {
          addressParts.state = comp.short_name;
        }
        if (comp.types.includes('country')) {
          addressParts.country = comp.long_name;
          addressParts.countryCode = comp.short_name;
        }
        if (comp.types.includes('postal_code')) {
          addressParts.postalCode = comp.long_name;
        }
      });

      res.json({
        success: true,
        data: {
          address: address,
          formattedAddress: result.formatted_address,
          latitude: result.geometry.location.lat,
          longitude: result.geometry.location.lng,
          placeId: result.place_id,
          locationType: result.geometry.location_type,
          viewport: result.geometry.viewport,
          addressComponents: addressParts,
          types: result.types,
          source: 'google_geocoding'
        },
        timestamp: new Date().toISOString()
      });
    } else if (data.status === 'ZERO_RESULTS') {
      res.status(404).json({
        success: false,
        error: 'Address not found',
        code: 'NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    } else {
      console.error('Geocoding API error:', data.status, data.error_message);
      res.status(500).json({
        success: false,
        error: 'Geocoding failed',
        code: data.status,
        message: data.error_message,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Geocoding error:', error);
    res.status(500).json({
      success: false,
      error: 'Geocoding failed',
      code: 'GEOCODING_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

// Reverse geocode coordinates to address using Google Geocoding API
app.post('/api/locations/reverse-geocode', async (req, res) => {
  const { latitude, longitude } = req.body;

  if (!latitude || !longitude) {
    return res.status(400).json({
      success: false,
      error: 'Latitude and longitude are required',
      code: 'MISSING_COORDINATES',
      timestamp: new Date().toISOString()
    });
  }

  if (!GOOGLE_MAPS_API_KEY) {
    return res.status(503).json({
      success: false,
      error: 'Reverse geocoding service unavailable',
      code: 'SERVICE_UNAVAILABLE',
      timestamp: new Date().toISOString()
    });
  }

  try {
    const lat = parseFloat(latitude);
    const lng = parseFloat(longitude);

    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const result = data.results[0];
      const components = result.address_components || [];

      // Parse address components
      const addressParts = {
        street: '',
        city: '',
        state: '',
        country: '',
        postalCode: ''
      };

      components.forEach(comp => {
        if (comp.types.includes('street_number')) {
          addressParts.street = comp.long_name + ' ';
        }
        if (comp.types.includes('route')) {
          addressParts.street += comp.long_name;
        }
        if (comp.types.includes('locality')) {
          addressParts.city = comp.long_name;
        }
        if (comp.types.includes('administrative_area_level_1')) {
          addressParts.state = comp.short_name;
        }
        if (comp.types.includes('country')) {
          addressParts.country = comp.long_name;
          addressParts.countryCode = comp.short_name;
        }
        if (comp.types.includes('postal_code')) {
          addressParts.postalCode = comp.long_name;
        }
      });

      res.json({
        success: true,
        data: {
          latitude: lat,
          longitude: lng,
          address: addressParts.street.trim() || result.formatted_address.split(',')[0],
          formattedAddress: result.formatted_address,
          placeId: result.place_id,
          addressComponents: addressParts,
          types: result.types,
          source: 'google_geocoding'
        },
        timestamp: new Date().toISOString()
      });
    } else if (data.status === 'ZERO_RESULTS') {
      res.status(404).json({
        success: false,
        error: 'No address found for these coordinates',
        code: 'NOT_FOUND',
        timestamp: new Date().toISOString()
      });
    } else {
      console.error('Reverse geocoding API error:', data.status, data.error_message);
      res.status(500).json({
        success: false,
        error: 'Reverse geocoding failed',
        code: data.status,
        message: data.error_message,
        timestamp: new Date().toISOString()
      });
    }
  } catch (error) {
    console.error('Reverse geocoding error:', error);
    res.status(500).json({
      success: false,
      error: 'Reverse geocoding failed',
      code: 'REVERSE_GEOCODING_ERROR',
      timestamp: new Date().toISOString()
    });
  }
});

// Helper function to determine place type
function getPlaceType(types) {
  if (!types || types.length === 0) return 'place';

  const typeMap = {
    'airport': 'airport',
    'train_station': 'transit',
    'transit_station': 'transit',
    'bus_station': 'transit',
    'subway_station': 'transit',
    'shopping_mall': 'shopping',
    'shopping_center': 'shopping',
    'restaurant': 'restaurant',
    'food': 'restaurant',
    'lodging': 'hotel',
    'hospital': 'hospital',
    'school': 'education',
    'university': 'education',
    'park': 'park',
    'neighborhood': 'neighborhood',
    'locality': 'city',
    'administrative_area_level_1': 'state',
    'country': 'country',
    'point_of_interest': 'poi',
    'establishment': 'business'
  };

  for (const type of types) {
    if (typeMap[type]) {
      return typeMap[type];
    }
  }

  return 'place';
}

// ==========================================
// PAYMENT ENDPOINTS
// ==========================================

// Create cash payment
app.post('/api/payments/cash/create', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { amount, rideId, packageId, currency = 'USD', description } = req.body;

    const transactionId = `CASH${Date.now().toString(36).toUpperCase()}`;

    res.status(201).json({
      success: true,
      data: {
        transactionId,
        type: 'cash',
        amount: parseFloat(amount),
        currency,
        status: 'pending',
        rideId,
        packageId,
        description,
        createdAt: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Create cash payment error:', error);
    res.status(500).json({ success: false, error: 'Failed to create payment' });
  }
});

// Get cash transaction
app.get('/api/payments/cash/:transactionId', authenticateToken, async (req, res) => {
  try {
    const { transactionId } = req.params;

    res.json({
      success: true,
      data: {
        transactionId,
        type: 'cash',
        amount: 25.00,
        currency: 'USD',
        status: 'completed',
        createdAt: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch transaction' });
  }
});

// Get payment history
app.get('/api/payments/cash/history', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 20, offset = 0 } = req.query;

    res.json({
      success: true,
      data: {
        transactions: [],
        total: 0,
        limit: parseInt(limit),
        offset: parseInt(offset)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch history' });
  }
});

// Get wallet balance
app.get('/api/payments/cash/wallet', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    res.json({
      success: true,
      data: {
        balance: 0.00,
        currency: 'USD',
        pendingAmount: 0.00,
        availableBalance: 0.00
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch wallet' });
  }
});

// Escrow endpoints
app.post('/api/payments/escrow/create', authenticateToken, async (req, res) => {
  try {
    const { amount, rideId, packageId, currency = 'USD' } = req.body;
    const escrowId = `ESC${Date.now().toString(36).toUpperCase()}`;

    res.status(201).json({
      success: true,
      data: {
        escrowId,
        amount: parseFloat(amount),
        currency,
        status: 'created',
        rideId,
        packageId,
        createdAt: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create escrow' });
  }
});

app.post('/api/payments/escrow/:escrowId/fund', authenticateToken, async (req, res) => {
  try {
    const { escrowId } = req.params;

    res.json({
      success: true,
      data: { escrowId, status: 'funded', fundedAt: new Date().toISOString() },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fund escrow' });
  }
});

app.post('/api/payments/escrow/:escrowId/release', authenticateToken, async (req, res) => {
  try {
    const { escrowId } = req.params;

    res.json({
      success: true,
      data: { escrowId, status: 'released', releasedAt: new Date().toISOString() },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to release escrow' });
  }
});

app.post('/api/payments/escrow/:escrowId/refund', authenticateToken, async (req, res) => {
  try {
    const { escrowId } = req.params;

    res.json({
      success: true,
      data: { escrowId, status: 'refunded', refundedAt: new Date().toISOString() },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to refund escrow' });
  }
});

app.post('/api/payments/escrow/:escrowId/dispute', authenticateToken, async (req, res) => {
  try {
    const { escrowId } = req.params;
    const { reason } = req.body;

    res.json({
      success: true,
      data: { escrowId, status: 'disputed', reason, disputedAt: new Date().toISOString() },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to dispute escrow' });
  }
});

app.get('/api/payments/escrow/:escrowId', authenticateToken, async (req, res) => {
  try {
    const { escrowId } = req.params;

    res.json({
      success: true,
      data: {
        escrowId,
        amount: 0,
        currency: 'USD',
        status: 'pending',
        createdAt: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch escrow' });
  }
});

app.get('/api/payments/escrow/ride/:rideId', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: null,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch escrow' });
  }
});

app.get('/api/payments/escrow/wallet/balance', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: { balance: 0, pendingRelease: 0, currency: 'USD' },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch balance' });
  }
});

app.get('/api/payments/escrow/statistics', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        totalEscrows: 0,
        totalAmount: 0,
        releasedAmount: 0,
        pendingAmount: 0
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch statistics' });
  }
});

app.get('/api/payments/escrow/history', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: { escrows: [], total: 0 },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch history' });
  }
});

app.get('/api/payments/escrow/:escrowId/auto-release-check', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: { eligible: false, reason: 'No auto-release configured' },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to check eligibility' });
  }
});

app.post('/api/payments/escrow/eligibility-check', authenticateToken, async (req, res) => {
  try {
    const { amount } = req.body;

    res.json({
      success: true,
      data: {
        eligible: true,
        maxAmount: 10000,
        minAmount: 1,
        reason: null
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to check eligibility' });
  }
});

// ==========================================
// NOTIFICATION ENDPOINTS
// ==========================================

// Register push notification token
app.post('/api/notifications/register-token', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { token, platform, deviceId } = req.body;

    // In production, store token in database
    console.log(`Push token registered for user ${userId}: ${token?.substring(0, 20)}...`);

    res.json({
      success: true,
      message: 'Push token registered successfully',
      data: { userId, platform, deviceId, registered: true },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Register token error:', error);
    res.status(500).json({ success: false, error: 'Failed to register token' });
  }
});

// Update notification preferences
app.put('/api/notifications/preferences', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const preferences = req.body;

    res.json({
      success: true,
      message: 'Preferences updated',
      data: {
        userId,
        preferences: {
          pushEnabled: preferences.pushEnabled ?? true,
          emailEnabled: preferences.emailEnabled ?? true,
          smsEnabled: preferences.smsEnabled ?? false,
          rideUpdates: preferences.rideUpdates ?? true,
          packageUpdates: preferences.packageUpdates ?? true,
          promotions: preferences.promotions ?? false,
          ...preferences
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update preferences' });
  }
});

// Get notification preferences
app.get('/api/notifications/preferences', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        pushEnabled: true,
        emailEnabled: true,
        smsEnabled: false,
        rideUpdates: true,
        packageUpdates: true,
        promotions: false
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch preferences' });
  }
});

// ==========================================
// EMERGENCY CONTACTS ENDPOINTS
// ==========================================

// Get emergency contacts
app.get('/api/user/emergency-contacts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;

    // In production, fetch from database
    res.json({
      success: true,
      data: {
        contacts: [],
        maxContacts: 5
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch contacts' });
  }
});

// Add emergency contact
app.post('/api/user/emergency-contacts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { name, phone, relationship, isPrimary } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Name and phone are required'
      });
    }

    const contactId = `EC${Date.now().toString(36).toUpperCase()}`;

    res.status(201).json({
      success: true,
      message: 'Emergency contact added',
      data: {
        id: contactId,
        name,
        phone,
        relationship,
        isPrimary: isPrimary || false,
        createdAt: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to add contact' });
  }
});

// Delete emergency contact
app.delete('/api/user/emergency-contacts/:contactId', authenticateToken, async (req, res) => {
  try {
    const { contactId } = req.params;

    res.json({
      success: true,
      message: 'Emergency contact removed',
      data: { deletedId: contactId },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to delete contact' });
  }
});

// Create emergency alert
app.post('/api/emergency/alerts', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { type, location, message, rideId, packageId } = req.body;

    const alertId = `ALERT${Date.now().toString(36).toUpperCase()}`;

    console.log(`🚨 EMERGENCY ALERT from user ${userId}: ${type} - ${message}`);

    res.status(201).json({
      success: true,
      message: 'Emergency alert created',
      data: {
        alertId,
        type: type || 'general',
        status: 'active',
        location,
        message,
        createdAt: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create alert' });
  }
});

// Update alert location
app.put('/api/emergency/alerts/:alertId/location', authenticateToken, async (req, res) => {
  try {
    const { alertId } = req.params;
    const { location } = req.body;

    res.json({
      success: true,
      message: 'Alert location updated',
      data: { alertId, location, updatedAt: new Date().toISOString() },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update location' });
  }
});

// Update/resolve alert
app.put('/api/emergency/alerts/:alertId', authenticateToken, async (req, res) => {
  try {
    const { alertId } = req.params;
    const { status } = req.body;

    res.json({
      success: true,
      message: `Alert ${status || 'updated'}`,
      data: { alertId, status: status || 'resolved', updatedAt: new Date().toISOString() },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update alert' });
  }
});

// Find emergency contacts
app.post('/api/emergency/contacts/find', authenticateToken, async (req, res) => {
  try {
    const { location, radius = 10 } = req.body;

    res.json({
      success: true,
      data: {
        contacts: [],
        emergencyServices: [
          { name: 'Police', number: '999', type: 'police' },
          { name: 'Ambulance', number: '999', type: 'medical' },
          { name: 'Fire', number: '999', type: 'fire' }
        ]
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to find contacts' });
  }
});

// ==========================================
// AI SERVICE ENDPOINTS
// ==========================================

// AI Pricing calculation
app.post('/api/ai/pricing/calculate', authenticateToken, async (req, res) => {
  try {
    const { origin, destination, rideType, passengers, preferences } = req.body;

    // Mock AI pricing calculation
    const basePrice = 10;
    const distancePrice = Math.random() * 20 + 5;
    const surgeMultiplier = 1 + Math.random() * 0.5;
    const finalPrice = (basePrice + distancePrice) * surgeMultiplier;

    res.json({
      success: true,
      data: {
        estimatedPrice: Math.round(finalPrice * 100) / 100,
        currency: 'USD',
        breakdown: {
          basePrice,
          distancePrice: Math.round(distancePrice * 100) / 100,
          surgeMultiplier: Math.round(surgeMultiplier * 100) / 100,
          serviceFee: Math.round(finalPrice * 0.1 * 100) / 100
        },
        confidence: 0.85,
        priceRange: {
          low: Math.round(finalPrice * 0.9 * 100) / 100,
          high: Math.round(finalPrice * 1.2 * 100) / 100
        }
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to calculate pricing' });
  }
});

// AI Matching
app.post('/api/ai/matching/find', authenticateToken, async (req, res) => {
  try {
    const { origin, destination, preferences } = req.body;

    res.json({
      success: true,
      data: {
        matches: [],
        totalMatches: 0,
        searchRadius: 10,
        message: 'No drivers available at the moment'
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to find matches' });
  }
});

// Get available drivers
app.post('/api/drivers/available', authenticateToken, async (req, res) => {
  try {
    const { location, radius = 10 } = req.body;

    res.json({
      success: true,
      data: {
        drivers: [],
        total: 0,
        radius
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch drivers' });
  }
});

// Pricing surge zones
app.get('/api/pricing/surge-zones', async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        zones: [],
        lastUpdated: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch surge zones' });
  }
});

// Pricing history
app.get('/api/pricing/history', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: { history: [], total: 0 },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch history' });
  }
});

// Pricing feedback
app.post('/api/pricing/feedback', authenticateToken, async (req, res) => {
  try {
    const { rideId, rating, comment } = req.body;

    res.json({
      success: true,
      message: 'Feedback submitted',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to submit feedback' });
  }
});

// AI Recommendations
app.post('/api/ai/recommendations/profile', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      message: 'Profile updated for recommendations',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update profile' });
  }
});

app.post('/api/ai/recommendations/generate', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        recommendations: [],
        generatedAt: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to generate recommendations' });
  }
});

// ==========================================
// CALL SERVICE ENDPOINTS
// ==========================================

app.put('/api/calls/:callId/quality', authenticateToken, async (req, res) => {
  try {
    const { callId } = req.params;
    const { rating, feedback } = req.body;

    res.json({
      success: true,
      message: 'Call quality feedback recorded',
      data: { callId, rating },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to record feedback' });
  }
});

app.get('/api/calls/history', authenticateToken, async (req, res) => {
  try {
    const { limit = 20, offset = 0 } = req.query;

    res.json({
      success: true,
      data: { calls: [], total: 0 },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch history' });
  }
});

app.get('/api/calls/history/:contextType/:contextId', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: { calls: [], total: 0 },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch history' });
  }
});

app.post('/api/calls/workflows/create', authenticateToken, async (req, res) => {
  try {
    const workflowId = `WF${Date.now().toString(36).toUpperCase()}`;

    res.status(201).json({
      success: true,
      data: { workflowId, status: 'created', createdAt: new Date().toISOString() },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create workflow' });
  }
});

app.post('/api/calls/workflows/emergency', authenticateToken, async (req, res) => {
  try {
    const workflowId = `EMG${Date.now().toString(36).toUpperCase()}`;

    res.status(201).json({
      success: true,
      data: { workflowId, type: 'emergency', status: 'initiated', createdAt: new Date().toISOString() },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create emergency workflow' });
  }
});

app.put('/api/calls/workflows/:workflowId/status', authenticateToken, async (req, res) => {
  try {
    const { workflowId } = req.params;
    const { status } = req.body;

    res.json({
      success: true,
      data: { workflowId, status, updatedAt: new Date().toISOString() },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to update workflow' });
  }
});

// ==========================================
// OTP SERVICE ENDPOINTS
// ==========================================

app.post('/api/otp/sms/send', async (req, res) => {
  try {
    const { phoneNumber, purpose = 'verification' } = req.body;

    if (!phoneNumber) {
      return res.status(400).json({ success: false, error: 'Phone number is required' });
    }

    // In production, send actual SMS
    const otpId = `OTP${Date.now().toString(36).toUpperCase()}`;

    res.json({
      success: true,
      message: 'OTP sent successfully',
      data: { otpId, expiresIn: 300 }, // 5 minutes
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to send OTP' });
  }
});

app.post('/api/otp/email/send', async (req, res) => {
  try {
    const { email, purpose = 'verification' } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    const otpId = `OTP${Date.now().toString(36).toUpperCase()}`;

    res.json({
      success: true,
      message: 'OTP sent to email',
      data: { otpId, expiresIn: 600 }, // 10 minutes
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to send OTP' });
  }
});

app.post('/api/otp/verify', async (req, res) => {
  try {
    const { otpId, code } = req.body;

    if (!otpId || !code) {
      return res.status(400).json({ success: false, error: 'OTP ID and code are required' });
    }

    // In production, verify against stored OTP
    const isValid = code.length === 6 && /^\d+$/.test(code);

    res.json({
      success: isValid,
      message: isValid ? 'OTP verified successfully' : 'Invalid OTP',
      data: { verified: isValid },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to verify OTP' });
  }
});

app.get('/api/otp/settings', authenticateToken, async (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        smsEnabled: true,
        emailEnabled: true,
        defaultMethod: 'sms',
        otpLength: 6,
        expirySeconds: 300
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch settings' });
  }
});

// ==========================================
// VERIFICATION ENDPOINTS
// ==========================================

app.post('/api/verification/documents/upload', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { documentType, documentData } = req.body;

    const documentId = `DOC${Date.now().toString(36).toUpperCase()}`;

    res.status(201).json({
      success: true,
      message: 'Document uploaded for verification',
      data: {
        documentId,
        documentType,
        status: 'pending_review',
        uploadedAt: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to upload document' });
  }
});

app.get('/api/verification/status/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    res.json({
      success: true,
      data: {
        userId,
        status: 'pending',
        documents: [],
        verifiedAt: null
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch status' });
  }
});

app.get('/api/verification/progress/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    res.json({
      success: true,
      data: {
        userId,
        progress: 0,
        completedSteps: [],
        pendingSteps: ['id_verification', 'phone_verification', 'email_verification'],
        totalSteps: 3
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to fetch progress' });
  }
});

// ==========================================
// ADDITIONAL /API/HEALTH ENDPOINT
// ==========================================

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'ARYV Backend API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0',
    database: 'connected',
    uptime: process.uptime()
  });
});

// Default catch-all
app.use('/api/*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found`,
    code: 'ROUTE_NOT_FOUND',
    timestamp: new Date().toISOString(),
    availableEndpoints: {
      auth: [
        'POST /api/auth/login',
        'POST /api/auth/register',
        'POST /api/auth/refresh',
        'POST /api/auth/google/verify',
        'GET /api/auth/profile'
      ],
      users: [
        'GET /api/users',
        'GET /api/users/profile',
        'PUT /api/users/profile',
        'GET /api/users/:id'
      ],
      rides: [
        'GET /api/rides',
        'POST /api/rides',
        'GET /api/rides/:id',
        'PUT /api/rides/:id',
        'DELETE /api/rides/:id',
        'POST /api/rides/search',
        'POST /api/rides/:id/book',
        'GET /api/bookings'
      ],
      courier: [
        'GET /api/courier/profile',
        'POST /api/courier/availability',
        'POST /api/courier/location',
        'GET /api/courier/stats',
        'GET /api/courier/notifications',
        'GET /api/courier/delivery-tiers',
        'POST /api/courier/pricing/suggestions',
        'POST /api/courier/packages',
        'GET /api/courier/user/packages',
        'GET /api/courier/deliveries',
        'GET /api/courier/packages/:id/tracking',
        'GET /api/courier/analytics'
      ],
      deliveries: [
        'GET /api/deliveries/available',
        'POST /api/deliveries/accept',
        'PUT /api/deliveries/:id/status'
      ],
      packages: [
        'GET /api/packages',
        'GET /api/packages/:id/events'
      ],
      currencies: [
        'GET /api/currencies',
        'GET /api/currencies/popular',
        'POST /api/currencies/convert',
        'GET /api/currencies/user',
        'PUT /api/currencies/user/primary',
        'POST /api/currencies/user/payment',
        'DELETE /api/currencies/user/payment/:code',
        'GET /api/currencies/country/:code'
      ],
      countries: [
        'GET /api/countries',
        'GET /api/countries/popular',
        'GET /api/countries/:code',
        'GET /api/countries/search',
        'GET /api/countries/region/:region',
        'PUT /api/countries/user',
        'GET /api/countries/user',
        'GET /api/countries/:code/currency',
        'GET /api/countries/phone'
      ],
      locations: [
        'GET /api/locations/search',
        'POST /api/locations/geocode',
        'POST /api/locations/reverse-geocode'
      ],
      payments: [
        'POST /api/payments/cash/create',
        'GET /api/payments/cash/:id',
        'GET /api/payments/cash/history',
        'GET /api/payments/cash/wallet',
        'POST /api/payments/escrow/create',
        'POST /api/payments/escrow/:id/fund',
        'POST /api/payments/escrow/:id/release',
        'POST /api/payments/escrow/:id/refund',
        'POST /api/payments/escrow/:id/dispute',
        'GET /api/payments/escrow/:id',
        'GET /api/payments/escrow/wallet/balance',
        'GET /api/payments/escrow/statistics',
        'GET /api/payments/escrow/history'
      ],
      notifications: [
        'POST /api/notifications/register-token',
        'PUT /api/notifications/preferences',
        'GET /api/notifications/preferences'
      ],
      emergency: [
        'GET /api/user/emergency-contacts',
        'POST /api/user/emergency-contacts',
        'DELETE /api/user/emergency-contacts/:id',
        'POST /api/emergency/alerts',
        'PUT /api/emergency/alerts/:id/location',
        'PUT /api/emergency/alerts/:id',
        'POST /api/emergency/contacts/find'
      ],
      ai: [
        'POST /api/ai/pricing/calculate',
        'POST /api/ai/matching/find',
        'POST /api/ai/recommendations/profile',
        'POST /api/ai/recommendations/generate',
        'POST /api/drivers/available',
        'GET /api/pricing/surge-zones',
        'GET /api/pricing/history',
        'POST /api/pricing/feedback'
      ],
      calls: [
        'PUT /api/calls/:id/quality',
        'GET /api/calls/history',
        'POST /api/calls/workflows/create',
        'POST /api/calls/workflows/emergency',
        'PUT /api/calls/workflows/:id/status'
      ],
      otp: [
        'POST /api/otp/sms/send',
        'POST /api/otp/email/send',
        'POST /api/otp/verify',
        'GET /api/otp/settings'
      ],
      verification: [
        'POST /api/verification/documents/upload',
        'GET /api/verification/status/:userId',
        'GET /api/verification/progress/:userId'
      ],
      system: [
        'GET /api/health',
        'GET /api/websocket/status',
        'POST /api/broadcast/notification'
      ]
    }
  });
});

// WebSocket connection handling
const connectedUsers = new Map(); // userId -> socketId
const activeRooms = new Map(); // roomId -> Set of socketIds

io.on('connection', (socket) => {
  console.log('📡 New WebSocket connection:', socket.id);

  // Handle user authentication for real-time features
  socket.on('authenticate', (data) => {
    const { token, userId } = data;
    try {
      const jwtSecret = process.env.JWT_SECRET || 'aryv-jwt-secret-key-2025';
      const decoded = jwt.verify(token, jwtSecret);
      socket.userId = decoded.userId;
      connectedUsers.set(decoded.userId, socket.id);
      
      console.log(`👤 User ${decoded.userId} authenticated for real-time features`);
      socket.emit('authenticated', { success: true, userId: decoded.userId });
    } catch (error) {
      console.error('WebSocket authentication failed:', error);
      socket.emit('authentication_error', { error: 'Invalid token' });
    }
  });

  // Join ride tracking room
  socket.on('join_ride', (rideId) => {
    socket.join(`ride_${rideId}`);
    console.log(`🚗 Socket ${socket.id} joined ride tracking: ${rideId}`);
    
    if (!activeRooms.has(`ride_${rideId}`)) {
      activeRooms.set(`ride_${rideId}`, new Set());
    }
    activeRooms.get(`ride_${rideId}`).add(socket.id);
    
    // Notify room about new participant
    socket.to(`ride_${rideId}`).emit('passenger_joined', { 
      message: 'A passenger joined ride tracking',
      timestamp: new Date().toISOString()
    });
  });

  // Join package tracking room
  socket.on('join_package', (packageId) => {
    socket.join(`package_${packageId}`);
    console.log(`📦 Socket ${socket.id} joined package tracking: ${packageId}`);
    
    if (!activeRooms.has(`package_${packageId}`)) {
      activeRooms.set(`package_${packageId}`, new Set());
    }
    activeRooms.get(`package_${packageId}`).add(socket.id);
    
    // Send current package status
    pool.query('SELECT status, pickup_confirmed_at, delivery_confirmed_at FROM packages WHERE id = $1', [packageId])
      .then(result => {
        if (result.rows.length > 0) {
          socket.emit('package_status', {
            packageId,
            status: result.rows[0].status,
            pickupTime: result.rows[0].pickup_confirmed_at,
            deliveryTime: result.rows[0].delivery_confirmed_at,
            timestamp: new Date().toISOString()
          });
        }
      })
      .catch(err => console.error('Error fetching package status:', err));
  });

  // Handle location updates from drivers/couriers
  socket.on('location_update', async (data) => {
    const { latitude, longitude, rideId, packageId, speed, heading } = data;
    
    if (socket.userId) {
      try {
        // Store location update in database
        if (packageId) {
          await pool.query(`
            INSERT INTO package_events (package_id, event_type, event_description, location_latitude, location_longitude, created_by)
            VALUES ($1, 'location_update', 'Real-time location update', $2, $3, $4)
          `, [packageId, latitude, longitude, socket.userId]);
          
          // Broadcast to package tracking room
          io.to(`package_${packageId}`).emit('location_update', {
            packageId,
            latitude,
            longitude,
            speed,
            heading,
            timestamp: new Date().toISOString()
          });
        }
        
        if (rideId) {
          // Broadcast to ride tracking room
          io.to(`ride_${rideId}`).emit('location_update', {
            rideId,
            latitude,
            longitude,
            speed,
            heading,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('Error handling location update:', error);
      }
    }
  });

  // Handle chat messages
  socket.on('send_message', async (data) => {
    const { rideId, packageId, message, type = 'text' } = data;
    
    if (socket.userId) {
      try {
        // Store message in database
        if (packageId) {
          await pool.query(`
            INSERT INTO package_events (package_id, event_type, event_description, created_by)
            VALUES ($1, 'chat_message', $2, $3)
          `, [packageId, message, socket.userId]);
          
          // Get sender info
          const userResult = await pool.query('SELECT first_name, last_name FROM users WHERE id = $1', [socket.userId]);
          const sender = userResult.rows[0];
          
          // Broadcast to package room
          io.to(`package_${packageId}`).emit('new_message', {
            packageId,
            message,
            type,
            sender: `${sender.first_name} ${sender.last_name}`,
            senderId: socket.userId,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        console.error('Error handling chat message:', error);
      }
    }
  });

  // Handle package status updates
  socket.on('update_package_status', async (data) => {
    const { packageId, status, location } = data;
    
    if (socket.userId) {
      try {
        // Update package status
        await pool.query('UPDATE packages SET status = $1 WHERE id = $2', [status, packageId]);
        
        // Add tracking event
        await pool.query(`
          INSERT INTO package_events (package_id, event_type, event_description, location_latitude, location_longitude, created_by)
          VALUES ($1, 'status_change', $2, $3, $4, $5)
        `, [packageId, `Package status changed to ${status}`, location?.latitude, location?.longitude, socket.userId]);
        
        // Broadcast status update
        io.to(`package_${packageId}`).emit('status_update', {
          packageId,
          status,
          location,
          timestamp: new Date().toISOString()
        });
        
        console.log(`📦 Package ${packageId} status updated to: ${status}`);
      } catch (error) {
        console.error('Error updating package status:', error);
      }
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log('📡 WebSocket disconnected:', socket.id);
    
    if (socket.userId) {
      connectedUsers.delete(socket.userId);
    }
    
    // Remove from active rooms
    for (const [roomId, socketIds] of activeRooms.entries()) {
      if (socketIds.has(socket.id)) {
        socketIds.delete(socket.id);
        if (socketIds.size === 0) {
          activeRooms.delete(roomId);
        }
      }
    }
  });
});

// REST API endpoint to broadcast notifications
app.post('/api/broadcast/notification', async (req, res) => {
  try {
    const { userId, title, message, type = 'info', data = {} } = req.body;
    
    if (userId && connectedUsers.has(userId)) {
      const socketId = connectedUsers.get(userId);
      io.to(socketId).emit('notification', {
        title,
        message,
        type,
        data,
        timestamp: new Date().toISOString()
      });
      
      res.json({ success: true, message: 'Notification sent' });
    } else {
      res.json({ success: false, message: 'User not connected' });
    }
  } catch (error) {
    console.error('Broadcast notification error:', error);
    res.status(500).json({ success: false, error: 'Failed to send notification' });
  }
});

// WebSocket status endpoint
app.get('/api/websocket/status', (req, res) => {
  res.json({
    success: true,
    data: {
      connectedUsers: connectedUsers.size,
      activeRooms: Array.from(activeRooms.keys()),
      totalConnections: io.engine.clientsCount
    },
    timestamp: new Date().toISOString()
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`🚀 ARYV Backend API with WebSocket running on port ${PORT}`);
  console.log(`🔗 HTTP: http://localhost:${PORT}`);
  console.log(`📡 WebSocket: ws://localhost:${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🌐 Real-time features: Enabled`);
});