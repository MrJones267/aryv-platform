/**
 * @fileoverview E2E Test Runner - Orchestrates all test suites
 * @author Oabona-Majoko
 * @created 2025-01-21
 * @lastModified 2025-01-21
 */

const { E2ETestSetup } = require('./setup');
const UserJourneyTests = require('./suites/user-journey.test');
const RideLifecycleTests = require('./suites/ride-lifecycle.test');
const AIIntegrationTests = require('./suites/ai-integration.test');
const AdminPanelTests = require('./suites/admin-panel.test');
const PerformanceTests = require('./suites/performance.test');
const SecurityTests = require('./suites/security.test');
const MobileResponsiveTests = require('./suites/mobile-responsive.test');
const fs = require('fs');
const path = require('path');

class E2ETestRunner {
  constructor() {
    this.setup = new E2ETestSetup();
    this.results = {
      startTime: new Date(),
      endTime: null,
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      skippedTests: 0,
      suites: []
    };
    this.testSuites = [
      { name: 'User Journey', class: UserJourneyTests, critical: true },
      { name: 'Ride Lifecycle', class: RideLifecycleTests, critical: true },
      { name: 'AI Integration', class: AIIntegrationTests, critical: false },
      { name: 'Admin Panel', class: AdminPanelTests, critical: true },
      { name: 'Performance', class: PerformanceTests, critical: false },
      { name: 'Security', class: SecurityTests, critical: true },
      { name: 'Mobile Responsive', class: MobileResponsiveTests, critical: false }
    ];
  }

