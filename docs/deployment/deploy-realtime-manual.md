# 🚀 Manual Railway Deployment Guide - Hitch Real-time Service

## IMMEDIATE DEPLOYMENT STEPS (15 minutes)

### Step 1: Railway Account Setup (2 minutes)
1. Go to **[railway.app](https://railway.app)**
2. **Sign up/Login** with GitHub account
3. Click **"New Project"**

### Step 2: Connect Repository (3 minutes)
1. Select **"Deploy from GitHub repo"**
2. Authorize Railway to access your repositories
3. Select repository: **`Hitch`** (or your fork)
4. Railway will scan for deployment files

### Step 3: Configure Service (5 minutes)
1. Railway will detect `Dockerfile.realtime.prod`
2. **Service Name**: `hitch-realtime-production`
3. **Build Command**: Docker will build automatically
4. **Start Command**: `node realtime-production-server.js`
5. **Port**: `3002`

### Step 4: Set Environment Variables (3 minutes)
In Railway dashboard, go to **Variables** tab and add:

```bash
NODE_ENV=production
PORT=3002
JWT_SECRET=hitch-jwt-secret-2025-production-v1
REDIS_URL=redis://localhost:6379
DATABASE_URL=postgresql://localhost:5432/hitch
```

### Step 5: Deploy (2 minutes)
1. Click **"Deploy"**
2. Railway will:
   - Build Docker container
   - Assign public HTTPS URL
   - Start the service
   - Provide monitoring dashboard

### Step 6: Get Production URL
Railway will provide a URL like:
```
https://hitch-realtime-production-XXXXX.up.railway.app
```

## 📱 Update Mobile App with Production URL

**Current mobile app configuration** (already updated):
```typescript
// mobile-app/src/services/RealTimeService.ts
return 'https://hitch-realtime-production.up.railway.app';
```

**If Railway provides different URL**, update to:
```typescript
return 'https://YOUR-ACTUAL-RAILWAY-URL.up.railway.app';
```

## ✅ Verification Steps

### 1. Health Check
```bash
curl https://YOUR-RAILWAY-URL.up.railway.app/health
# Expected: {"status":"healthy","timestamp":"..."}
```

### 2. Socket.io Connection Test
```bash
curl https://YOUR-RAILWAY-URL.up.railway.app/socket.io/
# Expected: Socket.io response
```

### 3. Mobile App Test
1. Build and run mobile app
2. Check logs for successful Socket.io connection
3. Test real-time features (if any are implemented)

## 🎯 Success Criteria

- [ ] Service deployed and healthy on Railway
- [ ] HTTPS endpoint responding correctly
- [ ] Health check returns 200 status
- [ ] Socket.io endpoint accessible
- [ ] Mobile app can connect to production service
- [ ] No critical errors in Railway logs

## 📊 Expected Performance

- **Deployment Time**: 5-10 minutes
- **Cold Start**: < 2 seconds
- **Response Time**: < 200ms
- **Concurrent Connections**: 100+ supported
- **Uptime**: 99.9% (Railway SLA)

## 🔧 Troubleshooting

### If Deployment Fails:
1. Check Railway build logs
2. Verify `Dockerfile.realtime.prod` exists
3. Ensure `realtime-production-server.js` is in root directory

### If Health Check Fails:
1. Check environment variables are set
2. Verify PORT=3002 is configured
3. Check Railway service logs

### If Mobile App Can't Connect:
1. Verify Railway URL in mobile app code
2. Check CORS configuration in server
3. Test with curl first

## 🚀 Post-Deployment

Once real-time service is live:

1. **Test core features**: location updates, chat, notifications
2. **Monitor performance**: Railway provides built-in metrics
3. **Prepare backend deployment**: Fix remaining TypeScript issues
4. **Scale if needed**: Railway auto-scales based on usage

## 💰 Railway Pricing

- **Starter**: $5/month (suitable for initial deployment)
- **Pro**: $20/month (recommended for production)
- **Database**: Additional cost if using Railway PostgreSQL

## 🎖️ Expected Result

**Live real-time service** accessible globally via HTTPS, ready for mobile app integration and user testing.

---

**Status**: 🎯 **READY FOR MANUAL DEPLOYMENT**  
**Timeline**: 15 minutes to live production service  
**Next**: Test mobile app with production real-time server 🚀