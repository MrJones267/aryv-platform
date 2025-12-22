# 📋 GitHub Repository Setup for Railway Deployment

## Quick Setup Steps

### 1. Create GitHub Repository
1. Go to [github.com](https://github.com)
2. Click "+" → "New repository"
3. Name: `aryv-platform`
4. Description: "ARYV ride-sharing platform with courier services"
5. Set to **Public** (for free Railway deployment)
6. Don't initialize with README (we already have code)
7. Click "Create repository"

### 2. Push Code to GitHub
Copy and run these commands in your terminal:

```bash
# Add GitHub remote (replace YOUR_USERNAME with your GitHub username)
git remote add origin https://github.com/YOUR_USERNAME/aryv-platform.git

# Push code to GitHub
git branch -M main
git push -u origin main
```

### 3. Deploy with Railway Web Dashboard

1. **Go to Railway**: [railway.app](https://railway.app)
2. **Login/Signup**: Create account or login
3. **New Project**: Click "Start a New Project"
4. **GitHub Integration**: 
   - Select "Deploy from GitHub repo"
   - Connect your GitHub account
   - Select your `aryv-platform` repository
5. **Auto-Deploy**: Railway will automatically detect and deploy

### 4. Add Database
1. In Railway dashboard, click "Add Service"
2. Select "Database" → "PostgreSQL" 
3. Wait 2-3 minutes for provisioning

### 5. Environment Variables
Add these in Railway dashboard under "Variables":

```
NODE_ENV=production
PORT=8080
JWT_SECRET=your_32_char_secure_secret_here
CORS_ORIGIN=https://aryv-app.com,https://www.aryv-app.com,https://admin.aryv-app.com
CLOUDFLARE_R2_ACCESS_KEY=5e32a2e7d785343862a4b4cff13da063
CLOUDFLARE_R2_SECRET_KEY=3936145fcbd784c92967a44dc045c496d10b536c2709b8dad11ba98e5d847eb2
CLOUDFLARE_R2_BUCKET=aryv-app-platform-bucket
CLOUDFLARE_R2_ENDPOINT=https://22a16693828a3dbfd6bdf769e417be8c.r2.cloudflarestorage.com
STORAGE_PROVIDER=r2
FEATURE_AI_MATCHING=true
FEATURE_REAL_TIME_CHAT=true
FEATURE_COURIER_SERVICE=true
```

### 6. Test Deployment
After deployment completes (~3-5 minutes):
1. Railway will provide a URL like: `https://aryv-backend-production-xxxx.up.railway.app`
2. Test health check: Visit `YOUR_URL/health`
3. Should return: `{"success": true, "message": "ARYV Backend API..."}`

---

## Alternative: NPM Railway Install (if you have NPM permissions)

If you can install packages locally:

```bash
# Install Railway CLI locally
npm install -g @railway/cli

# Then run deployment
railway login
railway init
railway up
```

---

## 🎯 Expected Result

After successful deployment:
- ✅ Backend API running on Railway
- ✅ Database connected and initialized  
- ✅ Health check responding
- ✅ All API endpoints functional
- ✅ Ready for admin panel and mobile app connection

The web dashboard approach is actually easier than CLI for first-time deployment!