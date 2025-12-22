# Hitch Platform - Production Deployment Guide

**Project:** Hitch Ride-Sharing Platform  
**Version:** 1.0.0  
**Date:** January 27, 2025  
**Author:** Claude-Code  

---

## 🚀 Deployment Overview

This guide provides comprehensive instructions for deploying the Hitch platform to production environments. The platform consists of multiple services that work together to provide a complete ride-sharing and courier service solution.

### Deployment Architecture
```
Production Environment:
├── Backend API Service (Node.js + TypeScript)
├── Database Service (PostgreSQL + PostGIS)
├── Cache Service (Redis)
├── Admin Panel (React + Vite)
├── Mobile App (React Native)
└── Reverse Proxy/Load Balancer (Nginx)
```

---

## 📋 Prerequisites

### System Requirements

#### Minimum Hardware Specifications
```
CPU: 4 cores (2.4 GHz)
RAM: 8 GB
Storage: 100 GB SSD
Network: 1 Gbps connection
OS: Ubuntu 20.04 LTS or CentOS 8+
```

#### Recommended Hardware Specifications
```
CPU: 8 cores (3.0 GHz)
RAM: 16 GB
Storage: 200 GB SSD
Network: 10 Gbps connection
Load Balancer: Dedicated hardware or cloud service
```

### Software Dependencies

#### Core Dependencies
```bash
# Required Software
Docker Engine 24.0+
Docker Compose 2.0+
Node.js 18.x LTS
npm 9.x
Git 2.x
```

#### Optional Tools
```bash
# Monitoring and Management
htop
curl
jq
nginx (if not using Docker)
certbot (for SSL certificates)
```

---

## 🛠️ Installation Steps

### 1. System Preparation

#### Update System Packages
```bash
# Ubuntu/Debian
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl wget git htop

# CentOS/RHEL
sudo yum update -y
sudo yum install -y curl wget git htop
```

#### Install Docker
```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add user to docker group
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Verify installation
docker --version
docker-compose --version
```

### 2. Project Setup

#### Clone Repository
```bash
# Clone the project
git clone https://github.com/your-org/hitch-platform.git
cd hitch-platform

# Set proper permissions
sudo chown -R $USER:$USER /path/to/hitch-platform
chmod +x scripts/*.sh
```

#### Environment Configuration
```bash
# Copy environment templates
cp backend/.env.example backend/.env
cp admin-panel/.env.example admin-panel/.env
cp mobile-app/.env.example mobile-app/.env

# Edit configuration files
nano backend/.env
nano admin-panel/.env
nano mobile-app/.env
```

### 3. Production Environment Variables

#### Backend Configuration (`backend/.env`)
```bash
# Environment
NODE_ENV=production
PORT=3001

# Database Configuration
POSTGRES_HOST=hitch-postgres
POSTGRES_PORT=5432
POSTGRES_DB=hitch_production
POSTGRES_USER=hitch_user
POSTGRES_PASSWORD=YOUR_SECURE_PASSWORD_HERE

# JWT Configuration
JWT_SECRET=YOUR_SUPER_SECURE_JWT_SECRET_256_BITS
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=YOUR_REFRESH_SECRET_256_BITS
JWT_REFRESH_EXPIRES_IN=7d

# Admin JWT
ADMIN_JWT_SECRET=YOUR_ADMIN_JWT_SECRET_256_BITS
ADMIN_JWT_EXPIRES_IN=8h

# Redis Configuration
REDIS_HOST=hitch-redis
REDIS_PORT=6379
REDIS_PASSWORD=YOUR_REDIS_PASSWORD

# CORS Configuration
CORS_ORIGIN=https://yourdomain.com,https://admin.yourdomain.com

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000

# External Services
STRIPE_SECRET_KEY=sk_live_YOUR_STRIPE_SECRET_KEY
GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY

# Monitoring
LOG_LEVEL=info
SENTRY_DSN=YOUR_SENTRY_DSN
```

#### Admin Panel Configuration (`admin-panel/.env`)
```bash
# API Configuration
VITE_API_BASE_URL=https://api.yourdomain.com
VITE_SOCKET_URL=https://api.yourdomain.com

# Environment
VITE_APP_ENV=production
VITE_DEBUG=false

# Analytics
VITE_GOOGLE_ANALYTICS_ID=YOUR_GA_ID
```

#### Mobile App Configuration (`mobile-app/.env`)
```bash
# API Configuration
API_BASE_URL=https://api.yourdomain.com
SOCKET_URL=https://api.yourdomain.com

# App Configuration
APP_NAME=Hitch
BUNDLE_ID=com.hitch.mobile
VERSION_CODE=1
VERSION_NAME=1.0.0

# Feature Flags
ENABLE_PUSH_NOTIFICATIONS=true
ENABLE_ANALYTICS=true
ENABLE_CRASH_REPORTING=true

# Third-party Services
GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY
STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_STRIPE_PUBLISHABLE_KEY
SENTRY_DSN=YOUR_SENTRY_DSN
```

