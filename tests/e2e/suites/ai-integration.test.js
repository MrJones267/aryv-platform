/**
 * @fileoverview AI Integration E2E Tests - AI-powered features
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

const { expect } = require('chai');
const axios = require('axios');
const { config, testUsers, testLocations } = require('../setup');

class AIIntegrationTests {
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
      { name: 'AI-Powered Ride Matching', fn: this.testRideMatching },
      { name: 'Dynamic Pricing Algorithm', fn: this.testDynamicPricing },
      { name: 'Route Optimization Engine', fn: this.testRouteOptimization },
      { name: 'Demand Prediction Integration', fn: this.testDemandPrediction },
      { name: 'Smart Recommendations', fn: this.testSmartRecommendations },
      { name: 'Real-time Traffic Integration', fn: this.testTrafficIntegration },
      { name: 'Predictive ETA Calculations', fn: this.testPredictiveETA },
      { name: 'AI-Driven Safety Scoring', fn: this.testSafetyScoring },
      { name: 'Intelligent Passenger Matching', fn: this.testPassengerMatching }
    ];

    for (const test of tests) {
      await this.runTest(test.name, test.fn.bind(this));
    }
  }

  async runTest(testName, testFn) {
    const startTime = Date.now();
    console.log(`  🤖 ${testName}`);

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

  // Test AI-powered ride matching
  async testRideMatching() {
    const page = await this.setup.createPage('chromium', 'ai_matching');
    
    try {
      await this.loginUser(page, testUsers.passenger1);
      
      // Navigate to AI-powered search
      await page.click('[data-testid="ai-search"]');
      
      // Set search preferences
      await page.fill('[data-testid="origin"]', testLocations.timesSquare.address);
      await page.fill('[data-testid="destination"]', testLocations.centralPark.address);
      
      const futureTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const timeString = futureTime.toISOString().slice(0, 16);
      await page.fill('[data-testid="departure-time"]', timeString);
      
      // Set AI preferences
      await page.click('[data-testid="preferences-panel"]');
      await page.check('[data-testid="prefer-eco-friendly"]');
      await page.check('[data-testid="prefer-highly-rated"]');
      await page.fill('[data-testid="max-detour"]', '10');
      await page.selectOption('[data-testid="comfort-level"]', 'high');
      
      // Trigger AI matching
      await page.click('[data-testid="find-ai-matches"]');
      
      // Wait for AI processing
      await page.waitForSelector('[data-testid="ai-processing"]');
      await page.waitForSelector('[data-testid="ai-results"]', { timeout: 15000 });
      
      // Verify AI matching results
      const matchCards = await page.locator('[data-testid="match-card"]');
      const matchCount = await matchCards.count();
      expect(matchCount).to.be.greaterThan(0);
      
      // Check compatibility scores
      for (let i = 0; i < Math.min(matchCount, 3); i++) {
        const scoreElement = matchCards.nth(i).locator('[data-testid="compatibility-score"]');
        const scoreText = await scoreElement.textContent();
        const score = parseFloat(scoreText.replace('%', ''));
        expect(score).to.be.within(0, 100);
      }
      
      // Verify AI explanations
      await matchCards.first().click();
      await page.waitForSelector('[data-testid="ai-explanation"]');
      
      const explanation = await page.textContent('[data-testid="ai-explanation"]');
      expect(explanation).to.include('compatibility');
      
      // Test AI-driven sorting
      const sortedScores = [];
      for (let i = 0; i < Math.min(matchCount, 3); i++) {
        const scoreText = await matchCards.nth(i).locator('[data-testid="compatibility-score"]').textContent();
        sortedScores.push(parseFloat(scoreText.replace('%', '')));
      }
      
      // Verify descending order
      for (let i = 0; i < sortedScores.length - 1; i++) {
        expect(sortedScores[i]).to.be.at.least(sortedScores[i + 1]);
      }
      
    } finally {
      await page.close();
    }
  }

  // Test dynamic pricing algorithm
  async testDynamicPricing() {
    const token = this.setup.getToken('driver1');
    const page = await this.setup.createPage('chromium', 'dynamic_pricing');
    
    try {
      await this.loginUser(page, testUsers.driver1);
      
      // Navigate to ride creation with AI pricing
      await page.click('[data-testid="create-ride-ai"]');
      
      // Fill basic ride details
      await page.fill('[data-testid="origin"]', testLocations.timesSquare.address);
      await page.fill('[data-testid="destination"]', testLocations.centralPark.address);
      
      const futureTime = new Date(Date.now() + 2 * 60 * 60 * 1000);
      const timeString = futureTime.toISOString().slice(0, 16);
      await page.fill('[data-testid="departure-time"]', timeString);
      
      // Trigger AI pricing calculation
      await page.click('[data-testid="calculate-ai-price"]');
      
      // Wait for pricing analysis
      await page.waitForSelector('[data-testid="pricing-analysis"]');
      
      // Verify pricing components
      const basePriceElement = await page.locator('[data-testid="base-price"]');
      const demandMultiplierElement = await page.locator('[data-testid="demand-multiplier"]');
      const weatherAdjustmentElement = await page.locator('[data-testid="weather-adjustment"]');
      const trafficAdjustmentElement = await page.locator('[data-testid="traffic-adjustment"]');
      
      const basePrice = parseFloat(await basePriceElement.textContent());
      const demandMultiplier = parseFloat(await demandMultiplierElement.textContent());
      
      expect(basePrice).to.be.greaterThan(0);
      expect(demandMultiplier).to.be.within(0.5, 3.0);
      
      // Test different scenarios
      await page.selectOption('[data-testid="weather-scenario"]', 'rain');
      await page.click('[data-testid="recalculate-price"]');
      
      const rainPrice = parseFloat(await page.textContent('[data-testid="final-price"]'));
      
      await page.selectOption('[data-testid="weather-scenario"]', 'clear');
      await page.click('[data-testid="recalculate-price"]');
      
      const clearPrice = parseFloat(await page.textContent('[data-testid="final-price"]'));
      
      // Rain should increase price
      expect(rainPrice).to.be.greaterThan(clearPrice);
      
      // Test API integration
      const response = await axios.post(
        `${config.baseUrl}/api/rides/ai/calculate-price`,
        {
          originCoordinates: testLocations.timesSquare.coordinates,
          destinationCoordinates: testLocations.centralPark.coordinates,
          departureTime: futureTime.toISOString(),
          distance: 2.5,
          estimatedDuration: 15,
          marketConditions: {
            weather: { condition: 'clear', temperature: 22 },
            events: []
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      expect(response.status).to.equal(200);
      expect(response.data.success).to.be.true;
      expect(response.data.data.suggested_price).to.be.greaterThan(0);
      
    } finally {
      await page.close();
    }
  }

  // Test route optimization engine
  async testRouteOptimization() {
    const token = this.setup.getToken('driver1');
    const page = await this.setup.createPage('chromium', 'route_optimization');
    
    try {
      await this.loginUser(page, testUsers.driver1);
      
      // Navigate to route optimization
      await page.click('[data-testid="optimize-routes"]');
      
      // Add multiple waypoints
      const waypoints = [
        testLocations.timesSquare,
        testLocations.centralPark,
        testLocations.empireState,
        testLocations.brooklynBridge
      ];
      
      for (let i = 0; i < waypoints.length; i++) {
        await page.click('[data-testid="add-waypoint"]');
        await page.fill(`[data-testid="waypoint-${i}"]`, waypoints[i].address);
        await page.selectOption(`[data-testid="waypoint-type-${i}"]`, i % 2 === 0 ? 'pickup' : 'dropoff');
      }
      
      // Set optimization parameters
      await page.fill('[data-testid="max-passengers"]', '4');
      await page.fill('[data-testid="max-detour"]', '1.5');
      await page.check('[data-testid="minimize-time"]');
      
      // Trigger AI optimization
      await page.click('[data-testid="optimize-route-ai"]');
      
      // Wait for optimization results
      await page.waitForSelector('[data-testid="optimization-results"]', { timeout: 20000 });
      
      // Verify optimization metrics
      const originalDistance = await page.textContent('[data-testid="original-distance"]');
      const optimizedDistance = await page.textContent('[data-testid="optimized-distance"]');
      const timeSavings = await page.textContent('[data-testid="time-savings"]');
      const fuelSavings = await page.textContent('[data-testid="fuel-savings"]');
      
      expect(originalDistance).to.match(/\d+(\.\d+)?\s*(km|mi)/);
      expect(optimizedDistance).to.match(/\d+(\.\d+)?\s*(km|mi)/);
      expect(timeSavings).to.match(/\d+(\.\d+)?\s*min/);
      expect(fuelSavings).to.match(/\d+(\.\d+)?%/);
      
      // Test route alternatives
      await page.click('[data-testid="show-alternatives"]');
      const alternatives = await page.locator('[data-testid="alternative-route"]').count();
      expect(alternatives).to.be.at.least(1);
      
      // Verify turn-by-turn directions
      await page.click('[data-testid="view-directions"]');
      const directions = await page.locator('[data-testid="direction-step"]').count();
      expect(directions).to.be.greaterThan(waypoints.length);
      
      // Test API integration
      const response = await axios.post(
        `${config.baseUrl}/api/rides/ai/optimize-route`,
        {
          waypoints: waypoints.map((loc, i) => ({
            id: `waypoint_${i}`,
            type: i % 2 === 0 ? 'pickup' : 'dropoff',
            latitude: loc.coordinates.latitude,
            longitude: loc.coordinates.longitude,
            address: loc.address,
            passenger_id: `passenger_${Math.floor(i/2)}`,
            estimated_time: 120
          })),
          constraints: {
            maxPassengers: 4,
            maxDetourFactor: 1.5
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      expect(response.status).to.equal(200);
      expect(response.data.success).to.be.true;
      expect(response.data.data.optimized_route).to.be.an('array');
      
    } finally {
      await page.close();
    }
  }

  // Test demand prediction integration
  async testDemandPrediction() {
    const token = this.setup.getToken('driver1');
    const page = await this.setup.createPage('chromium', 'demand_prediction');
    
    try {
      await this.loginUser(page, testUsers.driver1);
      
      // Navigate to demand analytics
      await page.click('[data-testid="demand-analytics"]');
      
      // Set prediction parameters
      await page.fill('[data-testid="prediction-location"]', testLocations.timesSquare.address);
      
      const startTime = new Date(Date.now() + 60 * 60 * 1000);
      const endTime = new Date(Date.now() + 5 * 60 * 60 * 1000);
      
      await page.fill('[data-testid="start-time"]', startTime.toISOString().slice(0, 16));
      await page.fill('[data-testid="end-time"]', endTime.toISOString().slice(0, 16));
      
      // Generate demand prediction
      await page.click('[data-testid="predict-demand"]');
      
      // Wait for AI analysis
      await page.waitForSelector('[data-testid="demand-chart"]', { timeout: 15000 });
      
      // Verify demand predictions
      const peakTime = await page.textContent('[data-testid="peak-demand-time"]');
      const peakLevel = await page.textContent('[data-testid="peak-demand-level"]');
      const confidence = await page.textContent('[data-testid="prediction-confidence"]');
      
      expect(peakTime).to.match(/\d{1,2}:\d{2}/);
      expect(peakLevel).to.match(/\d+(\.\d+)?/);
      expect(confidence).to.match(/\d+(\.\d+)?%/);
      
      // Test demand heatmap
      await page.click('[data-testid="heatmap-view"]');
      await page.waitForSelector('[data-testid="demand-heatmap"]');
      
      const heatmapVisible = await page.isVisible('[data-testid="heatmap-overlay"]');
      expect(heatmapVisible).to.be.true;
      
      // Verify hotspots
      const hotspots = await page.locator('[data-testid="demand-hotspot"]').count();
      expect(hotspots).to.be.greaterThan(0);
      
      // Test recommendations
      await page.click('[data-testid="get-recommendations"]');
      await page.waitForSelector('[data-testid="driver-recommendations"]');
      
      const recommendations = await page.locator('[data-testid="recommendation-item"]').count();
      expect(recommendations).to.be.greaterThan(0);
      
      // Test API integration
      const response = await axios.post(
        `${config.baseUrl}/api/rides/ai/predict-demand`,
        {
          location: testLocations.timesSquare.coordinates,
          timeRange: {
            start: startTime.toISOString(),
            end: endTime.toISOString()
          }
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      expect(response.status).to.equal(200);
      expect(response.data.success).to.be.true;
      expect(response.data.data.demand_forecast).to.be.an('array');
      
    } finally {
      await page.close();
    }
  }

  // Test smart recommendations
  async testSmartRecommendations() {
    const page = await this.setup.createPage('chromium', 'smart_recommendations');
    
    try {
      await this.loginUser(page, testUsers.passenger1);
      
      // Navigate to personalized dashboard
      await page.click('[data-testid="dashboard"]');
      
      // Wait for AI recommendations to load
      await page.waitForSelector('[data-testid="smart-recommendations"]');
      
      // Verify recommendation categories
      const categories = [
        'frequent-routes',
        'cost-saving-rides',
        'eco-friendly-options',
        'premium-experiences'
      ];
      
      for (const category of categories) {
        const categoryElement = page.locator(`[data-testid="${category}"]`);
        const isVisible = await categoryElement.isVisible();
        expect(isVisible).to.be.true;
        
        const recommendations = await categoryElement.locator('[data-testid="recommendation"]').count();
        expect(recommendations).to.be.greaterThan(0);
      }
      
      // Test personalization
      await page.click('[data-testid="frequent-routes"]');
      await page.waitForSelector('[data-testid="route-suggestions"]');
      
      const routeSuggestions = await page.locator('[data-testid="route-suggestion"]').count();
      expect(routeSuggestions).to.be.greaterThan(0);
      
      // Verify suggestion relevance
      const firstSuggestion = page.locator('[data-testid="route-suggestion"]').first();
      const suggestedRoute = await firstSuggestion.textContent();
      expect(suggestedRoute).to.be.a('string').and.not.empty;
      
      // Test recommendation interaction
      await firstSuggestion.click();
      await page.waitForSelector('[data-testid="suggestion-details"]');
      
      const reasoningText = await page.textContent('[data-testid="ai-reasoning"]');
      expect(reasoningText).to.include('based on your');
      
      // Test feedback system
      await page.click('[data-testid="helpful-yes"]');
      
      const feedbackConfirm = await page.textContent('[data-testid="feedback-confirmation"]');
      expect(feedbackConfirm).to.include('Thank you');
      
    } finally {
      await page.close();
    }
  }

  // Test real-time traffic integration
  async testTrafficIntegration() {
    const page = await this.setup.createPage('chromium', 'traffic_integration');
    
    try {
      await this.loginUser(page, testUsers.passenger1);
      
      // Navigate to live traffic view
      await page.click('[data-testid="live-traffic"]');
      
      // Wait for traffic data to load
      await page.waitForSelector('[data-testid="traffic-map"]');
      
      // Verify traffic layers
      const trafficVisible = await page.isVisible('[data-testid="traffic-overlay"]');
      expect(trafficVisible).to.be.true;
      
      // Test traffic-aware route planning
      await page.fill('[data-testid="origin"]', testLocations.timesSquare.address);
      await page.fill('[data-testid="destination"]', testLocations.brooklynBridge.address);
      
      await page.click('[data-testid="plan-with-traffic"]');
      
      // Wait for traffic-optimized route
      await page.waitForSelector('[data-testid="traffic-route"]');
      
      // Verify traffic information
      const trafficDelay = await page.textContent('[data-testid="traffic-delay"]');
      const alternateRoutes = await page.locator('[data-testid="alternate-route"]').count();
      
      expect(trafficDelay).to.match(/\d+\s*min/);
      expect(alternateRoutes).to.be.at.least(1);
      
      // Test real-time updates
      await page.click('[data-testid="enable-traffic-alerts"]');
      
      // Simulate traffic condition change
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('trafficUpdate', {
          detail: { severity: 'heavy', location: 'Broadway', delay: '10 min' }
        }));
      });
      
      await page.waitForSelector('[data-testid="traffic-alert"]');
      const alertText = await page.textContent('[data-testid="traffic-alert"]');
      expect(alertText).to.include('traffic');
      
    } finally {
      await page.close();
    }
  }

  // Test predictive ETA calculations
  async testPredictiveETA() {
    const page = await this.setup.createPage('chromium', 'predictive_eta');
    
    try {
      await this.loginUser(page, testUsers.passenger1);
      await this.setupActiveRide(page);
      
      // Navigate to live ride tracking
      await page.click('[data-testid="track-ride"]');
      
      // Wait for predictive ETA
      await page.waitForSelector('[data-testid="predictive-eta"]');
      
      // Verify ETA components
      const baseETA = await page.textContent('[data-testid="base-eta"]');
      const trafficAdjustment = await page.textContent('[data-testid="traffic-adjustment"]');
      const weatherImpact = await page.textContent('[data-testid="weather-impact"]');
      const finalETA = await page.textContent('[data-testid="final-eta"]');
      
      expect(baseETA).to.match(/\d+\s*min/);
      expect(finalETA).to.match(/\d+\s*min/);
      
      // Test ETA accuracy tracking
      const accuracyScore = await page.textContent('[data-testid="eta-accuracy"]');
      expect(accuracyScore).to.match(/\d+(\.\d+)?%/);
      
      // Test dynamic updates
      await page.click('[data-testid="simulate-delay"]');
      
      const updatedETA = await page.textContent('[data-testid="final-eta"]');
      expect(updatedETA).to.not.equal(finalETA);
      
      // Verify confidence intervals
      const confidenceRange = await page.textContent('[data-testid="eta-confidence"]');
      expect(confidenceRange).to.match(/\d+\s*-\s*\d+\s*min/);
      
    } finally {
      await page.close();
    }
  }

  // Test AI-driven safety scoring
  async testSafetyScoring() {
    const page = await this.setup.createPage('chromium', 'safety_scoring');
    
    try {
      await this.loginUser(page, testUsers.driver1);
      
      // Navigate to safety dashboard
      await page.click('[data-testid="safety-dashboard"]');
      
      // Wait for safety analysis
      await page.waitForSelector('[data-testid="safety-score"]');
      
      // Verify safety score components
      const overallScore = await page.textContent('[data-testid="overall-safety-score"]');
      const drivingBehavior = await page.textContent('[data-testid="driving-behavior-score"]');
      const vehicleSafety = await page.textContent('[data-testid="vehicle-safety-score"]');
      const routeSafety = await page.textContent('[data-testid="route-safety-score"]');
      
      expect(parseFloat(overallScore)).to.be.within(0, 100);
      expect(parseFloat(drivingBehavior)).to.be.within(0, 100);
      expect(parseFloat(vehicleSafety)).to.be.within(0, 100);
      expect(parseFloat(routeSafety)).to.be.within(0, 100);
      
      // Test safety recommendations
      await page.click('[data-testid="safety-recommendations"]');
      
      const recommendations = await page.locator('[data-testid="safety-recommendation"]').count();
      expect(recommendations).to.be.greaterThan(0);
      
      // Verify real-time monitoring
      await page.click('[data-testid="start-monitoring"]');
      
      const monitoringActive = await page.isVisible('[data-testid="monitoring-indicator"]');
      expect(monitoringActive).to.be.true;
      
      // Test incident detection
      await page.evaluate(() => {
        window.dispatchEvent(new CustomEvent('safetyIncident', {
          detail: { type: 'hard_braking', severity: 'medium', timestamp: Date.now() }
        }));
      });
      
      await page.waitForSelector('[data-testid="safety-alert"]');
      const alertText = await page.textContent('[data-testid="safety-alert"]');
      expect(alertText).to.include('incident');
      
    } finally {
      await page.close();
    }
  }

  // Test intelligent passenger matching
  async testPassengerMatching() {
    const page = await this.setup.createPage('chromium', 'passenger_matching');
    
    try {
      await this.loginUser(page, testUsers.driver1);
      
      // Navigate to passenger matching
      await page.click('[data-testid="find-passengers"]');
      
      // Set matching preferences
      await page.check('[data-testid="similar-interests"]');
      await page.check('[data-testid="compatible-schedule"]');
      await page.selectOption('[data-testid="passenger-type"]', 'professional');
      
      // Set route details
      await page.fill('[data-testid="regular-route-origin"]', testLocations.timesSquare.address);
      await page.fill('[data-testid="regular-route-destination"]', testLocations.centralPark.address);
      
      // Find compatible passengers
      await page.click('[data-testid="find-matches"]');
      
      // Wait for AI matching results
      await page.waitForSelector('[data-testid="passenger-matches"]');
      
      const matches = await page.locator('[data-testid="passenger-match"]').count();
      expect(matches).to.be.greaterThan(0);
      
      // Verify compatibility metrics
      const firstMatch = page.locator('[data-testid="passenger-match"]').first();
      const compatibilityScore = await firstMatch.locator('[data-testid="compatibility-score"]').textContent();
      const routeOverlap = await firstMatch.locator('[data-testid="route-overlap"]').textContent();
      
      expect(parseFloat(compatibilityScore.replace('%', ''))).to.be.within(0, 100);
      expect(parseFloat(routeOverlap.replace('%', ''))).to.be.within(0, 100);
      
      // Test passenger invitation
      await firstMatch.locator('[data-testid="invite-passenger"]').click();
      
      await page.fill('[data-testid="invitation-message"]', 'Would you like to share regular rides?');
      await page.click('[data-testid="send-invitation"]');
      
      const invitationSent = await page.textContent('[data-testid="invitation-status"]');
      expect(invitationSent).to.include('sent');
      
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

  async setupActiveRide(page) {
    await page.evaluate(() => {
      localStorage.setItem('activeRide', JSON.stringify({
        id: 'ai-test-ride-123',
        status: 'in_progress',
        driver: { name: 'AI Test Driver', rating: 4.8 },
        estimatedArrival: new Date(Date.now() + 15 * 60 * 1000).toISOString()
      }));
    });
    await page.reload();
  }
}

module.exports = AIIntegrationTests;
