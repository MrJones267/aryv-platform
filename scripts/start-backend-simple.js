// Simple Backend Server for Mobile Testing
// This bypasses TypeScript compilation issues for quick mobile testing

const express = require('express');
const cors = require('cors');
const app = express();
const PORT = 3001;

// Enable CORS for mobile device access
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:8081',
    'http://172.30.188.102:3000',
    'http://172.30.188.102:8081',
    'http://192.168.*.*',
    'http://10.0.*.*',
  ],
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Hitch Backend Server Running',
    timestamp: new Date().toISOString(),
    environment: 'mobile-testing'
  });
});

// Mock admin authentication endpoint
app.post('/api/admin/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  if (email === 'admin@hitch.com' && password === 'admin123') {
    res.json({
      success: true,
      message: 'Authentication successful',
      token: 'mock-jwt-token-for-mobile-testing-' + Date.now(),
      user: {
        id: 1,
        email: 'admin@hitch.com',
        role: 'admin'
      }
    });
  } else {
    res.status(401).json({
      success: false,
      message: 'Invalid credentials'
    });
  }
});

// Mock dashboard analytics endpoint
app.get('/api/admin/analytics/dashboard', (req, res) => {
  res.json({
    success: true,
    data: {
      totalUsers: 150,
      totalRides: 1250,
      totalRevenue: 25000,
      activeDrivers: 45,
      completedRides: 1100,
      pendingRides: 12
    }
  });
});

// Mock user registration endpoint
app.post('/api/auth/register', (req, res) => {
  const { email, password, phone, firstName, lastName } = req.body;
  
  res.json({
    success: true,
    message: 'User registered successfully',
    user: {
      id: Date.now(),
      email,
      firstName,
      lastName,
      phone
    }
  });
});

// Mock user login endpoint
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  res.json({
    success: true,
    message: 'Login successful',
    token: 'mock-user-jwt-token-' + Date.now(),
    user: {
      id: Date.now(),
      email,
      role: 'user'
    }
  });
});

// Mock ride booking endpoint
app.post('/api/rides/book', (req, res) => {
  const { pickupLocation, destination, rideType } = req.body;
  
  res.json({
    success: true,
    message: 'Ride booked successfully',
    booking: {
      id: Date.now(),
      pickupLocation,
      destination,
      rideType,
      estimatedFare: 25.50,
      estimatedTime: '15 minutes',
      status: 'confirmed'
    }
  });
});

// Mock rides list endpoint
app.get('/api/rides', (req, res) => {
  res.json({
    success: true,
    rides: [
      {
        id: 1,
        pickup: 'Downtown Station',
        destination: 'Airport Terminal',
        status: 'completed',
        fare: 45.00,
        date: '2025-01-27'
      },
      {
        id: 2,
        pickup: 'Shopping Mall',
        destination: 'Hotel Plaza',
        status: 'in-progress',
        fare: 25.50,
        date: '2025-01-27'
      }
    ]
  });
});

// Mock courier package endpoints
app.post('/api/courier/packages', (req, res) => {
  const { senderName, receiverName, packageDetails } = req.body;
  
  res.json({
    success: true,
    message: 'Package created successfully',
    package: {
      id: Date.now(),
      trackingNumber: 'HTC-' + Date.now(),
      senderName,
      receiverName,
      packageDetails,
      status: 'created',
      qrCode: 'mock-qr-code-data'
    }
  });
});

// Mock package tracking
app.get('/api/courier/packages/:id', (req, res) => {
  const { id } = req.params;
  
  res.json({
    success: true,
    package: {
      id,
      trackingNumber: 'HTC-' + id,
      status: 'in-transit',
      currentLocation: 'Distribution Center',
      estimatedDelivery: '2025-01-28 15:00',
      courierInfo: {
        name: 'John Driver',
        phone: '+1234567890'
      }
    }
  });
});

// Catch-all endpoint for testing
app.all('*', (req, res) => {
  res.json({
    success: true,
    message: 'Hitch API endpoint',
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body,
    note: 'This is a mock endpoint for mobile testing'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Hitch Backend Server running on http://0.0.0.0:${PORT}`);
  console.log(`📱 Mobile testing ready at: http://172.30.188.102:${PORT}`);
  console.log(`🔗 Health check: http://172.30.188.102:${PORT}/health`);
  console.log('');
  console.log('🧪 Available endpoints:');
  console.log('   GET  /health - Health check');
  console.log('   POST /api/admin/auth/login - Admin login');
  console.log('   POST /api/auth/register - User registration');
  console.log('   POST /api/auth/login - User login');
  console.log('   POST /api/rides/book - Book a ride');
  console.log('   GET  /api/rides - Get rides');
  console.log('   POST /api/courier/packages - Create package');
  console.log('   GET  /api/courier/packages/:id - Track package');
});