---

## 🐳 Docker Deployment

### Production Docker Compose

#### Create `docker-compose.prod.yml`
```yaml
version: '3.8'

services:
  hitch-postgres:
    image: postgis/postgis:15-3.3-alpine
    container_name: hitch-postgres-prod
    environment:
      POSTGRES_DB: hitch_production
      POSTGRES_USER: hitch_user
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
      POSTGRES_INITDB_ARGS: "--encoding=UTF8 --locale=C"
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./backend/database/init.sql:/docker-entrypoint-initdb.d/01-init.sql
      - ./backend/migrations:/docker-entrypoint-initdb.d/migrations
    ports:
      - "5432:5432"
    networks:
      - hitch-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hitch_user -d hitch_production"]
      interval: 30s
      timeout: 10s
      retries: 3

  hitch-redis:
    image: redis:7-alpine
    container_name: hitch-redis-prod
    command: redis-server --requirepass ${REDIS_PASSWORD} --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "6379:6379"
    networks:
      - hitch-network
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 30s
      timeout: 10s
      retries: 3

  hitch-backend:
    build:
      context: ./backend
      dockerfile: Dockerfile
      target: production
    container_name: hitch-backend-prod
    environment:
      - NODE_ENV=production
    env_file:
      - ./backend/.env
    ports:
      - "3001:3001"
    depends_on:
      hitch-postgres:
        condition: service_healthy
      hitch-redis:
        condition: service_healthy
    networks:
      - hitch-network
    restart: unless-stopped
    volumes:
      - backend_logs:/app/logs
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3001/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  hitch-admin:
    build:
      context: ./admin-panel
      dockerfile: Dockerfile
      target: production
    container_name: hitch-admin-prod
    env_file:
      - ./admin-panel/.env
    ports:
      - "3000:80"
    depends_on:
      - hitch-backend
    networks:
      - hitch-network
    restart: unless-stopped

  hitch-nginx:
    image: nginx:alpine
    container_name: hitch-nginx-prod
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./nginx/ssl:/etc/nginx/ssl
      - nginx_logs:/var/log/nginx
    depends_on:
      - hitch-backend
      - hitch-admin
    networks:
      - hitch-network
    restart: unless-stopped

volumes:
  postgres_data:
    driver: local
  redis_data:
    driver: local
  backend_logs:
    driver: local
  nginx_logs:
    driver: local

networks:
  hitch-network:
    driver: bridge
```

### Production Dockerfile

#### Backend Dockerfile (`backend/Dockerfile`)
```dockerfile
# Multi-stage build for production
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production && npm cache clean --force

FROM node:18-alpine AS development
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS production
WORKDIR /app
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001
COPY --from=base /app/node_modules ./node_modules
COPY --from=development /app/dist ./dist
COPY --from=development /app/package*.json ./
RUN mkdir -p logs && chown -R nodejs:nodejs /app
USER nodejs
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1
CMD ["node", "dist/index.js"]
```

#### Admin Panel Dockerfile (`admin-panel/Dockerfile`)
```dockerfile
# Multi-stage build for production
FROM node:18-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine AS production
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

---

## 🌐 Nginx Configuration

### Production Nginx Config (`nginx/nginx.conf`)
```nginx
events {
    worker_connections 1024;
}

