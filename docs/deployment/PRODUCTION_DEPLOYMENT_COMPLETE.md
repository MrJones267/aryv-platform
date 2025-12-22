# 🚀 Hitch Platform - Complete Production Deployment Guide

**Status:** Ready for Production Deployment  
**Date:** January 27, 2025  
**Objective:** Deploy Hitch platform to live production server

---

## 📋 **PRODUCTION DEPLOYMENT CHECKLIST**

### **PHASE 1: PRE-DEPLOYMENT REQUIREMENTS**

#### **1.1 Server Requirements**
- [ ] **Cloud Server**: AWS EC2, Google Cloud, DigitalOcean, or dedicated server
- [ ] **OS**: Ubuntu 20.04 LTS or 22.04 LTS (recommended)
- [ ] **Resources**: 
  - CPU: 4+ cores
  - RAM: 8+ GB
  - Storage: 100+ GB SSD
  - Network: 1+ Gbps connection
- [ ] **IP Address**: Static public IP address
- [ ] **Root Access**: SSH access with sudo privileges

#### **1.2 Domain Requirements**
- [ ] **Domain Name**: Purchase from registrar (e.g., namecheap.com, godaddy.com)
- [ ] **DNS Access**: Ability to configure DNS records
- [ ] **Subdomains Needed**:
  - `yourdomain.com` (main website)
  - `api.yourdomain.com` (backend API)
  - `admin.yourdomain.com` (admin panel)

#### **1.3 External Services**
- [ ] **SSL Certificates**: Let's Encrypt (free) or commercial
- [ ] **Email Service**: SendGrid, Mailgun, or SMTP provider
- [ ] **Payment Processing**: Stripe account (live keys)
- [ ] **Maps Service**: Google Maps API key
- [ ] **File Storage**: AWS S3 bucket or similar
- [ ] **Monitoring**: Sentry for error tracking (optional)

---

## 🔧 **PHASE 2: SERVER SETUP**

### **2.1 Initial Server Configuration**

#### **Connect to Server**
```bash
# Connect via SSH
ssh root@YOUR_SERVER_IP
# or
ssh username@YOUR_SERVER_IP
```

#### **Update System**
```bash
# Update package lists
apt update && apt upgrade -y

# Install essential packages
apt install -y curl wget git htop nginx certbot python3-certbot-nginx
```

#### **Create Application User**
```bash
# Create dedicated user for the application
adduser hitch
usermod -aG sudo hitch
usermod -aG docker hitch

# Switch to application user
su - hitch
```

### **2.2 Install Docker**

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker $USER

# Verify installation
docker --version
docker-compose --version
```

### **2.3 Clone and Setup Project**

```bash
# Clone your project
git clone https://github.com/your-username/hitch-platform.git
cd hitch-platform

