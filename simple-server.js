// Ultra-Simple Backend Server for Mobile Testing
// Pure Node.js - no external dependencies needed

const http = require('http');
const url = require('url');

const PORT = 3001;
const HOST = '0.0.0.0';

// Mock data for testing
const mockUsers = [
  { id: 1, email: 'admin@aryv-app.com', password: 'admin123', role: 'admin' },
  { id: 2, email: 'user@aryv-app.com', password: 'user123', role: 'user' }
];

const mockRides = [
  { id: 1, pickup: 'Downtown Station', destination: 'Airport Terminal', status: 'completed', fare: 45.00 },
  { id: 2, pickup: 'Shopping Mall', destination: 'Hotel Plaza', status: 'in-progress', fare: 25.50 }
];

// Helper function to parse JSON body
function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}

// Helper function to send JSON response with CORS
function sendJSON(res, data, statusCode = 200) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Content-Type': 'application/json'
  };
  
  res.writeHead(statusCode, corsHeaders);
  res.end(JSON.stringify(data, null, 2));
}

// Handle CORS preflight requests
function handleCORS(req, res) {
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true'
    });
    res.end();
    return true;
  }
  return false;
}

// Create server
const server = http.createServer(async (req, res) => {
  // Handle CORS preflight
  if (handleCORS(req, res)) return;

  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  const method = req.method;
  const timestamp = new Date().toISOString();

  console.log(`[${timestamp}] ${method} ${path}`);

  try {
    // Health check endpoint
    if (path === '/health' && method === 'GET') {
      return sendJSON(res, {
        success: true,
        message: 'Admin server running',
        timestamp,
        environment: 'mobile-testing',
        server: 'aryv-backend',
        version: '1.0.0'
      });
    }

    // Admin authentication endpoint
    if (path === '/api/admin/auth/login' && method === 'POST') {
      const body = await parseBody(req);
      const { email, password } = body;
      
      const user = mockUsers.find(u => u.email === email && u.password === password && u.role === 'admin');
      
      if (user) {
        return sendJSON(res, {
          success: true,
          message: 'Login successful',
          token: 'mock-admin-jwt-token-' + Date.now() + '-mobile-testing',
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            firstName: 'Admin',
            lastName: 'User'
          }
        });
      } else {
        return sendJSON(res, {
          success: false,
          message: 'Invalid credentials'
        }, 401);
      }
    }

    // User registration endpoint
    if (path === '/api/auth/register' && method === 'POST') {
      const body = await parseBody(req);
      const { email, password, firstName, lastName, phone } = body;
      
      return sendJSON(res, {
        success: true,
        message: 'User registered successfully',
        data: {
          accessToken: 'mock-user-jwt-token-' + Date.now() + '-mobile-testing',
          refreshToken: 'mock-refresh-token-' + Date.now() + '-mobile-testing',
          expiresIn: 3600,
          user: {
            id: Date.now(),
            email,
            firstName: firstName || 'Test',
            lastName: lastName || 'User',
            phone: phone || '+1234567890',
            role: 'user'
          }
        }
      });
    }

    // User login endpoint
    if ((path === '/api/auth/login' || path === '/auth/login') && method === 'POST') {
      const body = await parseBody(req);
      const { email, password } = body;
      
      return sendJSON(res, {
        success: true,
        message: 'Login successful',
        data: {
          accessToken: 'mock-user-jwt-token-' + Date.now() + '-mobile-testing',
          refreshToken: 'mock-refresh-token-' + Date.now() + '-mobile-testing',
          expiresIn: 3600,
          user: {
            id: Date.now(),
            email,
            role: 'user',
            firstName: 'Test',
            lastName: 'User'
          }
        }
      });
    }

    // Dashboard analytics endpoint
    if (path === '/api/admin/analytics/dashboard' && method === 'GET') {
      return sendJSON(res, {
        success: true,
        message: 'Dashboard data retrieved',
        data: {
          totalUsers: 150,
          totalRides: 1250,
          totalRevenue: 25000,
          activeDrivers: 45,
          completedRides: 1100,
          pendingRides: 12,
          courierPackages: 85,
          disputesOpen: 3
        }
      });
    }

    // Book ride endpoint
    if (path === '/api/rides/book' && method === 'POST') {
      const body = await parseBody(req);
      const { pickupLocation, destination, rideType } = body;
      
      return sendJSON(res, {
        success: true,
        message: 'Ride booked successfully',
        booking: {
          id: Date.now(),
          pickupLocation: pickupLocation || 'Current Location',
          destination: destination || 'Destination',
          rideType: rideType || 'Standard',
          estimatedFare: 25.50,
          estimatedTime: '15 minutes',
          driverName: 'John Driver',
          vehicleInfo: 'Toyota Camry - ABC123',
          status: 'confirmed'
        }
      });
    }

    // Get rides list endpoint
    if (path === '/api/rides' && method === 'GET') {
      return sendJSON(res, {
        success: true,
        message: 'Rides retrieved successfully',
        rides: mockRides
      });
    }

    // Create package delivery endpoint
    if (path === '/api/courier/packages' && method === 'POST') {
      const body = await parseBody(req);
      const { senderName, receiverName, packageDetails, pickupLocation, deliveryLocation } = body;
      
      return sendJSON(res, {
        success: true,
        message: 'Package created successfully',
        package: {
          id: Date.now(),
          trackingNumber: 'ARYV-' + Date.now(),
          senderName: senderName || 'Test Sender',
          receiverName: receiverName || 'Test Receiver',
          packageDetails: packageDetails || 'Test Package',
          pickupLocation: pickupLocation || 'Pickup Location',
          deliveryLocation: deliveryLocation || 'Delivery Location',
          status: 'created',
          qrCode: 'MOCK-QR-CODE-' + Date.now(),
          estimatedDelivery: '2025-01-28 15:00'
        }
      });
    }

    // Track package endpoint
    if (path.startsWith('/api/courier/packages/') && method === 'GET') {
      const packageId = path.split('/').pop();
      
      return sendJSON(res, {
        success: true,
        message: 'Package tracking retrieved',
        package: {
          id: packageId,
          trackingNumber: 'ARYV-' + packageId,
          status: 'in-transit',
          currentLocation: 'Distribution Center',
          estimatedDelivery: '2025-01-28 15:00',
          courierInfo: {
            name: 'Jane Courier',
            phone: '+1234567890',
            vehicleInfo: 'Honda Civic - XYZ789'
          },
          timeline: [
            { status: 'created', time: '2025-01-27 10:00', location: 'Origin' },
            { status: 'picked-up', time: '2025-01-27 11:00', location: 'Pickup Location' },
            { status: 'in-transit', time: '2025-01-27 12:00', location: 'Distribution Center' }
          ]
        }
      });
    }

    // Token verification endpoint (admin)
    if (path === '/api/admin/auth/verify' && method === 'GET') {
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        return sendJSON(res, {
          success: true,
          message: 'Token verified',
          user: {
            id: 1,
            email: 'admin@aryv-app.com',
            role: 'admin',
            firstName: 'Admin',
            lastName: 'User'
          }
        });
      } else {
        return sendJSON(res, {
          success: false,
          message: 'Token required'
        }, 401);
      }
    }

    // User token verification endpoint
    if (path === '/api/auth/verify' && method === 'GET') {
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        return sendJSON(res, {
          success: true,
          message: 'Token verified',
          data: {
            user: {
              id: Date.now(),
              email: 'user@aryv-app.com',
              role: 'user',
              firstName: 'Test',
              lastName: 'User',
              phone: '+1234567890'
            },
            tokenValid: true
          }
        });
      } else {
        return sendJSON(res, {
          success: false,
          message: 'Token required'
        }, 401);
      }
    }

    // User profile endpoint
    if (path === '/api/auth/profile' && method === 'GET') {
      const authHeader = req.headers.authorization;
      
      if (authHeader && authHeader.startsWith('Bearer ')) {
        return sendJSON(res, {
          success: true,
          message: 'Profile retrieved successfully',
          data: {
            id: Date.now(),
            email: 'user@aryv-app.com',
            firstName: 'Test',
            lastName: 'User',
            phone: '+1234567890',
            role: 'user',
            profilePicture: null,
            bio: 'Mobile testing user',
            isEmailVerified: true,
            isPhoneVerified: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        });
      } else {
        return sendJSON(res, {
          success: false,
          message: 'Authentication required'
        }, 401);
      }
    }

    // Token refresh endpoint
    if (path === '/api/auth/refresh' && method === 'POST') {
      const body = await parseBody(req);
      const { refreshToken } = body;
      
      if (refreshToken && refreshToken.includes('mock-refresh-token')) {
        return sendJSON(res, {
          success: true,
          message: 'Token refreshed successfully',
          data: {
            accessToken: 'mock-user-jwt-token-' + Date.now() + '-mobile-testing',
            refreshToken: 'mock-refresh-token-' + Date.now() + '-mobile-testing',
            expiresIn: 3600
          }
        });
      } else {
        return sendJSON(res, {
          success: false,
          message: 'Invalid refresh token'
        }, 401);
      }
    }

    // Default catch-all endpoint
    return sendJSON(res, {
      success: true,
      message: 'ARYV API Mock Endpoint',
      endpoint: {
        method,
        path,
        timestamp
      },
      note: 'This is a mock endpoint for mobile testing',
      availableEndpoints: [
        'GET /health',
        'POST /api/admin/auth/login',
        'POST /api/auth/register',
        'POST /api/auth/login',
        'GET /api/admin/analytics/dashboard',
        'POST /api/rides/book',
        'GET /api/rides',
        'POST /api/courier/packages',
        'GET /api/courier/packages/:id',
        'GET /api/admin/auth/verify'
      ]
    });

  } catch (error) {
    console.error(`[${timestamp}] Server error:`, error);
    return sendJSON(res, {
      success: false,
      message: 'Internal server error',
      error: error.message,
      timestamp
    }, 500);
  }
});

