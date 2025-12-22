# 🛠️ Hitch Platform - Utility Scripts

This directory contains helpful scripts for setting up and managing the Hitch platform.

## 📜 Available Scripts

### `setup-local.sh`
**Automated local development setup**

```bash
./scripts/setup-local.sh
```

This script will:
- ✅ Check prerequisites (Node.js, Docker)
- ✅ Setup environment configuration
- ✅ Install all dependencies
- ✅ Start Docker services
- ✅ Initialize database with sample data
- ✅ Display access URLs and credentials

### `verify-setup.sh`
**Verify that all services are running correctly**

```bash
./scripts/verify-setup.sh
```

This script will:
- ✅ Check Docker container status
- ✅ Verify database connectivity
- ✅ Test web service health endpoints
- ✅ Validate API accessibility
- ✅ Display service URLs and credentials

## 🚀 Quick Usage

### First Time Setup
```bash
# Clone the repository
git clone <your-repo>
cd Hitch

# Run automated setup
./scripts/setup-local.sh
```

### Verify Everything is Working
```bash
# Check service health
./scripts/verify-setup.sh
```

### Manual Service Management
```bash
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View service logs
docker-compose logs -f

# Restart a specific service
docker-compose restart backend
```

## 🔧 Script Features

### Setup Script (`setup-local.sh`)
- **Prerequisite checking**: Validates Node.js and Docker installation
- **Environment setup**: Creates `.env` file from template
- **Dependency installation**: Installs npm packages for all components
- **Service orchestration**: Starts services in correct order
- **Database initialization**: Runs migrations and seeds
- **Real-time monitoring**: Shows service logs

### Verification Script (`verify-setup.sh`)
- **Health checks**: Tests all service endpoints
- **Database validation**: Verifies PostgreSQL and Redis connectivity
- **API testing**: Checks core API functionality
- **Status reporting**: Clear pass/fail results
- **Troubleshooting guidance**: Helpful error messages

## 📋 Prerequisites

Before running these scripts, ensure you have:

- **Node.js** v18+ installed
- **Docker Desktop** running
- **Git** for version control
- **curl** for health checks (usually pre-installed)

## 🎯 What Gets Set Up

### Core Services
- **PostgreSQL** database with PostGIS extension
- **Redis** for caching and sessions
- **Backend API** (Node.js/Express)
- **Admin Panel** (React/TypeScript)
- **AI Services** (Python/Flask)

### Optional Services
- **Nginx** reverse proxy
- **Prometheus** monitoring
- **Grafana** dashboards

### Sample Data
- Admin user account
- Test rider and driver accounts
- Sample ride bookings
- Package delivery data

## 🔍 Troubleshooting

### Common Issues

#### Port Conflicts
```bash
# Kill processes using common ports
npx kill-port 3000 3001 5000 5432 6379
```

#### Docker Issues
```bash
# Reset Docker environment
docker-compose down
docker system prune -f
docker-compose up -d
```

#### Permission Issues (Linux/macOS)
```bash
# Make scripts executable
chmod +x scripts/*.sh
```

#### Service Not Starting
```bash
# Check specific service logs
docker-compose logs <service-name>

# Examples:
docker-compose logs backend
docker-compose logs postgres
```

### Getting Help

1. **Check script output**: Scripts provide detailed status messages
2. **Review logs**: Use `docker-compose logs <service>`
3. **Verify prerequisites**: Ensure all required software is installed
4. **Check ports**: Make sure required ports are available

## 📝 Customization

### Environment Variables
Edit `.env` file to customize:
- Database passwords
- API keys
- Service ports
- Feature flags

### Service Configuration
Modify `docker-compose.yml` to:
- Change service ports
- Add new services
- Modify resource limits
- Configure volumes

## 🎉 Success Indicators

### Setup Complete When:
- ✅ All Docker containers are running
- ✅ Admin panel loads at http://localhost:3000
- ✅ API responds at http://localhost:3001
- ✅ Database migrations completed
- ✅ Sample data loaded

### Ready to Use When:
- ✅ Can login to admin panel
- ✅ API documentation accessible
- ✅ Mobile app can connect to backend
- ✅ All verification checks pass

---

**Need help?** Check the main `LOCAL_DEPLOYMENT_GUIDE.md` for detailed instructions.