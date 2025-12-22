# Hitch Platform E2E Testing Suite

Comprehensive end-to-end testing framework for the Hitch ride-sharing platform using Playwright.

## Overview

This E2E testing suite validates complete user workflows across the Hitch platform, including:

- **User Journey Tests**: Complete user workflows from registration to ride completion
- **Ride Lifecycle Tests**: Comprehensive ride management and real-time features
- **AI Integration Tests**: AI-powered matching, pricing, and optimization features
- **Admin Panel Tests**: Administrative functionality and system management
- **Performance Tests**: Load testing, response times, and resource optimization
- **Security Tests**: Authentication, authorization, and security vulnerability testing
- **Mobile Responsive Tests**: Cross-device compatibility and mobile-specific features

## Prerequisites

- Node.js 16+ and npm 8+
- Hitch platform services running locally or accessible URLs
- Test database with sample data

## Quick Start

```bash
# Install dependencies
npm install

# Install Playwright browsers
npm run install-browsers

# Run all tests
npm test

# Run tests with browser UI (headed mode)
npm run test:headed

# Run critical tests only
npm run test:critical
```

## Configuration

### Environment Variables

```bash
# Service URLs
E2E_BASE_URL=http://localhost:3001          # Backend API URL
E2E_ADMIN_URL=http://localhost:3000         # Admin panel URL

# Test Configuration
E2E_TIMEOUT=30000                           # Test timeout (ms)
E2E_HEADLESS=true                           # Run browsers in headless mode
E2E_BROWSERS=chromium,firefox,webkit        # Browsers to test
E2E_SCREENSHOTS=true                        # Take screenshots on failure
E2E_VIDEOS=false                           # Record test videos

# Test Users (automatically created)
E2E_ADMIN_EMAIL=admin@test.com
E2E_ADMIN_PASSWORD=AdminPassword123!
```

## Test Suites

### User Journey Tests

Validates complete user workflows:
- User registration (passenger & driver)
- Profile management
- Ride search and booking
- Payment and reviews
- Multi-user scenarios

```bash
npm run test:user-journey
```

### Ride Lifecycle Tests

Tests comprehensive ride management:
- Ride creation and validation
- Real-time tracking
- Status transitions
- Multi-passenger rides
- Cancellation scenarios
- Emergency features

```bash
npm run test:ride-lifecycle
```

### AI Integration Tests

Validates AI-powered features:
- Intelligent ride matching
- Dynamic pricing algorithms
- Route optimization
- Demand prediction
- Smart recommendations

```bash
npm run test:ai-integration
```

### Admin Panel Tests

Tests administrative functionality:
- User management
- Ride monitoring
- Financial reports
- System configuration
- Support ticket management
- Compliance tools

```bash
npm run test:admin-panel
```

### Performance Tests

Validates performance and scalability:
- Page load times
- API response times
- Concurrent user load
- Memory usage
- Network optimization
- Mobile performance

```bash
npm run test:performance
```

### Security Tests

Tests security measures:
- Authentication flows
- Authorization controls
- Input validation
- XSS/CSRF protection
- Rate limiting
- Data encryption

```bash
npm run test:security
```

### Mobile Responsive Tests

Validates mobile compatibility:
- Responsive design
- Touch interactions
- Mobile-specific features
- Cross-device consistency
- Performance on mobile

```bash
npm run test:mobile
```

## Browser Support

The test suite supports multiple browsers:

```bash
# Test on Chromium only
npm run test:chrome

# Test on Firefox only
npm run test:firefox

# Test on WebKit (Safari) only
npm run test:webkit

# Test on all browsers
npm run test:all-browsers
```

## Test Modes

### Development Mode

```bash
# Run with browser UI, screenshots, and videos
npm run test:local
```

### CI/CD Mode

```bash
# Headless mode with strict failure handling
npm run test:ci
```

### Smoke Tests

```bash
# Quick validation of critical functionality
npm run test:smoke
```

### Regression Tests

```bash
# Full test suite with strict validation
npm run test:regression
```

## Reports and Artifacts

### HTML Reports

Detailed test reports are generated in `reports/e2e-report.html` with:
- Test execution summary
- Pass/fail status for each test
- Performance metrics
- Screenshots of failures
- Error details and stack traces

### JUnit XML

CI/CD compatible reports in `reports/junit.xml` for integration with:
- Jenkins
- GitLab CI
- GitHub Actions
- Azure DevOps

### Screenshots

Automatic screenshots on test failure in `screenshots/` directory:
- Timestamped filenames
- Full page screenshots
- Organized by test suite

### Videos

Optional video recordings in `videos/` directory:
- Complete test execution recordings
- Helpful for debugging complex interactions
- Configurable via `E2E_VIDEOS=true`

