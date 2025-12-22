/**
 * @fileoverview Database-integrated admin server for ARYV platform
 * @author Oabona-Majoko
 * @created 2025-01-25
 */

const express = require('express');
const cors = require('cors');
const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secure-jwt-secret-key-change-this-in-production';

// Database configuration
const sequelize = new Sequelize({
  dialect: 'postgres',
  host: 'localhost',
  port: 5433,
  database: 'hitch',
  username: 'hitch_user',
  password: 'hitch_password',
  logging: false,
  pool: {
    max: 10,
    min: 0,
    acquire: 30000,
    idle: 10000,
  },
});

// AdminUser model definition
const AdminUser = sequelize.define('AdminUser', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  passwordHash: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'password_hash',
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'first_name',
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: false,
    field: 'last_name',
  },
  role: {
    type: DataTypes.ENUM('super_admin', 'admin', 'moderator'),
    allowNull: false,
  },
  permissions: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: [],
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    field: 'is_active',
  },
  lastLogin: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'last_login',
  },
  failedLoginAttempts: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
    field: 'failed_login_attempts',
  },
  lockoutUntil: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'lockout_until',
  },
  createdAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'created_at',
  },
  updatedAt: {
    type: DataTypes.DATE,
    allowNull: false,
    field: 'updated_at',
  },
}, {
  tableName: 'admin_users',
  timestamps: true,
  underscored: true,
});

// Add instance methods
AdminUser.prototype.validatePassword = async function(password) {
  return bcrypt.compare(password, this.passwordHash);
};

AdminUser.prototype.isAccountLocked = function() {
  return this.lockoutUntil && this.lockoutUntil > new Date();
};

AdminUser.prototype.incrementFailedAttempts = function() {
  this.failedLoginAttempts += 1;
  if (this.failedLoginAttempts >= 5) {
    this.lockoutUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
  }
};

AdminUser.prototype.resetFailedAttempts = function() {
  this.failedLoginAttempts = 0;
  this.lockoutUntil = null;
};

AdminUser.prototype.updateLastLogin = function() {
  this.lastLogin = new Date();
};

AdminUser.prototype.toSafeObject = function() {
  const { passwordHash, twoFactorSecret, ...safeAdmin } = this.toJSON();
  return safeAdmin;
};

// Middleware
app.use(cors());
app.use(express.json());

// Database connection
const connectDatabase = async () => {
  try {
    await sequelize.authenticate();
    console.log('✅ Database connection established successfully');
    return true;
  } catch (error) {
    console.error('❌ Unable to connect to database:', error.message);
    return false;
  }
};

// Admin authentication middleware
const authenticateAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Access token is required',
      code: 'ACCESS_TOKEN_REQUIRED',
      timestamp: new Date().toISOString(),
    });
  }

  const token = authHeader.substring(7);
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    
    if (decoded.type !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
        code: 'ADMIN_ACCESS_REQUIRED',
        timestamp: new Date().toISOString(),
      });
    }

    const admin = await AdminUser.findByPk(decoded.id);
    if (!admin || !admin.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Admin not found or inactive',
        code: 'ADMIN_NOT_FOUND',
        timestamp: new Date().toISOString(),
      });
    }

    req.admin = admin;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired admin token',
      code: 'INVALID_ADMIN_TOKEN',
      timestamp: new Date().toISOString(),
    });
  }
};

// Admin Authentication Routes
app.post('/api/admin/auth/login', async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;

    // Find admin user by email
    const admin = await AdminUser.findOne({
      where: { email: email.toLowerCase() }
    });
    
    if (!admin || !admin.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
        timestamp: new Date().toISOString(),
      });
    }

    // Check if account is locked
    if (admin.isAccountLocked()) {
      return res.status(423).json({
        success: false,
        error: 'Account is temporarily locked due to multiple failed login attempts',
        code: 'ACCOUNT_LOCKED',
        timestamp: new Date().toISOString(),
      });
    }

    // Verify password
    const isValidPassword = await admin.validatePassword(password);
    if (!isValidPassword) {
      admin.incrementFailedAttempts();
      await admin.save();
      
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
        code: 'INVALID_CREDENTIALS',
        timestamp: new Date().toISOString(),
      });
    }

    // Reset failed attempts on successful login
    admin.resetFailedAttempts();
    admin.updateLastLogin();
    await admin.save();

    // Generate JWT token
    const tokenPayload = {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      permissions: admin.permissions,
      type: 'admin',
    };

    const accessToken = jwt.sign(
      tokenPayload,
      JWT_SECRET,
      { expiresIn: rememberMe ? '7d' : '24h' }
    );

    res.json({
      success: true,
      data: {
        admin: admin.toSafeObject(),
        token: accessToken,
        expiresIn: rememberMe ? 604800 : 86400, // 7 days or 24 hours in seconds
      },
      timestamp: new Date().toISOString(),
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      code: 'INTERNAL_ERROR',
      timestamp: new Date().toISOString(),
    });
  }
});

