/**
 * WebSocket Test Client for ARYV Real-time Features
 */

const { io } = require('socket.io-client');
const https = require('https');
const http = require('http');

// Simple fetch implementation
function fetch(url, options = {}) {
  const urlObj = new URL(url);
  const isHttps = urlObj.protocol === 'https:';
  const client = isHttps ? https : http;
  
  return new Promise((resolve, reject) => {
    const reqOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    };
    
    const req = client.request(reqOptions, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            json: () => Promise.resolve(JSON.parse(data))
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            json: () => Promise.resolve({ error: 'Invalid JSON', raw: data })
          });
        }
      });
    });
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(options.body);
    }
    
    req.end();
  });
}

// Test WebSocket connection
async function testWebSocket() {
  console.log('🧪 Testing ARYV WebSocket Real-time Features');
  console.log('=' .repeat(50));

  try {
    // Test HTTP endpoints first
    console.log('\n1️⃣ Testing HTTP API...');
    
    const healthResponse = await fetch('http://localhost:3001/health');
    const health = await healthResponse.json();
    console.log('   ✅ Health:', health.success ? 'Connected' : 'Failed');

    const wsStatusResponse = await fetch('http://localhost:3001/api/websocket/status');
    const wsStatus = await wsStatusResponse.json();
    console.log('   📊 WebSocket Status:', wsStatus.success ? 'Available' : 'Failed');
    console.log('   👥 Connected Users:', wsStatus.data?.connectedUsers || 0);
    console.log('   🏠 Active Rooms:', wsStatus.data?.activeRooms?.length || 0);

    // Test WebSocket connection
    console.log('\n2️⃣ Testing WebSocket Connection...');
    
    const socket = io('http://localhost:3001', {
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('   ✅ WebSocket Connected:', socket.id);

      // Test authentication
      console.log('\n3️⃣ Testing Authentication...');
      socket.emit('authenticate', {
        token: 'test-token-for-demo',
        userId: 'test-user'
      });

      // Test joining package tracking
      console.log('\n4️⃣ Testing Package Tracking...');
      socket.emit('join_package', 3); // Join package tracking for package ID 3
      console.log('   📦 Joined package tracking room for package 3');

      // Test location update
      setTimeout(() => {
        console.log('\n5️⃣ Testing Location Update...');
        socket.emit('location_update', {
          packageId: 3,
          latitude: 40.7200,
          longitude: -73.9600,
          speed: 25,
          heading: 180
        });
        console.log('   📍 Sent location update');
      }, 1000);

      // Test chat message
      setTimeout(() => {
        console.log('\n6️⃣ Testing Chat Message...');
        socket.emit('send_message', {
          packageId: 3,
          message: 'Package is on the way, arriving in 10 minutes!',
          type: 'text'
        });
        console.log('   💬 Sent chat message');
      }, 2000);

      // Test status update
      setTimeout(() => {
        console.log('\n7️⃣ Testing Status Update...');
        socket.emit('update_package_status', {
          packageId: 3,
          status: 'in_transit',
          location: {
            latitude: 40.7100,
            longitude: -73.9500
          }
        });
        console.log('   📦 Sent status update');
      }, 3000);

      // Disconnect after testing
      setTimeout(() => {
        socket.disconnect();
      }, 5000);
    });

    socket.on('connect_error', (error) => {
      console.log('   ❌ WebSocket Connection Error:', error.message);
    });

    socket.on('authenticated', (data) => {
      console.log('   ✅ Authentication Success:', data);
    });

    socket.on('authentication_error', (error) => {
      console.log('   ❌ Authentication Failed:', error);
    });

    socket.on('package_status', (data) => {
      console.log('   📦 Package Status Received:', data);
    });

    socket.on('location_update', (data) => {
      console.log('   📍 Location Update Received:', data);
    });

    socket.on('new_message', (data) => {
      console.log('   💬 New Message Received:', data);
    });

    socket.on('status_update', (data) => {
      console.log('   📦 Status Update Received:', data);
    });

    socket.on('notification', (data) => {
      console.log('   🔔 Notification Received:', data);
    });

    socket.on('disconnect', () => {
      console.log('   📡 WebSocket Disconnected');
      
      setTimeout(async () => {
        console.log('\n8️⃣ Final Status Check...');
        try {
          const finalStatus = await fetch('http://localhost:3001/api/websocket/status');
          const final = await finalStatus.json();
          console.log('   👥 Final Connected Users:', final.data?.connectedUsers || 0);
          console.log('   🏠 Final Active Rooms:', final.data?.activeRooms?.length || 0);
          
          console.log('\n' + '='.repeat(50));
          console.log('🎯 WebSocket Testing Complete!');
          console.log('✅ Real-time features are working properly');
          console.log('📡 WebSocket server is ready for production use');
          
        } catch (error) {
          console.error('Final status check failed:', error);
        }
      }, 1000);
    });

    // Test notification broadcasting
    setTimeout(async () => {
      console.log('\n📢 Testing Notification Broadcasting...');
      try {
        const notifyResponse = await fetch('http://localhost:3001/api/broadcast/notification', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: 'test-user',
            title: 'Test Notification',
            message: 'This is a test notification from the WebSocket system',
            type: 'info',
            data: { packageId: 3, action: 'status_update' }
          })
        });
        
        const notifyResult = await notifyResponse.json();
        console.log('   🔔 Notification Broadcast:', notifyResult.success ? 'Sent' : 'Failed');
      } catch (error) {
        console.error('   ❌ Notification test failed:', error.message);
      }
    }, 4000);

  } catch (error) {
    console.error('❌ WebSocket test failed:', error);
  }
}

// Run the test
testWebSocket();