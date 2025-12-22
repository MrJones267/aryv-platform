# Comprehensive Development Guidelines for Claude-Code

## 🎯 Mission Statement
You are Claude-Code, an expert AI coding agent responsible for building the complete Hitch ride-sharing platform. Follow these guidelines religiously to ensure code quality, continuity, and successful delivery.

## 📋 Core Development Principles

### 1. **Never Break Working Code**
- **Rule**: Always verify existing functionality before adding new features
- **Implementation**: Run tests after every change
- **Recovery**: If something breaks, immediately revert and fix the issue
- **Documentation**: Log what broke and how it was fixed

### 2. **Progressive Enhancement**
- **Rule**: Build incrementally - each commit should add value without breaking existing features
- **Implementation**: Complete one feature entirely before starting the next
- **Verification**: Test the entire user journey after each feature
- **Documentation**: Update README with newly completed features

### 3. **Code Quality Gates**
- **Rule**: No code moves forward without passing all quality checks
- **Implementation**: Every file must pass linting, type checking, and security scans
- **Standards**: Follow established patterns and conventions
- **Documentation**: Comment complex logic and business rules

## 🔄 Continuous Integration Workflow

### Pre-Development Checklist
```bash
# Before starting any new feature:
1. git status                    # Ensure clean working directory
2. npm test                      # Verify all tests pass
3. npm run lint                  # Check code style
4. npm run type-check           # Verify TypeScript types
5. docker-compose up --build    # Ensure all services start
6. npm run e2e-test            # Run end-to-end tests
```

### During Development Workflow
```bash
# For each feature/change:
1. Create feature branch: git checkout -b feature/[feature-name]
2. Write failing test first (TDD approach)
3. Implement minimum viable code to pass test
4. Refactor and optimize
5. Run full test suite: npm run test:all
6. Check code coverage: npm run coverage
7. Commit with descriptive message
8. Push and create progress backup
```

### Post-Development Verification
```bash
# After completing any feature:
1. npm run build                # Ensure production build works
2. npm run test:integration     # Run integration tests
3. npm run security-audit       # Check for vulnerabilities
4. npm run performance-test     # Verify performance benchmarks
5. docker-compose down && docker-compose up  # Full restart test
6. Manual smoke testing of critical paths
```

## 🔒 Code Quality Standards

### File Structure Standards
```javascript
// Every file must follow this structure:
/**
 * @fileoverview Brief description of file purpose
 * @author Oabona-Majoko
 * @created YYYY-MM-DD
 * @lastModified YYYY-MM-DD
 */

// Imports (grouped: external, internal, types)
import express from 'express';
import { UserService } from '../services/UserService';
import { User } from '../types/User';

// Constants
const CONSTANTS = {
  MAX_RETRY_ATTEMPTS: 3,
  DEFAULT_TIMEOUT: 5000
};

// Types/Interfaces (if applicable)
interface RequestWithUser extends Request {
  user: User;
}

// Main implementation
class UserController {
  // Implementation with proper error handling
}

// Exports
export { UserController };
export default UserController;
```

### Error Handling Standards
```javascript
// Every function must implement proper error handling:
try {
  // Main logic
  const result = await someAsyncOperation();
  
  // Validation
  if (!result) {
    throw new Error('Operation failed: No result returned');
  }
  
  return {
    success: true,
    data: result,
    timestamp: new Date().toISOString()
  };
} catch (error) {
  // Log error with context
  console.error(`[${new Date().toISOString()}] Error in functionName:`, {
    error: error.message,
    stack: error.stack,
    context: { /* relevant context */ }
  });
  
  // Return consistent error format
  return {
    success: false,
    error: error.message,
    code: error.code || 'UNKNOWN_ERROR',
    timestamp: new Date().toISOString()
  };
}
```

### Security Standards
```javascript
// Every API endpoint must implement:
1. Input validation with Joi/Yup
2. Authentication verification
3. Authorization checks
4. Rate limiting
5. SQL injection prevention
6. XSS protection
7. CORS configuration

// Example implementation:
const validateInput = (schema) => (req, res, next) => {
  const { error } = schema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      error: 'Invalid input',
      details: error.details
    });
  }
  next();
};

const authenticateToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  // JWT verification logic
};
```

## 📊 Progress Tracking System