app.get('/api/admin/auth/verify', authenticateAdmin, (req, res) => {
  res.json({
    success: true,
    data: {
      admin: req.admin.toSafeObject(),
      isAuthenticated: true
    },
    timestamp: new Date().toISOString(),
  });
});

app.post('/api/admin/auth/logout', authenticateAdmin, (req, res) => {
  // In a real implementation, you would blacklist the token
  res.json({
    success: true,
    message: 'Logged out successfully',
    timestamp: new Date().toISOString(),
  });
});

app.put('/api/admin/auth/profile', authenticateAdmin, async (req, res) => {
  try {
    const { firstName, lastName } = req.body;
    const admin = req.admin;

    if (firstName) admin.firstName = firstName;
    if (lastName) admin.lastName = lastName;

    await admin.save();
    
    res.json({
      success: true,
      data: { admin: admin.toSafeObject() },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update profile',
      code: 'PROFILE_UPDATE_FAILED',
      timestamp: new Date().toISOString(),
    });
  }
});

// Dashboard Analytics
app.get('/api/admin/analytics/dashboard', authenticateAdmin, (req, res) => {
  const mockStats = {
    totalUsers: 12547,
    totalRides: 8923,
    totalPackages: 2156,
    totalRevenue: 145780.50,
    activeUsers: 1834,
    completedRides: 8156,
    pendingDeliveries: 87,
    disputesOpen: 12,
    
    // Revenue trends (last 6 months)
    revenueData: [
      { month: 'Aug 2024', amount: 18420 },
      { month: 'Sep 2024', amount: 21850 },
      { month: 'Oct 2024', amount: 24120 },
      { month: 'Nov 2024', amount: 28940 },
      { month: 'Dec 2024', amount: 31200 },
      { month: 'Jan 2025', amount: 34780 }
    ],
    
    // Service distribution
    serviceDistribution: [
      { name: 'Ride Sharing', value: 78, color: '#8884d8' },
      { name: 'Courier Service', value: 22, color: '#82ca9d' }
    ],
    
    // Recent activity
    recentActivity: [
      {
        id: 1,
        type: 'user_registration',
        description: 'New user registered: John Smith',
        timestamp: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
        icon: 'user'
      },
      {
        id: 2,
        type: 'ride_completed',
        description: 'Ride completed: Lagos to Abuja',
        timestamp: new Date(Date.now() - 12 * 60 * 1000).toISOString(),
        icon: 'car'
      },
      {
        id: 3,
        type: 'dispute_opened',
        description: 'New dispute opened for delivery #DEL-8823',
        timestamp: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        icon: 'alert'
      },
      {
        id: 4,
        type: 'payment_processed',
        description: 'Payment processed: ₦15,500',
        timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        icon: 'payment'
      }
    ],
    
    // System health
    systemHealth: {
      apiResponseTime: 124, // ms
      databaseConnections: 45,
      activeConnections: 234,
      uptime: '15 days, 8 hours',
      memoryUsage: 67, // percentage
      cpuUsage: 23 // percentage
    }
  };

  res.json({
    success: true,
    data: mockStats,
    timestamp: new Date().toISOString(),
  });
});

// Placeholder endpoints that return "Not Implemented" for frontend testing
const notImplemented = (endpoint) => (req, res) => {
  res.status(501).json({
    success: false,
    error: `${endpoint} endpoint not yet implemented`,
    code: 'NOT_IMPLEMENTED',
    timestamp: new Date().toISOString(),
  });
};

