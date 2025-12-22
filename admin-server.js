/**
 * Minimal Admin Server for Testing Admin Panel Integration
 * This is a simple Express server to test the admin panel immediately
 */

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3001;
const JWT_SECRET = 'test-secret-key';

// Middleware with mobile device support
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:8081',
    'http://172.30.188.102:3000',
    'http://172.30.188.102:8081',
    'http://192.168.*.*',
    'http://10.0.*.*'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
}));

app.use(express.json());

// Mock admin users
const mockAdmins = [
  {
    id: 'admin-1',
    email: 'admin@aryv-app.com',
    firstName: 'Admin',
    lastName: 'User',
    role: 'super_admin',
    permissions: ['*'],
    isActive: true,
    lastLogin: new Date(),
  },
  {
    id: 'admin-2',
    email: 'moderator@aryv-app.com',
    firstName: 'Moderator',
    lastName: 'User',
    role: 'moderator',
    permissions: ['users.read', 'disputes.manage', 'analytics.read'],
    isActive: true,
    lastLogin: new Date(),
  },
];

// Admin Authentication Middleware
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Access token is required',
      code: 'ACCESS_TOKEN_REQUIRED',
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
      });
    }

    const admin = mockAdmins.find(u => u.id === decoded.id && u.isActive);
    if (!admin) {
      return res.status(401).json({
        success: false,
        error: 'Admin not found or inactive',
        code: 'ADMIN_NOT_FOUND',
      });
    }

    req.user = admin;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
      code: 'INVALID_TOKEN',
    });
  }
};

// Routes

// Health check
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'ARYV Admin Server is running',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

// Admin login
app.post('/api/admin/auth/login', (req, res) => {
  const { email, password, rememberMe } = req.body;

  const admin = mockAdmins.find(u => u.email === email && u.isActive);
  if (!admin || password !== 'admin123') {
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials',
      code: 'INVALID_CREDENTIALS',
    });
  }

  const tokenPayload = {
    id: admin.id,
    email: admin.email,
    role: admin.role,
    permissions: admin.permissions,
    type: 'admin',
  };

  const accessToken = jwt.sign(tokenPayload, JWT_SECRET, {
    expiresIn: rememberMe ? '7d' : '24h'
  });

  const refreshToken = jwt.sign(
    { id: admin.id, type: 'admin' },
    JWT_SECRET + '-refresh',
    { expiresIn: '30d' }
  );

  admin.lastLogin = new Date();

  res.json({
    success: true,
    message: 'Login successful',
    data: {
      user: {
        id: admin.id,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        role: admin.role,
        permissions: admin.permissions,
        lastLogin: admin.lastLogin,
      },
      tokens: {
        accessToken,
        refreshToken,
        expiresIn: rememberMe ? '7d' : '24h',
      },
    },
  });
});

// Admin token verification
app.get('/api/admin/auth/verify', authenticateAdmin, (req, res) => {
  res.json({
    success: true,
    data: {
      user: {
        id: req.user.id,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        role: req.user.role,
        permissions: req.user.permissions,
        lastLogin: req.user.lastLogin,
      },
    },
  });
});

// Admin logout
app.post('/api/admin/auth/logout', authenticateAdmin, (req, res) => {
  res.json({
    success: true,
    message: 'Logout successful',
  });
});

// Update admin profile
app.put('/api/admin/auth/profile', authenticateAdmin, (req, res) => {
  const { firstName, lastName } = req.body;
  
  if (firstName) req.user.firstName = firstName;
  if (lastName) req.user.lastName = lastName;
  req.user.updatedAt = new Date();

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: {
      user: {
        id: req.user.id,
        email: req.user.email,
        firstName: req.user.firstName,
        lastName: req.user.lastName,
        role: req.user.role,
        permissions: req.user.permissions,
        lastLogin: req.user.lastLogin,
      },
    },
  });
});

