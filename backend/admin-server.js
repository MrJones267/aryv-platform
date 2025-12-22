/**
 * @fileoverview Minimal admin-only server for testing admin panel integration
 * @author Oabona-Majoko
 * @created 2025-01-25
 */

const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

// Middleware
app.use(cors());
app.use(express.json());

// Mock admin users
const adminUsers = [
  {
    id: 'admin-1',
    email: 'admin@hitch.com',
    password: 'admin123', // In production, this would be hashed
    firstName: 'Super',
    lastName: 'Admin',
    role: 'super_admin',
    permissions: ['all'],
    isActive: true,
    lastLogin: new Date().toISOString(),
    createdAt: '2025-01-25T00:00:00.000Z'
  },
  {
    id: 'admin-2',
    email: 'moderator@hitch.com',
    password: 'admin123',
    firstName: 'Site',
    lastName: 'Moderator',
    role: 'moderator',
    permissions: ['user_management', 'dispute_resolution'],
    isActive: true,
    lastLogin: new Date().toISOString(),
    createdAt: '2025-01-25T00:00:00.000Z'
  }
];

// Admin authentication middleware
const authenticateAdmin = (req, res, next) => {
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

    const admin = adminUsers.find(a => a.id === decoded.id && a.isActive);
    if (!admin) {
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
app.post('/api/admin/auth/login', (req, res) => {
  const { email, password } = req.body;

  const admin = adminUsers.find(a => a.email === email && a.password === password && a.isActive);
  
  if (!admin) {
    return res.status(401).json({
      success: false,
      error: 'Invalid credentials',
      code: 'INVALID_CREDENTIALS',
      timestamp: new Date().toISOString(),
    });
  }

  // Generate admin JWT token
  const token = jwt.sign(
    {
      id: admin.id,
      email: admin.email,
      role: admin.role,
      type: 'admin'
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );

  // Update last login
  admin.lastLogin = new Date().toISOString();

  res.json({
    success: true,
    data: {
      admin: {
        id: admin.id,
        email: admin.email,
        firstName: admin.firstName,
        lastName: admin.lastName,
        role: admin.role,
        permissions: admin.permissions,
        lastLogin: admin.lastLogin
      },
      token,
      expiresIn: 86400 // 24 hours in seconds
    },
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/admin/auth/verify', authenticateAdmin, (req, res) => {
  const { password, ...safeAdmin } = req.admin;
  
  res.json({
    success: true,
    data: {
      admin: safeAdmin,
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

app.put('/api/admin/auth/profile', authenticateAdmin, (req, res) => {
  const { firstName, lastName } = req.body;
  const admin = req.admin;

  if (firstName) admin.firstName = firstName;
  if (lastName) admin.lastName = lastName;

  const { password, ...safeAdmin } = admin;
  
  res.json({
    success: true,
    data: { admin: safeAdmin },
    timestamp: new Date().toISOString(),
  });
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
    message: 'Admin server is running',
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
app.listen(PORT, () => {
  console.log(`🚀 Admin server running on port ${PORT}`);
  console.log(`📊 Dashboard API: http://localhost:${PORT}/api/admin/analytics/dashboard`);
  console.log(`🔐 Test Credentials: admin@hitch.com / admin123`);
  console.log(`🩺 Health Check: http://localhost:${PORT}/health`);
  console.log(`\n📋 Available Admin Endpoints:`);
  console.log(`   • POST /api/admin/auth/login - Admin login`);
  console.log(`   • GET  /api/admin/auth/verify - Token verification`);
  console.log(`   • GET  /api/admin/analytics/dashboard - Dashboard stats`);
  console.log(`   • All other admin endpoints return 501 Not Implemented`);
});