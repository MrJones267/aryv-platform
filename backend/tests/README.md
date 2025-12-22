# Hitch Backend Testing Suite

Comprehensive testing suite for the Hitch platform backend services, with focus on admin user management functionality.

## Testing Structure

```
tests/
├── README.md                           # This file
├── setup.js                            # Global test setup and utilities
├── admin-user-management.test.js       # Integration tests for admin user management
├── unit/
│   └── AdminUserController.unit.test.js # Unit tests for AdminUserController
├── integration/
│   └── admin-user-flow.integration.test.js # End-to-end workflow tests
└── performance/
    └── load-test.yml                    # Performance testing configuration
```

## Test Categories

### Integration Tests
- **admin-user-management.test.js**: Comprehensive API endpoint testing
- **admin-user-flow.integration.test.js**: Complete workflow testing

### Unit Tests
- **AdminUserController.unit.test.js**: Controller logic testing with mocked dependencies

### Performance Tests
- Load testing for user management endpoints
- Stress testing for concurrent operations

## Running Tests

### All Tests
```bash
npm test
```

### Specific Test Categories
```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# End-to-end tests only
npm run test:e2e

# Watch mode for development
npm run test:watch

# With coverage report
npm run coverage
```

### Individual Test Files
```bash
# Run specific test file
npx jest tests/admin-user-management.test.js

# Run tests matching pattern
npx jest --testPathPattern=admin

# Run with verbose output
npx jest --verbose
```

## Test Features Covered

### Admin User Management API
- ✅ User listing with pagination, filtering, and search
- ✅ User details retrieval with statistics
- ✅ User information updates with validation
- ✅ User account blocking/unblocking with audit logging
- ✅ User verification (email, phone, identity)
- ✅ User analytics and reporting
- ✅ Authentication and authorization
- ✅ Error handling and edge cases
- ✅ Data integrity and transaction safety
- ✅ Concurrent operation handling

### Comprehensive Test Scenarios
- **User Verification Workflow**: Complete email and phone verification process
- **User Suspension Flow**: Block, verify suspension, and restore user accounts
- **Search and Filtering**: Complex query combinations with pagination
- **Analytics Integration**: Real-time statistics and reporting
- **Data Integrity**: Transaction safety and error recovery
- **Concurrent Operations**: Multiple simultaneous requests handling
- **Edge Cases**: Invalid data, non-existent users, permission errors

## Test Data Management

### Test Database Setup
The test suite uses a separate test database to avoid affecting development data:

```javascript
// Environment configuration
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgres://hitch_user:hitch_secure_password@localhost:5433/hitch';
```

### Test Data Creation
Each test creates its own isolated data:

```javascript
// Automatic test user creation
const testUser = await global.testUtils.createTestUser({
  email: 'test@hitch.com',
  role: 'driver',
  isVerified: true
});
```

### Database Cleanup
Tests automatically clean up after themselves:

```javascript
// Global cleanup utilities
await global.testUtils.cleanDatabase();
```

## Test Utilities

### Global Test Helpers
Available in all test files via `global.testUtils`:

- `createTestUser(userData)` - Create test users with defaults
- `generateTestToken(user)` - Generate JWT tokens for authentication
- `cleanDatabase()` - Clean test database
- `withTransaction(callback)` - Database transaction wrapper
- `wait(ms)` - Async delay utility
- `generateRandomEmail()` - Random test email generation
- `mockExternalServices()` - Mock external service calls

### Authentication Helper
```javascript
// Generate admin token for testing
const adminToken = await global.testUtils.generateTestToken(adminUser);

// Use in requests
const response = await request(app)
  .get('/api/admin/users')
  .set('Authorization', `Bearer ${adminToken}`)
  .expect(200);
```

## Coverage Requirements

### Minimum Coverage Thresholds
- **Branches**: 70%
- **Functions**: 70%
- **Lines**: 70%
- **Statements**: 70%

### Coverage Report
```bash
# Generate coverage report
npm run coverage

# View HTML coverage report
open coverage/lcov-report/index.html
```

## Continuous Integration

### GitHub Actions Integration
Tests run automatically on:
- Pull requests to main branch
- Pushes to main branch
- Nightly builds

