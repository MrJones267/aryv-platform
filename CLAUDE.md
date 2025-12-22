# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

ARYV is a comprehensive ride-sharing platform with integrated public transport and courier services, featuring AI-powered matching and blockchain-based package delivery. Currently in active development with admin panel complete and backend foundation ready.

## Technology Stack

**Expected Stack** (based on development guidelines):
- **Backend**: Node.js with TypeScript, Express.js
- **Database**: PostgreSQL with PostGIS extension for geospatial queries
- **Frontend Mobile**: React Native for cross-platform development
- **Frontend Admin**: React with TypeScript
- **Real-time**: Socket.io for live tracking and chat
- **AI Services**: Python with TensorFlow/PyTorch for ML algorithms
- **Blockchain**: Ethereum/Polygon for smart contracts (Solidity)
- **Infrastructure**: Docker with docker-compose
- **Cloud**: AWS/GCP for deployment
- **Cache**: Redis for session management and real-time data
- **Testing**: Jest for unit tests, Supertest for API tests, Detox for E2E mobile tests

## Claude Code Initialization Protocol

**MANDATORY**: Start every session with this initialization:

```bash
CLAUDE-CODE INITIALIZATION PROTOCOL v4.0

Status: [INITIALIZING]
Project: ARYV Ride-Sharing Platform
Phase: [Current Phase Number and Name]

PRE-FLIGHT CHECKLIST:
□ Development guidelines acknowledged and loaded
□ Current project state assessed
□ Quality gates from previous session verified
□ Technology stack confirmed
□ Next task requirements understood

REQUIRED RESPONSE FORMAT:
✅ CLAUDE-CODE INITIALIZED
□ ✅ Guidelines v4.0 loaded and active
□ ✅ Project state: [DETAILED_STATUS]
□ ✅ Quality gates: [PASS/FAIL with details]
□ ✅ Technology stack: [CONFIRMED]
□ ✅ Current task: [CLEAR_DESCRIPTION]

READY FOR DEVELOPMENT: [YES/NO]
```

## Development Commands

The project is not yet initialized, but based on the development guidelines, these commands are expected:

```bash
# Core Development Workflow
npm test                      # Run unit tests
npm run lint                  # Code linting (ESLint + Prettier)
npm run type-check           # TypeScript type checking
npm run build                # Production build
npm run dev                  # Development server with hot reload

# Comprehensive Testing
npm run test:all             # Full test suite (unit + integration + e2e)
npm run test:unit            # Unit tests only
npm run test:integration     # Integration tests
npm run test:e2e            # End-to-end tests
npm run test:watch          # Tests in watch mode
npm run coverage            # Test coverage report

# Quality Assurance
npm run security-audit       # Security vulnerability scan
npm run performance-test     # Performance benchmarks
npm audit                   # NPM audit for vulnerabilities
npm run validate            # Run all quality checks

# Infrastructure
docker-compose up --build    # Start all services
docker-compose down          # Stop all services
docker-compose logs         # View service logs
docker-compose ps           # Check service status

# Database
npm run db:migrate          # Run database migrations
npm run db:seed            # Seed database with test data
npm run db:reset           # Reset database

# AI Services (when implemented)
npm run ai:train           # Train ML models
npm run ai:test            # Test AI services

# Blockchain (when implemented)
npm run contracts:compile   # Compile smart contracts
npm run contracts:deploy   # Deploy smart contracts
npm run contracts:test     # Test smart contracts
```

## Mandatory Task Execution Template

**Every task must follow this exact pattern:**

```markdown
## TASK EXECUTION: [Feature/Fix Description]

### PRE-EXECUTION CHECKLIST:
□ Current code compiles without errors
□ All existing tests pass
□ No security vulnerabilities in current codebase
□ Previous features still functional

### IMPLEMENTATION PLAN:
1. [Step 1 with expected outcome]
2. [Step 2 with expected outcome]
3. [Step 3 with expected outcome]

### TESTS TO WRITE:
- [ ] Unit tests for [specific functionality]
- [ ] Integration tests for [API endpoints]
- [ ] E2E tests for [user journeys]

### VERIFICATION STEPS:
□ Unit tests written and passing
□ Integration tests passing
□ Security scan clean
□ Performance benchmarks met
□ Documentation updated

### POST-EXECUTION CHECKLIST:
□ Feature working as specified in PRD
□ No regressions introduced
□ Code committed with proper message
□ Progress backup created

TASK STATUS: [PLANNING/IN_PROGRESS/VERIFICATION/COMPLETE]
```

