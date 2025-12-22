#!/bin/bash
# ARYV Platform - Railway Deployment Script
# Deploys backend to Railway platform with complete configuration

set -e  # Exit on any error

echo "🚀 ARYV Platform - Railway Deployment"
echo "====================================="

# Check if Railway CLI is available
if ! command -v railway &> /dev/null; then
    echo "⚠️  Railway CLI not found. Installing..."
    
    # Try to install Railway CLI
    if curl -fsSL https://railway.app/install.sh | sh; then
        echo "✅ Railway CLI installed successfully"
    else
        echo "❌ Failed to install Railway CLI automatically"
        echo "📋 Manual installation required:"
        echo "   1. Visit: https://railway.app"
        echo "   2. Install CLI: curl -fsSL https://railway.app/install.sh | sh"
        echo "   3. Login: railway login"
        echo "   4. Re-run this script"
        exit 1
    fi
fi

# Check if user is logged in
if ! railway whoami &> /dev/null; then
    echo "🔐 Railway login required..."
    railway login
fi

echo "👤 Current Railway user:"
railway whoami

# Initialize Railway project if needed
echo "🏗️  Setting up Railway project..."
if [ ! -f .railway/config.json ]; then
    echo "Creating new Railway project..."
    railway init --name "aryv-backend" --template empty
else
    echo "Railway project already exists"
fi

# Environment variable setup
echo "🔧 Setting up environment variables..."

# Core environment variables
railway variables set NODE_ENV=production
railway variables set PORT=8080

# JWT Configuration - Generate secure secrets if needed
JWT_SECRET=${JWT_SECRET:-$(openssl rand -hex 32)}
ADMIN_JWT_SECRET=${ADMIN_JWT_SECRET:-$(openssl rand -hex 32)}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET:-$(openssl rand -hex 32)}

railway variables set JWT_SECRET="$JWT_SECRET"
railway variables set JWT_EXPIRES_IN="24h"
railway variables set ADMIN_JWT_SECRET="$ADMIN_JWT_SECRET"
railway variables set ADMIN_JWT_EXPIRES_IN="8h"
railway variables set JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET"
railway variables set JWT_REFRESH_EXPIRES_IN="7d"

# Database Configuration
echo "📊 Setting up database..."
# Railway will provide PostgreSQL instance
railway add postgresql

# Wait for database to be ready
sleep 5

# Get database connection details
DB_URL=$(railway variables get DATABASE_URL || echo "")
if [ -z "$DB_URL" ]; then
    echo "⚠️  Database URL not found. Using environment variables..."
    railway variables set POSTGRES_HOST="localhost"
    railway variables set POSTGRES_PORT="5432"
    railway variables set POSTGRES_DB="aryv_production"
    railway variables set POSTGRES_USER="aryv_user"
    railway variables set POSTGRES_PASSWORD=$(openssl rand -hex 16)
else
    echo "✅ Database URL configured: ${DB_URL:0:20}..."
fi

# CORS Configuration
railway variables set CORS_ORIGIN="https://aryv-app.com,https://www.aryv-app.com,https://admin.aryv-app.com"

# Security Configuration
railway variables set RATE_LIMIT_WINDOW_MS="900000"
railway variables set RATE_LIMIT_MAX_REQUESTS="1000"
railway variables set HELMET_ENABLED="true"

# Cloudflare R2 Configuration
railway variables set CLOUDFLARE_R2_ACCESS_KEY="5e32a2e7d785343862a4b4cff13da063"
railway variables set CLOUDFLARE_R2_SECRET_KEY="3936145fcbd784c92967a44dc045c496d10b536c2709b8dad11ba98e5d847eb2"
railway variables set CLOUDFLARE_R2_BUCKET="aryv-app-platform-bucket"
railway variables set CLOUDFLARE_ACCOUNT_ID="22a16693828a3dbfd6bdf769e417be8c"
railway variables set CLOUDFLARE_R2_ENDPOINT="https://22a16693828a3dbfd6bdf769e417be8c.r2.cloudflarestorage.com"
railway variables set CLOUDFLARE_R2_PUBLIC_URL="https://uploads.aryv-app.com"
railway variables set STORAGE_PROVIDER="r2"

# Feature Flags
railway variables set FEATURE_AI_MATCHING="true"
railway variables set FEATURE_REAL_TIME_CHAT="true"
railway variables set FEATURE_PUSH_NOTIFICATIONS="true"
railway variables set FEATURE_COURIER_SERVICE="true"

# Logging
railway variables set LOG_LEVEL="info"
railway variables set HEALTH_CHECK_ENABLED="true"

echo "✅ Environment variables configured"

# Prepare deployment
echo "📦 Preparing deployment..."

# Ensure railway.json is properly configured
if [ ! -f railway.json ]; then
    echo "Creating railway.json configuration..."
    cat > railway.json << EOF
{
  "\$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "cd backend && npm ci",
    "watchPatterns": ["backend/**/*.js", "backend/**/*.ts", "**/*.json"]
  },
  "deploy": {
    "startCommand": "cd backend && node server-simple.js",
    "healthcheckPath": "/health",
    "healthcheckTimeout": 30,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  },
  "environments": {
    "production": {
      "variables": {
        "NODE_ENV": "production"
      }
    }
  }
}
EOF
fi

# Git setup and deployment
echo "🔧 Setting up Git repository..."
if [ ! -d .git ]; then
    git init
    git add .
    git commit -m "Initial commit - ARYV Platform

🎯 Complete ARYV platform codebase ready for production deployment
- ✅ Mobile app with Google Auth integration  
- ✅ Backend API with PostgreSQL + PostGIS
- ✅ Admin panel with real-time features
- ✅ Courier service with blockchain integration
- ✅ Cloudflare R2 storage configuration
- ✅ Complete branding migration from Hitch to ARYV
- ✅ Production-ready Docker containers
- ✅ Comprehensive testing suite
- ✅ AI/ML services foundation
- ✅ WebSocket real-time features

🚀 Generated with Claude Code (https://claude.ai/code)

Co-Authored-By: Claude <noreply@anthropic.com>"
else
    echo "Git repository already initialized"
    # Add all changes
    git add .
    git status
    echo "📋 Git status shown above. Commit changes if needed."
fi

# Deploy to Railway
echo "🚀 Deploying to Railway..."
railway up

# Wait for deployment
echo "⏳ Waiting for deployment to complete..."
sleep 10

# Get deployment URL
DEPLOYMENT_URL=$(railway url)
echo "🌐 Deployment URL: $DEPLOYMENT_URL"

# Test deployment
echo "🧪 Testing deployment..."
if curl -f "$DEPLOYMENT_URL/health" > /dev/null 2>&1; then
    echo "✅ Health check passed!"
    echo "🎉 ARYV Backend successfully deployed to Railway!"
    echo ""
    echo "📋 Next Steps:"
    echo "   1. Update DNS: api.aryv-app.com → $DEPLOYMENT_URL"
    echo "   2. Test API endpoints"
    echo "   3. Run database migrations if needed"
    echo "   4. Deploy admin panel to Cloudflare Pages"
    echo "   5. Update mobile app API configuration"
    echo ""
    echo "🔗 Deployment Details:"
    echo "   Backend URL: $DEPLOYMENT_URL"
    echo "   Health Check: $DEPLOYMENT_URL/health"
    echo "   API Base: $DEPLOYMENT_URL/api"
    echo ""
    echo "✅ Railway deployment completed successfully!"
else
    echo "❌ Health check failed. Check deployment logs:"
    echo "   railway logs"
    exit 1
fi