  async run(options = {}) {
    console.log('🏁 Starting Hitch Platform E2E Test Suite');
    console.log('===========================================');
    
    try {
      // Setup test environment
      await this.setup.setup();
      
      // Run test suites
      await this.runTestSuites(options);
      
      // Generate final report
      await this.generateReport();
      
      // Determine exit code
      const hasFailures = this.results.failedTests > 0;
      const hasCriticalFailures = this.results.suites.some(
        suite => suite.critical && suite.failed > 0
      );
      
      if (hasCriticalFailures) {
        console.log('
🔴 CRITICAL FAILURES DETECTED - DEPLOYMENT BLOCKED');
        process.exit(1);
      } else if (hasFailures) {
        console.log('
🟡 NON-CRITICAL FAILURES DETECTED - REVIEW REQUIRED');
        process.exit(options.strictMode ? 1 : 0);
      } else {
        console.log('
🟢 ALL TESTS PASSED - READY FOR DEPLOYMENT');
        process.exit(0);
      }
      
    } catch (error) {
      console.error('
🔴 FATAL ERROR IN E2E TESTS:', error.message);
      console.error(error.stack);
      process.exit(1);
    } finally {
      await this.setup.cleanup();
    }
  }

  async runTestSuites(options) {
    const suitesToRun = options.suites ? 
      this.testSuites.filter(suite => options.suites.includes(suite.name)) :
      this.testSuites;

    for (const suiteConfig of suitesToRun) {
      console.log(`
📦 Running ${suiteConfig.name} Tests`);
      console.log('='.repeat(30 + suiteConfig.name.length));
      
      const suiteResult = {
        name: suiteConfig.name,
        critical: suiteConfig.critical,
        startTime: new Date(),
        endTime: null,
        passed: 0,
        failed: 0,
        skipped: 0,
        tests: []
      };
      
      try {
        const testSuite = new suiteConfig.class(this.setup);
        await testSuite.runAll();
        
        // Collect results from test suite
        suiteResult.passed = testSuite.results.passed;
        suiteResult.failed = testSuite.results.failed;
        suiteResult.skipped = testSuite.results.skipped;
        suiteResult.tests = testSuite.results.tests;
        
      } catch (error) {
        console.error(`❌ ${suiteConfig.name} suite failed:`, error.message);
        suiteResult.failed = 1;
        suiteResult.tests.push({
          name: 'Suite Setup/Teardown',
          status: 'failed',
          error: error.message
        });
      }
      
      suiteResult.endTime = new Date();
      this.results.suites.push(suiteResult);
      
      // Update totals
      this.results.totalTests += suiteResult.passed + suiteResult.failed + suiteResult.skipped;
      this.results.passedTests += suiteResult.passed;
      this.results.failedTests += suiteResult.failed;
      this.results.skippedTests += suiteResult.skipped;
      
      // Print suite summary
      const duration = (suiteResult.endTime - suiteResult.startTime) / 1000;
      const status = suiteResult.failed > 0 ? '🔴 FAILED' : '🟢 PASSED';
      console.log(`
${status} ${suiteConfig.name} Suite (${duration.toFixed(2)}s)`);
      console.log(`  Passed: ${suiteResult.passed}, Failed: ${suiteResult.failed}, Skipped: ${suiteResult.skipped}`);
      
      if (suiteResult.critical && suiteResult.failed > 0) {
        console.log('  ⚠️ CRITICAL SUITE FAILURE - IMMEDIATE ATTENTION REQUIRED');
      }
    }
  }

  async generateReport() {
    this.results.endTime = new Date();
    const duration = (this.results.endTime - this.results.startTime) / 1000;
    
    console.log('
📊 E2E TEST SUMMARY');
    console.log('==================');
    console.log(`Duration: ${duration.toFixed(2)}s`);
    console.log(`Total Tests: ${this.results.totalTests}`);
    console.log(`Passed: 🟢 ${this.results.passedTests}`);
    console.log(`Failed: 🔴 ${this.results.failedTests}`);
    console.log(`Skipped: 🟡 ${this.results.skippedTests}`);
    
    // Generate detailed HTML report
    await this.generateHTMLReport();
    
    // Generate JUnit XML report for CI/CD
    await this.generateJUnitReport();
  }

  async generateHTMLReport() {
    const reportPath = path.join('./tests/e2e/reports', 'e2e-report.html');
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Hitch Platform E2E Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: white; border: 1px solid #ddd; padding: 15px; border-radius: 5px; text-align: center; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .skipped { color: #ffc107; }
        .suite { margin: 20px 0; border: 1px solid #ddd; border-radius: 5px; }
        .suite-header { background: #f8f9fa; padding: 15px; font-weight: bold; }
        .critical { border-left: 4px solid #dc3545; }
        .test { padding: 10px 15px; border-bottom: 1px solid #eee; }
        .test:last-child { border-bottom: none; }
        .status-passed { color: #28a745; }
        .status-failed { color: #dc3545; }
        .status-skipped { color: #ffc107; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Hitch Platform E2E Test Report</h1>
        <p><strong>Generated:</strong> ${this.results.endTime.toISOString()}</p>
        <p><strong>Duration:</strong> ${((this.results.endTime - this.results.startTime) / 1000).toFixed(2)}s</p>
    </div>
    
    <div class="summary">
        <div class="metric">
            <h3>Total Tests</h3>
            <div style="font-size: 2em;">${this.results.totalTests}</div>
        </div>
        <div class="metric passed">
            <h3>Passed</h3>
            <div style="font-size: 2em;">${this.results.passedTests}</div>
        </div>
        <div class="metric failed">
            <h3>Failed</h3>
            <div style="font-size: 2em;">${this.results.failedTests}</div>
        </div>
        <div class="metric skipped">
            <h3>Skipped</h3>
            <div style="font-size: 2em;">${this.results.skippedTests}</div>
        </div>
    </div>
    
    <h2>Test Suites</h2>
    ${this.results.suites.map(suite => `
        <div class="suite ${suite.critical ? 'critical' : ''}">
            <div class="suite-header">
                <span class="${suite.failed > 0 ? 'failed' : 'passed'}">
                    ${suite.name} ${suite.critical ? '(Critical)' : ''}
                </span>
                <span style="float: right;">
                    Duration: ${((suite.endTime - suite.startTime) / 1000).toFixed(2)}s
                </span>
            </div>
            ${suite.tests.map(test => `
                <div class="test">
                    <span class="status-${test.status}">●</span>
                    ${test.name}
                    ${test.duration ? `<span style="float: right;">${test.duration.toFixed(2)}s</span>` : ''}
                    ${test.error ? `<div style="color: #dc3545; font-size: 0.9em; margin-top: 5px;">Error: ${test.error}</div>` : ''}
                </div>
            `).join('')}
        </div>
    `).join('')}
</body>
</html>`;
    
    fs.writeFileSync(reportPath, html);
    console.log(`📋 HTML Report generated: ${reportPath}`);
  }

  async generateJUnitReport() {
    const reportPath = path.join('./tests/e2e/reports', 'junit.xml');
    
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="Hitch E2E Tests" tests="${this.results.totalTests}" failures="${this.results.failedTests}" time="${((this.results.endTime - this.results.startTime) / 1000).toFixed(2)}">
${this.results.suites.map(suite => `
  <testsuite name="${suite.name}" tests="${suite.tests.length}" failures="${suite.failed}" time="${((suite.endTime - suite.startTime) / 1000).toFixed(2)}">
${suite.tests.map(test => `
    <testcase name="${test.name}" time="${test.duration ? test.duration.toFixed(2) : '0'}">
${test.status === 'failed' ? `      <failure message="${test.error || 'Test failed'}">${test.error || 'Test failed'}</failure>` : ''}
${test.status === 'skipped' ? '      <skipped/>' : ''}
    </testcase>`).join('')}
  </testsuite>`).join('')}
</testsuites>`;
    
    fs.writeFileSync(reportPath, xml);
    console.log(`📄 JUnit Report generated: ${reportPath}`);
  }
}

// Command line interface
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {};
  
  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--suites':
        options.suites = args[++i].split(',');
        break;
      case '--strict':
        options.strictMode = true;
        break;
      case '--headless':
        process.env.E2E_HEADLESS = 'true';
        break;
      case '--headed':
        process.env.E2E_HEADLESS = 'false';
        break;
      case '--browser':
        process.env.E2E_BROWSERS = args[++i];
        break;
      case '--help':
        console.log(`
Hitch Platform E2E Test Runner

Usage: node test-runner.js [options]

Options:
  --suites <names>    Run specific test suites (comma-separated)
  --strict            Fail on any test failure (not just critical)
  --headless          Run browsers in headless mode
  --headed            Run browsers with UI
  --browser <name>    Specify browser (chromium, firefox, webkit)
  --help              Show this help message

Examples:
  node test-runner.js                           # Run all tests
  node test-runner.js --suites "User Journey"   # Run specific suite
  node test-runner.js --strict --headless       # Strict mode, headless
`);
        process.exit(0);
        break;
    }
  }
  
  // Run tests
  const runner = new E2ETestRunner();
  runner.run(options);
}

module.exports = E2ETestRunner;
