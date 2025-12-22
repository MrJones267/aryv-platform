/**
 * @fileoverview E2E Testing Setup and Configuration
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

const { chromium, firefox, webkit } = require('playwright');
const { execSync } = require('child_process');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Test configuration
const config = {
  baseUrl: process.env.E2E_BASE_URL || 'http://localhost:3001',
  adminUrl: process.env.E2E_ADMIN_URL || 'http://localhost:3000',
  timeout: parseInt(process.env.E2E_TIMEOUT) || 30000,
  headless: process.env.E2E_HEADLESS !== 'false',
  browsers: process.env.E2E_BROWSERS ? process.env.E2E_BROWSERS.split(',') : ['chromium'],
  viewport: { width: 1280, height: 720 },
  screenshots: process.env.E2E_SCREENSHOTS !== 'false',
  videos: process.env.E2E_VIDEOS === 'true',
  reportDir: './tests/e2e/reports',
  screenshotDir: './tests/e2e/screenshots',
  videoDir: './tests/e2e/videos'
};

// Test data
const testUsers = {
  passenger1: {
    email: 'passenger1@test.com',
    password: 'TestPassword123!',
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: '+1234567890',
    role: 'passenger'
  },
  passenger2: {
    email: 'passenger2@test.com',
    password: 'TestPassword456!',
    firstName: 'Jane',
    lastName: 'Smith',
    phoneNumber: '+1234567891',
    role: 'passenger'
  },
  driver1: {
    email: 'driver1@test.com',
    password: 'TestPassword789!',
    firstName: 'Bob',
    lastName: 'Johnson',
    phoneNumber: '+1234567892',
    role: 'driver'
  },
  driver2: {
    email: 'driver2@test.com',
    password: 'TestPassword012!',
    firstName: 'Alice',
    lastName: 'Williams',
    phoneNumber: '+1234567893',
    role: 'driver'
  },
  admin: {
    email: 'admin@test.com',
    password: 'AdminPassword123!',
    firstName: 'Admin',
    lastName: 'User',
    phoneNumber: '+1234567894',
    role: 'admin'
  }
};

// Test locations in New York
const testLocations = {
  timesSquare: {
    address: 'Times Square, New York, NY 10036',
    coordinates: { latitude: 40.7580, longitude: -73.9855 }
  },
  centralPark: {
    address: 'Central Park, New York, NY 10024',
    coordinates: { latitude: 40.7812, longitude: -73.9665 }
  },
  brooklynBridge: {
    address: 'Brooklyn Bridge, New York, NY 10038',
    coordinates: { latitude: 40.7061, longitude: -73.9969 }
  },
  empireState: {
    address: 'Empire State Building, New York, NY 10001',
    coordinates: { latitude: 40.7484, longitude: -73.9857 }
  }
};

// Test vehicles
const testVehicles = {
  sedan1: {
    make: 'Toyota',
    model: 'Camry',
    year: 2022,
    color: 'Blue',
    licensePlate: 'TEST001',
    vehicleType: 'sedan',
    seatsAvailable: 4,
    insuranceExpiry: '2025-12-31',
    registrationExpiry: '2025-06-30'
  },
  suv1: {
    make: 'Honda',
    model: 'CR-V',
    year: 2023,
    color: 'White',
    licensePlate: 'TEST002',
    vehicleType: 'suv',
    seatsAvailable: 6,
    insuranceExpiry: '2025-12-31',
    registrationExpiry: '2025-06-30'
  }
};

class E2ETestSetup {
  constructor() {
    this.browsers = new Map();
    this.contexts = new Map();
    this.pages = new Map();
    this.tokens = new Map();
    this.userIds = new Map();
    this.vehicleIds = new Map();
    this.rideIds = new Map();
  }

  // Initialize test environment
  async setup() {
    console.log('🚀 Setting up E2E test environment...');
    
    // Create directories
    this.createDirectories();
    
    // Wait for services to be ready
    await this.waitForServices();
    
    // Setup test database
    await this.setupTestDatabase();
    
    // Launch browsers
    await this.launchBrowsers();
    
    // Register test users
    await this.registerTestUsers();
    
    // Setup test data
    await this.setupTestData();
    
    console.log('✅ E2E test environment ready!');
  }

  // Create necessary directories
  createDirectories() {
    const dirs = [config.reportDir, config.screenshotDir, config.videoDir];
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  // Wait for all services to be available
  async waitForServices() {
    console.log('⏳ Waiting for services to be ready...');
    
    const services = [
      { name: 'Backend', url: `${config.baseUrl}/health` },
      { name: 'Admin Panel', url: `${config.adminUrl}/health` || `${config.adminUrl}` }
    ];

    for (const service of services) {
      let retries = 30;
      let ready = false;
      
      while (retries > 0 && !ready) {
        try {
          await axios.get(service.url, { timeout: 5000 });
          console.log(`✅ ${service.name} is ready`);
          ready = true;
        } catch (error) {
          console.log(`⏳ Waiting for ${service.name}... (${retries} retries left)`);
          await this.sleep(2000);
          retries--;
        }
      }
      
      if (!ready) {
        throw new Error(`❌ ${service.name} failed to start`);
      }
    }
  }

  // Setup test database
  async setupTestDatabase() {
    console.log('🗄️ Setting up test database...');
    
    try {
      // Run migrations
      execSync('cd backend && npm run db:migrate', { stdio: 'inherit' });
      console.log('✅ Database migrations completed');
    } catch (error) {
      console.warn('⚠️ Database migrations failed (might already be applied):', error.message);
    }
  }

  // Launch browsers for testing
  async launchBrowsers() {
    console.log('🌐 Launching browsers...');
    
    for (const browserName of config.browsers) {
      let browser;
      
      switch (browserName) {
        case 'chromium':
          browser = await chromium.launch({ headless: config.headless });
          break;
        case 'firefox':
          browser = await firefox.launch({ headless: config.headless });
          break;
        case 'webkit':
          browser = await webkit.launch({ headless: config.headless });
          break;
        default:
          throw new Error(`Unsupported browser: ${browserName}`);
      }
      
      this.browsers.set(browserName, browser);
      console.log(`✅ ${browserName} browser launched`);
    }
  }

  // Register test users via API
  async registerTestUsers() {
    console.log('👥 Registering test users...');
    
    for (const [userKey, userData] of Object.entries(testUsers)) {
      try {
        // Register user
        const registerResponse = await axios.post(
          `${config.baseUrl}/api/auth/register`,
          userData,
          { headers: { 'Content-Type': 'application/json' } }
        );
        
        if (registerResponse.data.success) {
          this.tokens.set(userKey, registerResponse.data.data.token);
          this.userIds.set(userKey, registerResponse.data.data.user.id);
          console.log(`✅ Registered user: ${userKey}`);
        } else {
          // Try to login if user already exists
          const loginResponse = await axios.post(
            `${config.baseUrl}/api/auth/login`,
            { email: userData.email, password: userData.password },
            { headers: { 'Content-Type': 'application/json' } }
          );
          
          if (loginResponse.data.success) {
            this.tokens.set(userKey, loginResponse.data.data.token);
            this.userIds.set(userKey, loginResponse.data.data.user.id);
            console.log(`✅ Logged in existing user: ${userKey}`);
          }
        }
      } catch (error) {
        console.error(`❌ Failed to register user ${userKey}:`, error.message);
      }
    }
  }

  // Setup test data (vehicles, etc.)
  async setupTestData() {
    console.log('🚗 Setting up test vehicles...');
    
    // Add vehicles for drivers
    const drivers = ['driver1', 'driver2'];
    const vehicles = Object.values(testVehicles);
    
    for (let i = 0; i < drivers.length; i++) {
      const driverKey = drivers[i];
      const vehicle = vehicles[i];
      const token = this.tokens.get(driverKey);
      
      if (token) {
        try {
          const response = await axios.post(
            `${config.baseUrl}/api/vehicles`,
            vehicle,
            { 
              headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
              }
            }
          );
          
          if (response.data.success) {
            this.vehicleIds.set(driverKey, response.data.data.id);
            console.log(`✅ Added vehicle for ${driverKey}`);
          }
        } catch (error) {
          console.error(`❌ Failed to add vehicle for ${driverKey}:`, error.message);
        }
      }
    }
  }

  // Create browser context for user
  async createContext(browserName, userKey) {
    const browser = this.browsers.get(browserName);
    const contextId = `${browserName}_${userKey}`;
    
    const contextOptions = {
      viewport: config.viewport,
      ignoreHTTPSErrors: true
    };
    
    if (config.videos) {
      contextOptions.recordVideo = {
        dir: config.videoDir,
        size: config.viewport
      };
    }
    
    const context = await browser.newContext(contextOptions);
    this.contexts.set(contextId, context);
    
    return context;
  }

  // Create page for testing
  async createPage(browserName, userKey) {
    const contextId = `${browserName}_${userKey}`;
    let context = this.contexts.get(contextId);
    
    if (!context) {
      context = await this.createContext(browserName, userKey);
    }
    
    const page = await context.newPage();
    const pageId = `${browserName}_${userKey}`;
    this.pages.set(pageId, page);
    
    // Set default timeout
    page.setDefaultTimeout(config.timeout);
    
    return page;
  }

  // Take screenshot
  async screenshot(page, name) {
    if (config.screenshots) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `${name}_${timestamp}.png`;
      const filepath = path.join(config.screenshotDir, filename);
      await page.screenshot({ path: filepath, fullPage: true });
      return filepath;
    }
  }

  // Cleanup test environment
  async cleanup() {
    console.log('🧹 Cleaning up test environment...');
    
    // Close all pages
    for (const [pageId, page] of this.pages.entries()) {
      try {
        await page.close();
      } catch (error) {
        console.warn(`Warning: Failed to close page ${pageId}`);
      }
    }
    
    // Close all contexts
    for (const [contextId, context] of this.contexts.entries()) {
      try {
        await context.close();
      } catch (error) {
        console.warn(`Warning: Failed to close context ${contextId}`);
      }
    }
    
    // Close all browsers
    for (const [browserName, browser] of this.browsers.entries()) {
      try {
        await browser.close();
      } catch (error) {
        console.warn(`Warning: Failed to close browser ${browserName}`);
      }
    }
    
    console.log('✅ Cleanup completed');
  }

  // Helper methods
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getToken(userKey) {
    return this.tokens.get(userKey);
  }

  getUserId(userKey) {
    return this.userIds.get(userKey);
  }

  getVehicleId(userKey) {
    return this.vehicleIds.get(userKey);
  }

  getRideId(rideKey) {
    return this.rideIds.get(rideKey);
  }

  setRideId(rideKey, rideId) {
    this.rideIds.set(rideKey, rideId);
  }
}

// Export configuration and setup class
module.exports = {
  config,
  testUsers,
  testLocations,
  testVehicles,
  E2ETestSetup
};
