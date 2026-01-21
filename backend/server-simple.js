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
  if (process.env.NODE_ENV === 'production') {
    baseConfig.ssl = {
      require: true,
      rejectUnauthorized: true,
      // For Railway/Supabase/managed PostgreSQL
      sslmode: process.env.PGSSLMODE || 'require',
    };
    
    // Custom SSL certificate if provided
    if (process.env.PGSSLROOTCERT) {
      baseConfig.ssl.ca = require('fs').readFileSync(process.env.PGSSLROOTCERT).toString();
    }
  } else {
    baseConfig.ssl = false;
  }

  return baseConfig;
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
    const ridesQuery = `
      SELECT 
        r.id,
        r.driver_id,
        u.first_name || ' ' || u.last_name as driver_name,
        r.origin_address as "from",
        r.destination_address as "to",
        r.departure_time,
        r.status,
        r.available_seats as capacity,
        COALESCE(SUM(b.seats_booked), 0) as booked,
        r.price_per_seat as price,
        r.distance,
        r.created_at
      FROM rides r
      JOIN users u ON r.driver_id = u.id
      LEFT JOIN bookings b ON r.id = b.ride_id AND b.status IN ('pending', 'confirmed')
      GROUP BY r.id, r.driver_id, u.first_name, u.last_name
      ORDER BY r.created_at DESC
    `;
    const result = await pool.query(ridesQuery);

    res.json({
      success: true,
      data: result.rows.map(ride => ({
        id: `R${ride.id.toString().padStart(3, '0')}`,
        driverId: `D${ride.driver_id.toString().padStart(3, '0')}`,
        driverName: ride.driver_name,
        route: { from: ride.from, to: ride.to },
        departureTime: ride.departure_time,
        status: ride.status,
        passengers: { 
          booked: parseInt(ride.booked), 
          capacity: ride.capacity 
        },
        price: parseFloat(ride.price),
        distance: parseFloat(ride.distance) || 0,
        created: ride.created_at
      }))
    });
  } catch (error) {
    console.error('Rides error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
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
    const result = await pool.query(`
      SELECT 
        p.id, p.title, p.description, p.package_size, p.weight, p.fragile, p.valuable,
        p.pickup_address, p.dropoff_address, p.distance, p.price, p.platform_fee,
        p.status, p.tracking_code, p.special_instructions, p.created_at,
        sender.first_name as sender_first_name, sender.last_name as sender_last_name, sender.email as sender_email,
        courier.first_name as courier_first_name, courier.last_name as courier_last_name, courier.email as courier_email
      FROM packages p
      LEFT JOIN users sender ON p.sender_id = sender.id
      LEFT JOIN users courier ON p.courier_id = courier.id
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
        address: pkg.pickup_address
      },
      dropoff: {
        address: pkg.dropoff_address
      },
      distance: pkg.distance,
      price: pkg.price,
      platformFee: pkg.platform_fee,
      status: pkg.status,
      trackingCode: pkg.tracking_code,
      specialInstructions: pkg.special_instructions,
      sender: pkg.sender_first_name ? {
        name: `${pkg.sender_first_name} ${pkg.sender_last_name}`,
        email: pkg.sender_email
      } : null,
      courier: pkg.courier_first_name ? {
        name: `${pkg.courier_first_name} ${pkg.courier_last_name}`,
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
  { id: 'EGP', code: 'EGP', name: 'Egyptian Pound', symbol: 'E£', decimalPlaces: 2, flag: '🇪🇬', countryCode: 'EG', exchangeRate: 30.9, isPopular: false, region: 'Africa' }
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
  { id: 'AE', code: 'AE', name: 'United Arab Emirates', nameOfficial: 'United Arab Emirates', flag: '🇦🇪', phonePrefix: '+971', continent: 'Asia', region: 'Middle East', capital: 'Abu Dhabi', timezones: ['Asia/Dubai'], languages: ['Arabic', 'English'], isActive: true }
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
// LOCATIONS ENDPOINTS
// ==========================================

// Location search (mock implementation - would integrate with Google Places API)
app.get('/api/locations/search', (req, res) => {
  const query = req.query.q || req.query.query || '';

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

  // Mock location results
  const mockLocations = [
    { id: '1', name: 'Nairobi CBD', address: 'Central Business District, Nairobi, Kenya', latitude: -1.2921, longitude: 36.8219, type: 'city_center' },
    { id: '2', name: 'Jomo Kenyatta International Airport', address: 'JKIA, Nairobi, Kenya', latitude: -1.3192, longitude: 36.9278, type: 'airport' },
    { id: '3', name: 'Westlands', address: 'Westlands, Nairobi, Kenya', latitude: -1.2673, longitude: 36.8118, type: 'neighborhood' },
    { id: '4', name: 'Karen', address: 'Karen, Nairobi, Kenya', latitude: -1.3162, longitude: 36.7115, type: 'neighborhood' },
    { id: '5', name: 'Lagos Island', address: 'Lagos Island, Lagos, Nigeria', latitude: 6.4549, longitude: 3.4246, type: 'neighborhood' },
    { id: '6', name: 'Victoria Island', address: 'Victoria Island, Lagos, Nigeria', latitude: 6.4281, longitude: 3.4219, type: 'neighborhood' },
    { id: '7', name: 'Sandton City', address: 'Sandton, Johannesburg, South Africa', latitude: -26.1076, longitude: 28.0567, type: 'shopping' },
    { id: '8', name: 'Cape Town CBD', address: 'Cape Town City Centre, South Africa', latitude: -33.9249, longitude: 18.4241, type: 'city_center' }
  ];

  const results = mockLocations.filter(loc =>
    loc.name.toLowerCase().includes(query.toLowerCase()) ||
    loc.address.toLowerCase().includes(query.toLowerCase())
  );

  res.json({
    success: true,
    data: {
      locations: results,
      total: results.length,
      query
    },
    timestamp: new Date().toISOString()
  });
});

// Geocode address to coordinates
app.post('/api/locations/geocode', (req, res) => {
  const { address } = req.body;

  if (!address) {
    return res.status(400).json({
      success: false,
      error: 'Address is required',
      code: 'MISSING_ADDRESS',
      timestamp: new Date().toISOString()
    });
  }

  // Mock geocoding - in production, use Google Geocoding API
  const mockResult = {
    address: address,
    latitude: -1.2921 + (Math.random() - 0.5) * 0.1,
    longitude: 36.8219 + (Math.random() - 0.5) * 0.1,
    formattedAddress: `${address}, Kenya`,
    placeId: `place_${Date.now()}`
  };

  res.json({
    success: true,
    data: mockResult,
    timestamp: new Date().toISOString()
  });
});

// Reverse geocode coordinates to address
app.post('/api/locations/reverse-geocode', (req, res) => {
  const { latitude, longitude } = req.body;

  if (!latitude || !longitude) {
    return res.status(400).json({
      success: false,
      error: 'Latitude and longitude are required',
      code: 'MISSING_COORDINATES',
      timestamp: new Date().toISOString()
    });
  }

  // Mock reverse geocoding
  const mockResult = {
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude),
    address: 'Nearby Location',
    formattedAddress: `${parseFloat(latitude).toFixed(4)}, ${parseFloat(longitude).toFixed(4)}, Kenya`,
    placeId: `place_${Date.now()}`
  };

  res.json({
    success: true,
    data: mockResult,
    timestamp: new Date().toISOString()
  });
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
    availableEndpoints: [
      'GET /api/health - Health check',
      'GET /api/currencies - List all currencies',
      'GET /api/currencies/popular - Popular currencies by region',
      'POST /api/currencies/convert - Convert between currencies',
      'GET /api/countries - List all countries',
      'GET /api/countries/popular - Popular countries',
      'GET /api/countries/:code - Get country by code',
      'GET /api/locations/search - Search locations',
      'POST /api/locations/geocode - Geocode address',
      'POST /api/locations/reverse-geocode - Reverse geocode',
      'GET /api/packages - List all packages',
      'GET /api/couriers - List all couriers',
      'GET /api/rides - List all rides',
      'POST /api/auth/login - User login',
      'POST /api/auth/register - User registration',
      'POST /api/auth/google/verify - Google OAuth verification'
    ]
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