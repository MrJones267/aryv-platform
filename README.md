# 🚗 ARYV - Comprehensive Ride-Sharing Platform

A sophisticated ride-sharing platform with integrated public transport and courier services, featuring AI-powered matching, blockchain-based package delivery, and advanced cash payment systems optimized for African markets.

## 🎯 **Platform Status: Production Ready**

✅ **Backend API**: 40+ endpoints, TypeScript-clean compilation  
✅ **Mobile App**: React Native v0.72.17, production-ready  
✅ **Real-time Service**: Socket.io with WebRTC, deployment-ready  
✅ **Admin Panel**: React-based, fully functional  
✅ **Payment Systems**: Advanced cash escrow + Stripe integration  
✅ **Infrastructure**: Docker-containerized, scalable architecture

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18.0.0
- Docker & Docker Compose
- Git

### Setup Development Environment

1. **Clone and setup the project:**
   ```bash
   git clone <repository-url>
   cd ARYV
   cp .env.example .env
   npm run setup
   ```

2. **Start the development environment:**
   ```bash
   npm run docker:build
   ```

3. **Access the applications:**
   - Backend API: http://localhost:3001
   - Admin Panel: http://localhost:3000
   - AI Services: http://localhost:5000

## 📁 Project Structure

```
aryv-platform/
├── backend/                    # Node.js/TypeScript API server
├── mobile-app/                 # React Native mobile application  
├── admin-panel/               # React admin interface
├── ai-services/              # Python ML services
├── blockchain/               # Smart contracts (Solidity)
├── shared/                   # Shared utilities and types
├── docs/                     # Documentation
├── docker-compose.yml        # Development environment
└── CLAUDE.md                 # Claude Code guidance
```

## 🛠️ Development Commands

### Root Level Commands
```bash
# Development
npm run dev                   # Start all services
npm run docker:up            # Start Docker services
npm run docker:down          # Stop Docker services

# Quality Assurance
npm run validate             # Run all quality checks
npm test                     # Run all tests
npm run lint                 # Lint all workspaces
npm run type-check          # TypeScript checks

# Database
npm run db:migrate          # Run database migrations
npm run db:seed            # Seed test data
npm run db:reset           # Reset database
```

### Backend Specific
```bash
cd backend
npm run dev                 # Development server with hot reload
npm run build              # Production build
npm test                   # Unit tests
npm run test:integration   # Integration tests
npm run security-audit     # Security scan
```

### Mobile App
```bash
cd mobile-app
npm run android            # Run on Android
npm run ios               # Run on iOS  
npm run test:e2e          # End-to-end tests
```

## 🏗️ Technology Stack

### Backend
- **Runtime**: Node.js 18+ with TypeScript
- **Framework**: Express.js with security middleware
- **Database**: PostgreSQL with PostGIS extension
- **Cache**: Redis for sessions and real-time data
- **Real-time**: Socket.io for live tracking and chat
- **Authentication**: JWT with bcrypt password hashing
- **Validation**: Joi for input validation
- **Testing**: Jest with Supertest for API testing

### Frontend
- **Mobile**: React Native with TypeScript
- **Admin Panel**: React with Material-UI
- **State Management**: Redux Toolkit
- **Navigation**: React Navigation
- **Maps**: React Native Maps with Google Maps
- **Testing**: Jest with React Native Testing Library

### AI Services
- **Runtime**: Python 3.11
- **Framework**: Flask with Flask-RESTful
- **ML Libraries**: TensorFlow, PyTorch, scikit-learn
- **Data Processing**: NumPy, Pandas
- **NLP**: Transformers library

### Infrastructure
- **Containerization**: Docker with multi-stage builds
- **Orchestration**: Docker Compose for development
- **Database**: PostgreSQL 15 with PostGIS 3.3
- **Cache**: Redis 7 Alpine

## 🔒 Security Features

- **Authentication**: JWT tokens with refresh mechanism
- **Authorization**: Role-based access control (RBAC)
- **Input Validation**: Comprehensive Joi schemas
- **Rate Limiting**: Express rate limiter
- **Security Headers**: Helmet.js middleware
- **Password Hashing**: bcrypt with salt rounds
- **CORS**: Configurable cross-origin resource sharing
- **SQL Injection Prevention**: Sequelize ORM parameterized queries

