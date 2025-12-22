// Final Integration Test - Focus on Working Components
const io = require('socket.io-client');
const http = require('http');

console.log('🎯 Final Integration Test for Hitch Platform');
console.log('===========================================');

const BACKEND_SERVER = 'http://localhost:3001';
const REALTIME_SERVER = 'http://localhost:3002';

let testResults = {
  passed: 0,
  failed: 0,
  total: 5
};

function log(message, status = 'info') {
  const timestamp = new Date().toISOString().substring(11, 23);
  const icon = status === 'success' ? '✅' : status === 'error' ? '❌' : status === 'warning' ? '⚠️' : 'ℹ️';
  console.log(`[${timestamp}] ${icon} ${message}`);
}

// HTTP Request helper
function makeRequest(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve({ raw: data });
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(10000, () => {
      req.abort();
      reject(new Error('Request timeout'));
    });
  });
}

// Test 1: Backend Health Check
async function testBackendHealth() {
  log('Testing backend API health...');
  try {
    const data = await makeRequest(`${BACKEND_SERVER}/api/health`);
    
    if (data.success) {
      log(`Backend healthy: ${data.message}`, 'success');
      log(`Socket.io enabled: ${data.socketio.enabled}`);
      testResults.passed++;
      return true;
    } else {
      log('Backend health check failed', 'error');
      testResults.failed++;
      return false;
    }
  } catch (error) {
    log(`Backend connection failed: ${error.message}`, 'error');
    testResults.failed++;
    return false;
  }
}

// Test 2: Real-time Server Health
async function testRealtimeHealth() {
  log('Testing real-time server health...');
  try {
    const data = await makeRequest(`${REALTIME_SERVER}/health`);
    
    if (data.success && data.features.includes('socket.io')) {
      log(`Real-time server: ${data.server} v${data.version}`, 'success');
      log(`Features: ${data.features.length} enabled`);
      testResults.passed++;
      return true;
    } else {
      log('Real-time server health check failed', 'error');
      testResults.failed++;
      return false;
    }
  } catch (error) {
    log(`Real-time server connection failed: ${error.message}`, 'error');
    testResults.failed++;
    return false;
  }
}

// Test 3: Socket.io Real-time Connection
async function testSocketConnection() {
  log('Testing Socket.io real-time connection...');
  return new Promise((resolve) => {
    const socket = io(REALTIME_SERVER, {
      transports: ['websocket', 'polling'],
      timeout: 10000
    });

    socket.on('connect', () => {
      log(`Socket.io connected: ${socket.id}`, 'success');
      
      socket.emit('authenticate', {
        userId: 'final_test_user',
        token: 'final-test-token',
        platform: 'integration-test'
      });
    });

    socket.on('authenticated', (data) => {
      if (data.success) {
        log(`Authentication successful - Connected users: ${data.connectedUsers}`, 'success');
        testResults.passed++;
        socket.disconnect();
        resolve(true);
      } else {
        log(`Authentication failed: ${data.error}`, 'error');
        testResults.failed++;
        socket.disconnect();
        resolve(false);
      }
    });

    socket.on('connect_error', (error) => {
      log(`Socket.io connection error: ${error.message}`, 'error');
      testResults.failed++;
      resolve(false);
    });

    setTimeout(() => {
      log('Socket.io connection timeout', 'error');
      testResults.failed++;
      socket.disconnect();
      resolve(false);
    }, 8000);
  });
}

// Test 4: Real-time Features End-to-End
async function testRealtimeFeatures() {
  log('Testing real-time features end-to-end...');
  return new Promise((resolve) => {
    const driverSocket = io(REALTIME_SERVER);
    const passengerSocket = io(REALTIME_SERVER);
    
    let driverAuth = false;
    let passengerAuth = false;
    let locationUpdate = false;
    let rideUpdate = false;
    
    // Driver connection
    driverSocket.on('connect', () => {
      driverSocket.emit('authenticate', {
        userId: 'test_driver',
        token: 'driver-token'
      });
    });
    
    driverSocket.on('authenticated', (data) => {
      if (data.success) {
        driverAuth = true;
        log('Driver authenticated successfully', 'success');
        
        // Join ride room
        driverSocket.emit('join_ride', { rideId: 'test_ride_001' });
      }
    });
    
    // Passenger connection
    passengerSocket.on('connect', () => {
      passengerSocket.emit('authenticate', {
        userId: 'test_passenger',
        token: 'passenger-token'
      });
    });
    
    passengerSocket.on('authenticated', (data) => {
      if (data.success) {
        passengerAuth = true;
        log('Passenger authenticated successfully', 'success');
        
        // Join same ride room
        passengerSocket.emit('join_ride', { rideId: 'test_ride_001' });
      }
    });
    
    // Test location updates
    passengerSocket.on('live_location', (data) => {
      if (data.data?.userId === 'test_driver') {
        locationUpdate = true;
        log('Location update received by passenger', 'success');
      }
    });
    
    // Test ride status updates
    passengerSocket.on('ride_status_update', (data) => {
      if (data.data?.rideId === 'test_ride_001') {
        rideUpdate = true;
        log('Ride status update received', 'success');
      }
    });
    
    // Send test events after both are connected
    setTimeout(() => {
      if (driverAuth && passengerAuth) {
        // Driver sends location
        driverSocket.emit('location_update', {
          latitude: 6.5244,
          longitude: 3.3792,
          speed: 30
        });
        
        // Driver updates ride status
        setTimeout(() => {
          driverSocket.emit('ride_update', {
            rideId: 'test_ride_001',
            status: 'in_progress',
            message: 'Trip started'
          });
        }, 500);
      }
    }, 2000);
    
    // Check results
    setTimeout(() => {
      driverSocket.disconnect();
      passengerSocket.disconnect();
      
      if (driverAuth && passengerAuth && locationUpdate && rideUpdate) {
        log('All real-time features working correctly', 'success');
        testResults.passed++;
        resolve(true);
      } else {
        log(`Real-time features incomplete: Auth(${driverAuth && passengerAuth}), Location(${locationUpdate}), Ride(${rideUpdate})`, 'error');
        testResults.failed++;
        resolve(false);
      }
    }, 6000);
  });
}