http {
    include       /etc/nginx/mime.types;
    default_type  application/octet-stream;
    
    # Logging
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    
    access_log /var/log/nginx/access.log main;
    error_log /var/log/nginx/error.log warn;
    
    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript 
               application/javascript application/xml+rss 
               application/json application/xml;
    
    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    limit_req_zone $binary_remote_addr zone=admin:10m rate=5r/s;
    
    # SSL Configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 10m;
    
    # Security headers
    add_header X-Frame-Options DENY always;
    add_header X-Content-Type-Options nosniff always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;
    
    # API Backend
    upstream backend {
        server hitch-backend:3001;
        keepalive 32;
    }
    
    # Admin Panel
    upstream admin {
        server hitch-admin:80;
        keepalive 16;
    }
    
    # API Server
    server {
        listen 80;
        server_name api.yourdomain.com;
        return 301 https://$server_name$request_uri;
    }
    
    server {
        listen 443 ssl http2;
        server_name api.yourdomain.com;
        
        ssl_certificate /etc/nginx/ssl/api.yourdomain.com.crt;
        ssl_certificate_key /etc/nginx/ssl/api.yourdomain.com.key;
        
        location / {
            limit_req zone=api burst=20 nodelay;
            
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection 'upgrade';
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            proxy_cache_bypass $http_upgrade;
            
            # Timeouts
            proxy_connect_timeout 60s;
            proxy_send_timeout 60s;
            proxy_read_timeout 60s;
        }
        
        # WebSocket support
        location /socket.io/ {
            proxy_pass http://backend;
            proxy_http_version 1.1;
            proxy_set_header Upgrade $http_upgrade;
            proxy_set_header Connection "upgrade";
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
    }
    
    # Admin Panel
    server {
        listen 80;
        server_name admin.yourdomain.com;
        return 301 https://$server_name$request_uri;
    }
    
    server {
        listen 443 ssl http2;
        server_name admin.yourdomain.com;
        
        ssl_certificate /etc/nginx/ssl/admin.yourdomain.com.crt;
        ssl_certificate_key /etc/nginx/ssl/admin.yourdomain.com.key;
        
        location / {
            limit_req zone=admin burst=10 nodelay;
            
            proxy_pass http://admin;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # Cache static assets
            location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
                expires 1y;
                add_header Cache-Control "public, immutable";
            }
        }
    }
}
```

---

## 🔐 SSL/TLS Setup

### Generate SSL Certificates

#### Using Let's Encrypt (Recommended)
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Generate certificates
sudo certbot --nginx -d api.yourdomain.com -d admin.yourdomain.com

# Setup auto-renewal
sudo crontab -e
# Add: 0 12 * * * /usr/bin/certbot renew --quiet
```

#### Using Self-Signed Certificates (Development)
```bash
# Create SSL directory
mkdir -p nginx/ssl

# Generate certificates
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/api.yourdomain.com.key \
  -out nginx/ssl/api.yourdomain.com.crt \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=api.yourdomain.com"

openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout nginx/ssl/admin.yourdomain.com.key \
  -out nginx/ssl/admin.yourdomain.com.crt \
  -subj "/C=US/ST=State/L=City/O=Organization/CN=admin.yourdomain.com"
```

---

## 🚀 Deployment Process

### 1. Pre-deployment Checks
```bash
# Create deployment script
cat > deploy.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 Starting Hitch Platform Deployment..."

# Check Docker
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed"
    exit 1
fi

# Check Docker Compose
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose is not installed"
    exit 1
fi

# Check environment files
if [ ! -f backend/.env ]; then
    echo "❌ Backend .env file is missing"
    exit 1
fi

if [ ! -f admin-panel/.env ]; then
    echo "❌ Admin panel .env file is missing"
    exit 1
fi

echo "✅ Pre-deployment checks passed"
EOF

chmod +x deploy.sh
./deploy.sh
```

### 2. Database Migration
```bash
# Create migration script
cat > migrate.sh << 'EOF'
#!/bin/bash
set -e

echo "🗄️ Running database migrations..."

# Start only the database
docker-compose -f docker-compose.prod.yml up -d hitch-postgres

# Wait for database to be ready
echo "⏳ Waiting for database to be ready..."
sleep 30

# Run migrations
docker-compose -f docker-compose.prod.yml exec hitch-postgres psql -U hitch_user -d hitch_production -f /docker-entrypoint-initdb.d/01-init.sql

echo "✅ Database migrations completed"
EOF

chmod +x migrate.sh
./migrate.sh
```

### 3. Application Deployment
```bash
# Create full deployment script
cat > deploy-production.sh << 'EOF'
#!/bin/bash
set -e

echo "🚀 Deploying Hitch Platform to Production..."

# Pull latest images
docker-compose -f docker-compose.prod.yml pull

# Build services
docker-compose -f docker-compose.prod.yml build --no-cache

# Stop existing services
docker-compose -f docker-compose.prod.yml down

# Start services
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be healthy
echo "⏳ Waiting for services to be healthy..."
sleep 60

# Health checks
echo "🔍 Running health checks..."
curl -f http://localhost:3001/health || exit 1
curl -f http://localhost:3000 || exit 1

echo "✅ Deployment completed successfully!"
echo "🌐 API: https://api.yourdomain.com"
echo "🖥️ Admin: https://admin.yourdomain.com"
EOF

chmod +x deploy-production.sh
./deploy-production.sh
```

---

## 📱 Mobile App Deployment

### iOS App Store Deployment
```bash
# Build for iOS production
cd mobile-app
npm run build:ios:release

# Archive and upload to App Store Connect
# Use Xcode or fastlane for automated deployment
```

### Android Play Store Deployment
```bash
# Build for Android production
cd mobile-app
npm run build:android:release

# Generate signed APK/AAB
./gradlew assembleRelease

# Upload to Google Play Console
# Use fastlane or manual upload
```

---

## 📊 Monitoring & Logging