### Test Pipeline
1. **Setup**: Database and environment preparation
2. **Linting**: Code style and quality checks
3. **Unit Tests**: Fast component testing
4. **Integration Tests**: API endpoint testing
5. **Performance Tests**: Load and stress testing
6. **Coverage Report**: Code coverage analysis

## Development Workflow

### Before Committing
```bash
# Run full test suite
npm test

# Check coverage
npm run coverage

# Lint and type check
npm run lint
npm run type-check
```

### Test-Driven Development
1. Write failing test for new feature
2. Implement minimum code to pass test
3. Refactor while keeping tests green
4. Add edge cases and error scenarios

### Writing New Tests

#### Unit Test Example
```javascript
describe('AdminUserController', () => {
  it('should validate user input', async () => {
    const mockReq = { body: { role: 'invalid' } };
    const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    
    await AdminUserController.updateUser(mockReq, mockRes);
    
    expect(mockRes.status).toHaveBeenCalledWith(400);
  });
});
```

#### Integration Test Example
```javascript
describe('User Management API', () => {
  it('should create and verify user', async () => {
    const user = await global.testUtils.createTestUser();
    const token = await global.testUtils.generateTestToken(adminUser);
    
    const response = await request(app)
      .put(`/api/admin/users/${user.id}/verify`)
      .set('Authorization', `Bearer ${token}`)
      .send({ verificationType: 'email' })
      .expect(200);
      
    expect(response.body.success).toBe(true);
  });
});
```

## Performance Testing

### Load Testing
```bash
# Run performance tests
npm run performance-test

# Custom load test
artillery run tests/performance/load-test.yml
```

### Performance Benchmarks
- **User Listing**: < 200ms for 1000 users
- **User Details**: < 100ms per request
- **User Updates**: < 150ms with database transaction
- **Analytics**: < 500ms for complex queries

## Troubleshooting

### Common Issues

#### Database Connection Errors
```bash
# Check database is running
docker exec hitch-postgres pg_isready

# Restart database
docker-compose restart postgres
```

#### Test Timeouts
```bash
# Increase timeout for specific test
jest.setTimeout(30000);

# Debug hanging tests
npx jest --detectOpenHandles
```

#### Coverage Issues
```bash
# Debug coverage
npx jest --coverage --verbose

# Exclude files from coverage
// Add to jest.config.js collectCoverageFrom
```

### Environment Variables
Required for testing:
```bash
NODE_ENV=test
DATABASE_URL=postgres://hitch_user:hitch_secure_password@localhost:5433/hitch
JWT_SECRET=test_secret_key
```

## Best Practices

### Test Organization
- Group related tests with `describe` blocks
- Use descriptive test names that explain the behavior
- Follow AAA pattern: Arrange, Act, Assert
- Keep tests independent and isolated

### Mock Strategy
- Mock external services (email, SMS, payment)
- Use real database for integration tests
- Mock complex dependencies in unit tests
- Avoid mocking internal application code

### Data Management
- Create minimal test data for each test
- Clean up data after tests complete
- Use transactions for data isolation
- Avoid shared test data between tests

### Performance
- Keep unit tests fast (< 100ms each)
- Use parallel test execution where possible
- Mock expensive operations in unit tests
- Use integration tests for full system validation

## Contributing

### Adding New Tests
1. Create test file in appropriate directory
2. Follow existing naming conventions
3. Add test description to this README
4. Ensure tests pass and maintain coverage
5. Update documentation if needed

### Test Review Checklist
- [ ] Tests cover all success scenarios
- [ ] Tests cover error cases and edge cases
- [ ] Tests are independent and isolated
- [ ] Tests use appropriate mocking strategy
- [ ] Tests follow project conventions
- [ ] Coverage requirements are met
- [ ] Performance benchmarks are maintained

## References

- [Jest Documentation](https://jestjs.io/docs)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [Sequelize Testing Guide](https://sequelize.org/master/manual/migrations.html)
- [Node.js Testing Best Practices](https://github.com/goldbergyoni/nodejs-best-practices#-6-testing-and-overall-quality-practices)