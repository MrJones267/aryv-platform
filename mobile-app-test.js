#!/usr/bin/env node

/**
 * Mobile App Integration Test Script
 * Simulates complete mobile app usage flow
 */

const https = require('https');
const http = require('http');

const BASE_URL = 'http://localhost:3001/api';
const TEST_USER = {
  email: 'mobile.integration@hitch.com',
  password: 'SecurePassword123!',
  firstName: 'Integration',
  lastName: 'TestUser',
  phone: '+2348123456789'
};

let accessToken = null;
let refreshToken = null;

// HTTP request helper
function makeRequest(endpoint, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint.startsWith('http') ? endpoint : BASE_URL + endpoint);
    
    const options = {
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...headers
      }
    };

    if (accessToken) {
      options.headers.Authorization = `Bearer ${accessToken}`;
    }

    const req = (url.protocol === 'https:' ? https : http).request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          const parsedData = JSON.parse(responseData);
          resolve({ status: res.statusCode, data: parsedData });
        } catch (e) {
          resolve({ status: res.statusCode, data: responseData });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Test functions
async function testHealthCheck() {
  console.log('🔍 Testing Health Check...');
  const result = await makeRequest('/health', 'GET');
  console.log(`   Status: ${result.status}, Server: ${result.data.server}`);
  return result.data.success;
}

async function testUserRegistration() {
  console.log('📝 Testing User Registration...');
  const result = await makeRequest('/auth/register', 'POST', TEST_USER);
  
  if (result.data.success) {
    accessToken = result.data.data.accessToken;
    refreshToken = result.data.data.refreshToken;
    console.log(`   ✅ User registered: ${result.data.data.user.email}`);
    console.log(`   🔑 Token received: ${accessToken.substring(0, 20)}...`);
    return true;
  } else {
    console.log(`   ❌ Registration failed: ${result.data.error || result.data.message}`);
    return false;
  }
}

async function testUserLogin() {
  console.log('🔐 Testing User Login...');
  const result = await makeRequest('/auth/login', 'POST', {
    email: TEST_USER.email,
    password: TEST_USER.password
  });
  
  if (result.data.success) {
    accessToken = result.data.data.accessToken;
    refreshToken = result.data.data.refreshToken;
    console.log(`   ✅ Login successful: ${result.data.data.user.firstName} ${result.data.data.user.lastName}`);
    return true;
  } else {
    console.log(`   ❌ Login failed: ${result.data.error || result.data.message}`);
    return false;
  }
}

async function testUserProfile() {
  console.log('👤 Testing User Profile...');
  const result = await makeRequest('/auth/profile', 'GET');
  
  if (result.data.success) {
    console.log(`   ✅ Profile retrieved: ${result.data.data.firstName} ${result.data.data.lastName}`);
    console.log(`   📧 Email verified: ${result.data.data.isEmailVerified}`);
    return true;
  } else {
    console.log(`   ❌ Profile failed: ${result.data.error || result.data.message}`);
    return false;
  }
}

async function testRideBooking() {
  console.log('🚗 Testing Ride Booking...');
  const rideData = {
    pickupLocation: 'Victoria Island, Lagos',
    destination: 'Lekki Phase 1',
    rideType: 'Premium',
    passengers: 2,
    notes: 'Integration test ride'
  };
  
  const result = await makeRequest('/rides/book', 'POST', rideData);
  
  if (result.data.success) {
    console.log(`   ✅ Ride booked: ${result.data.booking.id}`);
    console.log(`   🚖 Driver: ${result.data.booking.driverName}`);
    console.log(`   💰 Fare: ₦${result.data.booking.estimatedFare}`);
    return result.data.booking.id;
  } else {
    console.log(`   ❌ Ride booking failed: ${result.data.error || result.data.message}`);
    return false;
  }
}

async function testRideHistory() {
  console.log('📋 Testing Ride History...');
  const result = await makeRequest('/rides', 'GET');
  
  if (result.data.success) {
    console.log(`   ✅ Ride history retrieved: ${result.data.rides.length} rides`);
    return true;
  } else {
    console.log(`   ❌ Ride history failed: ${result.data.error || result.data.message}`);
    return false;
  }
}

async function testPackageCreation() {
  console.log('📦 Testing Package Creation...');
  const packageData = {
    senderName: TEST_USER.firstName + ' ' + TEST_USER.lastName,
    receiverName: 'John Recipient',
    packageDetails: 'Integration test package - Important documents',
    pickupLocation: 'Ikeja GRA, Lagos',
    deliveryLocation: 'Maryland Mall, Lagos',
    packageType: 'documents',
    value: 25000,
    fragile: false
  };
  
  const result = await makeRequest('/courier/packages', 'POST', packageData);
  
  if (result.data.success) {
    console.log(`   ✅ Package created: ${result.data.package.trackingNumber}`);
    console.log(`   📍 From: ${result.data.package.pickupLocation}`);
    console.log(`   📍 To: ${result.data.package.deliveryLocation}`);
    return result.data.package.trackingNumber;
  } else {
    console.log(`   ❌ Package creation failed: ${result.data.error || result.data.message}`);
    return false;
  }
}

async function testPackageTracking(trackingNumber) {
  console.log('🔍 Testing Package Tracking...');
  const result = await makeRequest(`/courier/packages/${trackingNumber}`, 'GET');
  
  if (result.data.success) {
    console.log(`   ✅ Package tracked: ${result.data.package.status}`);
    console.log(`   📍 Current location: ${result.data.package.currentLocation}`);
    console.log(`   🚚 Courier: ${result.data.package.courierInfo.name}`);
    return true;
  } else {
    console.log(`   ❌ Package tracking failed: ${result.data.error || result.data.message}`);
    return false;
  }
}

async function testTokenRefresh() {
  console.log('🔄 Testing Token Refresh...');
  const result = await makeRequest('/auth/refresh', 'POST', { refreshToken });
  
  if (result.data.success) {
    accessToken = result.data.data.accessToken;
    refreshToken = result.data.data.refreshToken;
    console.log(`   ✅ Token refreshed successfully`);
    return true;
  } else {
    console.log(`   ❌ Token refresh failed: ${result.data.error || result.data.message}`);
    return false;
  }
}

// Main test execution
async function runIntegrationTests() {
  console.log('🚀 HITCH MOBILE APP INTEGRATION TESTS');
  console.log('=====================================');
  console.log('');
  
  const results = {
    passed: 0,
    failed: 0,
    total: 0
  };
  
  const tests = [
    { name: 'Health Check', fn: testHealthCheck },
    { name: 'User Registration', fn: testUserRegistration },
    { name: 'User Login', fn: testUserLogin },
    { name: 'User Profile', fn: testUserProfile },
    { name: 'Ride Booking', fn: testRideBooking },
    { name: 'Ride History', fn: testRideHistory },
    { name: 'Package Creation', fn: testPackageCreation },
    { name: 'Token Refresh', fn: testTokenRefresh },
  ];
  
  let trackingNumber = null;
  
  for (const test of tests) {
    results.total++;
    try {
      const result = await test.fn();
      if (result) {
        results.passed++;
        if (test.name === 'Package Creation' && typeof result === 'string') {
          trackingNumber = result;
        }
      } else {
        results.failed++;
      }
    } catch (error) {
      console.log(`   ❌ ${test.name} error: ${error.message}`);
      results.failed++;
    }
    console.log('');
  }
  
  // Test package tracking if we have a tracking number
  if (trackingNumber) {
    results.total++;
    try {
      const result = await testPackageTracking(trackingNumber);
      if (result) {
        results.passed++;
      } else {
        results.failed++;
      }
    } catch (error) {
      console.log(`   ❌ Package Tracking error: ${error.message}`);
      results.failed++;
    }
    console.log('');
  }
  
  // Results summary
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('=======================');
  console.log(`✅ Passed: ${results.passed}/${results.total}`);
  console.log(`❌ Failed: ${results.failed}/${results.total}`);
  console.log(`📈 Success Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);
  console.log('');
  
  if (results.failed === 0) {
    console.log('🎉 ALL TESTS PASSED! Mobile app integration is ready for production.');
  } else {
    console.log('⚠️  Some tests failed. Please review the issues above.');
  }
  
  console.log('');
  console.log('🔗 Backend Server: http://localhost:3001');
  console.log('📱 Android Emulator URL: http://10.0.2.2:3001/api');
  console.log('📱 iOS Simulator URL: http://localhost:3001/api');
}

// Run tests
runIntegrationTests().catch(console.error);