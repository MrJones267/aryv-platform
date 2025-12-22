/**
 * @fileoverview Performance E2E Tests - Load testing and performance validation
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

const { expect } = require('chai');
const { config, testUsers } = require('../setup');

class PerformanceTests {
  constructor(setup) {
    this.setup = setup;
    this.results = {
      passed: 0,
      failed: 0,
      skipped: 0,
      tests: []
    };
  }

  async runAll() {
    const tests = [
      { name: 'Page Load Performance', fn: this.testPageLoadPerformance },
      { name: 'API Response Times', fn: this.testAPIResponseTimes },
      { name: 'Concurrent User Load', fn: this.testConcurrentUserLoad },
      { name: 'Database Query Performance', fn: this.testDatabasePerformance },
      { name: 'Memory Usage and Leaks', fn: this.testMemoryUsage },
      { name: 'Network Resource Optimization', fn: this.testNetworkOptimization },
      { name: 'Real-time Features Performance', fn: this.testRealTimePerformance },
      { name: 'Mobile Performance', fn: this.testMobilePerformance },
      { name: 'Caching Effectiveness', fn: this.testCachingPerformance }
    ];

    for (const test of tests) {
      await this.runTest(test.name, test.fn.bind(this));
    }
  }

  async runTest(testName, testFn) {
    const startTime = Date.now();
    console.log(`  ⚡ ${testName}`);

    try {
      await testFn();
      const duration = (Date.now() - startTime) / 1000;
      console.log(`  ✅ ${testName} (${duration.toFixed(2)}s)`);
      
      this.results.passed++;
      this.results.tests.push({
        name: testName,
        status: 'passed',
        duration
      });
    } catch (error) {
      const duration = (Date.now() - startTime) / 1000;
      console.log(`  ❌ ${testName} (${duration.toFixed(2)}s)`);
      console.log(`    Error: ${error.message}`);
      
      this.results.failed++;
      this.results.tests.push({
        name: testName,
        status: 'failed',
        duration,
        error: error.message
      });
    }
  }

  // Test page load performance
  async testPageLoadPerformance() {
    const page = await this.setup.createPage('chromium', 'performance_test');
    
    try {
      // Test homepage load time
      const startTime = Date.now();
      await page.goto(`${config.baseUrl}`);
      await page.waitForLoadState('networkidle');
      const homepageLoadTime = Date.now() - startTime;
      
      expect(homepageLoadTime).to.be.below(3000, 'Homepage should load within 3 seconds');
      console.log(`    Homepage load time: ${homepageLoadTime}ms`);
      
      // Test dashboard load time after login
      const dashboardStartTime = Date.now();
      await this.loginUser(page, testUsers.passenger1);
      await page.waitForLoadState('networkidle');
      const dashboardLoadTime = Date.now() - dashboardStartTime;
      
      expect(dashboardLoadTime).to.be.below(2000, 'Dashboard should load within 2 seconds');
      console.log(`    Dashboard load time: ${dashboardLoadTime}ms`);
      
      // Test ride search page performance
      const searchStartTime = Date.now();
      await page.click('[data-testid="search-rides"]');
      await page.waitForLoadState('networkidle');
      const searchLoadTime = Date.now() - searchStartTime;
      
      expect(searchLoadTime).to.be.below(1500, 'Search page should load within 1.5 seconds');
      console.log(`    Search page load time: ${searchLoadTime}ms`);
      
      // Measure First Contentful Paint (FCP)
      const performanceMetrics = await page.evaluate(() => {
        return JSON.stringify(performance.getEntriesByType('navigation'));
      });
      
      const metrics = JSON.parse(performanceMetrics)[0];
      expect(metrics.domContentLoadedEventEnd - metrics.fetchStart).to.be.below(2000);
      
      // Test Core Web Vitals
      const webVitals = await page.evaluate(() => {
        return new Promise((resolve) => {
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const vitals = {};
            
            for (const entry of entries) {
              if (entry.entryType === 'largest-contentful-paint') {
                vitals.LCP = entry.startTime;
              }
              if (entry.entryType === 'first-input') {
                vitals.FID = entry.processingStart - entry.startTime;
              }
            }
            
            resolve(vitals);
          }).observe({ entryTypes: ['largest-contentful-paint', 'first-input'] });
          
          // Resolve after timeout if no metrics available
          setTimeout(() => resolve({}), 5000);
        });
      });
      
      if (webVitals.LCP) {
        expect(webVitals.LCP).to.be.below(2500, 'Largest Contentful Paint should be under 2.5s');
        console.log(`    LCP: ${webVitals.LCP.toFixed(2)}ms`);
      }
      
    } finally {
      await page.close();
    }
  }

  // Test API response times
  async testAPIResponseTimes() {
    const axios = require('axios');
    const token = this.setup.getToken('passenger1');
    
    const apiTests = [
      { endpoint: '/health', method: 'GET', expectedTime: 200 },
      { endpoint: '/api/auth/profile', method: 'GET', expectedTime: 300, requiresAuth: true },
      { endpoint: '/api/rides/search?originLat=40.7128&originLng=-74.0060&destinationLat=40.7589&destinationLng=-73.9851&departureTime=2025-01-22T10:00:00Z', method: 'GET', expectedTime: 500 },
      { endpoint: '/api/vehicles', method: 'GET', expectedTime: 300, requiresAuth: true }
    ];
    
    for (const test of apiTests) {
      const startTime = Date.now();
      
      try {
        const headers = test.requiresAuth && token ? 
          { 'Authorization': `Bearer ${token}` } : {};
        
        const response = await axios({
          method: test.method,
          url: `${config.baseUrl}${test.endpoint}`,
          headers,
          timeout: 10000
        });
        
        const responseTime = Date.now() - startTime;
        
        expect(response.status).to.be.within(200, 299);
        expect(responseTime).to.be.below(test.expectedTime, 
          `${test.endpoint} should respond within ${test.expectedTime}ms`);
        
        console.log(`    ${test.endpoint}: ${responseTime}ms`);
        
      } catch (error) {
        if (error.code === 'ECONNREFUSED') {
          console.log(`    ${test.endpoint}: Service not available (skipped)`);
        } else {
          const responseTime = Date.now() - startTime;
          console.log(`    ${test.endpoint}: ${responseTime}ms (${error.message})`);
          
          // Still check response time even for errors
          expect(responseTime).to.be.below(test.expectedTime * 2);
        }
      }
    }
  }

  // Test concurrent user load
  async testConcurrentUserLoad() {
    const concurrentUsers = 5;
    const pages = [];
    
    try {
      // Create multiple browser contexts
      const promises = [];
      for (let i = 0; i < concurrentUsers; i++) {
        promises.push(this.setup.createPage('chromium', `concurrent_user_${i}`));
      }
      
      const createdPages = await Promise.all(promises);
      pages.push(...createdPages);
      
      // Simulate concurrent user actions
      const startTime = Date.now();
      
      const userActions = pages.map(async (page, index) => {
        const userKey = index % 2 === 0 ? 'passenger1' : 'passenger2';
        const user = testUsers[userKey];
        
        // Login
        await this.loginUser(page, user);
        
        // Perform typical user actions
        await page.click('[data-testid="search-rides"]');
        await page.waitForSelector('[data-testid="search-form"]');
        
        // Search for rides
        await page.fill('[data-testid="origin"]', 'Times Square');
        await page.fill('[data-testid="destination"]', 'Central Park');
        
        const searchStartTime = Date.now();
        await page.click('[data-testid="search-button"]');
        await page.waitForSelector('[data-testid="search-results"]', { timeout: 10000 });
        const searchTime = Date.now() - searchStartTime;
        
        return { userId: index, searchTime };
      });
      
      const results = await Promise.all(userActions);
      const totalTime = Date.now() - startTime;
      
      // Verify all users completed successfully
      expect(results).to.have.length(concurrentUsers);
      
      // Check individual search times
      const avgSearchTime = results.reduce((sum, r) => sum + r.searchTime, 0) / results.length;
      expect(avgSearchTime).to.be.below(3000, 'Average search time should be under 3 seconds with concurrent load');
      
      console.log(`    ${concurrentUsers} concurrent users completed in ${totalTime}ms`);
      console.log(`    Average search time: ${avgSearchTime.toFixed(2)}ms`);
      
      // Test system stability under load
      const healthCheck = await pages[0].goto(`${config.baseUrl}/health`);
      const healthResponse = await pages[0].textContent('body');
      expect(healthResponse).to.include('success');
      
    } finally {
      await Promise.all(pages.map(page => page.close()));
    }
  }

  // Test database performance
  async testDatabasePerformance() {
    const axios = require('axios');
    const token = this.setup.getToken('passenger1');
    
    if (!token) {
      console.log('    Skipping database tests - no authentication token');
      return;
    }
    
    try {
      // Test database-heavy operations
      const dbTests = [
        {
          name: 'User profile query',
          endpoint: '/api/users/profile',
          expectedTime: 200
        },
        {
          name: 'Ride search query',
          endpoint: '/api/rides/search?originLat=40.7128&originLng=-74.0060&destinationLat=40.7589&destinationLng=-73.9851&departureTime=2025-01-22T10:00:00Z&limit=20',
          expectedTime: 500
        },
        {
          name: 'Vehicle list query',
          endpoint: '/api/vehicles',
          expectedTime: 300
        }
      ];
      
      for (const test of dbTests) {
        const iterations = 5;
        const times = [];
        
        for (let i = 0; i < iterations; i++) {
          const startTime = Date.now();
          
          try {
            await axios.get(`${config.baseUrl}${test.endpoint}`, {
              headers: { 'Authorization': `Bearer ${token}` },
              timeout: 10000
            });
            
            times.push(Date.now() - startTime);
          } catch (error) {
            if (error.response?.status === 404) {
              console.log(`    ${test.name}: Endpoint not found (skipped)`);
              break;
            }
            throw error;
          }
        }
        
        if (times.length > 0) {
          const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
          const maxTime = Math.max(...times);
          
          expect(avgTime).to.be.below(test.expectedTime, 
            `${test.name} average response time should be under ${test.expectedTime}ms`);
          
          expect(maxTime).to.be.below(test.expectedTime * 2, 
            `${test.name} max response time should be under ${test.expectedTime * 2}ms`);
          
          console.log(`    ${test.name}: avg ${avgTime.toFixed(2)}ms, max ${maxTime}ms`);
        }
      }
      
    } catch (error) {
      if (error.code === 'ECONNREFUSED') {
        console.log('    Database tests skipped - service not available');
      } else {
        throw error;
      }
    }
  }

  // Test memory usage and leaks
  async testMemoryUsage() {
    const page = await this.setup.createPage('chromium', 'memory_test');
    
    try {
      await this.loginUser(page, testUsers.passenger1);
      
      // Get initial memory usage
      const initialMemory = await page.evaluate(() => {
        if (performance.memory) {
          return {
            usedJSHeapSize: performance.memory.usedJSHeapSize,
            totalJSHeapSize: performance.memory.totalJSHeapSize,
            jsHeapSizeLimit: performance.memory.jsHeapSizeLimit
          };
        }
        return null;
      });
      
      if (!initialMemory) {
        console.log('    Memory testing not available in this browser');
        return;
      }
      
      console.log(`    Initial memory usage: ${(initialMemory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`);
      
      // Perform memory-intensive operations
      for (let i = 0; i < 10; i++) {
        await page.click('[data-testid="search-rides"]');
        await page.waitForSelector('[data-testid="search-form"]');
        
        await page.fill('[data-testid="origin"]', `Location ${i}`);
        await page.fill('[data-testid="destination"]', `Destination ${i}`);
        
        // Clear and repeat to test memory cleanup
        await page.fill('[data-testid="origin"]', '');
        await page.fill('[data-testid="destination"]', '');
      }
      
      // Force garbage collection if available
      await page.evaluate(() => {
        if (window.gc) {
          window.gc();
        }
      });
      
      // Check final memory usage
      const finalMemory = await page.evaluate(() => {
        return {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize
        };
      });
      
      const memoryIncrease = finalMemory.usedJSHeapSize - initialMemory.usedJSHeapSize;
      const memoryIncreasePercent = (memoryIncrease / initialMemory.usedJSHeapSize) * 100;
      
      console.log(`    Final memory usage: ${(finalMemory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`);
      console.log(`    Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)} MB (${memoryIncreasePercent.toFixed(2)}%)`);
      
      // Memory increase should be reasonable (less than 50% increase)
      expect(memoryIncreasePercent).to.be.below(50, 'Memory usage should not increase by more than 50%');
      
      // Total memory should not exceed reasonable limits
      expect(finalMemory.usedJSHeapSize / 1024 / 1024).to.be.below(100, 'Total memory usage should be under 100MB');
      
    } finally {
      await page.close();
    }
  }

  // Test network resource optimization
  async testNetworkOptimization() {
    const page = await this.setup.createPage('chromium', 'network_test');
    
    try {
      // Monitor network activity
      const networkRequests = [];
      
      page.on('request', request => {
        networkRequests.push({
          url: request.url(),
          method: request.method(),
          size: request.postDataBuffer()?.length || 0,
          startTime: Date.now()
        });
      });
      
      const responses = [];
      page.on('response', response => {
        responses.push({
          url: response.url(),
          status: response.status(),
          size: 0, // Will be updated below
          endTime: Date.now()
        });
      });
      
      // Load the main page
      await page.goto(`${config.baseUrl}`);
      await page.waitForLoadState('networkidle');
      
      // Analyze network requests
      const jsRequests = networkRequests.filter(req => req.url.endsWith('.js'));
      const cssRequests = networkRequests.filter(req => req.url.endsWith('.css'));
      const imageRequests = networkRequests.filter(req => 
        req.url.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i));
      
      console.log(`    Total requests: ${networkRequests.length}`);
      console.log(`    JavaScript files: ${jsRequests.length}`);
      console.log(`    CSS files: ${cssRequests.length}`);
      console.log(`    Images: ${imageRequests.length}`);
      
      // Check for resource optimization
      expect(jsRequests.length).to.be.below(20, 'Should have fewer than 20 JavaScript files');
      expect(cssRequests.length).to.be.below(10, 'Should have fewer than 10 CSS files');
      
      // Check for caching headers
      const staticResources = responses.filter(resp => 
        resp.url.match(/\.(js|css|jpg|jpeg|png|gif|webp|svg)$/i) && resp.status === 200);
      
      // Test resource compression
      const resourceMetrics = await page.evaluate(() => {
        const entries = performance.getEntriesByType('resource');
        return entries.map(entry => ({
          name: entry.name,
          transferSize: entry.transferSize,
          encodedBodySize: entry.encodedBodySize,
          decodedBodySize: entry.decodedBodySize
        })).filter(entry => entry.transferSize > 0);
      });
      
      // Check compression ratios
      for (const metric of resourceMetrics) {
        if (metric.decodedBodySize > 1024) { // Only check files larger than 1KB
          const compressionRatio = metric.encodedBodySize / metric.decodedBodySize;
          if (compressionRatio > 0.9) {
            console.log(`    Warning: Poor compression for ${metric.name.split('/').pop()} (${(compressionRatio * 100).toFixed(1)}%)`);
          }
        }
      }
      
      // Check for duplicate resources
      const resourceUrls = networkRequests.map(req => req.url);
      const duplicates = resourceUrls.filter((url, index) => resourceUrls.indexOf(url) !== index);
      
      expect(duplicates.length).to.equal(0, 'Should not have duplicate resource requests');
      
    } finally {
      await page.close();
    }
  }

  // Test real-time features performance
  async testRealTimePerformance() {
    const driverPage = await this.setup.createPage('chromium', 'realtime_driver');
    const passengerPage = await this.setup.createPage('firefox', 'realtime_passenger');
    
    try {
      // Setup WebSocket connections
      await this.loginUser(driverPage, testUsers.driver1);
      await this.loginUser(passengerPage, testUsers.passenger1);
      
      // Test WebSocket connection time
      const wsStartTime = Date.now();
      
      await Promise.all([
        driverPage.evaluate(() => {
          return new Promise((resolve) => {
            const ws = new WebSocket('ws://localhost:3001');
            ws.onopen = () => resolve(Date.now());
            ws.onerror = () => resolve(null);
            setTimeout(() => resolve(null), 5000);
          });
        }),
        passengerPage.evaluate(() => {
          return new Promise((resolve) => {
            const ws = new WebSocket('ws://localhost:3001');
            ws.onopen = () => resolve(Date.now());
            ws.onerror = () => resolve(null);
            setTimeout(() => resolve(null), 5000);
          });
        })
      ]);
      
      const wsConnectionTime = Date.now() - wsStartTime;
      console.log(`    WebSocket connection time: ${wsConnectionTime}ms`);
      
      expect(wsConnectionTime).to.be.below(2000, 'WebSocket connections should establish within 2 seconds');
      
      // Test message latency
      const messageLatencies = [];
      
      for (let i = 0; i < 5; i++) {
        const messageStart = Date.now();
        
        // Simulate location update from driver
        await driverPage.evaluate((timestamp) => {
          if (window.socket && window.socket.readyState === WebSocket.OPEN) {
            window.socket.send(JSON.stringify({
              type: 'location_update',
              data: { lat: 40.7128, lng: -74.0060, timestamp }
            }));
          }
        }, messageStart);
        
        // Wait for passenger to receive update
        try {
          await passengerPage.waitForFunction(
            (timestamp) => {
              return window.lastLocationUpdate && window.lastLocationUpdate >= timestamp;
            },
            { timeout: 3000 },
            messageStart
          );
          
          const messageEnd = Date.now();
          const latency = messageEnd - messageStart;
          messageLatencies.push(latency);
          
        } catch (error) {
          console.log(`    Message ${i + 1}: No response (WebSocket may not be available)`);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait between messages
      }
      
      if (messageLatencies.length > 0) {
        const avgLatency = messageLatencies.reduce((sum, lat) => sum + lat, 0) / messageLatencies.length;
        const maxLatency = Math.max(...messageLatencies);
        
        console.log(`    Average message latency: ${avgLatency.toFixed(2)}ms`);
        console.log(`    Max message latency: ${maxLatency}ms`);
        
        expect(avgLatency).to.be.below(500, 'Average message latency should be under 500ms');
        expect(maxLatency).to.be.below(1000, 'Max message latency should be under 1 second');
      } else {
        console.log('    Real-time messaging tests skipped - WebSocket not available');
      }
      
    } finally {
      await driverPage.close();
      await passengerPage.close();
    }
  }

  // Test mobile performance
  async testMobilePerformance() {
    const mobileContext = await this.setup.createContext('chromium', 'mobile_test');
    
    // Emulate mobile device
    await mobileContext.addInitScript(() => {
      Object.defineProperty(navigator, 'userAgent', {
        get: () => 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15'
      });
    });
    
    const page = await mobileContext.newPage();
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE size
    
    try {
      // Test mobile page load performance
      const loadStartTime = Date.now();
      await page.goto(`${config.baseUrl}`);
      await page.waitForLoadState('networkidle');
      const mobileLoadTime = Date.now() - loadStartTime;
      
      console.log(`    Mobile page load time: ${mobileLoadTime}ms`);
      expect(mobileLoadTime).to.be.below(4000, 'Mobile page should load within 4 seconds');
      
      // Test touch interactions performance
      await this.loginUser(page, testUsers.passenger1);
      
      const touchStartTime = Date.now();
      await page.tap('[data-testid="search-rides"]');
      await page.waitForSelector('[data-testid="search-form"]');
      const touchResponseTime = Date.now() - touchStartTime;
      
      console.log(`    Touch interaction response time: ${touchResponseTime}ms`);
      expect(touchResponseTime).to.be.below(300, 'Touch interactions should respond within 300ms');
      
      // Test scroll performance
      const scrollStartTime = Date.now();
      
      await page.evaluate(() => {
        return new Promise((resolve) => {
          let scrollCount = 0;
          const targetScrolls = 5;
          
          const scroll = () => {
            window.scrollBy(0, 100);
            scrollCount++;
            
            if (scrollCount >= targetScrolls) {
              resolve();
            } else {
              requestAnimationFrame(scroll);
            }
          };
          
          requestAnimationFrame(scroll);
        });
      });
      
      const scrollTime = Date.now() - scrollStartTime;
      console.log(`    Scroll performance: ${scrollTime}ms for 5 scroll actions`);
      
      // Should be smooth (under 16ms per frame * 5 = 80ms)
      expect(scrollTime).to.be.below(200, 'Scrolling should be smooth on mobile');
      
      // Test mobile-specific features
      const isMobileOptimized = await page.evaluate(() => {
        const viewport = document.querySelector('meta[name="viewport"]');
        const touchAction = getComputedStyle(document.body).touchAction;
        
        return {
          hasViewportMeta: !!viewport,
          touchActionOptimized: touchAction !== 'auto',
          isResponsive: window.innerWidth <= 768
        };
      });
      
      expect(isMobileOptimized.hasViewportMeta).to.be.true;
      expect(isMobileOptimized.isResponsive).to.be.true;
      
    } finally {
      await page.close();
      await mobileContext.close();
    }
  }

  // Test caching performance
  async testCachingPerformance() {
    const page = await this.setup.createPage('chromium', 'caching_test');
    
    try {
      // First visit - measure cache miss performance
      const firstVisitStart = Date.now();
      await page.goto(`${config.baseUrl}`);
      await page.waitForLoadState('networkidle');
      const firstVisitTime = Date.now() - firstVisitStart;
      
      // Second visit - measure cache hit performance
      const secondVisitStart = Date.now();
      await page.reload();
      await page.waitForLoadState('networkidle');
      const secondVisitTime = Date.now() - secondVisitStart;
      
      console.log(`    First visit (cache miss): ${firstVisitTime}ms`);
      console.log(`    Second visit (cache hit): ${secondVisitTime}ms`);
      
      // Second visit should be significantly faster
      const improvementRatio = (firstVisitTime - secondVisitTime) / firstVisitTime;
      console.log(`    Cache improvement: ${(improvementRatio * 100).toFixed(1)}%`);
      
      expect(secondVisitTime).to.be.below(firstVisitTime, 'Cached resources should load faster');
      expect(improvementRatio).to.be.above(0.1, 'Cache should provide at least 10% improvement');
      
      // Test API response caching
      await this.loginUser(page, testUsers.passenger1);
      const token = this.setup.getToken('passenger1');
      
      if (token) {
        const axios = require('axios');
        
        // First API call
        const firstApiStart = Date.now();
        await axios.get(`${config.baseUrl}/api/users/profile`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const firstApiTime = Date.now() - firstApiStart;
        
        // Second API call (should be cached or faster)
        const secondApiStart = Date.now();
        await axios.get(`${config.baseUrl}/api/users/profile`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const secondApiTime = Date.now() - secondApiStart;
        
        console.log(`    First API call: ${firstApiTime}ms`);
        console.log(`    Second API call: ${secondApiTime}ms`);
        
        expect(secondApiTime).to.be.at.most(firstApiTime * 1.5, 'Subsequent API calls should not be significantly slower');
      }
      
    } finally {
      await page.close();
    }
  }

  // Helper method to login user
  async loginUser(page, user) {
    await page.goto(`${config.baseUrl}/auth/login`);
    await page.fill('[data-testid="email"]', user.email);
    await page.fill('[data-testid="password"]', user.password);
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('**/dashboard');
  }
}

module.exports = PerformanceTests;