### Phase Completion Checklist
```markdown
# Phase Completion Template
## Phase [X]: [Phase Name]
**Started**: YYYY-MM-DD HH:MM
**Completed**: YYYY-MM-DD HH:MM
**Duration**: X hours/days

### Features Implemented:
- [ ] Feature 1: Description
  - [ ] Backend API endpoints
  - [ ] Frontend UI components
  - [ ] Database migrations
  - [ ] Tests written and passing
  - [ ] Documentation updated

### Quality Gates Passed:
- [ ] All tests passing (Unit, Integration, E2E)
- [ ] Code coverage above 80%
- [ ] No security vulnerabilities
- [ ] Performance benchmarks met
- [ ] Code review completed
- [ ] Documentation updated

### Known Issues:
- Issue 1: Description and workaround
- Issue 2: Description and planned fix

### Next Phase Dependencies:
- Requirement 1: What needs to be ready
- Requirement 2: External dependencies
```

### Daily Progress Backup
```bash
#!/bin/bash
# progress-backup.sh - Run this after every major milestone

DATE=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="./backups/$DATE"

echo "Creating progress backup: $BACKUP_DIR"

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup code
git bundle create $BACKUP_DIR/code-backup.bundle --all

# Backup database
docker exec postgres pg_dump -U postgres hitch_db > $BACKUP_DIR/database-backup.sql

# Backup environment files
cp docker-compose.yml $BACKUP_DIR/
cp .env.example $BACKUP_DIR/

# Create progress report
cat > $BACKUP_DIR/progress-report.md << EOF
# Progress Backup: $DATE

## Current Status:
- Phase: [Current Phase]
- Features Completed: [List]
- Current Working On: [Description]

## Test Results:
- Unit Tests: $(npm test 2>&1 | grep -o '[0-9]* passing' || echo "Not run")
- Integration Tests: [Status]
- E2E Tests: [Status]

## Known Issues:
[List any current issues]

## Next Steps:
[What to work on next]
EOF

echo "Backup completed: $BACKUP_DIR"
```

## 🚨 Error Prevention & Recovery

### Automated Error Detection
```javascript
// error-monitor.js - Include in every service
class ErrorMonitor {
  static logError(error, context = {}) {
    const errorLog = {
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      context,
      severity: this.classifyError(error)
    };
    
    // Log to file
    fs.appendFileSync('./logs/errors.log', JSON.stringify(errorLog) + '\n');
    
    // Alert if critical
    if (errorLog.severity === 'CRITICAL') {
      this.alertDeveloper(errorLog);
    }
  }
  
  static classifyError(error) {
    if (error.message.includes('database') || error.message.includes('connection')) {
      return 'CRITICAL';
    }
    if (error.message.includes('validation') || error.message.includes('input')) {
      return 'WARNING';
    }
    return 'INFO';
  }
  
  static alertDeveloper(errorLog) {
    console.error('🚨 CRITICAL ERROR DETECTED:', errorLog);
    // Could integrate with Slack, email, etc.
  }
}
```

### Recovery Procedures
```bash
# emergency-recovery.sh
#!/bin/bash

echo "🚨 Emergency Recovery Procedure"
echo "1. Checking system status..."

# Check if services are running
if ! docker-compose ps | grep -q "Up"; then
  echo "❌ Services are down. Attempting restart..."
  docker-compose down
  docker-compose up -d
fi

# Check database connectivity
if ! docker exec postgres pg_isready; then
  echo "❌ Database connection failed. Restoring from backup..."
  # Restore latest backup
  LATEST_BACKUP=$(ls -t ./backups/*/database-backup.sql | head -1)
  docker exec -i postgres psql -U postgres -d hitch_db < $LATEST_BACKUP
fi

# Verify critical endpoints
echo "2. Testing critical endpoints..."
curl -f http://localhost:3001/health || echo "❌ Backend health check failed"
curl -f http://localhost:3000 || echo "❌ Frontend access failed"

echo "3. Recovery procedure completed"
```

## 📝 Documentation Standards

### Code Documentation
```javascript
/**
 * Creates a new ride booking for a passenger
 * 
 * @description This function handles the complete ride booking process including
 * validation, availability checking, payment processing, and notifications.
 * 
 * @param {string} rideId - The unique identifier of the ride
 * @param {string} passengerId - The unique identifier of the passenger
 * @param {number} seatsRequested - Number of seats to book (1-4)
 * @param {Object} paymentInfo - Payment information object
 * @param {string} paymentInfo.method - Payment method ('cash' | 'wallet')
 * @param {string} [paymentInfo.cardToken] - Card token if paying by card
 * 
 * @returns {Promise<BookingResult>} Booking result with success status and booking details
 * 
 * @throws {ValidationError} When input parameters are invalid
 * @throws {AvailabilityError} When requested seats are not available
 * @throws {PaymentError} When payment processing fails
 * 
 * @example
 * const result = await bookRide('ride123', 'user456', 2, {
 *   method: 'wallet'
 * });
 * 
 * @since 1.0.0
 * @author Oabona-Majoko
 */
async function bookRide(rideId, passengerId, seatsRequested, paymentInfo) {
  // Implementation
}
```

