#!/bin/bash

# Generate secure production secrets for Hitch platform
# This script creates secure random passwords and JWT secrets

echo "🔐 Generating Production Secrets for Hitch Platform..."
echo "=================================================="

# Function to generate secure random string
generate_secret() {
    local length=${1:-64}
    openssl rand -base64 $length | tr -d "=+/" | cut -c1-$length
}

# Generate database password
DB_PASSWORD=$(generate_secret 32)
REDIS_PASSWORD=$(generate_secret 32)

# Generate JWT secrets (need to be long for security)
JWT_SECRET=$(generate_secret 64)
JWT_REFRESH_SECRET=$(generate_secret 64)
ADMIN_JWT_SECRET=$(generate_secret 64)
QR_CODE_SECRET=$(generate_secret 64)
SESSION_SECRET=$(generate_secret 64)

echo ""
echo "🔑 Generated Secure Secrets:"
echo "=============================="
echo ""
echo "📊 Database Secrets:"
echo "POSTGRES_PASSWORD=$DB_PASSWORD"
echo "REDIS_PASSWORD=$REDIS_PASSWORD"
echo ""
echo "🔐 JWT Secrets:"
echo "JWT_SECRET=$JWT_SECRET"
echo "JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET"
echo "ADMIN_JWT_SECRET=$ADMIN_JWT_SECRET"
echo ""
echo "📦 Application Secrets:"
echo "QR_CODE_SECRET=$QR_CODE_SECRET"
echo "SESSION_SECRET=$SESSION_SECRET"
echo ""

# Create production environment file
cat > ../backend/.env.production.secure << EOF
# Hitch Backend - PRODUCTION Environment Configuration
# Generated on: $(date)
# SECURITY WARNING: Keep these secrets safe and never commit to version control

# Environment
NODE_ENV=production
PORT=3001

# Database Configuration (PostgreSQL + PostGIS)
POSTGRES_HOST=hitch-postgres
POSTGRES_PORT=5432
POSTGRES_DB=hitch_production
POSTGRES_USER=hitch_user
POSTGRES_PASSWORD=$DB_PASSWORD

# Redis Configuration
REDIS_HOST=hitch-redis
REDIS_PORT=6379
REDIS_PASSWORD=$REDIS_PASSWORD

# JWT Configuration
JWT_SECRET=$JWT_SECRET
JWT_EXPIRES_IN=24h
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
JWT_REFRESH_EXPIRES_IN=7d

# Admin JWT (separate secret for admin panel)
ADMIN_JWT_SECRET=$ADMIN_JWT_SECRET
ADMIN_JWT_EXPIRES_IN=8h

# CORS Configuration
CORS_ORIGIN=https://yourdomain.com,https://admin.yourdomain.com

# Security & Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
HELMET_ENABLED=true

# External Services (REPLACE WITH YOUR ACTUAL KEYS)
STRIPE_SECRET_KEY=sk_live_YOUR_STRIPE_SECRET_KEY
STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_STRIPE_PUBLISHABLE_KEY
STRIPE_WEBHOOK_SECRET=whsec_YOUR_WEBHOOK_SECRET

GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY

# Email Service (SendGrid/Mailgun)
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=YOUR_SENDGRID_API_KEY

# File Storage (AWS S3)
AWS_ACCESS_KEY_ID=YOUR_AWS_ACCESS_KEY
AWS_SECRET_ACCESS_KEY=YOUR_AWS_SECRET_KEY
AWS_S3_BUCKET=hitch-production-uploads
AWS_REGION=us-east-1

# Monitoring & Logging
LOG_LEVEL=info
SENTRY_DSN=YOUR_SENTRY_DSN

# Courier Service Settings
COURIER_PLATFORM_FEE_PERCENT=10
COURIER_AUTO_RELEASE_HOURS=24
COURIER_MAX_PACKAGE_WEIGHT=50
QR_CODE_SECRET=$QR_CODE_SECRET

# Session Configuration
SESSION_SECRET=$SESSION_SECRET

# Feature Flags
FEATURE_AI_MATCHING=true
FEATURE_REAL_TIME_CHAT=true
FEATURE_PUSH_NOTIFICATIONS=true
FEATURE_COURIER_SERVICE=true

# Health Check
HEALTH_CHECK_ENABLED=true
EOF

# Create admin panel production environment
cat > ../admin-panel/.env.production.secure << EOF
# Hitch Admin Panel - PRODUCTION Environment Configuration
# Generated on: $(date)

# API Configuration
VITE_API_BASE_URL=https://api.yourdomain.com
VITE_SOCKET_URL=https://api.yourdomain.com

# Environment
VITE_APP_ENV=production
VITE_DEBUG=false

# Application Info
VITE_APP_NAME=Hitch Admin
VITE_APP_VERSION=1.0.0

# Analytics (Optional - REPLACE WITH YOUR IDs)
VITE_GOOGLE_ANALYTICS_ID=YOUR_GA_ID
VITE_SENTRY_DSN=YOUR_SENTRY_DSN

# Build Configuration
GENERATE_SOURCEMAP=false
EOF

# Create mobile app production environment
cat > ../mobile-app/.env.production.secure << EOF
# Hitch Mobile App - PRODUCTION Environment Configuration
# Generated on: $(date)

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
ENABLE_DEBUG_MODE=false

# Third-party Services (REPLACE WITH YOUR KEYS)
GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY
STRIPE_PUBLISHABLE_KEY=pk_live_YOUR_STRIPE_PUBLISHABLE_KEY
SENTRY_DSN=YOUR_SENTRY_DSN

# Build Configuration
FLIPPER_ENABLED=false
HERMES_ENABLED=true
EOF

echo ""
echo "📁 Files Created:"
echo "=================="
echo "✅ backend/.env.production.secure"
echo "✅ admin-panel/.env.production.secure" 
echo "✅ mobile-app/.env.production.secure"
echo ""
echo "🔒 Security Notes:"
echo "=================="
echo "1. Copy these files to .env in each directory for production"
echo "2. Replace placeholder values (YOUR_*) with actual service keys"
echo "3. Never commit these files to version control"
echo "4. Store secrets securely (password manager, vault service)"
echo "5. Rotate secrets regularly for maximum security"
echo ""
echo "📋 Next Steps:"
echo "=============="
echo "1. Get your production server ready"
echo "2. Purchase and configure your domain"
echo "3. Sign up for external services (Stripe, SendGrid, etc.)"
echo "4. Replace placeholder values with real API keys"
echo "5. Run deployment script"
echo ""
echo "🎯 Ready for production deployment!"