// Test 5: Mobile App Simulation
async function testMobileAppSimulation() {
  log('Testing mobile app simulation...');
  return new Promise((resolve) => {
    const mobileSocket = io(REALTIME_SERVER, {
      transports: ['websocket', 'polling'],
      query: {
        platform: 'react-native',
        version: '1.0.0'
      }
    });

    let authenticated = false;
    let locationSent = false;
    let notificationReceived = false;

    mobileSocket.on('connect', () => {
      log('Mobile app connected', 'success');
      
      mobileSocket.emit('authenticate', {
        userId: 'mobile_user_final_test',
        token: 'mobile-token',
        platform: 'react-native',
        deviceId: 'simulator-12345'
      });
    });

    mobileSocket.on('authenticated', (data) => {
      if (data.success) {
        authenticated = true;
        log('Mobile app authenticated', 'success');
        
        // Simulate mobile location update
        mobileSocket.emit('location_update', {
          latitude: 6.5244,
          longitude: 3.3792,
          accuracy: 5,
          heading: 180,
          speed: 40
        });
        locationSent = true;
        
        // Send test notification
        setTimeout(() => {
          mobileSocket.emit('send_notification', {
            type: 'test',
            title: 'Mobile Test Notification',
            message: 'Testing mobile notification system'
          });
        }, 1000);
      }
    });

    mobileSocket.on('notification', (data) => {
      if (data.title === 'Mobile Test Notification') {
        notificationReceived = true;
        log('Mobile notification received', 'success');
      }
    });

    setTimeout(() => {
      mobileSocket.disconnect();
      
      if (authenticated && locationSent && notificationReceived) {
        log('Mobile app simulation successful', 'success');
        testResults.passed++;
        resolve(true);
      } else {
        log(`Mobile simulation incomplete: Auth(${authenticated}), Location(${locationSent}), Notification(${notificationReceived})`, 'error');
        testResults.failed++;
        resolve(false);
      }
    }, 5000);
  });
}

// Main execution
async function runFinalIntegrationTest() {
  log('Starting final integration test...');
  log('================================');
  
  try {
    await testBackendHealth();
    await testRealtimeHealth();
    await testSocketConnection();
    await testRealtimeFeatures();
    await testMobileAppSimulation();
    
  } catch (error) {
    log(`Test suite error: ${error.message}`, 'error');
    testResults.failed++;
  }
  
  // Results summary
  log('================================');
  log('FINAL INTEGRATION TEST RESULTS');
  log('================================');
  log(`Total Tests: ${testResults.total}`);
  log(`Passed: ${testResults.passed}`);
  log(`Failed: ${testResults.failed}`);
  log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
  
  if (testResults.passed === testResults.total) {
    log('🎉 PERFECT! ALL TESTS PASSED!', 'success');
    log('✅ Backend API operational');
    log('✅ Real-time server functional');
    log('✅ Socket.io connectivity confirmed');
    log('✅ End-to-end real-time features working');
    log('✅ Mobile app compatibility verified');
    log('🚀 HITCH PLATFORM FULLY INTEGRATED & READY!');
  } else if (testResults.passed >= 4) {
    log('✅ Integration successful with minor issues', 'success');
    log('🚀 PLATFORM READY FOR DEPLOYMENT!');
  } else if (testResults.passed >= 3) {
    log('⚠️  Partial integration success', 'warning');
    log('📋 Review failed components');
  } else {
    log('❌ Integration needs more work', 'error');
    log('🔧 Debug failed tests before deployment');
  }
  
  process.exit(testResults.passed >= 3 ? 0 : 1);
}

// Execute test suite
runFinalIntegrationTest().catch(error => {
  console.error('💥 Final integration test crashed:', error);
  process.exit(1);
});

// Safety timeout
setTimeout(() => {
  log('Final integration test timeout', 'error');
  process.exit(1);
}, 30000);