### API Documentation
```yaml
# Every API endpoint must be documented in OpenAPI format
paths:
  /api/rides/{rideId}/book:
    post:
      summary: Book a ride
      description: Books the specified number of seats for a passenger on a ride
      parameters:
        - name: rideId
          in: path
          required: true
          schema:
            type: string
          description: Unique identifier of the ride
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/BookingRequest'
      responses:
        200:
          description: Booking successful
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/BookingResponse'
        400:
          description: Invalid request
        401:
          description: Unauthorized
        409:
          description: Seats not available
```

## 🔄 Git Workflow Standards

### Commit Message Format
```
type(scope): brief description

Detailed description of changes made.

- Added feature X
- Fixed bug Y
- Updated documentation Z

Closes #issue-number
```

### Branch Naming Convention
```
feature/[feature-name]     # New features
bugfix/[issue-description] # Bug fixes
hotfix/[critical-fix]      # Critical production fixes
release/[version-number]   # Release preparation
docs/[documentation-update] # Documentation only
```

### Pre-commit Hooks
```javascript
// .husky/pre-commit
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

echo "🔍 Running pre-commit checks..."

# Run linting
npm run lint
if [ $? -ne 0 ]; then
  echo "❌ Linting failed. Please fix errors before committing."
  exit 1
fi

# Run tests
npm run test
if [ $? -ne 0 ]; then
  echo "❌ Tests failed. Please fix failing tests before committing."
  exit 1
fi

# Check TypeScript
npm run type-check
if [ $? -ne 0 ]; then
  echo "❌ TypeScript errors found. Please fix before committing."
  exit 1
fi

echo "✅ All pre-commit checks passed!"
```

## 📋 Phase Handoff Protocol

### Before Starting Each Phase
1. **Review Previous Phase**: Ensure all features are working
2. **Run Full Test Suite**: Verify no regressions
3. **Create Backup**: Save current stable state
4. **Update Documentation**: Reflect current state
5. **Plan Next Phase**: Review requirements and dependencies

### During Phase Development
1. **Commit Frequently**: Small, focused commits
2. **Test Incrementally**: Don't wait until the end
3. **Document Progress**: Update phase checklist daily
4. **Handle Blockers**: Don't let issues pile up

### Phase Completion Protocol
1. **Feature Complete**: All requirements implemented
2. **Quality Gates**: All checks passing
3. **Documentation**: Updated and accurate
4. **Demo Ready**: Can showcase to stakeholders
5. **Handoff Report**: Detailed status for next phase

## 🎯 Success Metrics & KPIs

### Code Quality Metrics
- **Test Coverage**: Minimum 80% for all modules
- **Code Complexity**: Keep cyclomatic complexity under 10
- **Duplication**: Less than 3% code duplication
- **Security**: Zero high/critical vulnerabilities
- **Performance**: API response times under 200ms

### Development Velocity
- **Feature Completion**: Track against planned timeline
- **Bug Rate**: Less than 5 bugs per 100 lines of code
- **Deployment Frequency**: Daily deployments to development
- **Mean Time to Recovery**: Under 30 minutes for critical issues

### Communication Standards
```markdown
## Daily Status Update Template
**Date**: YYYY-MM-DD
**Phase**: [Current Phase]
**Progress**: [X% complete]

### Completed Today:
- [List achievements]

### Working On:
- [Current tasks]

### Blockers:
- [Any issues preventing progress]

### Next Steps:
- [What's planned for tomorrow]

### Notes:
- [Any important observations or decisions]
```

## 🚀 Final Success Criteria

Each phase is only considered complete when:
1. ✅ All features work as specified in PRD
2. ✅ All tests pass (unit, integration, e2e)
3. ✅ Code coverage meets minimum requirements
4. ✅ Security scan shows no critical issues
5. ✅ Performance benchmarks are met
6. ✅ Documentation is updated and accurate
7. ✅ Demo can be successfully performed
8. ✅ Backup is created and verified
9. ✅ Next phase dependencies are ready
10. ✅ Stakeholder approval is obtained

---

**Remember**: Quality over speed. Better to deliver a smaller set of features that work perfectly than a larger set with bugs and issues.