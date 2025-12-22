# 🚀 Hitch Platform - Quick Start Guide

Get the Hitch platform running in 5 minutes!

## ⚡ Super Quick Start (Automated)

```bash
# Run the automated setup script
./scripts/setup-local.sh
```

This script will:
- ✅ Check prerequisites
- ✅ Install all dependencies
- ✅ Start Docker services
- ✅ Setup database with sample data
- ✅ Display access URLs

## 🔧 Manual Quick Start

### 1. Prerequisites Check
Make sure you have:
- **Docker Desktop** (running)
- **Node.js** v18+
- **Git**

### 2. Start Core Services
```bash
# Start database and cache
docker-compose up -d postgres redis

# Wait 10 seconds for services to initialize
sleep 10

# Start application services
docker-compose up -d backend admin-panel
```

### 3. Access the Applications

**🌐 Web Applications:**
- **Admin Panel**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **API Documentation**: http://localhost:3001/api-docs

**📱 Mobile App:**
```bash
cd mobile-app
npm install
npm start  # Then follow React Native instructions
```

## 🔑 Default Login Credentials

Use these to test the admin panel:

```
📧 Email: admin@hitch.com
🔒 Password: admin123
```

Test user accounts:
```
👤 Rider: rider@test.com / test123
🚗 Driver: driver@test.com / test123
```

## 🧪 Quick Test Workflow

### 1. Test Admin Panel
1. Go to http://localhost:3000
2. Login with admin credentials
3. Explore the dashboard and user management

### 2. Test API
1. Visit http://localhost:3001/api-docs
2. Try the authentication endpoints
3. Test creating a booking

### 3. Test Mobile App
1. Start mobile app: `cd mobile-app && npm start`
2. Register a new user
3. Test the booking flow

## 🐛 Quick Troubleshooting

### Services Won't Start
```bash
# Reset everything
docker-compose down
docker system prune -f
docker-compose up -d postgres redis
sleep 10
docker-compose up -d backend admin-panel
```

### Port Conflicts
```bash
# Kill processes on common ports
npx kill-port 3000 3001 5000 5432 6379
```

### Database Issues
```bash
# Reset database
docker-compose down postgres
docker volume rm hitch_postgres_data
docker-compose up -d postgres
```

## 🎯 What You Can Test

### Admin Panel Features
- ✅ User management (riders, drivers)
- ✅ Ride booking analytics
- ✅ Financial dashboard
- ✅ Real-time monitoring
- ✅ Package delivery tracking

### Mobile App Features
- ✅ User registration/login
- ✅ Ride booking flow
- ✅ Package delivery requests
- ✅ Real-time chat
- ✅ Payment integration (with test keys)

### API Features
- ✅ Authentication endpoints
- ✅ Booking management
- ✅ Real-time WebSocket events
- ✅ File upload functionality
- ✅ Payment processing

## 📊 Monitor Your Platform

**Service Status:**
```bash
docker-compose ps  # Check running services
docker-compose logs backend  # View backend logs
```

**Monitoring URLs:**
- **Grafana**: http://localhost:3003 (admin/admin)
- **Prometheus**: http://localhost:9090

## 🔄 Development Commands

```bash
# View logs
docker-compose logs -f

# Restart a service
docker-compose restart backend

# Stop all services
docker-compose down

# Database management
cd backend
npm run db:migrate  # Run migrations
npm run db:seed     # Add sample data
```

## 🎉 You're Ready!

The Hitch platform is now running locally with:

- ✅ **Full-featured admin panel**
- ✅ **RESTful API with real-time features**
- ✅ **Mobile app for iOS/Android**
- ✅ **Database with sample data**
- ✅ **Monitoring and analytics**

**Start exploring at http://localhost:3000!**

---

💡 **Tip**: For production deployment, see `DEPLOYMENT_GUIDE.md`