// User Management endpoints
app.get('/api/admin/users', authenticateAdmin, notImplemented('GET /api/admin/users'));
app.get('/api/admin/users/:id', authenticateAdmin, notImplemented('GET /api/admin/users/:id'));
app.put('/api/admin/users/:id', authenticateAdmin, notImplemented('PUT /api/admin/users/:id'));
app.post('/api/admin/users/:id/block', authenticateAdmin, notImplemented('POST /api/admin/users/:id/block'));
app.post('/api/admin/users/:id/unblock', authenticateAdmin, notImplemented('POST /api/admin/users/:id/unblock'));
app.put('/api/admin/users/:id/verify', authenticateAdmin, notImplemented('PUT /api/admin/users/:id/verify'));

// Rides Management endpoints
app.get('/api/admin/rides', authenticateAdmin, notImplemented('GET /api/admin/rides'));
app.get('/api/admin/rides/:id', authenticateAdmin, notImplemented('GET /api/admin/rides/:id'));
app.post('/api/admin/rides/:id/cancel', authenticateAdmin, notImplemented('POST /api/admin/rides/:id/cancel'));
app.get('/api/admin/bookings', authenticateAdmin, notImplemented('GET /api/admin/bookings'));

// Courier Management endpoints
app.get('/api/admin/courier/packages', authenticateAdmin, notImplemented('GET /api/admin/courier/packages'));
app.get('/api/admin/courier/disputes', authenticateAdmin, notImplemented('GET /api/admin/courier/disputes'));
app.post('/api/admin/courier/disputes/:id/resolve', authenticateAdmin, notImplemented('POST /api/admin/courier/disputes/:id/resolve'));
app.post('/api/admin/courier/agreements/:id/release-payment', authenticateAdmin, notImplemented('POST /api/admin/courier/agreements/:id/release-payment'));

// Analytics endpoints
app.get('/api/admin/analytics/revenue', authenticateAdmin, notImplemented('GET /api/admin/analytics/revenue'));
app.get('/api/admin/analytics/user-growth', authenticateAdmin, notImplemented('GET /api/admin/analytics/user-growth'));
app.get('/api/admin/analytics/top-routes', authenticateAdmin, notImplemented('GET /api/admin/analytics/top-routes'));

// Settings endpoints
app.get('/api/admin/settings', authenticateAdmin, notImplemented('GET /api/admin/settings'));
app.put('/api/admin/settings', authenticateAdmin, notImplemented('PUT /api/admin/settings'));
app.get('/api/admin/settings/commission', authenticateAdmin, notImplemented('GET /api/admin/settings/commission'));
app.put('/api/admin/settings/commission', authenticateAdmin, notImplemented('PUT /api/admin/settings/commission'));

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Database-integrated admin server is running',
    database: 'PostgreSQL (hitch database on port 5433)',
    timestamp: new Date().toISOString(),
    endpoints: {
      authentication: [
        'POST /api/admin/auth/login',
        'GET /api/admin/auth/verify',
        'POST /api/admin/auth/logout',
        'PUT /api/admin/auth/profile'
      ],
      analytics: [
        'GET /api/admin/analytics/dashboard'
      ],
      placeholder: [
        'User Management (6 endpoints)',
        'Rides Management (4 endpoints)', 
        'Courier Management (4 endpoints)',
        'Analytics (3 endpoints)',
        'Settings (4 endpoints)'
      ]
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    code: 'INTERNAL_ERROR',
    timestamp: new Date().toISOString(),
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: `Route ${req.method} ${req.originalUrl} not found`,
    code: 'ROUTE_NOT_FOUND',
    timestamp: new Date().toISOString(),
  });
});

// Start server
const startServer = async () => {
  const dbConnected = await connectDatabase();
  
  if (!dbConnected) {
    console.error('❌ Cannot start server without database connection');
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`🚀 Database-integrated admin server running on port ${PORT}`);
    console.log(`📊 Dashboard API: http://localhost:${PORT}/api/admin/analytics/dashboard`);
    console.log(`🔐 Database Credentials: admin@hitch.com / admin123`);
    console.log(`🗄️  Database: PostgreSQL (hitch database on port 5433)`);
    console.log(`🩺 Health Check: http://localhost:${PORT}/health`);
    console.log(`\n📋 Available Admin Endpoints:`);
    console.log(`   • POST /api/admin/auth/login - Admin login with database`);
    console.log(`   • GET  /api/admin/auth/verify - Token verification`);
    console.log(`   • GET  /api/admin/analytics/dashboard - Dashboard stats`);
    console.log(`   • All other admin endpoints return 501 Not Implemented`);
  });
};

startServer();