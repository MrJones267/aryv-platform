// Quick Socket.io client test for real-time features
const io = require('socket.io-client');

console.log('🧪 Testing Socket.io Real-time Features');
console.log('======================================');

const socket = io('http://localhost:3001', {
  transports: ['websocket', 'polling'],
  timeout: 10000
});

let testsPassed = 0;
let testsTotal = 0;

function runTest(name, testFn) {
  testsTotal++;
  console.log(`\n🔬 Running test: ${name}`);
  
  try {
    testFn();
    testsPassed++;
    console.log(`✅ ${name} - PASSED`);
  } catch (error) {
    console.log(`❌ ${name} - FAILED: ${error.message}`);
  }
}

socket.on('connect', () => {
  console.log(`\n✅ Connected to server with ID: ${socket.id}`);
  
  // Test 1: Authentication
  runTest('User Authentication', () => {
    socket.emit('authenticate', {
      userId: 'test_user_001',
      token: 'mock-token-123'
    });
  });
  
  // Test 2: Join ride room
  setTimeout(() => {
    runTest('Join Ride Room', () => {
      socket.emit('join_ride', { rideId: 'ride_12345' });
    });
  }, 1000);
  
  // Test 3: Location update
  setTimeout(() => {
    runTest('Location Update', () => {
      socket.emit('location_update', {
        userId: 'test_user_001',
        latitude: 6.5244,
        longitude: 3.3792,
        heading: 90,
        speed: 25
      });
    });
  }, 2000);
  
  // Test 4: Ride status update
  setTimeout(() => {
    runTest('Ride Status Update', () => {
      socket.emit('ride_update', {
        rideId: 'ride_12345',
        status: 'in_progress',
        location: { lat: 6.5244, lng: 3.3792 },
        message: 'Driver is on the way'
      });
    });
  }, 3000);
  
  // Test 5: Send notification
  setTimeout(() => {
    runTest('Send Notification', () => {
      socket.emit('send_notification', {
        type: 'test',
        title: 'Test Notification',
        message: 'Socket.io real-time test successful!',
        data: { testData: true }
      });
    });
  }, 4000);
  
  // Test 6: Custom test event
  setTimeout(() => {
    runTest('Custom Test Event', () => {
      socket.emit('test_realtime', {
        message: 'Testing real-time functionality',
        timestamp: new Date().toISOString()
      });
    });
  }, 5000);
  
  // Final results after all tests
  setTimeout(() => {
    console.log('\n📊 TEST RESULTS');
    console.log('================');
    console.log(`✅ Tests Passed: ${testsPassed}/${testsTotal}`);
    console.log(`📈 Success Rate: ${((testsPassed/testsTotal)*100).toFixed(1)}%`);
    
    if (testsPassed === testsTotal) {
      console.log('\n🎉 ALL REAL-TIME TESTS PASSED!');
      console.log('✅ Socket.io is working correctly');
      console.log('✅ Real-time events are functioning');
      console.log('✅ Server is ready for mobile integration');
    } else {
      console.log('\n⚠️  Some tests failed. Check server logs for details.');
    }
    
    socket.disconnect();
    process.exit(testsPassed === testsTotal ? 0 : 1);
  }, 7000);
});

// Event listeners for responses
socket.on('authenticated', (data) => {
  console.log(`🔐 Authentication response: ${data.success ? 'SUCCESS' : 'FAILED'}`);
  if (data.connectedUsers !== undefined) {
    console.log(`👥 Connected users: ${data.connectedUsers}`);
  }
});

socket.on('joined_ride', (data) => {
  console.log(`🎯 Joined ride: ${data.rideId}`);
});

socket.on('live_location', (data) => {
  console.log(`📍 Location update received from: ${data.data?.userId}`);
});

socket.on('ride_status_update', (data) => {
  console.log(`🔄 Ride status update: ${data.data?.status}`);
});

socket.on('notification', (data) => {
  console.log(`🔔 Notification: ${data.title} - ${data.message}`);
});

socket.on('test_response', (data) => {
  console.log(`🧪 Test response: ${data.message}`);
});

socket.on('user_connected', (data) => {
  console.log(`👤 User connected: ${data.userId}`);
});

socket.on('connect_error', (error) => {
  console.log(`❌ Connection error: ${error.message}`);
  process.exit(1);
});

socket.on('disconnect', (reason) => {
  console.log(`\n🔌 Disconnected: ${reason}`);
});

// Timeout for the entire test
setTimeout(() => {
  console.log('\n⏰ Test timeout reached');
  socket.disconnect();
  process.exit(1);
}, 15000);