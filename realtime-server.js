// Real-time Backend Server with Socket.io for Mobile Testing
// Enhanced version with Socket.io real-time features

const http = require('http');
const url = require('url');
const { Server } = require('socket.io');

const PORT = 3001;
const HOST = '0.0.0.0';

// Mock data for testing
const mockUsers = [
  { id: 1, email: 'admin@hitch.com', password: 'admin123', role: 'admin' },
  { id: 2, email: 'user@hitch.com', password: 'user123', role: 'user' },
  { id: 3, email: 'driver@hitch.com', password: 'driver123', role: 'driver' }
];

const mockRides = [
  { 
    id: 1, 
    pickup: 'Downtown Station', 
    destination: 'Airport Terminal', 
    status: 'completed', 
    fare: 45.00,
    driverId: 3,
    driverName: 'John Driver',
    passengers: 2
  },
  { 
    id: 2, 
    pickup: 'Shopping Mall', 
    destination: 'Hotel Plaza', 
    status: 'in-progress', 
    fare: 25.50,
    driverId: 3,
    driverName: 'Jane Driver',
    passengers: 1
  }
];

// Real-time data storage
const connectedUsers = new Map(); // userId -> socket.id
const activeRides = new Map(); // rideId -> ride data
const liveLocations = new Map(); // userId -> location data

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

