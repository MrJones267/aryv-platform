/**
 * @fileoverview Admin Panel E2E Tests - Administrative functionality
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

const { expect } = require('chai');
const { config, testUsers } = require('../setup');

class AdminPanelTests {
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
      { name: 'Admin Authentication and Authorization', fn: this.testAdminAuth },
      { name: 'User Management Dashboard', fn: this.testUserManagement },
      { name: 'Ride Monitoring and Analytics', fn: this.testRideMonitoring },
      { name: 'Financial Reports and Payments', fn: this.testFinancialReports },
      { name: 'System Configuration Management', fn: this.testSystemConfig },
      { name: 'Support Ticket Management', fn: this.testSupportTickets },
      { name: 'Real-time Platform Monitoring', fn: this.testPlatformMonitoring },
      { name: 'Content Moderation Tools', fn: this.testContentModeration },
      { name: 'Compliance and Safety Management', fn: this.testComplianceManagement }
    ];

    for (const test of tests) {
      await this.runTest(test.name, test.fn.bind(this));
    }
  }

  async runTest(testName, testFn) {
    const startTime = Date.now();
    console.log(`  🏛️ ${testName}`);

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

  // Test admin authentication and authorization
  async testAdminAuth() {
    const page = await this.setup.createPage('chromium', 'admin_auth');
    
    try {
      // Test unauthorized access
      await page.goto(`${config.adminUrl}/dashboard`);
      
      // Should redirect to login
      await page.waitForURL('**/login');
      
      // Test invalid admin credentials
      await page.fill('[data-testid="email"]', 'fake@admin.com');
      await page.fill('[data-testid="password"]', 'wrongpassword');
      await page.click('[data-testid="login-button"]');
      
      // Should show error
      const errorMessage = await page.textContent('[data-testid="error-message"]');
      expect(errorMessage).to.include('Invalid credentials');
      
      // Test valid admin login
      await page.fill('[data-testid="email"]', testUsers.admin.email);
      await page.fill('[data-testid="password"]', testUsers.admin.password);
      await page.click('[data-testid="login-button"]');
      
      // Should redirect to admin dashboard
      await page.waitForURL('**/dashboard');
      
      // Verify admin interface elements
      expect(await page.isVisible('[data-testid="admin-sidebar"]')).to.be.true;
      expect(await page.isVisible('[data-testid="user-management"]')).to.be.true;
      expect(await page.isVisible('[data-testid="system-stats"]')).to.be.true;
      
      // Test role-based permissions
      await page.click('[data-testid="system-config"]');
      await page.waitForSelector('[data-testid="config-panel"]');
      
      const configVisible = await page.isVisible('[data-testid="sensitive-settings"]');
      expect(configVisible).to.be.true;
      
      // Test session management
      await page.click('[data-testid="admin-menu"]');
      await page.click('[data-testid="logout"]');
      
      // Should redirect to login and clear session
      await page.waitForURL('**/login');
      
      // Try to access protected page directly
      await page.goto(`${config.adminUrl}/users`);
      await page.waitForURL('**/login');
      
    } finally {
      await page.close();
    }
  }

  // Test user management functionality
  async testUserManagement() {
    const page = await this.setup.createPage('chromium', 'user_management');
    
    try {
      await this.loginAdmin(page);
      
      // Navigate to user management
      await page.click('[data-testid="user-management"]');
      await page.waitForSelector('[data-testid="users-table"]');
      
      // Test user search and filtering
      await page.fill('[data-testid="user-search"]', 'john');
      await page.waitForTimeout(1000); // Wait for search
      
      const searchResults = await page.locator('[data-testid="user-row"]').count();
      expect(searchResults).to.be.greaterThan(0);
      
      // Test user filters
      await page.selectOption('[data-testid="role-filter"]', 'driver');
      await page.click('[data-testid="apply-filters"]');
      
      const driverRows = await page.locator('[data-testid="user-row"][data-role="driver"]').count();
      const totalRows = await page.locator('[data-testid="user-row"]').count();
      expect(driverRows).to.equal(totalRows);
      
      // Test user details view
      await page.click('[data-testid="user-row"]:first-child');
      await page.waitForSelector('[data-testid="user-details-modal"]');
      
      // Verify user information
      const userName = await page.textContent('[data-testid="user-name"]');
      const userEmail = await page.textContent('[data-testid="user-email"]');
      const userStatus = await page.textContent('[data-testid="user-status"]');
      
      expect(userName).to.not.be.empty;
      expect(userEmail).to.include('@');
      expect(['active', 'inactive', 'suspended']).to.include(userStatus.toLowerCase());
      
      // Test user actions
      await page.click('[data-testid="user-actions"]');
      
      // Test suspend user
      if (userStatus.toLowerCase() === 'active') {
        await page.click('[data-testid="suspend-user"]');
        await page.fill('[data-testid="suspension-reason"]', 'Policy violation');
        await page.click('[data-testid="confirm-suspension"]');
        
        await page.waitForSelector('[data-testid="suspension-success"]');
        
        // Verify status updated
        const newStatus = await page.textContent('[data-testid="user-status"]');
        expect(newStatus.toLowerCase()).to.equal('suspended');
      }
      
      // Test user statistics
      await page.click('[data-testid="user-stats"]');
      
      const totalRides = await page.textContent('[data-testid="total-rides"]');
      const avgRating = await page.textContent('[data-testid="avg-rating"]');
      
      expect(parseInt(totalRides)).to.be.at.least(0);
      expect(parseFloat(avgRating)).to.be.within(0, 5);
      
      await page.click('[data-testid="close-modal"]');
      
      // Test bulk actions
      await page.check('[data-testid="select-all-users"]');
      await page.click('[data-testid="bulk-actions"]');
      await page.click('[data-testid="bulk-export"]');
      
      // Wait for export to start
      await page.waitForSelector('[data-testid="export-started"]');
      
    } finally {
      await page.close();
    }
  }

  // Test ride monitoring and analytics
  async testRideMonitoring() {
    const page = await this.setup.createPage('chromium', 'ride_monitoring');
    
    try {
      await this.loginAdmin(page);
      
      // Navigate to ride monitoring
      await page.click('[data-testid="ride-monitoring"]');
      await page.waitForSelector('[data-testid="rides-dashboard"]');
      
      // Test real-time ride tracking
      const activeRides = await page.textContent('[data-testid="active-rides-count"]');
      const completedToday = await page.textContent('[data-testid="completed-today"]');
      const avgRating = await page.textContent('[data-testid="avg-ride-rating"]');
      
      expect(parseInt(activeRides)).to.be.at.least(0);
      expect(parseInt(completedToday)).to.be.at.least(0);
      expect(parseFloat(avgRating)).to.be.within(0, 5);
      
      // Test ride map view
      await page.click('[data-testid="map-view"]');
      await page.waitForSelector('[data-testid="rides-map"]');
      
      const mapVisible = await page.isVisible('[data-testid="ride-markers"]');
      expect(mapVisible).to.be.true;
      
      // Test ride filtering
      await page.click('[data-testid="list-view"]');
      await page.selectOption('[data-testid="status-filter"]', 'in_progress');
      
      const inProgressRides = await page.locator('[data-testid="ride-item"][data-status="in_progress"]').count();
      const totalVisible = await page.locator('[data-testid="ride-item"]').count();
      expect(inProgressRides).to.equal(totalVisible);
      
      // Test ride intervention
      if (totalVisible > 0) {
        await page.click('[data-testid="ride-item"]:first-child');
        await page.waitForSelector('[data-testid="ride-details"]');
        
        await page.click('[data-testid="admin-actions"]');
        
        // Test emergency intervention
        await page.click('[data-testid="flag-ride"]');
        await page.selectOption('[data-testid="flag-reason"]', 'safety_concern');
        await page.fill('[data-testid="flag-notes"]', 'Admin review required');
        await page.click('[data-testid="submit-flag"]');
        
        const flagSuccess = await page.textContent('[data-testid="flag-success"]');
        expect(flagSuccess).to.include('flagged');
      }
      
      // Test analytics charts
      await page.click('[data-testid="analytics-tab"]');
      await page.waitForSelector('[data-testid="ride-analytics"]');
      
      const chartVisible = await page.isVisible('[data-testid="rides-chart"]');
      expect(chartVisible).to.be.true;
      
      // Test time range selection
      await page.selectOption('[data-testid="time-range"]', 'last_7_days');
      await page.waitForTimeout(2000); // Wait for chart update
      
      const chartData = await page.locator('[data-testid="chart-data-point"]').count();
      expect(chartData).to.be.greaterThan(0);
      
    } finally {
      await page.close();
    }
  }

  // Test financial reports and payments
  async testFinancialReports() {
    const page = await this.setup.createPage('chromium', 'financial_reports');
    
    try {
      await this.loginAdmin(page);
      
      // Navigate to financial dashboard
      await page.click('[data-testid="financial-reports"]');
      await page.waitForSelector('[data-testid="financial-dashboard"]');
      
      // Test revenue metrics
      const totalRevenue = await page.textContent('[data-testid="total-revenue"]');
      const platformFees = await page.textContent('[data-testid="platform-fees"]');
      const driverEarnings = await page.textContent('[data-testid="driver-earnings"]');
      
      expect(totalRevenue).to.match(/\$[\d,]+(\.\d{2})?/);
      expect(platformFees).to.match(/\$[\d,]+(\.\d{2})?/);
      expect(driverEarnings).to.match(/\$[\d,]+(\.\d{2})?/);
      
      // Test payment processing overview
      await page.click('[data-testid="payments-tab"]');
      
      const pendingPayments = await page.textContent('[data-testid="pending-payments"]');
      const completedPayments = await page.textContent('[data-testid="completed-payments"]');
      const failedPayments = await page.textContent('[data-testid="failed-payments"]');
      
      expect(parseInt(pendingPayments)).to.be.at.least(0);
      expect(parseInt(completedPayments)).to.be.at.least(0);
      expect(parseInt(failedPayments)).to.be.at.least(0);
      
      // Test detailed transaction view
      await page.click('[data-testid="view-transactions"]');
      await page.waitForSelector('[data-testid="transactions-table"]');
      
      if (await page.locator('[data-testid="transaction-row"]').count() > 0) {
        await page.click('[data-testid="transaction-row"]:first-child');
        await page.waitForSelector('[data-testid="transaction-details"]');
        
        const transactionId = await page.textContent('[data-testid="transaction-id"]');
        const amount = await page.textContent('[data-testid="transaction-amount"]');
        const status = await page.textContent('[data-testid="transaction-status"]');
        
        expect(transactionId).to.not.be.empty;
        expect(amount).to.match(/\$\d+\.\d{2}/);
        expect(['pending', 'completed', 'failed', 'refunded']).to.include(status.toLowerCase());
      }
      
      // Test financial reports generation
      await page.click('[data-testid="reports-tab"]');
      
      await page.selectOption('[data-testid="report-type"]', 'revenue_summary');
      await page.selectOption('[data-testid="report-period"]', 'monthly');
      
      await page.click('[data-testid="generate-report"]');
      await page.waitForSelector('[data-testid="report-generated"]');
      
      const downloadLink = await page.isVisible('[data-testid="download-report"]');
      expect(downloadLink).to.be.true;
      
      // Test payout management
      await page.click('[data-testid="payouts-tab"]');
      
      const pendingPayouts = await page.textContent('[data-testid="pending-payouts-count"]');
      expect(parseInt(pendingPayouts)).to.be.at.least(0);
      
      if (parseInt(pendingPayouts) > 0) {
        await page.click('[data-testid="process-payouts"]');
        await page.click('[data-testid="confirm-payouts"]');
        
        await page.waitForSelector('[data-testid="payouts-processed"]');
      }
      
    } finally {
      await page.close();
    }
  }

  // Test system configuration management
  async testSystemConfig() {
    const page = await this.setup.createPage('chromium', 'system_config');
    
    try {
      await this.loginAdmin(page);
      
      // Navigate to system configuration
      await page.click('[data-testid="system-config"]');
      await page.waitForSelector('[data-testid="config-dashboard"]');
      
      // Test platform settings
      await page.click('[data-testid="platform-settings"]');
      
      const platformName = await page.inputValue('[data-testid="platform-name"]');
      expect(platformName).to.equal('Hitch');
      
      // Test pricing configuration
      await page.click('[data-testid="pricing-config"]');
      
      const baseFeeInput = page.locator('[data-testid="base-fee"]');
      const currentBaseFee = await baseFeeInput.inputValue();
      
      // Update base fee
      await baseFeeInput.fill('2.50');
      await page.click('[data-testid="save-pricing"]');
      
      await page.waitForSelector('[data-testid="pricing-saved"]');
      
      // Verify change persisted
      await page.reload();
      await page.click('[data-testid="system-config"]');
      await page.click('[data-testid="pricing-config"]');
      
      const updatedBaseFee = await page.inputValue('[data-testid="base-fee"]');
      expect(updatedBaseFee).to.equal('2.50');
      
      // Restore original value
      await baseFeeInput.fill(currentBaseFee);
      await page.click('[data-testid="save-pricing"]');
      
      // Test feature flags
      await page.click('[data-testid="feature-flags"]');
      
      const featureToggles = await page.locator('[data-testid="feature-toggle"]').count();
      expect(featureToggles).to.be.greaterThan(0);
      
      // Test toggling a feature
      const firstToggle = page.locator('[data-testid="feature-toggle"]').first();
      const toggleState = await firstToggle.isChecked();
      
      await firstToggle.click();
      await page.click('[data-testid="save-features"]');
      
      await page.waitForSelector('[data-testid="features-saved"]');
      
      // Restore original state
      if (toggleState) {
        await firstToggle.check();
      } else {
        await firstToggle.uncheck();
      }
      await page.click('[data-testid="save-features"]');
      
      // Test API configuration
      await page.click('[data-testid="api-config"]');
      
      const rateLimitValue = await page.inputValue('[data-testid="rate-limit"]');
      expect(parseInt(rateLimitValue)).to.be.greaterThan(0);
      
      // Test maintenance mode
      await page.click('[data-testid="maintenance-config"]');
      
      await page.check('[data-testid="maintenance-mode"]');
      await page.fill('[data-testid="maintenance-message"]', 'System maintenance in progress');
      await page.click('[data-testid="save-maintenance"]');
      
      // Disable maintenance mode immediately
      await page.uncheck('[data-testid="maintenance-mode"]');
      await page.click('[data-testid="save-maintenance"]');
      
    } finally {
      await page.close();
    }
  }

  // Test support ticket management
  async testSupportTickets() {
    const page = await this.setup.createPage('chromium', 'support_tickets');
    
    try {
      await this.loginAdmin(page);
      
      // Navigate to support dashboard
      await page.click('[data-testid="support-tickets"]');
      await page.waitForSelector('[data-testid="tickets-dashboard"]');
      
      // Test ticket overview
      const openTickets = await page.textContent('[data-testid="open-tickets"]');
      const inProgressTickets = await page.textContent('[data-testid="in-progress-tickets"]');
      const resolvedToday = await page.textContent('[data-testid="resolved-today"]');
      
      expect(parseInt(openTickets)).to.be.at.least(0);
      expect(parseInt(inProgressTickets)).to.be.at.least(0);
      expect(parseInt(resolvedToday)).to.be.at.least(0);
      
      // Test ticket filtering
      await page.selectOption('[data-testid="ticket-status-filter"]', 'open');
      await page.selectOption('[data-testid="ticket-priority-filter"]', 'high');
      await page.click('[data-testid="apply-ticket-filters"]');
      
      const filteredTickets = await page.locator('[data-testid="ticket-item"]').count();
      
      // Test ticket details
      if (filteredTickets > 0) {
        await page.click('[data-testid="ticket-item"]:first-child');
        await page.waitForSelector('[data-testid="ticket-details"]');
        
        const ticketSubject = await page.textContent('[data-testid="ticket-subject"]');
        const ticketDescription = await page.textContent('[data-testid="ticket-description"]');
        const ticketUser = await page.textContent('[data-testid="ticket-user"]');
        
        expect(ticketSubject).to.not.be.empty;
        expect(ticketDescription).to.not.be.empty;
        expect(ticketUser).to.not.be.empty;
        
        // Test ticket response
        await page.fill('[data-testid="response-message"]', 'Thank you for contacting support. We are investigating this issue.');
        await page.click('[data-testid="send-response"]');
        
        await page.waitForSelector('[data-testid="response-sent"]');
        
        // Test status change
        await page.selectOption('[data-testid="ticket-status"]', 'in_progress');
        await page.click('[data-testid="update-status"]');
        
        const statusUpdated = await page.textContent('[data-testid="status-updated"]');
        expect(statusUpdated).to.include('updated');
        
        // Test ticket assignment
        await page.selectOption('[data-testid="assign-agent"]', 'admin');
        await page.click('[data-testid="assign-ticket"]');
        
        await page.waitForSelector('[data-testid="ticket-assigned"]');
      }
      
      // Test bulk ticket operations
      await page.click('[data-testid="tickets-list"]');
      
      if (await page.locator('[data-testid="ticket-checkbox"]').count() > 0) {
        await page.check('[data-testid="select-all-tickets"]');
        await page.selectOption('[data-testid="bulk-action"]', 'mark_resolved');
        await page.click('[data-testid="apply-bulk-action"]');
        
        await page.click('[data-testid="confirm-bulk-action"]');
        await page.waitForSelector('[data-testid="bulk-action-completed"]');
      }
      
    } finally {
      await page.close();
    }
  }

  // Test real-time platform monitoring
  async testPlatformMonitoring() {
    const page = await this.setup.createPage('chromium', 'platform_monitoring');
    
    try {
      await this.loginAdmin(page);
      
      // Navigate to monitoring dashboard
      await page.click('[data-testid="platform-monitoring"]');
      await page.waitForSelector('[data-testid="monitoring-dashboard"]');
      
      // Test system health metrics
      const serverStatus = await page.textContent('[data-testid="server-status"]');
      const databaseStatus = await page.textContent('[data-testid="database-status"]');
      const apiHealth = await page.textContent('[data-testid="api-health"]');
      
      expect(['online', 'healthy', 'operational']).to.include(serverStatus.toLowerCase());
      expect(['online', 'healthy', 'operational']).to.include(databaseStatus.toLowerCase());
      expect(['online', 'healthy', 'operational']).to.include(apiHealth.toLowerCase());
      
      // Test performance metrics
      const avgResponseTime = await page.textContent('[data-testid="avg-response-time"]');
      const requestsPerMinute = await page.textContent('[data-testid="requests-per-minute"]');
      const errorRate = await page.textContent('[data-testid="error-rate"]');
      
      expect(avgResponseTime).to.match(/\d+ms/);
      expect(parseInt(requestsPerMinute)).to.be.at.least(0);
      expect(parseFloat(errorRate.replace('%', ''))).to.be.within(0, 100);
      
      // Test alert system
      await page.click('[data-testid="alerts-tab"]');
      
      const activeAlerts = await page.locator('[data-testid="alert-item"]').count();
      
      if (activeAlerts > 0) {
        await page.click('[data-testid="alert-item"]:first-child');
        await page.waitForSelector('[data-testid="alert-details"]');
        
        const alertType = await page.textContent('[data-testid="alert-type"]');
        const alertSeverity = await page.textContent('[data-testid="alert-severity"]');
        
        expect(alertType).to.not.be.empty;
        expect(['low', 'medium', 'high', 'critical']).to.include(alertSeverity.toLowerCase());
        
        // Test alert acknowledgment
        await page.click('[data-testid="acknowledge-alert"]');
        await page.fill('[data-testid="acknowledgment-note"]', 'Investigating the issue');
        await page.click('[data-testid="confirm-acknowledgment"]');
        
        await page.waitForSelector('[data-testid="alert-acknowledged"]');
      }
      
      // Test logs viewer
      await page.click('[data-testid="logs-tab"]');
      await page.waitForSelector('[data-testid="logs-viewer"]');
      
      const logEntries = await page.locator('[data-testid="log-entry"]').count();
      expect(logEntries).to.be.greaterThan(0);
      
      // Test log filtering
      await page.selectOption('[data-testid="log-level"]', 'error');
      await page.click('[data-testid="apply-log-filter"]');
      
      const errorLogs = await page.locator('[data-testid="log-entry"][data-level="error"]').count();
      const totalVisibleLogs = await page.locator('[data-testid="log-entry"]').count();
      expect(errorLogs).to.equal(totalVisibleLogs);
      
    } finally {
      await page.close();
    }
  }

  // Test content moderation tools
  async testContentModeration() {
    const page = await this.setup.createPage('chromium', 'content_moderation');
    
    try {
      await this.loginAdmin(page);
      
      // Navigate to content moderation
      await page.click('[data-testid="content-moderation"]');
      await page.waitForSelector('[data-testid="moderation-dashboard"]');
      
      // Test reported content queue
      const pendingReviews = await page.textContent('[data-testid="pending-reviews"]');
      const resolvedToday = await page.textContent('[data-testid="resolved-today"]');
      
      expect(parseInt(pendingReviews)).to.be.at.least(0);
      expect(parseInt(resolvedToday)).to.be.at.least(0);
      
      // Test content review
      if (parseInt(pendingReviews) > 0) {
        await page.click('[data-testid="review-queue"]');
        await page.waitForSelector('[data-testid="review-item"]');
        
        await page.click('[data-testid="review-item"]:first-child');
        await page.waitForSelector('[data-testid="content-details"]');
        
        const contentType = await page.textContent('[data-testid="content-type"]');
        const reportReason = await page.textContent('[data-testid="report-reason"]');
        
        expect(['review', 'message', 'profile', 'image']).to.include(contentType.toLowerCase());
        expect(reportReason).to.not.be.empty;
        
        // Test moderation action
        await page.selectOption('[data-testid="moderation-action"]', 'approve');
        await page.fill('[data-testid="moderation-notes"]', 'Content reviewed and approved');
        await page.click('[data-testid="submit-moderation"]');
        
        await page.waitForSelector('[data-testid="moderation-completed"]');
      }
      
      // Test automated flagging rules
      await page.click('[data-testid="flagging-rules"]');
      
      const flaggingRules = await page.locator('[data-testid="rule-item"]').count();
      expect(flaggingRules).to.be.greaterThan(0);
      
      // Test adding new rule
      await page.click('[data-testid="add-rule"]');
      await page.fill('[data-testid="rule-name"]', 'Spam Detection');
      await page.selectOption('[data-testid="rule-type"]', 'keyword');
      await page.fill('[data-testid="rule-pattern"]', 'spam, scam, fake');
      await page.selectOption('[data-testid="rule-action"]', 'flag');
      
      await page.click('[data-testid="save-rule"]');
      await page.waitForSelector('[data-testid="rule-saved"]');
      
      // Test user reputation system
      await page.click('[data-testid="reputation-system"]');
      
      const reputationScores = await page.locator('[data-testid="reputation-score"]').count();
      expect(reputationScores).to.be.greaterThan(0);
      
    } finally {
      await page.close();
    }
  }

  // Test compliance and safety management
  async testComplianceManagement() {
    const page = await this.setup.createPage('chromium', 'compliance_management');
    
    try {
      await this.loginAdmin(page);
      
      // Navigate to compliance dashboard
      await page.click('[data-testid="compliance-management"]');
      await page.waitForSelector('[data-testid="compliance-dashboard"]');
      
      // Test driver verification status
      await page.click('[data-testid="driver-verification"]');
      
      const pendingVerifications = await page.textContent('[data-testid="pending-verifications"]');
      const expiringSoon = await page.textContent('[data-testid="expiring-soon"]');
      
      expect(parseInt(pendingVerifications)).to.be.at.least(0);
      expect(parseInt(expiringSoon)).to.be.at.least(0);
      
      // Test document verification
      if (parseInt(pendingVerifications) > 0) {
        await page.click('[data-testid="verification-queue"]');
        await page.click('[data-testid="verification-item"]:first-child');
        
        await page.waitForSelector('[data-testid="document-viewer"]');
        
        const documentType = await page.textContent('[data-testid="document-type"]');
        expect(['license', 'insurance', 'registration']).to.include(documentType.toLowerCase());
        
        // Test verification decision
        await page.click('[data-testid="approve-document"]');
        await page.fill('[data-testid="verification-notes"]', 'Document verified successfully');
        await page.click('[data-testid="submit-verification"]');
        
        await page.waitForSelector('[data-testid="verification-completed"]');
      }
      
      // Test safety incident tracking
      await page.click('[data-testid="safety-incidents"]');
      
      const openIncidents = await page.textContent('[data-testid="open-incidents"]');
      const resolvedIncidents = await page.textContent('[data-testid="resolved-incidents"]');
      
      expect(parseInt(openIncidents)).to.be.at.least(0);
      expect(parseInt(resolvedIncidents)).to.be.at.least(0);
      
      // Test compliance reporting
      await page.click('[data-testid="compliance-reports"]');
      
      await page.selectOption('[data-testid="report-type"]', 'safety_summary');
      await page.selectOption('[data-testid="report-period"]', 'monthly');
      
      await page.click('[data-testid="generate-compliance-report"]');
      await page.waitForSelector('[data-testid="compliance-report-generated"]');
      
      const reportDownload = await page.isVisible('[data-testid="download-compliance-report"]');
      expect(reportDownload).to.be.true;
      
      // Test regulatory settings
      await page.click('[data-testid="regulatory-settings"]');
      
      const jurisdictions = await page.locator('[data-testid="jurisdiction-item"]').count();
      expect(jurisdictions).to.be.greaterThan(0);
      
      // Test insurance requirements
      await page.click('[data-testid="insurance-requirements"]');
      
      const minimumCoverage = await page.inputValue('[data-testid="minimum-coverage"]');
      expect(parseInt(minimumCoverage)).to.be.greaterThan(0);
      
    } finally {
      await page.close();
    }
  }

  // Helper method to login as admin
  async loginAdmin(page) {
    await page.goto(`${config.adminUrl}/login`);
    await page.fill('[data-testid="email"]', testUsers.admin.email);
    await page.fill('[data-testid="password"]', testUsers.admin.password);
    await page.click('[data-testid="login-button"]');
    await page.waitForURL('**/dashboard');
  }
}

module.exports = AdminPanelTests;
