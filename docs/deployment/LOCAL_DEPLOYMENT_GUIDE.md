# 🚀 Hitch Platform - Local Deployment Guide

This guide will help you set up and run the complete Hitch platform locally for testing and development.

## 📋 Prerequisites

### Required Software
- **Node.js** (v18 or higher) - [Download here](https://nodejs.org/)
- **Docker Desktop** - [Download here](https://www.docker.com/products/docker-desktop)
- **Git** - [Download here](https://git-scm.com/)

### Optional (for mobile development)
- **Android Studio** - [Download here](https://developer.android.com/studio)
- **Xcode** (macOS only) - For iOS development

## 🛠️ Step-by-Step Setup

### 1. Clone and Navigate to Project
```bash
# If not already cloned
git clone <your-repo-url>
cd Hitch
```

### 2. Environment Configuration
```bash
# Copy the environment template
cp .env.example .env

# Edit the .env file with your preferences (see configuration section below)
```

### 3. Quick Start with Docker (Recommended)
```bash
# Start all services
docker-compose up -d

# Or start services individually
docker-compose up -d postgres redis  # Database services first
docker-compose up -d backend         # Backend API
docker-compose up -d admin-panel     # Admin UI
docker-compose up -d ai-services     # AI services
```

### 4. Manual Setup (Alternative)

If you prefer to run services manually:

#### Backend Setup
```bash
cd backend
npm install
npm run build
npm run db:migrate  # Setup database
npm run db:seed     # Add sample data
npm run dev         # Start development server
```

#### Admin Panel Setup
```bash
cd admin-panel
npm install
npm run dev         # Start development server
```

#### Mobile App Setup
```bash
cd mobile-app
npm install

# For Android
npm run android

# For iOS (macOS only)
npm run ios

# For web development
npm start
```

## 🔧 Environment Configuration

### Minimal Configuration (Quick Start)
For local testing, you only need to set these in your `.env` file:

```env
# Basic settings
NODE_ENV=development
POSTGRES_PASSWORD=hitch_local_password
REDIS_PASSWORD=hitch_redis_password
JWT_SECRET=your-local-jwt-secret-at-least-32-chars-long
```

### Full Configuration
For complete functionality, configure these services:

#### Database Settings
```env
POSTGRES_PASSWORD=your_secure_password
DATABASE_URL=postgresql://hitch_user:your_secure_password@localhost:5432/hitch_db
```

#### Stripe (for payments)
```env
STRIPE_SECRET_KEY=sk_test_your_stripe_test_key
STRIPE_PUBLISHABLE_KEY=pk_test_your_stripe_test_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
```

#### Google Maps (for location features)
```env
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
REACT_APP_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
```

## 🌐 Accessing the Applications

Once running, you can access:

### Web Applications
- **Admin Panel**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **AI Services**: http://localhost:5000
- **API Documentation**: http://localhost:3001/api-docs

### Monitoring (Optional)
- **Grafana Dashboard**: http://localhost:3003
- **Prometheus Metrics**: http://localhost:9090

### Mobile App
- **Android**: Use `npm run android` in mobile-app directory
- **iOS**: Use `npm run ios` in mobile-app directory
- **Web**: Access at http://localhost:19006 (if using Expo)

## 🧪 Test Accounts and Data

### Default Admin Account
After running the database seeds:
```
Email: admin@hitch.com
Password: admin123
```

### Sample Rider Account
```
Email: rider@test.com
Password: test123
```

### Sample Driver Account
```
Email: driver@test.com
Password: test123
```

## 🔍 Verification Steps

### 1. Check Service Health
```bash
# Check if all containers are running
docker-compose ps

# Check service logs
docker-compose logs backend
docker-compose logs admin-panel
```

### 2. Test API Endpoints
```bash
# Health check
curl http://localhost:3001/health

# API documentation
curl http://localhost:3001/api-docs
```

### 3. Database Connection
```bash
# Connect to PostgreSQL
docker exec -it hitch-postgres psql -U hitch_user -d hitch_db

# List tables
\dt

# Exit
\q
```

## 📱 Mobile App Development

### React Native Setup
```bash
cd mobile-app

# Install dependencies
npm install

# Install iOS pods (macOS only)
cd ios && pod install && cd ..

# Start Metro bundler
npm start

# In separate terminals:
npm run android  # For Android
npm run ios      # For iOS
```

### Android Emulator
1. Open Android Studio
2. Open AVD Manager
3. Create/start an Android Virtual Device
4. Run `npm run android` in the mobile-app directory

### iOS Simulator (macOS only)
1. Open Xcode
2. Open Simulator
3. Choose a device
4. Run `npm run ios` in the mobile-app directory

## 🐛 Troubleshooting

### Common Issues

#### Port Already in Use
```bash
# Kill processes on specific ports
npx kill-port 3000 3001 5000

# Or check what's using the port
lsof -i :3000
```

#### Docker Issues
```bash
# Reset Docker
docker-compose down
docker system prune -f
docker-compose up -d
```

#### Database Connection Issues
```bash
# Reset database
docker-compose down postgres
docker volume rm hitch_postgres_data
docker-compose up -d postgres
```

#### Mobile App Issues
```bash
# Reset React Native cache
cd mobile-app
npx react-native start --reset-cache

# Clean builds
npm run clean
```

### Service-Specific Logs
```bash
# Backend logs
docker-compose logs -f backend

# Database logs
docker-compose logs -f postgres

# All logs
docker-compose logs -f
```

## 🧪 Testing the Platform

### 1. Admin Panel Testing
1. Go to http://localhost:3000
2. Login with admin credentials
3. Explore dashboard, user management, and analytics

### 2. API Testing
1. Visit http://localhost:3001/api-docs for Swagger UI
2. Test authentication endpoints
3. Create test bookings

### 3. Mobile App Testing
1. Start the mobile app
2. Register a new user
3. Test booking flow
4. Test real-time features

### 4. End-to-End Testing
1. Create a ride request in mobile app
2. Accept ride in driver mode
3. Monitor in admin panel
4. Complete the booking cycle

## 📊 Development Tools

### Database Management
```bash
# Access PostgreSQL
docker exec -it hitch-postgres psql -U hitch_user -d hitch_db

# Run migrations
cd backend && npm run db:migrate

# Seed database
cd backend && npm run db:seed
```

### Redis Management
```bash
# Access Redis CLI
docker exec -it hitch-redis redis-cli

# Monitor Redis
docker exec -it hitch-redis redis-cli monitor
```

### Code Quality
```bash
# Run tests
npm test                    # In any service directory
npm run test:coverage      # With coverage

# Code linting
npm run lint
npm run lint:fix

# Type checking
npm run type-check
```

## 🔄 Development Workflow

### Making Changes
1. **Backend**: Edit files in `backend/src/` - auto-reloads
2. **Admin Panel**: Edit files in `admin-panel/src/` - auto-reloads
3. **Mobile App**: Edit files in `mobile-app/src/` - auto-reloads

### Database Schema Changes
```bash
cd backend
npm run db:migrate    # Apply new migrations
npm run db:seed       # Refresh seed data
```

### Adding New Features
1. Update backend API if needed
2. Update admin panel UI
3. Update mobile app
4. Run tests: `npm test`
5. Update documentation

## 📝 Configuration Tips

### Performance Optimization
- Use `NODE_ENV=development` for auto-reload
- Enable hot reloading for faster development
- Use Docker for consistent environment

### Security for Local Development
- Never commit real API keys
- Use test Stripe keys only
- Generate secure local JWT secrets

### Debugging
- Enable `DEBUG_MODE=true` for verbose logging
- Use browser developer tools
- Check Docker logs regularly

## 🎯 Next Steps

After successful local deployment:

1. **Explore Features**: Test all platform capabilities
2. **Customize**: Modify UI/UX to your needs
3. **Integrate APIs**: Add your API keys
4. **Deploy**: Follow production deployment guide
5. **Scale**: Configure for production workloads

## 🆘 Support

If you encounter issues:

1. Check the troubleshooting section above
2. Review service logs: `docker-compose logs <service-name>`
3. Ensure all prerequisites are installed
4. Verify environment configuration
5. Check port availability

---

**🎉 You're ready to explore the Hitch platform locally!**

Access the admin panel at http://localhost:3000 and start testing the complete ride-sharing solution.