// Create HTTP server
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
        message: 'Real-time Hitch backend running',
        timestamp,
        environment: 'real-time-testing',
        server: 'hitch-realtime-backend',
        version: '1.0.0',
        features: ['socket.io', 'real-time-tracking', 'live-notifications'],
        connectedUsers: connectedUsers.size,
        activeRides: activeRides.size
      });
    }

    // Root endpoint - Socket.io info
    if (path === '/' && method === 'GET') {
      return sendJSON(res, {
        success: true,
        message: 'Hitch Real-time API Server',
        socketio: {
          enabled: true,
          endpoint: '/socket.io/',
          events: ['connect', 'disconnect', 'authenticate', 'join_ride', 'location_update', 'ride_update', 'notification']
        },
        api: {
          health: 'GET /health',
          auth: 'POST /api/auth/*',
          rides: 'POST /api/rides/*',
          courier: 'POST /api/courier/*',
          realtime: 'Socket.io on port 3001'
        },
        timestamp
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
          message: 'Admin login successful',
          token: 'mock-admin-jwt-token-' + Date.now() + '-realtime',
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
          message: 'Invalid admin credentials'
        }, 401);
      }
    }

    // User registration endpoint
    if (path === '/api/auth/register' && method === 'POST') {
      const body = await parseBody(req);
      const { email, password, firstName, lastName, phone } = body;
      
      const newUserId = Date.now();
      return sendJSON(res, {
        success: true,
        message: 'User registered successfully',
        data: {
          accessToken: 'mock-user-jwt-token-' + newUserId + '-realtime',
          refreshToken: 'mock-refresh-token-' + newUserId + '-realtime',
          expiresIn: 3600,
          user: {
            id: newUserId,
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
      
      const userId = Date.now();
      return sendJSON(res, {
        success: true,
        message: 'Login successful',
        data: {
          accessToken: 'mock-user-jwt-token-' + userId + '-realtime',
          refreshToken: 'mock-refresh-token-' + userId + '-realtime',
          expiresIn: 3600,
          user: {
            id: userId,
            email,
            role: 'user',
            firstName: 'Test',
            lastName: 'User'
          }
        }
      });
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
            email: 'user@hitch.com',
            firstName: 'Test',
            lastName: 'User',
            phone: '+1234567890',
            role: 'user',
            profilePicture: null,
            bio: 'Real-time testing user',
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
            accessToken: 'mock-user-jwt-token-' + Date.now() + '-realtime',
            refreshToken: 'mock-refresh-token-' + Date.now() + '-realtime',
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

    // Book ride endpoint with real-time updates
    if (path === '/api/rides/book' && method === 'POST') {
      const body = await parseBody(req);
      const { pickupLocation, destination, rideType } = body;
      
      const rideId = Date.now();
      const ride = {
        id: rideId,
        pickupLocation: pickupLocation || 'Current Location',
        destination: destination || 'Destination',
        rideType: rideType || 'Standard',
        estimatedFare: 25.50,
        estimatedTime: '15 minutes',
        driverName: 'John Driver',
        vehicleInfo: 'Toyota Camry - ABC123',
        status: 'confirmed',
        timestamp: new Date().toISOString()
      };
      
      // Store in active rides
      activeRides.set(rideId, ride);
      
      // Emit real-time update to all connected clients
      if (io) {
        io.emit('ride_booked', {
          type: 'ride_booked',
          data: ride,
          message: 'New ride has been booked',
          timestamp: new Date().toISOString()
        });
      }
      
      return sendJSON(res, {
        success: true,
        message: 'Ride booked successfully',
        booking: ride
      });
    }

    // Get rides list endpoint
    if (path === '/api/rides' && method === 'GET') {
      // Include active rides in response
      const allRides = [...mockRides, ...Array.from(activeRides.values())];
      
      return sendJSON(res, {
        success: true,
        message: 'Rides retrieved successfully',
        rides: allRides,
        activeRides: activeRides.size,
        connectedUsers: connectedUsers.size
      });
    }

    // Create package delivery endpoint with real-time tracking
    if (path === '/api/courier/packages' && method === 'POST') {
      const body = await parseBody(req);
      const { senderName, receiverName, packageDetails, pickupLocation, deliveryLocation } = body;
      
      const packageId = Date.now();
      const trackingNumber = 'HTC-' + packageId;
      const packageData = {
        id: packageId,
        trackingNumber,
        senderName: senderName || 'Test Sender',
        receiverName: receiverName || 'Test Receiver',
        packageDetails: packageDetails || 'Test Package',
        pickupLocation: pickupLocation || 'Pickup Location',
        deliveryLocation: deliveryLocation || 'Delivery Location',
        status: 'created',
        qrCode: 'MOCK-QR-CODE-' + packageId,
        estimatedDelivery: '2025-01-28 15:00',
        realTimeTracking: true,
        timestamp: new Date().toISOString()
      };
      
      // Emit real-time update
      if (io) {
        io.emit('package_created', {
          type: 'package_created',
          data: packageData,
          message: 'New package has been created',
          timestamp: new Date().toISOString()
        });
      }
      
      return sendJSON(res, {
        success: true,
        message: 'Package created successfully',
        package: packageData
      });
    }

    // Get user packages endpoint (requires auth)
    if (path === '/api/courier/user/packages' && method === 'GET') {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return sendJSON(res, {
          success: false,
          message: 'Authentication required'
        }, 401);
      }

      const mockUserPackages = [
        {
          id: 'pkg_001',
          trackingNumber: 'HTC-001',
          status: 'delivered',
          senderName: 'John Doe',
          receiverName: 'Current User',
          packageDetails: 'Electronics',
          createdAt: '2025-01-20T10:00:00Z',
          deliveredAt: '2025-01-21T14:30:00Z'
        },
        {
          id: 'pkg_002', 
          trackingNumber: 'HTC-002',
          status: 'in-transit',
          senderName: 'Jane Smith',
          receiverName: 'Current User',
          packageDetails: 'Documents',
          createdAt: '2025-01-25T09:00:00Z',
          estimatedDelivery: '2025-01-28T15:00:00Z'
        }
      ];

      return sendJSON(res, {
        success: true,
        message: 'User packages retrieved',
        packages: mockUserPackages
      });
    }

    // Get available packages endpoint (for couriers)
    if (path === '/api/courier/available/packages' && method === 'GET') {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return sendJSON(res, {
          success: false,
          message: 'Authentication required'
        }, 401);
      }

      const mockAvailablePackages = [
        {
          id: 'pkg_003',
          trackingNumber: 'HTC-003',
          senderName: 'Alice Johnson',
          receiverName: 'Bob Wilson',
          packageDetails: 'Books',
          pickupLocation: 'Downtown Library',
          deliveryLocation: 'University Campus',
          distance: '5.2 km',
          estimatedTime: '25 mins',
          fee: '$12.50',
          priority: 'normal'
        },
        {
          id: 'pkg_004',
          trackingNumber: 'HTC-004', 
          senderName: 'Mike Brown',
          receiverName: 'Sarah Davis',
          packageDetails: 'Medical supplies',
          pickupLocation: 'City Hospital',
          deliveryLocation: 'Clinic Center',
          distance: '8.1 km',
          estimatedTime: '35 mins',
          fee: '$18.00',
          priority: 'urgent'
        }
      ];

      return sendJSON(res, {
        success: true,
        message: 'Available packages retrieved',
        packages: mockAvailablePackages
      });
    }

    // Get courier deliveries endpoint
    if (path === '/api/courier/deliveries' && method === 'GET') {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return sendJSON(res, {
          success: false,
          message: 'Authentication required'
        }, 401);
      }

      const mockCourierDeliveries = [
        {
          id: 'delivery_001',
          packageId: 'pkg_005',
          trackingNumber: 'HTC-005',
          status: 'picked-up',
          pickupTime: '2025-01-27T11:30:00Z',
          estimatedDelivery: '2025-01-27T16:00:00Z',
          customerName: 'Robert Taylor',
          deliveryAddress: '123 Main St, Downtown',
          packageDetails: 'Food delivery',
          fee: '$8.50'
        },
        {
          id: 'delivery_002',
          packageId: 'pkg_006',
          trackingNumber: 'HTC-006',
          status: 'pending',
          scheduledPickup: '2025-01-27T15:00:00Z',
          estimatedDelivery: '2025-01-27T18:30:00Z',
          customerName: 'Lisa Anderson',
          deliveryAddress: '456 Oak Ave, Suburbs',
          packageDetails: 'Retail goods',
          fee: '$15.75'
        }
      ];

      return sendJSON(res, {
        success: true,
        message: 'Courier deliveries retrieved',
        deliveries: mockCourierDeliveries
      });
    }

    // Get delivery tiers endpoint
    if (path === '/api/courier/delivery-tiers' && method === 'GET') {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return sendJSON(res, {
          success: false,
          message: 'Authentication required'
        }, 401);
      }

      const mockDeliveryTiers = [
        {
          id: 'tier_standard',
          name: 'Standard Delivery',
          description: 'Regular delivery within 2-4 hours',
          basePrice: 5.00,
          pricePerKm: 1.50,
          estimatedTime: '2-4 hours',
          priority: 'normal'
        },
        {
          id: 'tier_express',
          name: 'Express Delivery',
          description: 'Fast delivery within 1-2 hours',
          basePrice: 8.00,
          pricePerKm: 2.00,
          estimatedTime: '1-2 hours',
          priority: 'high'
        },
        {
          id: 'tier_urgent',
          name: 'Urgent Delivery',
          description: 'Same-day delivery within 30-60 minutes',
          basePrice: 12.00,
          pricePerKm: 3.00,
          estimatedTime: '30-60 minutes',
          priority: 'urgent'
        }
      ];

      return sendJSON(res, {
        success: true,
        message: 'Delivery tiers retrieved',
        data: mockDeliveryTiers
      });
    }

    // Auth verify endpoint
    if (path === '/auth/verify' && method === 'GET') {
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return sendJSON(res, {
          success: false,
          message: 'Authentication required'
        }, 401);
      }

      const token = authHeader.replace('Bearer ', '');
      
      // Mock successful token verification
      return sendJSON(res, {
        success: true,
        message: 'Token verified successfully',
        data: {
          user: {
            id: Date.now(),
            email: 'testuser@example.com',
            firstName: 'Test',
            lastName: 'User',
            role: 'user',
            status: 'active',
            isEmailVerified: true,
            isPhoneVerified: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          },
          tokenValid: true
        }
      });
    }

    // Track package endpoint with real-time updates
    if (path.startsWith('/api/courier/packages/') && method === 'GET') {
      const packageId = path.split('/').pop();
      
      const packageData = {
        id: packageId,
        trackingNumber: 'HTC-' + packageId,
        status: 'in-transit',
        currentLocation: 'Distribution Center',
        estimatedDelivery: '2025-01-28 15:00',
        courierInfo: {
          name: 'Jane Courier',
          phone: '+1234567890',
          vehicleInfo: 'Honda Civic - XYZ789',
          currentLat: 6.5244 + (Math.random() - 0.5) * 0.01,
          currentLng: 3.3792 + (Math.random() - 0.5) * 0.01
        },
        timeline: [
          { status: 'created', time: '2025-01-27 10:00', location: 'Origin' },
          { status: 'picked-up', time: '2025-01-27 11:00', location: 'Pickup Location' },
          { status: 'in-transit', time: '2025-01-27 12:00', location: 'Distribution Center' }
        ],
        realTimeTracking: true,
        timestamp: new Date().toISOString()
      };
      
      return sendJSON(res, {
        success: true,
        message: 'Package tracking retrieved',
        package: packageData
      });
    }

    // Default catch-all endpoint
    return sendJSON(res, {
      success: true,
      message: 'Hitch Real-time API Mock Endpoint',
      endpoint: {
        method,
        path,
        timestamp
      },
      socketio: {
        enabled: true,
        connectedUsers: connectedUsers.size,
        activeRides: activeRides.size
      },
      availableEndpoints: [
        'GET /health',
        'GET / (Socket.io info)',
        'POST /api/admin/auth/login',
        'POST /api/auth/register',
        'POST /api/auth/login',
        'GET /api/auth/profile',
        'POST /api/auth/refresh',
        'POST /api/rides/book',
        'GET /api/rides',
        'POST /api/courier/packages',
        'GET /api/courier/packages/:id'
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

// Initialize Socket.io
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  },
  allowEIO3: true
});