## Test Data Management

### Test Users

The framework automatically creates test users:
- `passenger1@test.com` / `passenger2@test.com` - Regular passengers
- `driver1@test.com` / `driver2@test.com` - Drivers with vehicles
- `admin@test.com` - Platform administrator

### Test Locations

Predefined test locations in New York:
- Times Square
- Central Park
- Brooklyn Bridge
- Empire State Building

### Test Vehicles

Automatically registered test vehicles for drivers:
- Various vehicle types (sedan, SUV)
- Valid insurance and registration
- Different capacity configurations

## Debugging Tests

### Interactive Mode

```bash
# Run with browser UI for debugging
E2E_HEADLESS=false npm test
```

### Debug Specific Test

```bash
# Run single test suite
npm run test:user-journey

# With debugging enabled
E2E_HEADLESS=false E2E_SCREENSHOTS=true npm run test:user-journey
```

### Common Issues

1. **Services Not Running**: Ensure backend and admin services are accessible
2. **Database Issues**: Verify test database is properly configured
3. **Timing Issues**: Increase timeout for slow environments
4. **Element Not Found**: Check test selectors match current UI

## Best Practices

### Test Design

- Use data-testid attributes for reliable element selection
- Implement proper wait strategies (waitForSelector, waitForLoadState)
- Design tests to be independent and idempotent
- Use meaningful test names and descriptions

### Performance

- Run tests in parallel when possible
- Use efficient selectors
- Minimize unnecessary waits
- Clean up resources properly

### Maintenance

- Keep test data fresh and realistic
- Update selectors when UI changes
- Monitor test execution times
- Regular cleanup of artifacts

## Integration with CI/CD

### GitHub Actions

```yaml
name: E2E Tests
on: [push, pull_request]

jobs:
  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install dependencies
        run: |
          cd tests/e2e
          npm install
          npm run install-browsers
      - name: Start services
        run: docker-compose up -d
      - name: Wait for services
        run: sleep 30
      - name: Run E2E tests
        run: cd tests/e2e && npm run test:ci
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: e2e-results
          path: tests/e2e/reports/
```

### Docker Support

```dockerfile
# Dockerfile for E2E testing
FROM mcr.microsoft.com/playwright:v1.40.0-focal

WORKDIR /app
COPY tests/e2e/package*.json ./
RUN npm install

COPY tests/e2e/ ./
CMD ["npm", "run", "test:ci"]
```

## Contributing

### Adding New Tests

1. Create test files in appropriate suite directory
2. Follow existing naming conventions
3. Use consistent test structure and assertions
4. Add proper documentation

### Test Suite Structure

```javascript
class NewTestSuite {
  constructor(setup) {
    this.setup = setup;
    this.results = { passed: 0, failed: 0, skipped: 0, tests: [] };
  }

  async runAll() {
    const tests = [
      { name: 'Test Description', fn: this.testMethod }
    ];
    
    for (const test of tests) {
      await this.runTest(test.name, test.fn.bind(this));
    }
  }

  async testMethod() {
    // Test implementation
  }
}
```

## Support and Documentation

- **Test Framework**: [Playwright Documentation](https://playwright.dev/)
- **Assertion Library**: [Chai.js Documentation](https://www.chaijs.com/)
- **Platform API**: See `docs/API.md` for endpoint documentation
- **Issues**: Report bugs and feature requests via GitHub Issues

## Performance Benchmarks

### Expected Test Times

- User Journey Tests: ~5-8 minutes
- Ride Lifecycle Tests: ~8-12 minutes
- AI Integration Tests: ~6-10 minutes
- Admin Panel Tests: ~4-7 minutes
- Performance Tests: ~10-15 minutes
- Security Tests: ~3-5 minutes
- Mobile Tests: ~4-6 minutes

### Resource Requirements

- Memory: 2GB+ recommended
- CPU: 4+ cores for parallel execution
- Disk: 1GB for artifacts and browsers
- Network: Stable connection for external services

## Troubleshooting

### Common Error Messages

1. **"Service not available"**: Check if backend services are running
2. **"Element not found"**: UI might have changed, update selectors
3. **"Timeout exceeded"**: Increase timeout or check performance
4. **"Authentication failed"**: Verify test user credentials

### Debug Commands

```bash
# Verbose logging
DEBUG=pw:api npm test

# Slow motion for debugging
E2E_HEADLESS=false SLOW_MO=500 npm test

# Keep browser open after test
E2E_HEADLESS=false KEEP_OPEN=true npm test
```

---

**Last Updated**: 2025-01-21  
**Version**: 1.0.0  
**Maintainer**: Claude-Code