### System Monitoring Setup
```bash
# Create monitoring script
cat > monitoring/setup-monitoring.sh << 'EOF'
#!/bin/bash

# Install monitoring tools
docker run -d \
  --name prometheus \
  -p 9090:9090 \
  -v $(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus

docker run -d \
  --name grafana \
  -p 3003:3000 \
  -e "GF_SECURITY_ADMIN_PASSWORD=admin" \
  grafana/grafana

echo "📊 Monitoring setup complete"
echo "Prometheus: http://localhost:9090"
echo "Grafana: http://localhost:3003"
EOF

chmod +x monitoring/setup-monitoring.sh
```

### Log Management
```bash
# Setup log rotation
sudo cat > /etc/logrotate.d/hitch << 'EOF'
/var/lib/docker/containers/*/*.log {
    daily
    missingok
    rotate 7
    compress
    notifempty
    create 0644 root root
    postrotate
        docker kill --signal="USR1" $(docker ps -q) || true
    endscript
}
EOF
```

---

## 🔧 Maintenance & Operations

### Backup Procedures
```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
set -e

BACKUP_DIR="/backups/hitch/$(date +%Y%m%d_%H%M%S)"
mkdir -p $BACKUP_DIR

echo "📦 Creating backup..."

# Database backup
docker-compose -f docker-compose.prod.yml exec -T hitch-postgres pg_dump -U hitch_user hitch_production > $BACKUP_DIR/database.sql

# Redis backup
docker-compose -f docker-compose.prod.yml exec -T hitch-redis redis-cli BGSAVE
docker cp hitch-redis-prod:/data/dump.rdb $BACKUP_DIR/redis.rdb

# Application logs
docker-compose -f docker-compose.prod.yml logs > $BACKUP_DIR/application.log

# Compress backup
tar -czf $BACKUP_DIR.tar.gz -C /backups/hitch $(basename $BACKUP_DIR)
rm -rf $BACKUP_DIR

echo "✅ Backup completed: $BACKUP_DIR.tar.gz"
EOF

chmod +x backup.sh

# Schedule daily backups
echo "0 2 * * * /path/to/backup.sh" | sudo crontab -
```

### Update Procedures
```bash
# Create update script
cat > update.sh << 'EOF'
#!/bin/bash
set -e

echo "🔄 Updating Hitch Platform..."

# Pull latest code
git pull origin main

# Backup before update
./backup.sh

# Update services
docker-compose -f docker-compose.prod.yml pull
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

# Health check
sleep 60
curl -f http://localhost:3001/health || exit 1

echo "✅ Update completed successfully!"
EOF

chmod +x update.sh
```

---

## 🚨 Troubleshooting

### Common Issues and Solutions

#### Database Connection Issues
```bash
# Check database status
docker-compose -f docker-compose.prod.yml exec hitch-postgres pg_isready -U hitch_user

# Check database logs
docker-compose -f docker-compose.prod.yml logs hitch-postgres

# Restart database
docker-compose -f docker-compose.prod.yml restart hitch-postgres
```

#### Backend Service Issues
```bash
# Check backend logs
docker-compose -f docker-compose.prod.yml logs hitch-backend

# Check backend health
curl -f http://localhost:3001/health

# Restart backend
docker-compose -f docker-compose.prod.yml restart hitch-backend
```

#### Performance Issues
```bash
# Check resource usage
docker stats

# Check disk space
df -h

# Clean up unused resources
docker system prune -f
```

### Emergency Procedures
```bash
# Quick rollback
git checkout HEAD~1
./deploy-production.sh

# Emergency stop
docker-compose -f docker-compose.prod.yml down

# Emergency restart
docker-compose -f docker-compose.prod.yml restart
```

---

## 📞 Support & Maintenance

### Production Checklist
- [ ] All environment variables configured
- [ ] SSL certificates installed and valid
- [ ] Database migrations completed
- [ ] Health checks passing
- [ ] Monitoring setup and alerting configured
- [ ] Backup procedures tested
- [ ] Security hardening completed
- [ ] DNS records configured
- [ ] CDN setup (if applicable)
- [ ] Performance testing completed

### Contact Information
- **Technical Lead**: [Contact Details]
- **DevOps Team**: [Contact Details]
- **Emergency Contact**: [24/7 Support Number]

### Documentation Links
- [System Architecture](./docs/SYSTEM_ARCHITECTURE.md)
- [API Documentation](http://localhost:3001/docs)
- [Mobile Development Guide](./docs/MOBILE_DEVELOPMENT_HANDOFF.md)
- [Admin Panel Guide](./admin-panel/README.md)

---

**This deployment guide provides comprehensive instructions for setting up and maintaining the Hitch platform in production environments. Follow these procedures carefully to ensure a successful deployment with high availability and security.**