// Socket.io event handlers
io.on('connection', (socket) => {
  console.log(`[${new Date().toISOString()}] Socket connected: ${socket.id}`);

  // User authentication
  socket.on('authenticate', (data) => {
    try {
      const { userId, token } = data;
      if (userId && token) {
        connectedUsers.set(userId, socket.id);
        socket.userId = userId;
        socket.join(`user_${userId}`);
        
        console.log(`[${new Date().toISOString()}] User authenticated: ${userId}`);
        
        socket.emit('authenticated', { 
          success: true, 
          userId,
          connectedUsers: connectedUsers.size,
          message: 'Successfully authenticated and joined real-time updates'
        });
        
        // Broadcast user connected
        socket.broadcast.emit('user_connected', {
          type: 'user_connected',
          userId,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      socket.emit('authenticated', { success: false, error: error.message });
    }
  });

  // Join specific ride room for real-time updates
  socket.on('join_ride', (data) => {
    const { rideId } = data;
    socket.join(`ride_${rideId}`);
    console.log(`[${new Date().toISOString()}] Socket ${socket.id} joined ride ${rideId}`);
    
    socket.emit('joined_ride', {
      success: true,
      rideId,
      message: 'Joined ride for real-time updates'
    });
  });

  // Real-time location updates
  socket.on('location_update', (data) => {
    const { userId, latitude, longitude, heading, speed } = data;
    
    const locationData = {
      userId,
      latitude,
      longitude,
      heading: heading || 0,
      speed: speed || 0,
      timestamp: new Date().toISOString()
    };
    
    liveLocations.set(userId, locationData);
    
    // Broadcast to relevant users (ride participants, courier tracking, etc.)
    socket.broadcast.emit('live_location', {
      type: 'location_update',
      data: locationData,
      timestamp: new Date().toISOString()
    });
    
    console.log(`[${new Date().toISOString()}] Location update from ${userId}: ${latitude}, ${longitude}`);
  });

  // Ride status updates
  socket.on('ride_update', (data) => {
    const { rideId, status, location, message } = data;
    
    const updateData = {
      rideId,
      status,
      location,
      message,
      timestamp: new Date().toISOString()
    };
    
    // Update active ride
    if (activeRides.has(rideId)) {
      const ride = activeRides.get(rideId);
      ride.status = status;
      ride.lastUpdate = new Date().toISOString();
      activeRides.set(rideId, ride);
    }
    
    // Broadcast to ride room
    io.to(`ride_${rideId}`).emit('ride_status_update', {
      type: 'ride_status_update',
      data: updateData,
      timestamp: new Date().toISOString()
    });
    
    console.log(`[${new Date().toISOString()}] Ride ${rideId} status updated to ${status}`);
  });

  // Send notification
  socket.on('send_notification', (data) => {
    const { targetUserId, type, title, message, data: notificationData } = data;
    
    const notification = {
      type: type || 'general',
      title,
      message,
      data: notificationData,
      timestamp: new Date().toISOString()
    };
    
    if (targetUserId) {
      // Send to specific user
      io.to(`user_${targetUserId}`).emit('notification', notification);
    } else {
      // Broadcast to all users
      io.emit('notification', notification);
    }
    
    console.log(`[${new Date().toISOString()}] Notification sent: ${title}`);
  });

  // Test events for development
  socket.on('test_realtime', (data) => {
    socket.emit('test_response', {
      success: true,
      receivedData: data,
      timestamp: new Date().toISOString(),
      message: 'Real-time test successful!'
    });
  });

  // Handle disconnection
  socket.on('disconnect', (reason) => {
    console.log(`[${new Date().toISOString()}] Socket disconnected: ${socket.id}, reason: ${reason}`);
    
    // Remove from connected users
    if (socket.userId) {
      connectedUsers.delete(socket.userId);
      
      // Broadcast user disconnected
      socket.broadcast.emit('user_disconnected', {
        type: 'user_disconnected',
        userId: socket.userId,
        timestamp: new Date().toISOString()
      });
    }
  });
});

// Start server
server.listen(PORT, HOST, () => {
  console.log('🚀 HITCH REAL-TIME BACKEND SERVER');
  console.log('===================================');
  console.log('');
  console.log(`✅ Server running on: http://${HOST}:${PORT}`);
  console.log(`⚡ Socket.io enabled: http://${HOST}:${PORT}/socket.io/`);
  console.log(`📱 Mobile access URL: http://172.30.188.102:${PORT}`);
  console.log(`🔗 Health check: http://172.30.188.102:${PORT}/health`);
  console.log('');
  console.log('🎯 REAL-TIME FEATURES:');
  console.log('   📍 Live location tracking');
  console.log('   🚗 Real-time ride updates');
  console.log('   📦 Live package tracking');
  console.log('   💬 Instant notifications');
  console.log('   👥 User presence indicators');
  console.log('');
  console.log('🧪 SOCKET.IO EVENTS:');
  console.log('   📡 authenticate - User authentication');
  console.log('   🚗 join_ride - Join ride for updates');
  console.log('   📍 location_update - Send location');
  console.log('   🔄 ride_update - Update ride status');
  console.log('   🔔 send_notification - Send notifications');
  console.log('   🧪 test_realtime - Test real-time features');
  console.log('');
  console.log('📱 MOBILE TESTING STEPS:');
  console.log('1. Test from browser: http://172.30.188.102:3001/health');
  console.log('2. Connect to Socket.io: http://172.30.188.102:3001');
  console.log('3. Test real-time features in mobile app');
  console.log('4. Monitor live updates in admin panel');
  console.log('');
  console.log('🎉 Ready for real-time mobile device testing!');
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down real-time server gracefully...');
  io.close(() => {
    server.close(() => {
      console.log('✅ Real-time server shut down complete');
      process.exit(0);
    });
  });
});

// Simulate some real-time data for testing
setInterval(() => {
  if (connectedUsers.size > 0) {
    // Simulate random courier location updates
    io.emit('courier_location_update', {
      type: 'courier_location_update',
      data: {
        courierId: 'courier_123',
        packageId: 'PKG_' + Date.now(),
        latitude: 6.5244 + (Math.random() - 0.5) * 0.01,
        longitude: 3.3792 + (Math.random() - 0.5) * 0.01,
        speed: Math.floor(Math.random() * 60),
        heading: Math.floor(Math.random() * 360)
      },
      timestamp: new Date().toISOString()
    });
  }
}, 10000); // Every 10 seconds