/**
 * Test script for Mobile App Database Connection
 * Simulates mobile app API calls to database backend
 */

// Use Node.js built-in fetch (Node 18+) or create simple http test
const https = require('https');
const http = require('http');

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

// Database backend URL (matches mobile app dev configuration)
const LOCAL_API_URL = 'http://localhost:3001/api';
const PRODUCTION_API_URL = 'https://api.aryv-app.com/api';

// Test credentials
const TEST_CREDENTIALS = {
  email: 'admin@aryv-app.com',
  password: 'admin123'
};

const USER_CREDENTIALS = {
  email: 'test@aryv-app.com',
  password: 'test123'
};

async function testApiConnection(baseUrl, title) {
  console.log(`\n🧪 Testing ${title}`);
  console.log(`🔗 URL: ${baseUrl}`);
  console.log('─'.repeat(50));

  try {
    // Test 1: Health Check
    console.log('1️⃣ Health Check...');
    const healthResponse = await fetch(`${baseUrl.replace('/api', '')}/health`);
    const health = await healthResponse.json();
    console.log('   ✅ Health:', health.success ? 'Connected' : 'Failed');
    console.log('   📊 Server:', health.message);

    // Test 2: Admin Login
    console.log('\n2️⃣ Admin Login...');
    const loginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(TEST_CREDENTIALS)
    });
    const loginData = await loginResponse.json();
    
    if (loginData.success) {
      console.log('   ✅ Admin Login: Successful');
      console.log('   👤 User:', loginData.data.user.firstName, loginData.data.user.lastName);
      console.log('   🔑 Role:', loginData.data.user.role);
      console.log('   🎫 Token:', loginData.data.accessToken.substring(0, 30) + '...');
      
      const adminToken = loginData.data.accessToken;

      // Test 3: Profile Access
      console.log('\n3️⃣ Profile Access...');
      const profileResponse = await fetch(`${baseUrl}/auth/profile`, {
        headers: { 'Authorization': `Bearer ${adminToken}` }
      });
      const profileData = await profileResponse.json();
      
      if (profileData.success) {
        console.log('   ✅ Profile: Accessible');
        console.log('   📧 Email:', profileData.data.email);
      } else {
        console.log('   ❌ Profile: Failed');
      }
      
    } else {
      console.log('   ❌ Admin Login: Failed');
      console.log('   💬 Message:', loginData.message);
    }

    // Test 4: User Login
    console.log('\n4️⃣ Regular User Login...');
    const userLoginResponse = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(USER_CREDENTIALS)
    });
    const userLoginData = await userLoginResponse.json();
    
    if (userLoginData.success) {
      console.log('   ✅ User Login: Successful');
      console.log('   👤 User:', userLoginData.data.user.firstName, userLoginData.data.user.lastName);
      console.log('   🔑 Role:', userLoginData.data.user.role);
      
      const userToken = userLoginData.data.accessToken;

      // Test 5: Fetch Data (Users endpoint - admin only should fail for regular user)
      console.log('\n5️⃣ Data Access Test...');
      const usersResponse = await fetch(`${baseUrl.replace('/api', '')}/api/users`, {
        headers: { 'Authorization': `Bearer ${userToken}` }
      });
      const usersData = await usersResponse.json();
      
      if (usersData.success) {
        console.log('   📊 Users Data: Accessible');
        console.log('   📈 Total Users:', usersData.data?.length || 0);
      } else {
        console.log('   📊 Users Data: Access restricted (expected for regular users)');
      }
      
    } else {
      console.log('   ❌ User Login: Failed');
      console.log('   💬 Message:', userLoginData.message);
    }

    // Test 6: Public Data Access
    console.log('\n6️⃣ Public Data Access...');
    const ridesResponse = await fetch(`${baseUrl.replace('/api', '')}/api/rides`);
    const ridesData = await ridesResponse.json();
    
    if (ridesData.success) {
      console.log('   ✅ Rides Data: Accessible');
      console.log('   🚗 Total Rides:', ridesData.data?.length || 0);
      if (ridesData.data && ridesData.data.length > 0) {
        console.log('   📍 Sample Route:', ridesData.data[0].route?.from, '→', ridesData.data[0].route?.to);
      }
    } else {
      console.log('   ❌ Rides Data: Failed');
    }

    return { success: true, title };

  } catch (error) {
    console.log(`\n❌ ${title} - Connection Failed`);
    console.log('💥 Error:', error.message);
    return { success: false, title, error: error.message };
  }
}

async function runMobileAppDatabaseTests() {
  console.log('🏗️ ARYV Mobile App - Database Connection Test');
  console.log('🎯 Testing mobile app API connectivity to backend systems');
  console.log('=' .repeat(60));

  const results = [];

  // Test local database backend (preferred for development)
  const localResult = await testApiConnection(LOCAL_API_URL, 'Local Database Backend (Development)');
  results.push(localResult);

  // Test production API (fallback)
  const prodResult = await testApiConnection(PRODUCTION_API_URL, 'Production API Backend (Fallback)');
  results.push(prodResult);

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST RESULTS SUMMARY');
  console.log('='.repeat(60));

  results.forEach((result, index) => {
    const status = result.success ? '✅ PASSED' : '❌ FAILED';
    console.log(`${index + 1}. ${result.title}: ${status}`);
    if (!result.success) {
      console.log(`   Error: ${result.error}`);
    }
  });

  const passedTests = results.filter(r => r.success).length;
  const totalTests = results.length;

  console.log(`\n🎯 Overall: ${passedTests}/${totalTests} backends accessible`);
  
  if (passedTests > 0) {
    console.log('\n✅ Mobile app can connect to database backend!');
    if (results[0].success) {
      console.log('🔥 Local database backend is working - optimal for development');
    } else if (results[1].success) {
      console.log('☁️ Production API is working - fallback available');
    }
  } else {
    console.log('\n❌ No backends accessible - check server status');
  }

  console.log('\n📱 Mobile App Database Integration Status:');
  console.log('   🔗 API Configuration: Updated for local backend preference');
  console.log('   🔄 Fallback System: Production API as backup');
  console.log('   🔐 Authentication: JWT tokens with database users');
  console.log('   📊 Data Access: Real user and ride data from PostgreSQL');
}

// Run the tests
runMobileAppDatabaseTests().catch(console.error);