## Code Architecture

### Expected Project Structure
```
aryv-platform/
├── mobile-app/                 # React Native application
│   ├── src/
│   │   ├── screens/           # All app screens
│   │   ├── components/        # Reusable UI components
│   │   ├── navigation/        # App navigation setup
│   │   ├── services/          # API services and utilities
│   │   ├── store/            # State management (Redux/Context)
│   │   └── types/            # TypeScript type definitions
├── backend/                    # Node.js backend services
│   ├── src/
│   │   ├── controllers/       # Request handlers
│   │   ├── models/           # Database models (Sequelize)
│   │   ├── routes/           # API route definitions
│   │   ├── middleware/       # Authentication, validation, etc.
│   │   ├── services/         # Business logic
│   │   └── utils/            # Helper functions
├── admin-panel/               # React admin interface
├── ai-services/              # Python ML services
├── blockchain/               # Smart contracts and Web3 integration
├── shared/                   # Shared utilities and types
└── docker-compose.yml        # Development environment
```

### Development Principles
- **Never Break Working Code**: Always verify existing functionality before changes
- **Progressive Enhancement**: Build incrementally with complete features
- **Quality Gates**: All code must pass linting, type checking, and security scans
- **Test-Driven Development**: Write failing tests first, then implement
- **Security-First**: Every API endpoint must have validation, auth, rate limiting

### Code Standards

#### File Structure Pattern
```typescript
/**
 * @fileoverview Brief description of file purpose
 * @author Oabona-Majoko
 * @created YYYY-MM-DD
 * @lastModified YYYY-MM-DD
 */

// External imports
import express from 'express';
import bcrypt from 'bcryptjs';

// Internal imports
import { UserService } from '../services/UserService';
import { validateInput } from '../middleware/validation';

// Type imports
import { User, CreateUserRequest } from '../types/User';

// Constants
const CONSTANTS = {
  MAX_RETRY_ATTEMPTS: 3,
  DEFAULT_TIMEOUT: 5000
};

// Main implementation with proper error handling
class UserController {
  async createUser(req: CreateUserRequest): Promise<ApiResponse<User>> {
    try {
      // Implementation with comprehensive error handling
    } catch (error) {
      // Structured error logging and response
    }
  }
}

// Exports
export { UserController };
export default UserController;
```

#### Error Handling Standard
```typescript
// Every function must implement this error handling pattern:
try {
  // Main logic with validation
  if (!input) {
    throw new ValidationError('Invalid input provided');
  }
  
  const result = await operation();
  
  return {
    success: true,
    data: result,
    timestamp: new Date().toISOString()
  };
} catch (error) {
  console.error(`[${new Date().toISOString()}] Error in ${functionName}:`, {
    error: error.message,
    stack: error.stack,
    context: { /* relevant context */ }
  });
  
  return {
    success: false,
    error: error.message,
    code: error.code || 'UNKNOWN_ERROR',
    timestamp: new Date().toISOString()
  };
}
```

#### API Security Requirements
```typescript
// Every API endpoint must implement:
const secureEndpoint = [
  rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }), // Rate limiting
  helmet(), // Security headers
  validateInput(schema), // Input validation
  authenticateToken, // JWT verification
  authorizeUser(['admin', 'user']), // Role-based authorization
  async (req: Request, res: Response) => {
    // Endpoint implementation
  }
];
```

## Git Workflow

### Branch Naming Convention
- `feature/[feature-name]` - New features
- `bugfix/[issue-description]` - Bug fixes
- `hotfix/[critical-fix]` - Critical production fixes
- `release/[version-number]` - Release preparation
- `docs/[documentation-update]` - Documentation only

### Commit Message Format
```
type(scope): brief description

Detailed description of changes made.

- Added feature X with comprehensive tests
- Fixed bug Y affecting user authentication
- Updated documentation for API endpoints

Breaking Changes: [if any]
Closes #issue-number
```