// Dashboard statistics
app.get('/api/admin/analytics/dashboard', authenticateAdmin, (req, res) => {
  const stats = {
    users: {
      total: 45230,
      active: 38500,
      verified: 42100,
      blocked: 150,
      newThisMonth: 2340,
      growthRate: 12.5,
    },
    rides: {
      total: 8450,
      active: 245,
      completed: 7890,
      cancelled: 315,
      newThisMonth: 890,
      completionRate: 94.2,
    },
    courier: {
      totalPackages: 3120,
      activeDeliveries: 85,
      completed: 2890,
      disputed: 12,
      newThisMonth: 420,
      successRate: 96.8,
    },
    revenue: {
      total: 45500,
      thisMonth: 12300,
      lastMonth: 10800,
      growthRate: 18.7,
      ridesRevenue: 32500,
      courierRevenue: 13000,
    },
    disputes: {
      total: 12,
      open: 3,
      investigating: 5,
      resolved: 4,
      avgResolutionTime: 2.4,
    },
  };

  res.json({
    success: true,
    data: stats,
  });
});

// Placeholder endpoints for other admin APIs
const createPlaceholderEndpoint = (method, path, description) => {
  app[method](path, authenticateAdmin, (req, res) => {
    res.status(501).json({
      success: false,
      error: `${description} not yet implemented`,
      code: 'NOT_IMPLEMENTED',
      message: 'This endpoint is planned for future development',
    });
  });
};

// User management endpoints
createPlaceholderEndpoint('get', '/api/admin/users', 'User management');
createPlaceholderEndpoint('get', '/api/admin/users/:id', 'User details');
createPlaceholderEndpoint('put', '/api/admin/users/:id', 'User updates');
createPlaceholderEndpoint('post', '/api/admin/users/:id/block', 'User blocking');
createPlaceholderEndpoint('post', '/api/admin/users/:id/unblock', 'User unblocking');
createPlaceholderEndpoint('put', '/api/admin/users/:id/verify', 'User verification');

// Rides management endpoints
createPlaceholderEndpoint('get', '/api/admin/rides', 'Rides management');
createPlaceholderEndpoint('get', '/api/admin/rides/:id', 'Ride details');
createPlaceholderEndpoint('post', '/api/admin/rides/:id/cancel', 'Ride cancellation');
createPlaceholderEndpoint('get', '/api/admin/bookings', 'Bookings management');

// Courier and disputes endpoints
createPlaceholderEndpoint('get', '/api/admin/courier/disputes', 'Courier disputes');
createPlaceholderEndpoint('post', '/api/admin/courier/disputes/:id/resolve', 'Dispute resolution');
createPlaceholderEndpoint('get', '/api/admin/courier/packages', 'Package management');
createPlaceholderEndpoint('post', '/api/admin/courier/agreements/:id/release-payment', 'Payment release');

// Analytics endpoints
createPlaceholderEndpoint('get', '/api/admin/analytics/revenue', 'Revenue analytics');
createPlaceholderEndpoint('get', '/api/admin/analytics/user-growth', 'User growth analytics');
createPlaceholderEndpoint('get', '/api/admin/analytics/top-routes', 'Top routes analytics');

// Settings endpoints
createPlaceholderEndpoint('get', '/api/admin/settings', 'Settings management');
createPlaceholderEndpoint('put', '/api/admin/settings', 'Settings updates');
createPlaceholderEndpoint('get', '/api/admin/settings/commission', 'Commission settings');
createPlaceholderEndpoint('put', '/api/admin/settings/commission', 'Commission updates');

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 ARYV Admin Server running on port ${PORT}`);
  console.log(`🔗 Health check: http://172.30.188.102:${PORT}/health`);
  console.log(`👨‍💼 Admin login: POST http://172.30.188.102:${PORT}/api/admin/auth/login`);
  console.log(`📊 Dashboard: GET http://172.30.188.102:${PORT}/api/admin/analytics/dashboard`);
  console.log('');
  console.log('📱 MOBILE TESTING READY:');
  console.log('Test from phone browser: http://172.30.188.102:3001/health');
  console.log('');
  console.log('Test credentials:');
  console.log('Email: admin@aryv-app.com');
  console.log('Password: admin123');
  console.log('');
  console.log('Ready for mobile device testing! 🎉');
});

module.exports = app;