# Set proper permissions
sudo chown -R hitch:hitch /home/hitch/hitch-platform
chmod +x scripts/*.sh
```

---

## 🌐 **PHASE 3: DOMAIN AND DNS SETUP**

### **3.1 Configure Domain Names**

Run the interactive domain configuration:
```bash
./scripts/configure-domains.sh
```

**Input your actual domains:**
- Main domain: `yourdomain.com`
- API domain: `api.yourdomain.com`
- Admin domain: `admin.yourdomain.com`

### **3.2 DNS Configuration**

Configure these DNS records with your domain registrar:

#### **A Records**
```
yourdomain.com      A    YOUR_SERVER_IP
api.yourdomain.com  A    YOUR_SERVER_IP
admin.yourdomain.com A   YOUR_SERVER_IP
```

#### **Optional CNAME Records**
```
www.yourdomain.com  CNAME yourdomain.com
```

### **3.3 Verify DNS Propagation**

```bash
# Check DNS resolution
dig yourdomain.com
dig api.yourdomain.com
dig admin.yourdomain.com

# Test HTTP connectivity (before SSL)
curl -I http://api.yourdomain.com
curl -I http://admin.yourdomain.com
```

---

## 🔐 **PHASE 4: SSL CERTIFICATE SETUP**

### **4.1 Generate SSL Certificates**

```bash
# Run SSL setup script
./scripts/setup-ssl-certificates.sh api.yourdomain.com admin.yourdomain.com

# Choose option 1 for Let's Encrypt (recommended for production)
```

### **4.2 Manual Let's Encrypt Setup (if script fails)**

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Generate certificates
sudo certbot --nginx -d api.yourdomain.com -d admin.yourdomain.com

# Test auto-renewal
sudo certbot renew --dry-run
```

### **4.3 Setup Auto-Renewal**

```bash
# Add cron job for automatic renewal
sudo crontab -e

# Add this line:
0 12 * * * /usr/bin/certbot renew --quiet
```

---

## ⚙️ **PHASE 5: PRODUCTION ENVIRONMENT CONFIGURATION**

### **5.1 Backend Environment Variables**

Create `backend/.env` with production values:

```bash
# Copy template
cp backend/.env.production backend/.env

# Edit with your production values
nano backend/.env
```

**Required Production Values:**
```bash
# Environment
NODE_ENV=production
PORT=3001

# Database
POSTGRES_HOST=hitch-postgres
POSTGRES_DB=hitch_production
POSTGRES_USER=hitch_user
POSTGRES_PASSWORD=YOUR_SECURE_DB_PASSWORD_HERE

# Redis
REDIS_HOST=hitch-redis
REDIS_PASSWORD=YOUR_SECURE_REDIS_PASSWORD_HERE

# JWT Secrets (generate strong random strings)
JWT_SECRET=YOUR_SUPER_SECURE_JWT_SECRET_256_BITS_MIN
ADMIN_JWT_SECRET=YOUR_ADMIN_JWT_SECRET_256_BITS_MIN

# CORS
CORS_ORIGIN=https://yourdomain.com,https://admin.yourdomain.com

# External Services
STRIPE_SECRET_KEY=sk_live_YOUR_LIVE_STRIPE_SECRET_KEY
GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY
SMTP_PASS=YOUR_EMAIL_SERVICE_API_KEY
AWS_ACCESS_KEY_ID=YOUR_AWS_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=YOUR_AWS_SECRET_KEY
```

### **5.2 Admin Panel Environment Variables**

Create `admin-panel/.env`:
```bash
VITE_API_BASE_URL=https://api.yourdomain.com
VITE_SOCKET_URL=https://api.yourdomain.com
VITE_APP_ENV=production
VITE_DEBUG=false
```

### **5.3 Mobile App Environment Variables**

Create `mobile-app/.env`:
```bash
API_BASE_URL=https://api.yourdomain.com
SOCKET_URL=https://api.yourdomain.com
GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY
STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_LIVE_STRIPE_PUBLISHABLE_KEY
```

---

## 🚀 **PHASE 6: PRODUCTION DEPLOYMENT**

### **6.1 Deploy Platform**

```bash
# Run complete deployment
./scripts/deploy-production.sh

# Monitor deployment progress
./scripts/deploy-production.sh logs
```

### **6.2 Verify Deployment**

```bash
# Check service status
./scripts/deploy-production.sh status

# Test endpoints
curl https://api.yourdomain.com/health
curl https://admin.yourdomain.com
```

### **6.3 Configure Nginx (if manual setup needed)**

Edit `/etc/nginx/sites-available/hitch`:

```nginx
server {
    listen 80;
    server_name api.yourdomain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name api.yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 443 ssl http2;
    server_name admin.yourdomain.com;
    
    ssl_certificate /etc/letsencrypt/live/admin.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/admin.yourdomain.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/hitch /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 📊 **PHASE 7: MONITORING AND MAINTENANCE**

### **7.1 Setup Monitoring**

```bash
# Create monitoring script
./scripts/monitoring-setup.sh

# Setup log rotation
sudo nano /etc/logrotate.d/hitch
```

### **7.2 Backup Configuration**

```bash
# Create automated backups
./scripts/backup.sh

# Schedule daily backups
crontab -e
# Add: 0 2 * * * /home/hitch/hitch-platform/scripts/backup.sh
```

### **7.3 Security Hardening**

```bash
# Setup firewall
sudo ufw allow ssh
sudo ufw allow http
sudo ufw allow https
sudo ufw enable

# Setup fail2ban
sudo apt install fail2ban
sudo systemctl enable fail2ban
```

---

## ✅ **PHASE 8: POST-DEPLOYMENT VERIFICATION**

### **8.1 Test All Services**

```bash
# Health checks
curl https://api.yourdomain.com/health
curl https://admin.yourdomain.com

# Test authentication
curl -X POST https://api.yourdomain.com/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hitch.com","password":"admin123"}'

# Test SSL certificates
openssl s_client -connect api.yourdomain.com:443 -servername api.yourdomain.com
```

### **8.2 Performance Testing**

```bash
# Load testing (install apache2-utils)
sudo apt install apache2-utils

# Test API performance
ab -n 100 -c 10 https://api.yourdomain.com/health
```

### **8.3 Update Mobile App Configuration**

Update your mobile app to point to production:
```bash
# Update mobile-app/.env
API_BASE_URL=https://api.yourdomain.com
SOCKET_URL=https://api.yourdomain.com
```

---

## 🎉 **SUCCESS INDICATORS**

### **✅ Production Deployment Complete When:**
- [ ] All services running without errors
- [ ] HTTPS working for all domains
- [ ] Backend API responding at https://api.yourdomain.com
- [ ] Admin panel accessible at https://admin.yourdomain.com
- [ ] Database and Redis connected
- [ ] SSL certificates valid and auto-renewing
- [ ] Monitoring and backups configured
- [ ] Mobile app connecting to production API

---

## 🚨 **TROUBLESHOOTING GUIDE**

### **Common Issues:**

#### **DNS Not Resolving**
```bash
# Check DNS propagation
dig yourdomain.com
nslookup api.yourdomain.com

# Wait 24-48 hours for full propagation
```

#### **SSL Certificate Issues**
```bash
# Check certificate
sudo certbot certificates

# Renew manually
sudo certbot renew --force-renewal
```

#### **Service Not Starting**
```bash
# Check logs
docker-compose -f docker-compose.prod.yml logs

# Restart services
docker-compose -f docker-compose.prod.yml restart
```

#### **Database Connection Issues**
```bash
# Check database
docker-compose -f docker-compose.prod.yml exec hitch-postgres pg_isready

# Check environment variables
cat backend/.env
```

---

## 📞 **PRODUCTION SUPPORT COMMANDS**

```bash
# Service management
./scripts/deploy-production.sh status
./scripts/deploy-production.sh restart
./scripts/deploy-production.sh logs

# Backup and restore
./scripts/backup.sh
./scripts/deploy-production.sh rollback

# Monitoring
./scripts/deploy-production.sh health-check
tail -f logs/deployment.log
```

---

**🎯 NEXT: Let's start with Phase 1 - do you have a server and domain ready, or do you need help setting those up first?**