### Pre-commit Requirements
```bash
# These checks must pass before any commit:
npm run lint                 # ESLint + Prettier
npm run type-check          # TypeScript compilation
npm test                    # All tests
npm run security-audit      # Security scan
```

## Quality Requirements

### Definition of Done
Each feature is complete only when ALL criteria are met:
- [ ] **Functionality**: Works exactly as specified in PRD
- [ ] **Tests**: All tests pass (unit, integration, e2e)
- [ ] **Coverage**: Code coverage above 80%
- [ ] **Security**: No critical/high vulnerabilities
- [ ] **Performance**: Response times under 200ms for APIs
- [ ] **Documentation**: Updated and accurate
- [ ] **Code Review**: Passed peer review
- [ ] **Demo Ready**: Can be demonstrated to stakeholders
- [ ] **No Regressions**: Existing features still work

### Quality Gates Checklist
```bash
# Run these checks after every significant change:
□ npm test                    # All tests passing
□ npm run coverage           # Coverage above 80%
□ npm run lint              # No linting errors
□ npm run type-check        # No TypeScript errors
□ npm run security-audit    # No critical vulnerabilities
□ npm run build             # Production build successful
□ docker-compose up         # All services start successfully
```

## Phase-Based Development

### Phase 0: Project Setup
- [ ] Technology stack implementation
- [ ] Docker environment setup
- [ ] CI/CD pipeline configuration
- [ ] Development tooling setup

### Phase 1: Core Backend & Database
- [ ] Database schema design and implementation
- [ ] Authentication system
- [ ] Core API endpoints
- [ ] Security middleware

### Phase 2: Mobile App Foundation
- [ ] React Native project setup
- [ ] Navigation structure
- [ ] Core user interfaces
- [ ] API integration

### Phase 3: Ride Lifecycle
- [ ] Ride creation and search
- [ ] Booking system
- [ ] Real-time tracking with Socket.io
- [ ] Payment integration

### Phases 4-7: Advanced Features
- [ ] AI matching and pricing services
- [ ] Blockchain courier service
- [ ] Admin panel
- [ ] Production deployment

## Emergency Protocols

### If Code Quality Drops
```bash
🚨 QUALITY_EMERGENCY_STOP 🚨

IMMEDIATE ACTIONS:
1. Stop all development work
2. Run full quality gate verification
3. Fix all failing checks
4. Verify no regressions
5. Resume only after ALL gates pass
```

### If Guidelines Are Ignored
```bash
🚨 GUIDELINE_ENFORCEMENT_MODE 🚨

MANDATORY RESET:
1. Re-read all development guidelines
2. Verify understanding of current requirements
3. Confirm compliance with all standards
4. Restart with proper initialization protocol
```

## Current Status

**Project Phase**: Phase 3 - Admin Panel Complete, Backend Foundation Ready
**Implementation Status**: Admin Panel Production Ready + Backend API Foundation
**Last Updated**: January 25, 2025
**Next Milestone**: Full Backend API Implementation
**Current Priority**: Complete backend integration and database implementation

## Success Metrics

### Code Quality KPIs
- **Test Coverage**: Minimum 80% for all modules
- **Security**: Zero critical/high vulnerabilities
- **Performance**: API responses under 200ms
- **Reliability**: 99.9% uptime target

### Development Velocity
- **Feature Completion**: On-time delivery per phase
- **Bug Rate**: Less than 5 bugs per 100 lines of code
- **Code Review**: All code reviewed before merge

## Important Reminders

1. **Quality Over Speed**: Better to deliver smaller, perfect features than larger buggy ones
2. **Test Everything**: Write tests before implementation (TDD)
3. **Security Always**: Every endpoint needs validation, auth, and rate limiting
4. **Document Everything**: Code, APIs, and architectural decisions
5. **Progressive Enhancement**: Each phase builds on the previous
6. **No Shortcuts**: Follow all guidelines and quality gates religiously

## Contact and Support

For questions about development guidelines or architectural decisions, refer to:
- `.claude/development-guidelines.md` - Comprehensive development standards
- `.claude/compliance-system.md` - Quality enforcement procedures
- `docs/architecture.md` - System architecture documentation (when created)

---

**Remember**: You are Claude-Code, a senior developer who never compromises on quality. Your reputation depends on delivering maintainable, secure, and well-tested code that follows all established guidelines.