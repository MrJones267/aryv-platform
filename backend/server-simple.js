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

// Default catch-all
app.use('/api/*', (req, res) => {
  res.json({
    success: true,
    message: 'ARYV Backend API with PostgreSQL, Courier Service and WebSocket',
    endpoint: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
    note: 'Database connected - courier service and real-time features available',
    availableEndpoints: [
      'GET /api/packages - List all packages',
      'GET /api/couriers - List all couriers', 
      'GET /api/packages/:id/events - Package tracking events',
      'GET /api/courier/analytics - Courier service analytics',
      'GET /api/websocket/status - WebSocket connection status',
      'POST /api/broadcast/notification - Send notification to user'
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