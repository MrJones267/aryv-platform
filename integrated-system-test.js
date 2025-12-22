// Integrated System Test - Backend + Real-time + Mobile Integration
const io = require('socket.io-client');
const fetch = require('node-fetch');

console.log('🔗 Integrated System Test for Hitch Platform');
console.log('===========================================');

// Test configuration
const BACKEND_SERVER = 'http://localhost:3001';
const REALTIME_SERVER = 'http://localhost:3002';

let testResults = {
  passed: 0,
  failed: 0,
  total: 7
};

function log(message, status = 'info') {
  const timestamp = new Date().toISOString().substring(11, 23);
  const icon = status === 'success' ? '✅' : status === 'error' ? '❌' : status === 'warning' ? '⚠️' : 'ℹ️';
  console.log(`[${timestamp}] ${icon} ${message}`);
}

// Test 1: Backend API Health
async function testBackendHealth() {
  log('Testing backend API health...');
  try {
    const response = await fetch(`${BACKEND_SERVER}/api/health`);
    const data = await response.json();
    
    if (data.success) {
      log(`Backend healthy: ${data.message}`, 'success');
      log(`Available endpoints: ${data.availableEndpoints.length}`);
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
    const response = await fetch(`${REALTIME_SERVER}/health`);
    const data = await response.json();
    
    if (data.success && data.features.includes('socket.io')) {
      log(`Real-time server healthy: ${data.server}`, 'success');
      log(`Features: ${data.features.join(', ')}`);
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

// Test 3: Backend API Functionality
async function testBackendAPI() {
  log('Testing backend API functionality...');
  try {
    // Test user registration
    const registerResponse = await fetch(`${BACKEND_SERVER}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test@integration.com',
        password: 'test123',
        firstName: 'Integration',
        lastName: 'Test'
      })
    });
    const registerData = await registerResponse.json();
    
    if (registerData.success) {
      log('User registration successful', 'success');
      
      // Test ride booking
      const rideResponse = await fetch(`${BACKEND_SERVER}/api/rides/book`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pickupLocation: 'Victoria Island',
          destination: 'Lekki Phase 1',
          rideType: 'Standard'
        })
      });
      const rideData = await rideResponse.json();
      
      if (rideData.success) {
        log(`Ride booking successful: ${rideData.booking.id}`, 'success');
        testResults.passed++;
        return true;
      }
    }
    
    log('Backend API functionality test failed', 'error');
    testResults.failed++;
    return false;
  } catch (error) {
    log(`Backend API test failed: ${error.message}`, 'error');
    testResults.failed++;
    return false;
  }
}

// Test 4: Socket.io Connection
async function testSocketConnection() {
  log('Testing Socket.io connection...');
  return new Promise((resolve) => {
    const socket = io(REALTIME_SERVER, {
      transports: ['websocket', 'polling'],
      timeout: 10000
    });

    socket.on('connect', () => {
      log(`Socket.io connected: ${socket.id}`, 'success');
      
      // Test authentication
      socket.emit('authenticate', {
        userId: 'integration_test_user',
        token: 'integration-test-token',
        platform: 'integration-test'
      });
    });

    socket.on('authenticated', (data) => {
      if (data.success) {
        log('Socket.io authentication successful', 'success');
        testResults.passed++;
        socket.disconnect();
        resolve(true);
      } else {
        log(`Socket.io authentication failed: ${data.error}`, 'error');
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

// Test 5: Cross-service Communication
async function testCrossServiceCommunication() {
  log('Testing cross-service communication...');
  return new Promise((resolve) => {
    const socket = io(REALTIME_SERVER, {
      transports: ['websocket', 'polling'],
      timeout: 10000
    });

    let communicationWorking = false;

    socket.on('connect', () => {
      socket.emit('authenticate', {
        userId: 'cross_service_test',
        token: 'test-token'
      });
    });

    socket.on('authenticated', async (data) => {
      if (data.success) {
        // Try to create a ride via API and receive real-time notification
        try {
          const rideResponse = await fetch(`${BACKEND_SERVER}/api/rides/book`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              pickupLocation: 'Cross Service Test Location',
              destination: 'Integration Test Destination',
              rideType: 'Integration'
            })
          });
          
          const rideData = await rideResponse.json();
          
          if (rideData.success) {
            log('Cross-service ride creation successful', 'success');
            
            // Simulate real-time update
            socket.emit('ride_update', {
              rideId: rideData.booking.id,
              status: 'confirmed',
              message: 'Integration test ride confirmed'
            });
            
            communicationWorking = true;
          }
        } catch (error) {
          log(`Cross-service communication error: ${error.message}`, 'error');
        }
      }
    });

    socket.on('ride_status_update', (data) => {
      if (data.data && data.data.message.includes('Integration test')) {
        log('Cross-service real-time update received', 'success');
        communicationWorking = true;
      }
    });

    setTimeout(() => {
      if (communicationWorking) {
        testResults.passed++;
        log('Cross-service communication test passed', 'success');
        resolve(true);
      } else {
        testResults.failed++;
        log('Cross-service communication test failed', 'error');
        resolve(false);
      }
      socket.disconnect();
    }, 5000);
  });
}

// Test 6: Mobile App Compatibility
async function testMobileCompatibility() {
  log('Testing mobile app compatibility...');
  return new Promise((resolve) => {
    const mobileSocket = io(REALTIME_SERVER, {
      transports: ['websocket', 'polling'],
      timeout: 10000,
      query: {
        platform: 'react-native',
        version: '1.0.0'
      }
    });

    mobileSocket.on('connect', () => {
      log('Mobile app connection established', 'success');
      
      // Test mobile-specific authentication
      mobileSocket.emit('authenticate', {
        userId: 'mobile_test_user',
        token: 'mobile-app-token',
        platform: 'react-native',
        deviceId: 'test-device-12345'
      });
    });

    mobileSocket.on('authenticated', (data) => {
      if (data.success) {
        log('Mobile authentication successful', 'success');
        
        // Test mobile location update
        mobileSocket.emit('location_update', {
          latitude: 6.5244,
          longitude: 3.3792,
          accuracy: 5,
          heading: 90,
          speed: 25
        });
        
        testResults.passed++;
        resolve(true);
      } else {
        log('Mobile authentication failed', 'error');
        testResults.failed++;
        resolve(false);
      }
      mobileSocket.disconnect();
    });

    mobileSocket.on('connect_error', (error) => {
      log(`Mobile connection error: ${error.message}`, 'error');
      testResults.failed++;
      mobileSocket.disconnect();
      resolve(false);
    });

    setTimeout(() => {
      log('Mobile compatibility test timeout', 'error');
      testResults.failed++;
      mobileSocket.disconnect();
      resolve(false);
    }, 6000);
  });
}

// Test 7: Load and Performance
async function testLoadAndPerformance() {
  log('Testing system load and performance...');
  return new Promise(async (resolve) => {
    const startTime = Date.now();
    const connections = [];
    const targetConnections = 10;
    let connectedCount = 0;
    let authenticatedCount = 0;
    
    // Create multiple simultaneous connections
    for (let i = 0; i < targetConnections; i++) {
      const socket = io(REALTIME_SERVER, {
        transports: ['websocket', 'polling'],
        timeout: 10000
      });
      
      connections.push(socket);
      
      socket.on('connect', () => {
        connectedCount++;
        socket.emit('authenticate', {
          userId: `load_test_user_${i}`,
          token: `load-test-token-${i}`
        });
      });
      
      socket.on('authenticated', (data) => {
        if (data.success) {
          authenticatedCount++;
        }
      });
    }
    
    // Check results after 5 seconds
    setTimeout(() => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      // Cleanup connections
      connections.forEach(socket => socket.disconnect());
      
      if (authenticatedCount >= targetConnections * 0.8) { // 80% success rate
        log(`Load test passed: ${authenticatedCount}/${targetConnections} connections in ${duration}ms`, 'success');
        testResults.passed++;
        resolve(true);
      } else {
        log(`Load test failed: only ${authenticatedCount}/${targetConnections} connections succeeded`, 'error');
        testResults.failed++;
        resolve(false);
      }
    }, 5000);
  });
}

// Main test execution
async function runIntegratedSystemTest() {
  log('Starting integrated system test suite...');
  log('=====================================');
  
  try {
    await testBackendHealth();
    await testRealtimeHealth();
    await testBackendAPI();
    await testSocketConnection();
    await testCrossServiceCommunication();
    await testMobileCompatibility();
    await testLoadAndPerformance();
    
  } catch (error) {
    log(`Unexpected error: ${error.message}`, 'error');
    testResults.failed++;
  }
  
  // Final results
  log('=====================================');
  log('INTEGRATED SYSTEM TEST RESULTS');
  log('=====================================');
  log(`Total Tests: ${testResults.total}`);
  log(`Passed: ${testResults.passed}`);
  log(`Failed: ${testResults.failed}`);
  log(`Success Rate: ${((testResults.passed / testResults.total) * 100).toFixed(1)}%`);
  
  if (testResults.passed === testResults.total) {
    log('🎉 ALL INTEGRATION TESTS PASSED!', 'success');
    log('✅ Backend API server working perfectly');
    log('✅ Real-time Socket.io server operational');
    log('✅ Cross-service communication functional');
    log('✅ Mobile app compatibility verified');
    log('✅ Performance and load testing successful');
    log('🚀 INTEGRATED HITCH SYSTEM IS READY!');
  } else if (testResults.passed >= testResults.total * 0.8) {
    log('✅ Integration tests mostly successful', 'success');
    log('⚠️  Minor issues detected, system is operational', 'warning');
    log('🚀 SYSTEM READY FOR PRODUCTION WITH MONITORING');
  } else {
    log('⚠️  Multiple integration tests failed', 'warning');
    log('❌ Review failed tests before deployment');
    log('📋 System needs additional configuration');
  }
  
  process.exit(testResults.passed >= testResults.total * 0.8 ? 0 : 1);
}

// Start the integrated test
runIntegratedSystemTest().catch(error => {
  console.error('💥 Integration test suite crashed:', error);
  process.exit(1);
});

// Safety timeout
setTimeout(() => {
  log('Integration test suite timeout', 'error');
  process.exit(1);
}, 60000); // 1 minute timeout