## 📊 Quality Standards

### Code Quality Requirements
- **Test Coverage**: Minimum 80% for all modules
- **TypeScript**: Strict mode with comprehensive type checking
- **Linting**: ESLint with TypeScript and Prettier
- **Security**: No critical/high vulnerabilities allowed
- **Performance**: API response times under 200ms

### Pre-commit Checks
- ESLint with automatic fixing
- TypeScript compilation
- Unit test execution
- Security audit

## 🧪 Testing Strategy

### Backend Testing
```bash
npm run test                # Unit tests
npm run test:integration    # Integration tests
npm run test:e2e           # End-to-end API tests
npm run coverage           # Coverage report
```

### Mobile App Testing
```bash
npm run test               # Component tests
npm run test:e2e          # E2E tests with Detox
```

### Quality Gates
All code must pass:
- ✅ Unit tests (>80% coverage)
- ✅ Integration tests
- ✅ TypeScript compilation
- ✅ ESLint without errors
- ✅ Security audit (no high/critical)
- ✅ Performance benchmarks

## 🚀 Deployment

### Development
```bash
npm run docker:build      # Build and start all services
npm run setup             # Initial project setup
```

### Production
```bash
npm run build             # Build all projects
docker-compose -f docker-compose.prod.yml up -d
```

## 📝 Development Guidelines

This project follows strict development guidelines to ensure code quality and maintainability:

- **Test-Driven Development**: Write tests before implementation
- **Progressive Enhancement**: Build features incrementally
- **Security-First**: Every endpoint must have validation, auth, and rate limiting
- **Documentation**: Comprehensive code and API documentation
- **Error Handling**: Structured error logging and consistent responses

For detailed guidelines, see [CLAUDE.md](./CLAUDE.md).

## 📚 **Documentation**

All comprehensive documentation has been organized in the [`docs/`](./docs/) directory:

- **[📋 Analysis](./docs/analysis/)** - Platform readiness assessment and revenue models
- **[🏗️ Architecture](./docs/architecture/)** - System design and cash payment architecture  
- **[🚀 Deployment](./docs/deployment/)** - Production deployment guides and status
- **[💻 Development](./docs/development/)** - Setup guides and implementation tracking
- **[🧪 Testing](./docs/testing/)** - Testing strategies and results

**Quick Links:**
- [📖 Complete Documentation Index](./docs/README.md)
- [⚡ Quick Start Guide](./docs/development/QUICK_START.md)
- [🔧 Troubleshooting](./docs/development/TROUBLESHOOTING_GUIDE.md)
- [📊 Platform Analysis](./docs/analysis/COMPREHENSIVE_ANALYSIS_REPORT.md)
- [🚀 Deployment Status](./docs/deployment/FINAL_DEPLOYMENT_STATUS.md)

## 🔧 Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/aryv_db

# JWT
JWT_SECRET=your-super-secret-jwt-key

# External APIs
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
STRIPE_SECRET_KEY=sk_test_your_stripe_secret_key
```

## 📋 Phase Development

### Phase 0: Project Setup ✅
- [x] Technology stack implementation
- [x] Docker environment setup
- [x] Development tooling configuration
- [x] Git repository initialization

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
- [ ] Real-time tracking
- [ ] Payment integration

## 🆘 Troubleshooting

### Common Issues

**Docker services won't start:**
```bash
docker-compose down -v
docker-compose up --build
```

**Database connection issues:**
```bash
npm run db:reset
```

**Node modules issues:**
```bash
rm -rf node_modules package-lock.json
npm install
```

### Emergency Recovery
If something breaks, run the emergency recovery script:
```bash
./scripts/emergency-recovery.sh
```

## 📞 Support

For development questions or issues:
- Check existing [documentation](./docs/)
- Review [CLAUDE.md](./CLAUDE.md) for development guidelines
- Ensure all quality gates pass before seeking help

## 📄 License

This project is proprietary and confidential.

---

**Built with ❤️ by Claude-Code following comprehensive development guidelines.**