// Start server
server.listen(PORT, HOST, () => {
  console.log('🚀 ARYV BACKEND SERVER - MOBILE TESTING');
  console.log('==========================================');
  console.log('');
  console.log(`✅ Server running on: http://${HOST}:${PORT}`);
  console.log(`📱 Mobile access URL: http://172.30.188.102:${PORT}`);
  console.log(`🔗 Health check: http://172.30.188.102:${PORT}/health`);
  console.log('');
  console.log('🧪 TESTING ENDPOINTS:');
  console.log(`   GET    http://172.30.188.102:${PORT}/health`);
  console.log(`   POST   http://172.30.188.102:${PORT}/api/admin/auth/login`);
  console.log(`   POST   http://172.30.188.102:${PORT}/api/auth/register`);
  console.log(`   POST   http://172.30.188.102:${PORT}/api/auth/login`);
  console.log(`   POST   http://172.30.188.102:${PORT}/api/rides/book`);
  console.log(`   GET    http://172.30.188.102:${PORT}/api/rides`);
  console.log(`   POST   http://172.30.188.102:${PORT}/api/courier/packages`);
  console.log(`   GET    http://172.30.188.102:${PORT}/api/courier/packages/:id`);
  console.log('');
  console.log('🔑 TEST CREDENTIALS:');
  console.log('   Admin: admin@aryv-app.com / admin123');
  console.log('   User:  user@aryv-app.com / user123');
  console.log('');
  console.log('📱 MOBILE TESTING STEPS:');
  console.log('1. Test from phone browser: http://172.30.188.102:3001/health');
  console.log('2. Connect Android/iOS device via USB');
  console.log('3. Run: cd mobile-app && npx react-native run-android');
  console.log('4. Run: cd mobile-app && npx react-native run-ios --device');
  console.log('');
  console.log('🎉 Ready for comprehensive mobile device testing!');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down server gracefully...');
  server.close(() => {
    console.log('✅ Server shut down complete');
    process.exit(0);
  });
});