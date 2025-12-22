# 🚀 Hitch Platform - Production Deployment Guide

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Server Setup](#server-setup)
3. [Security Configuration](#security-configuration)
4. [Environment Configuration](#environment-configuration)
5. [SSL Certificate Setup](#ssl-certificate-setup)
6. [Database Setup](#database-setup)
7. [Deployment Process](#deployment-process)
8. [Post-Deployment Configuration](#post-deployment-configuration)
9. [Monitoring & Maintenance](#monitoring--maintenance)
10. [Troubleshooting](#troubleshooting)

## 🔧 Prerequisites

### System Requirements

**Minimum Server Specifications:**
- **CPU**: 4 cores (8 recommended)
- **RAM**: 8GB (16GB recommended)  
- **Storage**: 100GB SSD (500GB recommended)
- **Network**: 1Gbps connection
- **OS**: Ubuntu 20.04 LTS or newer

**Required Software:**
- Docker 24.0+
- Docker Compose 2.0+
- Nginx (if not using containerized version)
- Certbot (for SSL certificates)
- Git

### External Services Required

- **Domain Names**: 
  - `api.yourdomain.com` (API)
  - `admin.yourdomain.com` (Admin Panel)
  - `yourdomain.com` (Main Website)
- **Stripe Account** (Payment processing)
- **AWS Account** (S3 for file storage)
- **Google Cloud Account** (Maps API)
- **Email Service** (Mailgun, SendGrid, etc.)
- **Monitoring** (Sentry for error tracking)

## 🖥️ Server Setup

### 1. Initial Server Configuration

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install required packages
sudo apt install -y curl wget git unzip software-properties-common

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Install Certbot for SSL
sudo apt install -y certbot python3-certbot-nginx

# Create application user
sudo useradd -m -s /bin/bash hitch
sudo usermod -aG docker hitch
```

### 2. Directory Structure Setup

```bash
# Switch to hitch user
sudo su - hitch

# Create directory structure
mkdir -p /home/hitch/{app,backups,logs}
cd /home/hitch/app

# Clone repository
git clone https://github.com/your-org/hitch-platform.git .
```

## 🔒 Security Configuration

### 1. Firewall Setup

```bash
# Configure UFW firewall
sudo ufw enable
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH (adjust port if needed)
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow monitoring ports (restrict to monitoring servers)
sudo ufw allow from MONITORING_SERVER_IP to any port 9090
sudo ufw allow from MONITORING_SERVER_IP to any port 3000
```

### 2. System Hardening

```bash
# Disable root login
sudo sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config

# Configure automatic security updates
sudo apt install -y unattended-upgrades
sudo dpkg-reconfigure -plow unattended-upgrades

# Set up fail2ban
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

## ⚙️ Environment Configuration

### 1. Create Production Environment File

```bash
cd /home/hitch/app
cp .env.production .env.production.local

# Edit the environment file
nano .env.production.local
```

### 2. Required Environment Variables

Update the following variables in `.env.production.local`:

```bash
# === CORE APPLICATION ===
DOMAIN_NAME=yourdomain.com

# === DATABASE ===
POSTGRES_PASSWORD=your_strong_database_password
DB_PASSWORD=your_strong_database_password

# === REDIS ===
REDIS_PASSWORD=your_strong_redis_password

# === JWT & AUTHENTICATION ===
JWT_SECRET=your_64_character_jwt_secret_key

# === STRIPE (Production Keys) ===
STRIPE_SECRET_KEY=sk_live_your_production_secret_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_production_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# === AWS S3 ===
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_S3_BUCKET=your-production-bucket-name

# === GOOGLE SERVICES ===
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# === EMAIL SERVICE ===
SMTP_HOST=smtp.mailgun.org
SMTP_USER=postmaster@mg.yourdomain.com
SMTP_PASS=your_smtp_password

# === MONITORING ===
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
GRAFANA_PASSWORD=your_strong_grafana_password

# === COURIER SERVICE ===
QR_CODE_SECRET=your_64_character_qr_secret_key
```

## 🔐 SSL Certificate Setup

### Option 1: Let's Encrypt (Recommended)

```bash
# Stop nginx if running
sudo systemctl stop nginx

# Obtain certificates
sudo certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com
sudo certbot certonly --standalone -d api.yourdomain.com  
sudo certbot certonly --standalone -d admin.yourdomain.com

# Copy certificates to nginx directory
sudo mkdir -p /home/hitch/app/nginx/ssl
sudo cp /etc/letsencrypt/live/yourdomain.com/fullchain.pem /home/hitch/app/nginx/ssl/hitch.com.crt
sudo cp /etc/letsencrypt/live/yourdomain.com/privkey.pem /home/hitch/app/nginx/ssl/hitch.com.key
sudo cp /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem /home/hitch/app/nginx/ssl/api.hitch.com.crt
sudo cp /etc/letsencrypt/live/api.yourdomain.com/privkey.pem /home/hitch/app/nginx/ssl/api.hitch.com.key
sudo cp /etc/letsencrypt/live/admin.yourdomain.com/fullchain.pem /home/hitch/app/nginx/ssl/admin.hitch.com.crt
sudo cp /etc/letsencrypt/live/admin.yourdomain.com/privkey.pem /home/hitch/app/nginx/ssl/admin.hitch.com.key

# Set proper permissions
sudo chown -R hitch:hitch /home/hitch/app/nginx/ssl
sudo chmod 600 /home/hitch/app/nginx/ssl/*.key
sudo chmod 644 /home/hitch/app/nginx/ssl/*.crt
```

### Option 2: Commercial Certificate

```bash
# If using commercial certificates, place them in:
# /home/hitch/app/nginx/ssl/yourdomain.com.crt
# /home/hitch/app/nginx/ssl/yourdomain.com.key
# etc.
```

## 🗄️ Database Setup

### 1. Initialize Production Data

```bash
cd /home/hitch/app

# Create production directories
sudo mkdir -p /opt/hitch-data/{postgres,redis,uploads,ai-models,prometheus,grafana,loki}
sudo chown -R hitch:hitch /opt/hitch-data

# Start database for initial setup
docker-compose -f docker-compose.prod.yml up -d postgres redis

# Wait for database to be ready
sleep 30

# Run migrations
docker-compose -f docker-compose.prod.yml exec -T backend npm run migrate

# Create admin user
docker-compose -f docker-compose.prod.yml exec -T backend node scripts/create-admin-user.js
```

## 🚀 Deployment Process

### 1. Automated Deployment

```bash
cd /home/hitch/app

# Make deployment script executable
chmod +x scripts/deploy-production.sh

# Run full deployment
./scripts/deploy-production.sh deploy
```

### 2. Manual Deployment Steps

If you prefer manual control:

```bash
# 1. Build images
./scripts/deploy-production.sh build

# 2. Create backup
./scripts/deploy-production.sh backup

# 3. Start services
./scripts/deploy-production.sh start

# 4. Run migrations
./scripts/deploy-production.sh migrate

# 5. Verify deployment
./scripts/deploy-production.sh status
```

## 🔧 Post-Deployment Configuration

### 1. DNS Configuration

Configure your DNS records:

```
Type    Name       Value                    TTL
A       @          YOUR_SERVER_IP          300
A       www        YOUR_SERVER_IP          300  
A       api        YOUR_SERVER_IP          300
A       admin      YOUR_SERVER_IP          300
CNAME   *.         yourdomain.com          300
```

### 2. Test Endpoints

```bash
# Test API health
curl -f https://api.yourdomain.com/health

# Test admin panel
curl -f https://admin.yourdomain.com

# Test SSL certificates
curl -I https://yourdomain.com
```

### 3. Configure Monitoring

```bash
# Access Grafana
# URL: https://admin.yourdomain.com/grafana
# Username: admin
# Password: [value from GRAFANA_PASSWORD]

# Set up dashboards and alerts
# Import the provided dashboard configurations
```

## 📊 Monitoring & Maintenance

### 1. Log Management

```bash
# View application logs
docker-compose -f docker-compose.prod.yml logs -f backend

# View nginx logs
docker-compose -f docker-compose.prod.yml logs -f nginx

# View system logs
sudo journalctl -f -u docker
```

### 2. Backup Strategy

```bash
# Manual backup
./scripts/deploy-production.sh backup

# Set up automated backups (add to crontab)
sudo crontab -e
# Add: 0 2 * * * /home/hitch/app/scripts/deploy-production.sh backup
```

### 3. Updates

```bash
# Update application
cd /home/hitch/app
git pull origin main
./scripts/deploy-production.sh deploy

# Update system
sudo apt update && sudo apt upgrade -y
sudo reboot
```

## 🛠️ Troubleshooting

### Common Issues

#### 1. Service Won't Start

```bash
# Check service logs
docker-compose -f docker-compose.prod.yml logs [service_name]

# Check container status
docker-compose -f docker-compose.prod.yml ps

# Restart specific service
docker-compose -f docker-compose.prod.yml restart [service_name]
```

#### 2. Database Connection Issues

```bash
# Check database logs
docker-compose -f docker-compose.prod.yml logs postgres

# Test database connection
docker-compose -f docker-compose.prod.yml exec postgres psql -U hitch_user -d hitch_db -c "SELECT 1;"

# Reset database (DESTRUCTIVE)
docker-compose -f docker-compose.prod.yml down -v
docker-compose -f docker-compose.prod.yml up -d postgres
# Then run migrations again
```

#### 3. SSL Certificate Issues

```bash
# Check certificate validity
openssl x509 -in nginx/ssl/yourdomain.com.crt -text -noout

# Renew Let's Encrypt certificates
sudo certbot renew
# Then copy new certificates and restart nginx
```

#### 4. Performance Issues

```bash
# Check resource usage
docker stats

# Check system resources
htop
df -h
free -h

# Scale services if needed
docker-compose -f docker-compose.prod.yml up -d --scale backend=3
```

### Emergency Procedures

#### Rollback Deployment

```bash
# Stop current deployment
./scripts/deploy-production.sh stop

# Rollback to previous version
./scripts/deploy-production.sh rollback

# Or restore from backup
# Find latest backup in /home/hitch/backups/
# Restore manually using backup files
```

#### Complete System Recovery

```bash
# 1. Stop all services
docker-compose -f docker-compose.prod.yml down

# 2. Restore from backup
# [Restore database and files from your backup system]

# 3. Restart services
./scripts/deploy-production.sh deploy
```

## 📞 Support

### Log Files Locations

- **Application Logs**: `docker-compose logs`
- **System Logs**: `/var/log/syslog`
- **Nginx Logs**: `/var/log/nginx/`
- **Deployment Logs**: `/home/hitch/app/logs/`

### Health Check URLs

- **API Health**: `https://api.yourdomain.com/health`
- **Admin Panel**: `https://admin.yourdomain.com`
- **Nginx Status**: `http://YOUR_SERVER_IP:8080/nginx-health`

### Performance Monitoring

- **Grafana Dashboard**: `https://admin.yourdomain.com/grafana`
- **Prometheus Metrics**: `http://YOUR_SERVER_IP:9090`

---

## ✅ Production Checklist

Before going live, ensure:

- [ ] All environment variables are configured with production values
- [ ] SSL certificates are installed and valid
- [ ] DNS records are configured correctly
- [ ] Database is initialized and migrated
- [ ] Backups are configured and tested
- [ ] Monitoring is set up and functional
- [ ] Security hardening is complete
- [ ] Load testing has been performed
- [ ] Error tracking is configured
- [ ] Documentation is updated

**🎉 Congratulations! Your Hitch Platform is now running in production!**

---

*For technical support or questions, please refer to the project documentation or contact the development team.*