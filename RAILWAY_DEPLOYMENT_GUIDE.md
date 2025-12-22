# 🚀 ARYV Platform - Railway Deployment Guide

## Overview
This guide provides step-by-step instructions for deploying the ARYV backend to Railway platform.

## Prerequisites

1. **Railway Account**: Create account at [railway.app](https://railway.app)
2. **Git Repository**: Code must be in a Git repository
3. **Environment Variables**: Production secrets ready
4. **Database**: PostgreSQL instance (Railway provides this)

---

## Option 1: CLI Deployment (Recommended)

### Step 1: Install Railway CLI
```bash
# Install Railway CLI
curl -fsSL https://railway.app/install.sh | sh

# Login to Railway
railway login
```

### Step 2: Run Deployment Script
```bash
# Execute the automated deployment script
./deploy-railway.sh
```

The script will:
- ✅ Set up Railway project
- ✅ Configure environment variables  
- ✅ Add PostgreSQL database
- ✅ Deploy the backend
- ✅ Test health check

---

## Option 2: Web Dashboard Deployment

If CLI installation fails, use Railway's web interface:

### Step 1: Create Railway Project
1. Go to [railway.app](https://railway.app)
2. Click "Start a New Project"
3. Choose "Deploy from GitHub repo"
4. Connect your GitHub account
5. Select this repository

### Step 2: Configure Build Settings
1. **Root Directory**: Leave empty (uses root)
2. **Build Command**: `cd backend && npm ci`
3. **Start Command**: `cd backend && node server-simple.js`
4. **Port**: `8080` (or leave empty for auto-detect)

### Step 3: Add PostgreSQL Database
1. In Railway dashboard, click "Add Service"
2. Choose "Database" → "PostgreSQL"
3. Wait for provisioning (~2 minutes)

### Step 4: Configure Environment Variables
Add these variables in Railway dashboard:

#### Core Configuration
```env
NODE_ENV=production
PORT=8080
```

#### JWT Configuration (Generate secure 32-byte secrets)
```env
JWT_SECRET=your_secure_jwt_secret_256_bits_minimum
JWT_EXPIRES_IN=24h
ADMIN_JWT_SECRET=your_admin_jwt_secret_256_bits_minimum
ADMIN_JWT_EXPIRES_IN=8h
JWT_REFRESH_SECRET=your_refresh_secret_256_bits_minimum
JWT_REFRESH_EXPIRES_IN=7d
```

#### Database Configuration
```env
# Railway automatically provides DATABASE_URL
# If needed, set these manually:
POSTGRES_HOST=railway_postgres_host
POSTGRES_PORT=5432
POSTGRES_DB=railway
POSTGRES_USER=postgres
POSTGRES_PASSWORD=railway_generated_password
```

#### CORS Configuration
```env
CORS_ORIGIN=https://aryv-app.com,https://www.aryv-app.com,https://admin.aryv-app.com
```

#### Security & Rate Limiting
```env
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000
HELMET_ENABLED=true
```

#### Cloudflare R2 Storage
```env
CLOUDFLARE_R2_ACCESS_KEY=5e32a2e7d785343862a4b4cff13da063
CLOUDFLARE_R2_SECRET_KEY=3936145fcbd784c92967a44dc045c496d10b536c2709b8dad11ba98e5d847eb2
CLOUDFLARE_R2_BUCKET=aryv-app-platform-bucket
CLOUDFLARE_ACCOUNT_ID=22a16693828a3dbfd6bdf769e417be8c
CLOUDFLARE_R2_ENDPOINT=https://22a16693828a3dbfd6bdf769e417be8c.r2.cloudflarestorage.com
CLOUDFLARE_R2_PUBLIC_URL=https://uploads.aryv-app.com
STORAGE_PROVIDER=r2
```

#### Feature Flags
```env
FEATURE_AI_MATCHING=true
FEATURE_REAL_TIME_CHAT=true
FEATURE_PUSH_NOTIFICATIONS=true
FEATURE_COURIER_SERVICE=true
```

#### Logging & Monitoring
```env
LOG_LEVEL=info
HEALTH_CHECK_ENABLED=true
```

---

## Step 5: Deploy
1. Click "Deploy" button in Railway dashboard
2. Monitor deployment logs
3. Wait for successful deployment (~3-5 minutes)

---

## Post-Deployment Verification

### 1. Health Check
Once deployed, Railway will provide a URL like: `https://aryv-backend-production-xxxx.up.railway.app`

Test the health endpoint:
```bash
curl https://your-railway-url/health
```

Expected response:
```json
{
  "success": true,
  "message": "ARYV Backend API with PostgreSQL",
  "timestamp": "2025-01-27T...",
  "database": "Connected"
}
```

### 2. API Endpoints Test
```bash
# Test auth endpoint
curl https://your-railway-url/api/auth/login -X POST \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}'

# Test users endpoint
curl https://your-railway-url/api/users
```

### 3. Database Connection Test
```bash
# Check if database tables exist
curl https://your-railway-url/api/users
# Should return empty array or existing users
```

---

## Database Setup

### Option A: Automatic Migration (Recommended)
The backend includes initialization logic that creates tables automatically on first run.

### Option B: Manual Migration
If automatic setup fails, run migrations manually:

1. Connect to Railway PostgreSQL:
```bash
# Get database credentials from Railway dashboard
psql $DATABASE_URL
```

2. Run initialization script:
```sql
-- Copy contents from backend/database/init.sql and execute
```

---

## Custom Domain Configuration

### 1. Railway Domain Setup
1. In Railway dashboard, go to "Settings" → "Domains"
2. Add custom domain: `api.aryv-app.com`
3. Follow verification steps

### 2. DNS Configuration
Add CNAME record to your DNS provider:
```
api.aryv-app.com → your-railway-deployment.up.railway.app
```

### 3. SSL Certificate
Railway automatically provisions SSL certificates for custom domains.

---

## Monitoring & Logging

### 1. Railway Dashboard
- **Metrics**: CPU, Memory, Network usage
- **Logs**: Real-time application logs
- **Deployments**: Deployment history and rollback

### 2. Health Monitoring
```bash
# Monitor health endpoint
watch -n 30 "curl -s https://api.aryv-app.com/health | jq"
```

### 3. Application Logs
```bash
# View logs (if Railway CLI installed)
railway logs --follow
```

---

## Troubleshooting

### 1. Deployment Fails
- Check build logs in Railway dashboard
- Verify `package.json` dependencies
- Ensure proper file paths in `railway.json`

### 2. Database Connection Issues
- Verify DATABASE_URL environment variable
- Check PostgreSQL service status
- Review connection logs

### 3. Health Check Fails
- Verify server starts on correct port
- Check environment variables
- Review application logs

### 4. CORS Errors
- Update CORS_ORIGIN environment variable
- Include all required domains
- Check HTTPS vs HTTP protocols

---

## Environment Variables Reference

### Required Variables
- `NODE_ENV=production`
- `JWT_SECRET` (32+ characters)
- `DATABASE_URL` (auto-provided by Railway)

### Optional but Recommended
- `ADMIN_JWT_SECRET`
- `JWT_REFRESH_SECRET`
- `CORS_ORIGIN`
- `RATE_LIMIT_MAX_REQUESTS`

### External Services
- `CLOUDFLARE_R2_*` (for file storage)
- `STRIPE_*` (for payments)
- `GOOGLE_MAPS_API_KEY` (for location)
- `SMTP_*` (for emails)

---

## Security Checklist

- [ ] Strong JWT secrets (32+ bytes)
- [ ] CORS properly configured
- [ ] Rate limiting enabled
- [ ] HTTPS enforced
- [ ] Database password secure
- [ ] API keys rotated from development
- [ ] Environment variables not logged

---

## Next Steps After Deployment

1. **DNS Configuration**: Point `api.aryv-app.com` to Railway URL
2. **Admin Panel**: Deploy admin panel to Cloudflare Pages
3. **Mobile App**: Update API URLs to production endpoint
4. **Testing**: Run integration tests against production
5. **Monitoring**: Set up alerts and monitoring

---

## Support & Resources

- **Railway Documentation**: [docs.railway.app](https://docs.railway.app)
- **ARYV Platform Docs**: See `CLAUDE.md` for development guidelines
- **Deployment Logs**: Available in Railway dashboard
- **Health Status**: Monitor `/health` endpoint

---

**Status**: Ready for deployment  
**Last Updated**: 2025-01-27  
**Platform**: Railway  
**Environment**: Production