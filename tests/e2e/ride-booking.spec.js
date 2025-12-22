/**
 * @fileoverview End-to-End Playwright tests for Hitch Ride Booking functionality
 * @author Oabona-Majoko QA Protocol
 * @created 2025-07-23
 * @lastModified 2025-07-23
 */

const { test, expect, devices } = require('@playwright/test');

// Test configuration for evidence collection
test.use({
  // Configure automatic evidence collection on failure
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
  trace: 'retain-on-failure',
  // Use mobile viewport for React Native web testing
  ...devices['iPhone 12'],
});

test.describe('Ride Booking Feature', () => {
  // Test data constants
  const TEST_DATA = {
    passenger: {
      email: 'passenger.test@hitch.dev',
      password: 'SecurePass123!',
      name: 'Test Passenger'
    },
    driver: {
      email: 'driver.test@hitch.dev',
      password: 'DriverPass123!',
      name: 'Test Driver'
    },
    ride: {
      from: 'Downtown',
      to: 'Airport',
      date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Tomorrow
      time: '14:00',
      availableSeats: 3,
      price: 25.00
    }
  };

  test.beforeEach(async ({ page, context }) => {
    // Configure context for comprehensive logging
    await context.addInitScript(() => {
      // Capture console logs for evidence
      window.testLogs = [];
      const originalConsole = window.console;
      ['log', 'error', 'warn', 'info'].forEach(method => {
        window.console[method] = (...args) => {
          window.testLogs.push({ level: method, message: args.join(' '), timestamp: Date.now() });
          originalConsole[method](...args);
        };
      });
    });

    // Navigate to the application
    await page.goto('https://app.hitch.dev');
    await page.waitForLoadState('networkidle');
  });

  test('Successful End-to-End Ride Booking (Happy Path)', async ({ page }) => {
    // Step 1: Passenger Authentication
    await test.step('Passenger logs in successfully', async () => {
      await page.locator('[data-testid="login-email"]').fill(TEST_DATA.passenger.email);
      await page.locator('[data-testid="login-password"]').fill(TEST_DATA.passenger.password);
      await page.locator('[data-testid="login-submit"]').click();
      
      // Wait for successful login and dashboard load
      await expect(page.locator('[data-testid="dashboard-welcome"]')).toContainText(TEST_DATA.passenger.name);
      await expect(page.locator('[data-testid="passenger-dashboard"]')).toBeVisible();
    });

    // Step 2: Search for Available Rides
    await test.step('Search for rides from Downtown to Airport', async () => {
      await page.locator('[data-testid="search-from-input"]').fill(TEST_DATA.ride.from);
      await page.locator('[data-testid="search-to-input"]').fill(TEST_DATA.ride.to);
      await page.locator('[data-testid="search-date-input"]').fill(TEST_DATA.ride.date);
      await page.locator('[data-testid="search-time-input"]').fill(TEST_DATA.ride.time);
      await page.locator('[data-testid="search-rides-button"]').click();

      // Wait for search results to load
      await page.waitForSelector('[data-testid="ride-search-results"]');
      await expect(page.locator('[data-testid="ride-search-results"]')).toBeVisible();
    });

    // Step 3: Select Target Ride
    await test.step('Select the matching ride from search results', async () => {
      // Find the ride that matches our test criteria
      const rideCardLocator = page.locator('[data-testid="ride-card"]').first();
      
      // Verify ride details match expectations
      await expect(rideCardLocator.locator('[data-testid="ride-from"]')).toContainText(TEST_DATA.ride.from);
      await expect(rideCardLocator.locator('[data-testid="ride-to"]')).toContainText(TEST_DATA.ride.to);
      await expect(rideCardLocator.locator('[data-testid="ride-available-seats"]')).toContainText('3 seats available');
      
      // Select the ride
      await rideCardLocator.locator('[data-testid="select-ride-button"]').click();
      
      // Verify ride details page loads
      await expect(page.locator('[data-testid="ride-details-page"]')).toBeVisible();
      await expect(page.locator('[data-testid="ride-details-title"]')).toContainText(`${TEST_DATA.ride.from} to ${TEST_DATA.ride.to}`);
    });

    // Step 4: Configure Booking Details
    await test.step('Configure booking for 1 seat with credit card payment', async () => {
      // Select number of seats (default should be 1)
      await expect(page.locator('[data-testid="seat-selector"]')).toHaveValue('1');
      
      // Select payment method
      await page.locator('[data-testid="payment-method-selector"]').selectOption('credit-card');
      await expect(page.locator('[data-testid="payment-method-selector"]')).toHaveValue('credit-card');
      
      // Verify booking summary
      await expect(page.locator('[data-testid="booking-summary-seats"]')).toContainText('1 seat');
      await expect(page.locator('[data-testid="booking-summary-total"]')).toContainText(`$${TEST_DATA.ride.price.toFixed(2)}`);
    });

    // Step 5: Confirm Booking
    await test.step('Complete the booking confirmation process', async () => {
      // Click confirm booking button
      await page.locator('[data-testid="confirm-booking-button"]').click();
      
      // Handle payment processing (simulate successful payment)
      await page.waitForSelector('[data-testid="payment-processing"]');
      await page.waitForSelector('[data-testid="booking-confirmation"]', { timeout: 30000 });
      
      // Verify booking confirmation message
      await expect(page.locator('[data-testid="booking-success-message"]')).toContainText('Booking Confirmed');
      
      // Capture and verify booking reference number
      const bookingReferenceElement = page.locator('[data-testid="booking-reference-number"]');
      await expect(bookingReferenceElement).toBeVisible();
      const bookingReference = await bookingReferenceElement.textContent();
      expect(bookingReference).toMatch(/^BK\d{8}$/); // Format: BK12345678
    });

    // Step 6: Verify Booking in My Bookings
    await test.step('Verify ride appears in My Bookings list', async () => {
      // Navigate to My Bookings
      await page.locator('[data-testid="nav-my-bookings"]').click();
      await expect(page.locator('[data-testid="my-bookings-page"]')).toBeVisible();
      
      // Find the newly created booking
      const latestBookingCard = page.locator('[data-testid="booking-card"]').first();
      
      // Verify booking details
      await expect(latestBookingCard.locator('[data-testid="booking-route"]')).toContainText(`${TEST_DATA.ride.from} → ${TEST_DATA.ride.to}`);
      await expect(latestBookingCard.locator('[data-testid="booking-status"]')).toContainText('Confirmed');
      await expect(latestBookingCard.locator('[data-testid="booking-seats"]')).toContainText('1 seat');
      await expect(latestBookingCard.locator('[data-testid="booking-date"]')).toContainText(TEST_DATA.ride.date);
    });

    // Step 7: Verify Driver Notification (API verification)
    await test.step('Verify driver receives booking notification', async () => {
      // Intercept and verify API call for driver notification
      const notificationRequest = page.waitForRequest(request => 
        request.url().includes('/api/notifications/send') && 
        request.method() === 'POST'
      );
      
      // Trigger notification check (could be automatic or manual)
      await page.locator('[data-testid="refresh-notifications"]').click();
      
      const request = await notificationRequest;
      const requestBody = request.postDataJSON();
      
      expect(requestBody.recipientType).toBe('driver');
      expect(requestBody.notificationType).toBe('new_booking');
      expect(requestBody.message).toContain('new booking');
    });

    // Step 8: Verify Seat Count Update
    await test.step('Verify available seats decreased from 3 to 2', async () => {
      // Navigate back to search to verify seat count update
      await page.locator('[data-testid="nav-search"]').click();
      await page.locator('[data-testid="search-from-input"]').fill(TEST_DATA.ride.from);
      await page.locator('[data-testid="search-to-input"]').fill(TEST_DATA.ride.to);
      await page.locator('[data-testid="search-date-input"]').fill(TEST_DATA.ride.date);
      await page.locator('[data-testid="search-rides-button"]').click();
      
      // Verify the same ride now shows 2 available seats
      const updatedRideCard = page.locator('[data-testid="ride-card"]').first();
      await expect(updatedRideCard.locator('[data-testid="ride-available-seats"]')).toContainText('2 seats available');
    });
  });

  test.afterEach(async ({ page }) => {
    // Collect additional evidence for analysis
    const testLogs = await page.evaluate(() => window.testLogs || []);
    console.log('Test Execution Logs:', JSON.stringify(testLogs, null, 2));
    
    // Capture network activity for debugging
    const networkLogs = await page.evaluate(() => {
      return performance.getEntries()
        .filter(entry => entry.entryType === 'navigation' || entry.entryType === 'resource')
        .map(entry => ({
          name: entry.name,
          duration: entry.duration,
          transferSize: entry.transferSize
        }));
    });
    console.log('Network Activity:', JSON.stringify(networkLogs, null, 2));
  });
});