# ARYV Platform - Cloudflare Deployment Guide

## 🌐 Domain: aryv-app.com

This guide covers deploying the complete ARYV platform to Cloudflare with your secured domain.

## 📋 Prerequisites

- [x] Domain `aryv-app.com` secured and managed by Cloudflare
- [x] Mobile app updated to use production API endpoints
- [x] Backend configured for production deployment
- [x] Admin panel ready for static hosting

## 🎯 Deployment Architecture

```
aryv-app.com                    → Main landing page
www.aryv-app.com               → Main website  
admin.aryv-app.com             → Admin panel
api.aryv-app.com               → Backend API
```

## 🚀 Step 1: Cloudflare DNS Setup

In your Cloudflare dashboard for `aryv-app.com`:

### DNS Records
```
Type    Name    Content                 Proxy Status
A       @       192.0.2.1              🟠 Proxied
CNAME   www     aryv-app.com           🟠 Proxied  
CNAME   admin   aryv-app.com           🟠 Proxied
CNAME   api     aryv-app.com           🟠 Proxied
```

### SSL/TLS Settings
- **SSL/TLS encryption mode**: Full (strict)
- **Always Use HTTPS**: ON
- **Automatic HTTPS Rewrites**: ON

## 🏗️ Step 2: Deploy Backend API

### Option A: Cloudflare Workers (Recommended)
1. Install Wrangler CLI: `npm install -g wrangler`
2. Login: `wrangler login`
3. Deploy: `wrangler publish --name aryv-api`

### Option B: Cloudflare Pages Functions
1. Go to Cloudflare Pages dashboard
2. Create new project: "aryv-api"
3. Connect to Git repository
4. Build settings:
   - Framework: None
   - Build command: `npm run build`
   - Output directory: `dist`

## 🎨 Step 3: Deploy Admin Panel

1. Build admin panel:
   ```bash
   cd admin-panel
   npm run build
   ```

2. Deploy to Cloudflare Pages:
   - Go to Cloudflare Pages
   - Create project: "aryv-admin"
   - Upload `admin-panel/build` folder
   - Custom domain: `admin.aryv-app.com`

## 📱 Step 4: Mobile App Configuration

✅ **Already Updated!** Mobile app now uses:
- **API Base URL**: `https://api.aryv-app.com/api`
- **Authentication**: `https://api.aryv-app.com/api/auth/login`
- **All endpoints**: Production-ready

## 🔧 Step 5: Environment Configuration

Update production environment variables in Cloudflare:

### Required Environment Variables
```env
NODE_ENV=production
JWT_SECRET=your-secure-jwt-secret-256-bits
DATABASE_URL=your-production-database-url
CORS_ORIGIN=https://aryv-app.com,https://www.aryv-app.com,https://admin.aryv-app.com
```

## 🧪 Step 6: Testing

### 1. Test API Endpoints
```bash
curl https://api.aryv-app.com/health
curl -X POST https://api.aryv-app.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@aryv-app.com","password":"test123"}'
```

### 2. Test Mobile App
1. Reload ARYV app in emulator
2. Try login with any credentials
3. Verify network connectivity success

### 3. Test Admin Panel  
Visit `https://admin.aryv-app.com` and test login

## 🔒 Step 7: Security Configuration

### Cloudflare Security Rules
1. **Rate Limiting**: 
   - API endpoints: 300 requests/minute
   - Auth endpoints: 60 requests/minute

2. **Bot Fight Mode**: Enable
3. **DDoS Protection**: Enable  
4. **WAF Rules**: Configure for API protection

### Firewall Rules
```
(http.request.uri.path contains "/api/auth/" and cf.threat_score > 10) then Block
```

## 🚦 Step 8: Performance Optimization

### Caching Rules
- **API**: No cache (dynamic content)
- **Admin Panel**: Cache everything (static assets)
- **Images**: Cache for 1 month

### Compression
- **Brotli**: Enable
- **Minification**: CSS, JS, HTML

## 📊 Step 9: Monitoring Setup

1. **Cloudflare Analytics**: Enable
2. **Real User Monitoring**: Configure
3. **Error Tracking**: Set up alerts

## 🎉 Deployment Checklist

- [ ] DNS records configured
- [ ] SSL certificates active
- [ ] Backend API deployed
- [ ] Admin panel deployed  
- [ ] Environment variables set
- [ ] Security rules configured
- [ ] Performance optimized
- [ ] Mobile app tested with production API

## 🔧 Quick Deploy Commands

```bash
# Run the automated deployment script
chmod +x deploy-to-cloudflare.sh
./deploy-to-cloudflare.sh

# Or manual deployment
cd admin-panel && npm run build
cd ../backend && npm run build
# Upload to Cloudflare Pages/Workers
```

## 🆘 Troubleshooting

### Common Issues

1. **Mobile app network errors**: Check CORS configuration
2. **API not accessible**: Verify DNS propagation  
3. **SSL errors**: Check Cloudflare SSL mode
4. **Authentication failing**: Verify JWT secrets match

### Support Commands
```bash
# Test DNS propagation
nslookup api.aryv-app.com

# Test SSL certificate
openssl s_client -connect api.aryv-app.com:443

# Test API connectivity  
curl -v https://api.aryv-app.com/health
```

## 📞 Next Steps

1. **Deploy backend to Cloudflare Workers/Pages**
2. **Upload admin panel to Cloudflare Pages**
3. **Configure custom domains for subdomains**
4. **Test mobile app with production API**
5. **Set up monitoring and analytics**

The mobile app is now configured to use your production domain and will bypass all local networking issues!

---

**✅ ARYV Platform Ready for Cloudflare Deployment!**