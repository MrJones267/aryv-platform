/**
 * Test script for enhanced currency and country endpoints
 * Run with: node test-enhanced-endpoints.js
 */

const http = require('http');

const BASE_URL = 'http://localhost:3001';

async function testEndpoint(endpoint, description) {
  return new Promise((resolve) => {
    const url = `${BASE_URL}${endpoint}`;
    console.log(`\n🔍 Testing: ${description}`);
    console.log(`📍 URL: ${url}`);
    
    http.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          console.log(`✅ Status: ${res.statusCode}`);
          console.log(`📊 Response:`, JSON.stringify(parsed, null, 2));
          resolve({ success: true, status: res.statusCode, data: parsed });
        } catch (error) {
          console.log(`❌ Parse Error:`, error.message);
          console.log(`📄 Raw Response:`, data);
          resolve({ success: false, error: error.message, raw: data });
        }
      });
    }).on('error', (error) => {
      console.log(`🚨 Request Error:`, error.message);
      resolve({ success: false, error: error.message });
    });
  });
}

async function runTests() {
  console.log('🚀 Starting Enhanced Backend API Tests\n');
  
  const tests = [
    {
      endpoint: '/health',
      description: 'Health Check - Verify server is running'
    },
    {
      endpoint: '/api/currencies',
      description: 'Get All Currencies - Test fallback support'
    },
    {
      endpoint: '/api/currencies/popular?region=global',
      description: 'Get Popular Currencies - Test global region'
    },
    {
      endpoint: '/api/currencies/popular?region=Africa',
      description: 'Get Popular Currencies - Test Africa region'
    },
    {
      endpoint: '/api/countries',
      description: 'Get All Countries - Test dialing codes'
    },
    {
      endpoint: '/api/countries/popular',
      description: 'Get Popular Countries - Test popular filtering'
    },
    {
      endpoint: '/api/countries/US',
      description: 'Get Country by Code - Test specific country'
    },
    {
      endpoint: '/api/countries/region/Africa',
      description: 'Get Countries by Region - Test region filtering'
    },
    {
      endpoint: '/api/countries/search?q=United',
      description: 'Search Countries - Test search functionality'
    },
    {
      endpoint: '/api/countries/search?q=+1',
      description: 'Search Countries - Test dialing code search'
    }
  ];
  
  const results = [];
  
  for (const test of tests) {
    const result = await testEndpoint(test.endpoint, test.description);
    results.push({
      ...test,
      result
    });
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('📋 TEST SUMMARY');
  console.log('='.repeat(60));
  
  const successful = results.filter(r => r.result.success && r.result.status === 200);
  const failed = results.filter(r => !r.result.success || r.result.status !== 200);
  
  console.log(`✅ Successful: ${successful.length}/${results.length}`);
  console.log(`❌ Failed: ${failed.length}/${results.length}`);
  
  if (failed.length > 0) {
    console.log('\n🚨 Failed Tests:');
    failed.forEach(test => {
      console.log(`  - ${test.description}: ${test.result.error || 'Status ' + test.result.status}`);
    });
  }
  
  if (successful.length > 0) {
    console.log('\n✨ Key Features Verified:');
    successful.forEach(test => {
      if (test.result.data && test.result.data.data) {
        const data = test.result.data.data;
        if (data.currencies) {
          console.log(`  - ${test.description}: ${data.currencies.length} currencies, source: ${data.source}`);
        } else if (data.countries) {
          console.log(`  - ${test.description}: ${data.countries.length} countries, source: ${data.source}`);
        } else if (data.country) {
          console.log(`  - ${test.description}: ${data.country.name} (${data.country.dialingCode})`);
        }
      }
    });
  }
  
  console.log('\n🎯 Backend Integration Status:', successful.length === results.length ? 'READY' : 'NEEDS ATTENTION');
  console.log('\n📱 Mobile app can now use these enhanced endpoints for:');
  console.log('  • Currency settings with fallback data');
  console.log('  • Country dialing codes for registration');
  console.log('  • Dynamic currency and country selection');
  console.log('  • Offline-capable currency/country data');
}

// Check if server is running first
console.log('🔍 Checking if server is running...');
http.get(`${BASE_URL}/health`, (res) => {
  if (res.statusCode === 200) {
    runTests();
  } else {
    console.log('❌ Server not responding properly. Please start the backend server first.');
    console.log('   Run: cd backend && npm start');
  }
}).on('error', (error) => {
  console.log('🚨 Cannot connect to server. Please start the backend server first.');
  console.log('   Run: cd backend && npm start');
  console.log(`   Error: ${error.message}`);
});