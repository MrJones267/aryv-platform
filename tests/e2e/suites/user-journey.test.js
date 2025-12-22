/**
 * @fileoverview User Journey E2E Tests - Complete user workflows
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

const { expect } = require('chai');
const { config, testUsers, testLocations } = require('../setup');

class UserJourneyTests {
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
      { name: 'Complete Passenger Registration Journey', fn: this.testPassengerRegistration },
      { name: 'Complete Driver Registration Journey', fn: this.testDriverRegistration },
      { name: 'Passenger Profile Management Journey', fn: this.testPassengerProfile },
      { name: 'Driver Vehicle Management Journey', fn: this.testDriverVehicle },
      { name: 'Ride Search and Booking Journey', fn: this.testRideSearchAndBooking },
      { name: 'Driver Ride Creation Journey', fn: this.testDriverRideCreation },
      { name: 'Complete Ride Experience Journey', fn: this.testCompleteRideExperience },
      { name: 'Payment and Review Journey', fn: this.testPaymentAndReview },
      { name: 'Multi-User Concurrent Journey', fn: this.testMultiUserConcurrent }
    ];

    for (const test of tests) {
      await this.runTest(test.name, test.fn.bind(this));
    }
  }

  async runTest(testName, testFn) {
    const startTime = Date.now();
    console.log(`  📝 ${testName}`);

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

  // Test complete passenger registration workflow
  async testPassengerRegistration() {
    const page = await this.setup.createPage('chromium', 'new_passenger');
    
    try {
      // Navigate to registration
      await page.goto(`${config.baseUrl}/auth/register`);
      
      // Fill registration form
      await page.fill('[data-testid="email"]', 'newpassenger@test.com');
      await page.fill('[data-testid="password"]', 'NewPassword123!');
      await page.fill('[data-testid="firstName"]', 'New');
      await page.fill('[data-testid="lastName"]', 'Passenger');
      await page.fill('[data-testid="phoneNumber"]', '+1234567899');
      await page.selectOption('[data-testid="role"]', 'passenger');
      
      // Accept terms
      await page.check('[data-testid="terms"]');
      
      // Submit registration
      await page.click('[data-testid="register-button"]');
      
      // Wait for redirect to profile/dashboard
      await page.waitForURL('**/dashboard');
      
      // Verify welcome message
      const welcomeText = await page.textContent('[data-testid="welcome-message"]');
      expect(welcomeText).to.include('Welcome, New');
      
      // Verify user can see passenger features
      expect(await page.isVisible('[data-testid="search-rides"]')).to.be.true;
      expect(await page.isVisible('[data-testid="my-bookings"]')).to.be.true;
      
    } finally {
      await page.close();
    }
  }

  // Test complete driver registration workflow
  async testDriverRegistration() {
    const page = await this.setup.createPage('chromium', 'new_driver');
    
    try {
      await page.goto(`${config.baseUrl}/auth/register`);
      
      // Fill registration form
      await page.fill('[data-testid="email"]', 'newdriver@test.com');
      await page.fill('[data-testid="password"]', 'NewPassword123!');
      await page.fill('[data-testid="firstName"]', 'New');
      await page.fill('[data-testid="lastName"]', 'Driver');
      await page.fill('[data-testid="phoneNumber"]', '+1234567898');
      await page.selectOption('[data-testid="role"]', 'driver');
      
      // Driver-specific fields
      await page.fill('[data-testid="licenseNumber"]', 'DL123456789');
      await page.fill('[data-testid="licenseExpiry"]', '2025-12-31');
      
      await page.check('[data-testid="terms"]');
      await page.click('[data-testid="register-button"]');
      
      // Wait for driver onboarding flow
      await page.waitForURL('**/onboarding');
      
      // Complete vehicle setup
      await page.fill('[data-testid="make"]', 'Tesla');
      await page.fill('[data-testid="model"]', 'Model 3');
      await page.fill('[data-testid="year"]', '2023');
      await page.fill('[data-testid="licensePlate"]', 'TESLA01');
      await page.selectOption('[data-testid="vehicleType"]', 'sedan');
      
      await page.click('[data-testid="complete-onboarding"]');
      
      // Verify driver dashboard
      await page.waitForURL('**/dashboard');
      expect(await page.isVisible('[data-testid="create-ride"]')).to.be.true;
      expect(await page.isVisible('[data-testid="my-rides"]')).to.be.true;
      
    } finally {
      await page.close();
    }
  }

  // Test passenger profile management
  async testPassengerProfile() {
    const page = await this.setup.createPage('chromium', 'passenger1');
    const token = this.setup.getToken('passenger1');
    
    try {
      // Login first
      await this.loginUser(page, testUsers.passenger1);
      
      // Navigate to profile
      await page.click('[data-testid="user-menu"]');
      await page.click('[data-testid="profile-link"]');
      
      // Verify current profile info
      const firstName = await page.inputValue('[data-testid="firstName"]');
      expect(firstName).to.equal('John');
      
      // Update profile
      await page.fill('[data-testid="firstName"]', 'Johnny');
      await page.fill('[data-testid="phoneNumber"]', '+1234567800');
      
      // Upload profile image
      const fileInput = page.locator('[data-testid="profile-image"]');
      await fileInput.setInputFiles('./tests/fixtures/test-avatar.jpg');
      
      // Save changes
      await page.click('[data-testid="save-profile"]');
      
      // Wait for success message
      await page.waitForSelector('[data-testid="success-message"]');
      const successText = await page.textContent('[data-testid="success-message"]');
      expect(successText).to.include('Profile updated successfully');
      
      // Verify changes persisted
      await page.reload();
      const updatedName = await page.inputValue('[data-testid="firstName"]');
      expect(updatedName).to.equal('Johnny');
      
    } finally {
      await page.close();
    }
  }

  // Test driver vehicle management
  async testDriverVehicle() {
    const page = await this.setup.createPage('chromium', 'driver1');
    
    try {
      await this.loginUser(page, testUsers.driver1);
      
      // Navigate to vehicles
      await page.click('[data-testid="vehicles-link"]');
      
      // Add new vehicle
      await page.click('[data-testid="add-vehicle"]');
      
      await page.fill('[data-testid="make"]', 'BMW');
      await page.fill('[data-testid="model"]', 'X5');
      await page.fill('[data-testid="year"]', '2022');
      await page.fill('[data-testid="color"]', 'Black');
      await page.fill('[data-testid="licensePlate"]', 'BMW001');
      await page.selectOption('[data-testid="vehicleType"]', 'suv');
      await page.fill('[data-testid="seatsAvailable"]', '6');
      
      await page.click('[data-testid="save-vehicle"]');
      
      // Verify vehicle added
      await page.waitForSelector('[data-testid="vehicle-card"]');
      const vehicles = await page.locator('[data-testid="vehicle-card"]').count();
      expect(vehicles).to.be.greaterThan(0);
      
      // Edit vehicle
      await page.click('[data-testid="edit-vehicle"]:first-child');
      await page.fill('[data-testid="color"]', 'White');
      await page.click('[data-testid="save-vehicle"]');
      
      // Verify edit
      const colorText = await page.textContent('[data-testid="vehicle-color"]:first-child');
      expect(colorText).to.include('White');
      
    } finally {
      await page.close();
    }
  }

  // Test ride search and booking flow
  async testRideSearchAndBooking() {
    const page = await this.setup.createPage('chromium', 'passenger2');
    
    try {
      await this.loginUser(page, testUsers.passenger2);
      
      // Navigate to ride search
      await page.click('[data-testid="search-rides"]');
      
      // Fill search form
      await page.fill('[data-testid="origin"]', testLocations.timesSquare.address);
      await page.fill('[data-testid="destination"]', testLocations.centralPark.address);
      
      // Set departure time (2 hours from now)
      const futureTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const timeString = futureTime.toISOString().slice(0, 16);
      await page.fill('[data-testid="departure-time"]', timeString);
      
      await page.fill('[data-testid="seats"]', '2');
      
      // Search for rides
      await page.click('[data-testid="search-button"]');
      
      // Wait for results
      await page.waitForSelector('[data-testid="ride-results"]');
      
      // Select first available ride
      const rideCards = page.locator('[data-testid="ride-card"]');
      expect(await rideCards.count()).to.be.greaterThan(0);
      
      await rideCards.first().click();
      
      // Book the ride
      await page.click('[data-testid="book-ride"]');
      
      // Fill booking details
      await page.fill('[data-testid="pickup-address"]', testLocations.timesSquare.address);
      await page.fill('[data-testid="special-requests"]', 'Please wait 2 minutes');
      
      // Confirm booking
      await page.click('[data-testid="confirm-booking"]');
      
      // Wait for booking confirmation
      await page.waitForSelector('[data-testid="booking-success"]');
      const confirmationText = await page.textContent('[data-testid="booking-success"]');
      expect(confirmationText).to.include('Booking confirmed');
      
      // Verify booking appears in user's bookings
      await page.click('[data-testid="my-bookings"]');
      await page.waitForSelector('[data-testid="booking-item"]');
      const bookings = await page.locator('[data-testid="booking-item"]').count();
      expect(bookings).to.be.greaterThan(0);
      
    } finally {
      await page.close();
    }
  }

  // Test driver ride creation
  async testDriverRideCreation() {
    const page = await this.setup.createPage('chromium', 'driver2');
    
    try {
      await this.loginUser(page, testUsers.driver2);
      
      // Navigate to create ride
      await page.click('[data-testid="create-ride"]');
      
      // Fill ride details
      await page.fill('[data-testid="origin"]', testLocations.empireState.address);
      await page.fill('[data-testid="destination"]', testLocations.brooklynBridge.address);
      
      // Set departure time (3 hours from now)
      const futureTime = new Date(Date.now() + 3 * 60 * 60 * 1000);
      const timeString = futureTime.toISOString().slice(0, 16);
      await page.fill('[data-testid="departure-time"]', timeString);
      
      await page.fill('[data-testid="available-seats"]', '3');
      await page.fill('[data-testid="price-per-seat"]', '18.50');
      await page.fill('[data-testid="description"]', 'Comfortable ride with music and AC');
      
      // Select vehicle
      const vehicleId = this.setup.getVehicleId('driver2');
      await page.selectOption('[data-testid="vehicle"]', vehicleId);
      
      // Create ride
      await page.click('[data-testid="create-ride-button"]');
      
      // Wait for confirmation
      await page.waitForSelector('[data-testid="ride-created"]');
      const successText = await page.textContent('[data-testid="ride-created"]');
      expect(successText).to.include('Ride created successfully');
      
      // Verify ride appears in driver's rides
      await page.click('[data-testid="my-rides"]');
      await page.waitForSelector('[data-testid="ride-item"]');
      const rides = await page.locator('[data-testid="ride-item"]').count();
      expect(rides).to.be.greaterThan(0);
      
    } finally {
      await page.close();
    }
  }

  // Test complete ride experience from booking to completion
  async testCompleteRideExperience() {
    const driverPage = await this.setup.createPage('chromium', 'driver_experience');
    const passengerPage = await this.setup.createPage('firefox', 'passenger_experience');
    
    try {
      // Driver creates ride
      await this.loginUser(driverPage, testUsers.driver1);
      await this.createTestRide(driverPage);
      
      // Passenger books ride
      await this.loginUser(passengerPage, testUsers.passenger1);
      await this.bookTestRide(passengerPage);
      
      // Driver confirms booking
      await driverPage.bringToFront();
      await driverPage.click('[data-testid="notifications"]');
      await driverPage.click('[data-testid="confirm-booking"]');
      
      // Both users see real-time updates
      await this.verifyRealTimeUpdates(driverPage, passengerPage);
      
      // Driver starts ride
      await driverPage.click('[data-testid="start-ride"]');
      
      // Passenger sees ride started
      await passengerPage.waitForSelector('[data-testid="ride-in-progress"]');
      
      // Driver completes ride
      await driverPage.click('[data-testid="complete-ride"]');
      
      // Both users see completion
      await Promise.all([
        driverPage.waitForSelector('[data-testid="ride-completed"]'),
        passengerPage.waitForSelector('[data-testid="ride-completed"]')
      ]);
      
    } finally {
      await driverPage.close();
      await passengerPage.close();
    }
  }

  // Test payment and review flow
  async testPaymentAndReview() {
    const page = await this.setup.createPage('chromium', 'payment_test');
    
    try {
      await this.loginUser(page, testUsers.passenger2);
      
      // Navigate to completed ride for payment
      await page.click('[data-testid="my-bookings"]');
      await page.click('[data-testid="completed-booking"]:first-child');
      
      // Process payment
      await page.click('[data-testid="pay-now"]');
      
      // Enter payment details (test mode)
      await page.fill('[data-testid="card-number"]', '4242424242424242');
      await page.fill('[data-testid="expiry"]', '12/25');
      await page.fill('[data-testid="cvc"]', '123');
      
      await page.click('[data-testid="confirm-payment"]');
      
      // Wait for payment success
      await page.waitForSelector('[data-testid="payment-success"]');
      
      // Leave review
      await page.click('[data-testid="leave-review"]');
      await page.click('[data-testid="rating-5"]');
      await page.fill('[data-testid="review-comment"]', 'Excellent ride, very comfortable!');
      await page.click('[data-testid="submit-review"]');
      
      // Verify review submitted
      await page.waitForSelector('[data-testid="review-success"]');
      const reviewText = await page.textContent('[data-testid="review-success"]');
      expect(reviewText).to.include('Review submitted');
      
    } finally {
      await page.close();
    }
  }

  // Test multiple users interacting concurrently
  async testMultiUserConcurrent() {
    const pages = await Promise.all([
      this.setup.createPage('chromium', 'concurrent1'),
      this.setup.createPage('firefox', 'concurrent2'),
      this.setup.createPage('webkit', 'concurrent3')
    ]);
    
    try {
      // Login different users simultaneously
      await Promise.all([
        this.loginUser(pages[0], testUsers.driver1),
        this.loginUser(pages[1], testUsers.passenger1),
        this.loginUser(pages[2], testUsers.passenger2)
      ]);
      
      // Perform concurrent actions
      await Promise.all([
        this.performDriverActions(pages[0]),
        this.performPassengerActions(pages[1]),
        this.performPassengerActions(pages[2])
      ]);
      
      // Verify all actions completed successfully
      for (const page of pages) {
        const dashboardVisible = await page.isVisible('[data-testid="dashboard"]');
        expect(dashboardVisible).to.be.true;
      }
      
    } finally {
      await Promise.all(pages.map(page => page.close()));
    }
  }

  // Helper methods
  async loginUser(page, user) {
    await page.goto(`${config.baseUrl}/auth/login`);
    await page.fill('[data-testid="email"]', user.email);
    await page.fill('[data-testid="password"]', user.password);
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('**/dashboard');
  }

  async createTestRide(page) {
    await page.click('[data-testid="create-ride"]');
    // Ride creation logic...
    await page.click('[data-testid="create-ride-button"]');
    await page.waitForSelector('[data-testid="ride-created"]');
  }

  async bookTestRide(page) {
    await page.click('[data-testid="search-rides"]');
    // Booking logic...
    await page.click('[data-testid="confirm-booking"]');
    await page.waitForSelector('[data-testid="booking-success"]');
  }

  async verifyRealTimeUpdates(driverPage, passengerPage) {
    // Verify WebSocket connections and real-time updates
    const driverStatus = await driverPage.textContent('[data-testid="connection-status"]');
    const passengerStatus = await passengerPage.textContent('[data-testid="connection-status"]');
    
    expect(driverStatus).to.include('Connected');
    expect(passengerStatus).to.include('Connected');
  }

  async performDriverActions(page) {
    await page.click('[data-testid="my-rides"]');
    await page.waitForSelector('[data-testid="ride-item"]', { timeout: 5000 });
  }

  async performPassengerActions(page) {
    await page.click('[data-testid="search-rides"]');
    await page.waitForSelector('[data-testid="search-form"]', { timeout: 5000 });
  }
}

module.exports = UserJourneyTests;
