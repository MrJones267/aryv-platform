/**
 * @fileoverview Ride Lifecycle E2E Tests - Complete ride workflows
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

const { expect } = require('chai');
const axios = require('axios');
const { config, testUsers, testLocations } = require('../setup');

class RideLifecycleTests {
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
      { name: 'Ride Creation with Validation', fn: this.testRideCreation },
      { name: 'Ride Search and Filtering', fn: this.testRideSearch },
      { name: 'Booking Workflow with Confirmations', fn: this.testBookingWorkflow },
      { name: 'Real-time Location Tracking', fn: this.testLocationTracking },
      { name: 'Ride Status Transitions', fn: this.testStatusTransitions },
      { name: 'Multi-Passenger Ride Management', fn: this.testMultiPassengerRide },
      { name: 'Ride Cancellation Scenarios', fn: this.testCancellationScenarios },
      { name: 'Emergency and Safety Features', fn: this.testEmergencyFeatures },
      { name: 'Route Optimization Integration', fn: this.testRouteOptimization }
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

  // Test ride creation with comprehensive validation
  async testRideCreation() {
    const page = await this.setup.createPage('chromium', 'ride_creator');
    
    try {
      // Login as driver
      await this.loginUser(page, testUsers.driver1);
      
      // Navigate to ride creation
      await page.click('[data-testid="create-ride"]');
      
      // Test form validation
      await page.click('[data-testid="create-ride-button"]');
      
      // Verify validation errors
      const errors = await page.locator('[data-testid="validation-error"]').count();
      expect(errors).to.be.greaterThan(0);
      
      // Fill valid ride details
      await page.fill('[data-testid="origin"]', testLocations.timesSquare.address);
      await page.waitForSelector('[data-testid="origin-suggestions"]');
      await page.click('[data-testid="suggestion"]:first-child');
      
      await page.fill('[data-testid="destination"]', testLocations.centralPark.address);
      await page.waitForSelector('[data-testid="destination-suggestions"]');
      await page.click('[data-testid="suggestion"]:first-child');
      
      // Set departure time (2 hours from now)
      const futureTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const timeString = futureTime.toISOString().slice(0, 16);
      await page.fill('[data-testid="departure-time"]', timeString);
      
      await page.fill('[data-testid="available-seats"]', '3');
      await page.fill('[data-testid="price-per-seat"]', '15.00');
      
      // Select vehicle
      const vehicleId = this.setup.getVehicleId('driver1');
      if (vehicleId) {
        await page.selectOption('[data-testid="vehicle"]', vehicleId);
      }
      
      await page.fill('[data-testid="description"]', 'Comfortable ride with AC and music');
      
      // Create ride
      await page.click('[data-testid="create-ride-button"]');
      
      // Wait for success and get ride ID
      await page.waitForSelector('[data-testid="ride-created"]');
      const rideId = await page.getAttribute('[data-testid="ride-id"]', 'data-ride-id');
      
      // Store ride ID for other tests
      this.setup.setRideId('test_ride_1', rideId);
      
      // Verify ride details are correct
      await page.click('[data-testid="my-rides"]');
      await page.waitForSelector('[data-testid="ride-item"]');
      
      const rideTitle = await page.textContent('[data-testid="ride-title"]:first-child');
      expect(rideTitle).to.include('Times Square');
      expect(rideTitle).to.include('Central Park');
      
    } finally {
      await page.close();
    }
  }

  // Test comprehensive ride search functionality
  async testRideSearch() {
    const page = await this.setup.createPage('chromium', 'ride_searcher');
    
    try {
      await this.loginUser(page, testUsers.passenger1);
      
      // Navigate to search
      await page.click('[data-testid="search-rides"]');
      
      // Test location autocomplete
      await page.fill('[data-testid="origin"]', 'Times');
      await page.waitForSelector('[data-testid="origin-suggestions"]');
      const suggestions = await page.locator('[data-testid="suggestion"]').count();
      expect(suggestions).to.be.greaterThan(0);
      
      // Select locations
      await page.click('[data-testid="suggestion"]:first-child');
      await page.fill('[data-testid="destination"]', testLocations.centralPark.address);
      
      // Set search parameters
      const searchTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const timeString = searchTime.toISOString().slice(0, 16);
      await page.fill('[data-testid="departure-time"]', timeString);
      
      await page.fill('[data-testid="seats"]', '2');
      await page.fill('[data-testid="max-price"]', '20');
      
      // Search
      await page.click('[data-testid="search-button"]');
      
      // Wait for results
      await page.waitForSelector('[data-testid="search-results"]');
      
      // Test filters
      await page.click('[data-testid="filter-vehicle-type"]');
      await page.check('[data-testid="sedan-filter"]');
      await page.click('[data-testid="apply-filters"]');
      
      // Verify filtered results
      const filteredResults = await page.locator('[data-testid="ride-card"]').count();
      
      // Test sorting
      await page.selectOption('[data-testid="sort-by"]', 'price-asc');
      await page.waitForTimeout(1000); // Wait for re-sort
      
      // Verify first result has lowest price
      const prices = await page.locator('[data-testid="ride-price"]').allTextContents();
      if (prices.length > 1) {
        const price1 = parseFloat(prices[0].replace('$', ''));
        const price2 = parseFloat(prices[1].replace('$', ''));
        expect(price1).to.be.at.most(price2);
      }
      
      // Test map integration
      await page.click('[data-testid="map-view"]');
      await page.waitForSelector('[data-testid="ride-map"]');
      
      const mapVisible = await page.isVisible('[data-testid="ride-markers"]');
      expect(mapVisible).to.be.true;
      
    } finally {
      await page.close();
    }
  }

  // Test booking workflow with driver confirmations
  async testBookingWorkflow() {
    const passengerPage = await this.setup.createPage('chromium', 'booking_passenger');
    const driverPage = await this.setup.createPage('firefox', 'booking_driver');
    
    try {
      // Driver creates ride
      await this.loginUser(driverPage, testUsers.driver1);
      await this.createTestRide(driverPage);
      
      // Passenger searches and books
      await this.loginUser(passengerPage, testUsers.passenger1);
      await passengerPage.click('[data-testid="search-rides"]');
      
      // Quick search
      await passengerPage.fill('[data-testid="origin"]', testLocations.timesSquare.address);
      await passengerPage.fill('[data-testid="destination"]', testLocations.centralPark.address);
      await passengerPage.click('[data-testid="search-button"]');
      
      // Select and book first ride
      await passengerPage.waitForSelector('[data-testid="ride-card"]');
      await passengerPage.click('[data-testid="ride-card"]:first-child');
      
      // Fill booking details
      await passengerPage.click('[data-testid="book-ride"]');
      await passengerPage.fill('[data-testid="pickup-address"]', '123 Broadway, NY');
      await passengerPage.fill('[data-testid="dropoff-address"]', '456 5th Ave, NY');
      await passengerPage.fill('[data-testid="seats-requested"]', '1');
      await passengerPage.fill('[data-testid="special-requests"]', 'Please call when arriving');
      
      // Confirm booking
      await passengerPage.click('[data-testid="confirm-booking"]');
      
      // Wait for booking success
      await passengerPage.waitForSelector('[data-testid="booking-pending"]');
      const bookingId = await passengerPage.getAttribute('[data-testid="booking-id"]', 'data-booking-id');
      
      // Driver receives notification
      await driverPage.bringToFront();
      await driverPage.waitForSelector('[data-testid="booking-notification"]');
      
      // Driver views booking details
      await driverPage.click('[data-testid="view-booking"]');
      
      // Verify booking details are correct
      const passengerName = await driverPage.textContent('[data-testid="passenger-name"]');
      expect(passengerName).to.include('John');
      
      const specialRequests = await driverPage.textContent('[data-testid="special-requests"]');
      expect(specialRequests).to.include('Please call when arriving');
      
      // Driver confirms booking
      await driverPage.click('[data-testid="confirm-booking-button"]');
      
      // Both users see confirmation
      await Promise.all([
        driverPage.waitForSelector('[data-testid="booking-confirmed"]'),
        passengerPage.waitForSelector('[data-testid="booking-confirmed"]')
      ]);
      
      // Verify booking status updated
      const status = await passengerPage.textContent('[data-testid="booking-status"]');
      expect(status).to.include('Confirmed');
      
    } finally {
      await passengerPage.close();
      await driverPage.close();
    }
  }

  // Test real-time location tracking
  async testLocationTracking() {
    const driverPage = await this.setup.createPage('chromium', 'tracking_driver');
    const passengerPage = await this.setup.createPage('firefox', 'tracking_passenger');
    
    try {
      // Setup confirmed booking
      await this.setupConfirmedBooking(driverPage, passengerPage);
      
      // Driver starts ride
      await driverPage.click('[data-testid="start-ride"]');
      
      // Enable location sharing
      await driverPage.click('[data-testid="enable-location"]');
      
      // Mock location updates
      await driverPage.evaluate(() => {
        // Simulate location updates
        window.mockLocationUpdates = [
          { lat: 40.7580, lng: -73.9855, timestamp: Date.now() },
          { lat: 40.7590, lng: -73.9845, timestamp: Date.now() + 30000 },
          { lat: 40.7600, lng: -73.9835, timestamp: Date.now() + 60000 }
        ];
      });
      
      // Passenger sees real-time updates
      await passengerPage.bringToFront();
      await passengerPage.waitForSelector('[data-testid="live-tracking"]');
      
      // Verify map shows driver location
      const driverMarker = await passengerPage.isVisible('[data-testid="driver-marker"]');
      expect(driverMarker).to.be.true;
      
      // Verify ETA updates
      const eta = await passengerPage.textContent('[data-testid="estimated-arrival"]');
      expect(eta).to.match(/\d+\s+min/);
      
      // Test location history
      await driverPage.bringToFront();
      await driverPage.click('[data-testid="location-history"]');
      
      const historyItems = await driverPage.locator('[data-testid="location-item"]').count();
      expect(historyItems).to.be.greaterThan(0);
      
    } finally {
      await driverPage.close();
      await passengerPage.close();
    }
  }

  // Test ride status transitions
  async testStatusTransitions() {
    const driverPage = await this.setup.createPage('chromium', 'status_driver');
    const passengerPage = await this.setup.createPage('firefox', 'status_passenger');
    
    try {
      await this.setupConfirmedBooking(driverPage, passengerPage);
      
      // Test: Confirmed -> In Progress
      await driverPage.click('[data-testid="start-ride"]');
      
      // Verify status change on both ends
      await Promise.all([
        driverPage.waitForSelector('[data-testid="status-in-progress"]'),
        passengerPage.waitForSelector('[data-testid="status-in-progress"]')
      ]);
      
      // Test invalid transition (should fail)
      const startButtonVisible = await driverPage.isVisible('[data-testid="start-ride"]');
      expect(startButtonVisible).to.be.false;
      
      // Test: In Progress -> Arrived
      await driverPage.click('[data-testid="arrived-button"]');
      
      await Promise.all([
        driverPage.waitForSelector('[data-testid="status-arrived"]'),
        passengerPage.waitForSelector('[data-testid="status-arrived"]')
      ]);
      
      // Passenger confirms pickup
      await passengerPage.click('[data-testid="confirm-pickup"]');
      
      // Test: Arrived -> En Route
      await Promise.all([
        driverPage.waitForSelector('[data-testid="status-en-route"]'),
        passengerPage.waitForSelector('[data-testid="status-en-route"]')
      ]);
      
      // Test: En Route -> Completed
      await driverPage.click('[data-testid="complete-ride"]');
      
      await Promise.all([
        driverPage.waitForSelector('[data-testid="status-completed"]'),
        passengerPage.waitForSelector('[data-testid="status-completed"]')
      ]);
      
      // Verify completion details
      const completionTime = await driverPage.textContent('[data-testid="completion-time"]');
      expect(completionTime).to.not.be.empty;
      
    } finally {
      await driverPage.close();
      await passengerPage.close();
    }
  }

  // Test multi-passenger ride management
  async testMultiPassengerRide() {
    const driverPage = await this.setup.createPage('chromium', 'multi_driver');
    const passenger1Page = await this.setup.createPage('firefox', 'multi_passenger1');
    const passenger2Page = await this.setup.createPage('webkit', 'multi_passenger2');
    
    try {
      // Driver creates ride with multiple seats
      await this.loginUser(driverPage, testUsers.driver1);
      await this.createTestRideWithSeats(driverPage, 4);
      
      // Multiple passengers book the same ride
      await Promise.all([
        this.bookRideAsUser(passenger1Page, testUsers.passenger1, 2),
        this.bookRideAsUser(passenger2Page, testUsers.passenger2, 1)
      ]);
      
      // Driver sees all bookings
      await driverPage.click('[data-testid="ride-bookings"]');
      await driverPage.waitForSelector('[data-testid="booking-list"]');
      
      const bookings = await driverPage.locator('[data-testid="booking-item"]').count();
      expect(bookings).to.equal(2);
      
      // Driver confirms all bookings
      await driverPage.click('[data-testid="confirm-all-bookings"]');
      
      // Verify seat availability updated
      const availableSeats = await driverPage.textContent('[data-testid="available-seats"]');
      expect(parseInt(availableSeats)).to.equal(1); // 4 - 2 - 1 = 1
      
      // Start ride with multiple passengers
      await driverPage.click('[data-testid="start-ride"]');
      
      // All passengers see ride started
      await Promise.all([
        passenger1Page.waitForSelector('[data-testid="ride-started"]'),
        passenger2Page.waitForSelector('[data-testid="ride-started"]')
      ]);
      
      // Test route optimization for multiple pickups
      await driverPage.click('[data-testid="optimize-route"]');
      await driverPage.waitForSelector('[data-testid="optimized-route"]');
      
      const routeStops = await driverPage.locator('[data-testid="route-stop"]').count();
      expect(routeStops).to.be.greaterThan(2); // Origin + multiple pickups + destination
      
    } finally {
      await driverPage.close();
      await passenger1Page.close();
      await passenger2Page.close();
    }
  }

  // Test cancellation scenarios
  async testCancellationScenarios() {
    const driverPage = await this.setup.createPage('chromium', 'cancel_driver');
    const passengerPage = await this.setup.createPage('firefox', 'cancel_passenger');
    
    try {
      // Test passenger cancellation before confirmation
      await this.setupPendingBooking(driverPage, passengerPage);
      
      await passengerPage.click('[data-testid="cancel-booking"]');
      await passengerPage.click('[data-testid="confirm-cancellation"]');
      
      // Verify cancellation
      await passengerPage.waitForSelector('[data-testid="booking-cancelled"]');
      
      // Driver sees cancellation notification
      await driverPage.waitForSelector('[data-testid="cancellation-notification"]');
      
      // Test driver cancellation of entire ride
      await this.setupConfirmedBooking(driverPage, passengerPage);
      
      await driverPage.click('[data-testid="cancel-ride"]');
      await driverPage.fill('[data-testid="cancellation-reason"]', 'Vehicle breakdown');
      await driverPage.click('[data-testid="confirm-cancellation"]');
      
      // All passengers notified
      await passengerPage.waitForSelector('[data-testid="ride-cancelled-notification"]');
      
      const cancellationReason = await passengerPage.textContent('[data-testid="cancellation-reason"]');
      expect(cancellationReason).to.include('Vehicle breakdown');
      
      // Verify refund processing initiated
      const refundStatus = await passengerPage.textContent('[data-testid="refund-status"]');
      expect(refundStatus).to.include('Processing refund');
      
    } finally {
      await driverPage.close();
      await passengerPage.close();
    }
  }

  // Test emergency and safety features
  async testEmergencyFeatures() {
    const page = await this.setup.createPage('chromium', 'emergency_test');
    
    try {
      await this.loginUser(page, testUsers.passenger1);
      await this.setupActiveRide(page);
      
      // Test emergency button
      await page.click('[data-testid="emergency-button"]');
      
      // Verify emergency options
      await page.waitForSelector('[data-testid="emergency-options"]');
      
      // Test call 911
      await page.click('[data-testid="call-911"]');
      
      // Verify emergency initiated (mock)
      const emergencyStatus = await page.textContent('[data-testid="emergency-status"]');
      expect(emergencyStatus).to.include('Emergency services contacted');
      
      // Test share location with emergency contact
      await page.click('[data-testid="share-location"]');
      await page.fill('[data-testid="emergency-contact"]', '+1234567890');
      await page.click('[data-testid="send-location"]');
      
      // Verify location shared
      await page.waitForSelector('[data-testid="location-shared"]');
      
      // Test safety check-in
      await page.click('[data-testid="safety-checkin"]');
      await page.click('[data-testid="im-safe"]');
      
      const checkinStatus = await page.textContent('[data-testid="checkin-status"]');
      expect(checkinStatus).to.include('Check-in recorded');
      
    } finally {
      await page.close();
    }
  }

  // Test route optimization integration
  async testRouteOptimization() {
    const page = await this.setup.createPage('chromium', 'route_optimization');
    
    try {
      await this.loginUser(page, testUsers.driver1);
      
      // Create ride with multiple waypoints
      await page.click('[data-testid="create-ride"]');
      await this.fillRideDetails(page);
      
      // Add multiple passenger pickups/dropoffs
      await page.click('[data-testid="add-waypoint"]');
      await page.fill('[data-testid="waypoint-1"]', testLocations.empireState.address);
      
      await page.click('[data-testid="add-waypoint"]');
      await page.fill('[data-testid="waypoint-2"]', testLocations.brooklynBridge.address);
      
      // Request route optimization
      await page.click('[data-testid="optimize-route"]');
      
      // Wait for AI optimization
      await page.waitForSelector('[data-testid="optimization-result"]');
      
      // Verify optimized route details
      const totalDistance = await page.textContent('[data-testid="total-distance"]');
      const estimatedDuration = await page.textContent('[data-testid="estimated-duration"]');
      const fuelSavings = await page.textContent('[data-testid="fuel-savings"]');
      
      expect(totalDistance).to.match(/\d+(\.\d+)?\s*(km|miles)/);
      expect(estimatedDuration).to.match(/\d+\s*min/);
      expect(fuelSavings).to.match(/\d+%/);
      
      // Test alternative routes
      await page.click('[data-testid="view-alternatives"]');
      const alternatives = await page.locator('[data-testid="alternative-route"]').count();
      expect(alternatives).to.be.greaterThan(0);
      
      // Select optimized route and create ride
      await page.click('[data-testid="select-optimized"]');
      await page.click('[data-testid="create-ride-button"]');
      
      // Verify ride created with optimized route
      await page.waitForSelector('[data-testid="ride-created"]');
      const routeInfo = await page.textContent('[data-testid="route-summary"]');
      expect(routeInfo).to.include('Optimized route');
      
    } finally {
      await page.close();
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
    await this.fillRideDetails(page);
    await page.click('[data-testid="create-ride-button"]');
    await page.waitForSelector('[data-testid="ride-created"]');
  }

  async createTestRideWithSeats(page, seats) {
    await page.click('[data-testid="create-ride"]');
    await this.fillRideDetails(page);
    await page.fill('[data-testid="available-seats"]', seats.toString());
    await page.click('[data-testid="create-ride-button"]');
    await page.waitForSelector('[data-testid="ride-created"]');
  }

  async fillRideDetails(page) {
    await page.fill('[data-testid="origin"]', testLocations.timesSquare.address);
    await page.fill('[data-testid="destination"]', testLocations.centralPark.address);
    
    const futureTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const timeString = futureTime.toISOString().slice(0, 16);
    await page.fill('[data-testid="departure-time"]', timeString);
    
    await page.fill('[data-testid="available-seats"]', '3');
    await page.fill('[data-testid="price-per-seat"]', '15.00');
    
    const vehicleId = this.setup.getVehicleId('driver1');
    if (vehicleId) {
      await page.selectOption('[data-testid="vehicle"]', vehicleId);
    }
  }

  async bookRideAsUser(page, user, seats) {
    await this.loginUser(page, user);
    await page.click('[data-testid="search-rides"]');
    await page.fill('[data-testid="origin"]', testLocations.timesSquare.address);
    await page.fill('[data-testid="destination"]', testLocations.centralPark.address);
    await page.click('[data-testid="search-button"]');
    
    await page.waitForSelector('[data-testid="ride-card"]');
    await page.click('[data-testid="ride-card"]:first-child');
    
    await page.click('[data-testid="book-ride"]');
    await page.fill('[data-testid="seats-requested"]', seats.toString());
    await page.click('[data-testid="confirm-booking"]');
    
    await page.waitForSelector('[data-testid="booking-pending"]');
  }

  async setupConfirmedBooking(driverPage, passengerPage) {
    await this.loginUser(driverPage, testUsers.driver1);
    await this.createTestRide(driverPage);
    
    await this.loginUser(passengerPage, testUsers.passenger1);
    await this.bookRideAsUser(passengerPage, testUsers.passenger1, 1);
    
    await driverPage.bringToFront();
    await driverPage.waitForSelector('[data-testid="booking-notification"]');
    await driverPage.click('[data-testid="confirm-booking-button"]');
    
    await Promise.all([
      driverPage.waitForSelector('[data-testid="booking-confirmed"]'),
      passengerPage.waitForSelector('[data-testid="booking-confirmed"]')
    ]);
  }

  async setupPendingBooking(driverPage, passengerPage) {
    await this.loginUser(driverPage, testUsers.driver1);
    await this.createTestRide(driverPage);
    
    await this.loginUser(passengerPage, testUsers.passenger1);
    await this.bookRideAsUser(passengerPage, testUsers.passenger1, 1);
  }

  async setupActiveRide(page) {
    // Mock an active ride scenario
    await page.evaluate(() => {
      localStorage.setItem('activeRide', JSON.stringify({
        id: 'test-ride-123',
        status: 'in_progress',
        driver: { name: 'Test Driver', phone: '+1234567890' }
      }));
    });
    await page.reload();
  }
}

module.exports = RideLifecycleTests;
