# 🚀 ARYV Production Deployment - Implementation Guide

**Status**: ✅ Security hardening completed  
**Ready for**: Production deployment with your configuration  

## 📋 Tasks Requiring Your Direct Input

### 1. **External API Keys Configuration** ⚠️ ACTION REQUIRED

**What you need to configure:**

#### **A. Payment Processing (Stripe)**
```bash
# Required for payment functionality
STRIPE_SECRET_KEY=sk_live_your_actual_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_actual_webhook_secret
```

**Implementation Steps:**
1. **Create Stripe Account**: https://stripe.com
2. **Get API Keys**: Dashboard → Developers → API keys
3. **Set up Webhooks**: Dashboard → Developers → Webhooks
4. **Add these to Railway environment variables**

#### **B. Google Maps API (for location services)**
```bash
# Required for geocoding, directions, places
GOOGLE_MAPS_API_KEY=AIzaSy_your_actual_google_maps_api_key
```

**Implementation Steps:**
1. **Google Cloud Console**: https://console.cloud.google.com
2. **Enable APIs**: Maps JavaScript API, Geocoding API, Places API
3. **Create API Key**: APIs & Services → Credentials
4. **Restrict Key**: Set application restrictions and API restrictions

#### **C. Email Service (SMTP)**
```bash
# Required for user notifications, password resets
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-business-email@gmail.com
SMTP_PASS=your-app-password
```

**Implementation Steps (Gmail):**
1. **Enable 2FA** on your Gmail account
2. **Generate App Password**: Google Account → Security → App passwords
3. **Use App Password** (not your regular Gmail password)

#### **D. File Storage (AWS S3)**
```bash
# Required for user avatars, package images
AWS_ACCESS_KEY_ID=AKIA_your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_access_key
AWS_S3_BUCKET=aryv-uploads
AWS_REGION=us-east-1
```

**Implementation Steps:**
1. **AWS Account**: Create at https://aws.amazon.com
2. **Create S3 Bucket**: S3 → Create bucket → Name: "aryv-uploads"
3. **Create IAM User**: IAM → Users → Add user → Programmatic access
4. **Attach S3 Policy**: AmazonS3FullAccess (or custom policy)

---

### 2. **Production Domain Configuration** ⚠️ ACTION REQUIRED

**What you need to do:**

#### **A. Domain DNS Setup**
```dns
# Add these DNS records in Cloudflare
Type    Name    Content
CNAME   api     your-railway-backend-url.railway.app
CNAME   admin   aryv-admin-professional.majokoobo.workers.dev
A       @       your-main-website-ip
```

#### **B. SSL Certificate Setup**
Railway automatically provides SSL certificates for custom domains.

**Implementation Steps:**
1. **Railway Dashboard** → Your project → Settings → Domains
2. **Add Custom Domain**: api.aryv-app.com
3. **Copy CNAME**: Railway provides a CNAME target
4. **Update DNS**: Add CNAME record in Cloudflare DNS
5. **Wait for SSL**: Automatic provisioning (5-10 minutes)

---

### 3. **Production Secrets Generation** ⚠️ ACTION REQUIRED

**Run these commands to generate secure secrets:**

```bash
# JWT Secret (copy the output)
openssl rand -base64 64

# Session Secret (copy the output)  
openssl rand -base64 32

# Database Password (Railway will provide this)
# Copy from Railway PostgreSQL service environment variables
```

**Implementation Steps:**
1. **Run Commands**: Execute the openssl commands above
2. **Copy Outputs**: Save the generated secrets
3. **Add to Railway**: Environment variables in Railway dashboard

---

### 4. **Railway Deployment Configuration** ⚠️ ACTION REQUIRED

**Environment Variables to set in Railway:**

```bash
# Required Railway Environment Variables
NODE_ENV=production
JWT_SECRET=[OUTPUT_FROM_OPENSSL_COMMAND]
SESSION_SECRET=[OUTPUT_FROM_OPENSSL_COMMAND]
CORS_ORIGINS=https://aryv-app.com,https://api.aryv-app.com,https://admin.aryv-app.com,https://aryv-admin-professional.majokoobo.workers.dev

# Security Features (Enable all)
VALIDATION_ENABLED=true
SANITIZATION_ENABLED=true
XSS_PROTECTION=true
SQL_INJECTION_PROTECTION=true
RATE_LIMIT_SKIP_SUCCESS=true

# External API Keys (use your actual keys)
STRIPE_SECRET_KEY=[YOUR_STRIPE_KEY]
GOOGLE_MAPS_API_KEY=[YOUR_GOOGLE_MAPS_KEY] 
SMTP_HOST=smtp.gmail.com
SMTP_USER=[YOUR_EMAIL]
SMTP_PASS=[YOUR_APP_PASSWORD]
AWS_ACCESS_KEY_ID=[YOUR_AWS_KEY]
AWS_SECRET_ACCESS_KEY=[YOUR_AWS_SECRET]
AWS_S3_BUCKET=aryv-uploads

# Database (Railway auto-provides these)
DATABASE_URL=[AUTO_PROVIDED_BY_RAILWAY]
PGSSLMODE=require
```

**Implementation Steps:**
1. **Railway Dashboard** → Your backend service → Variables
2. **Add Each Variable**: Copy and paste each line
3. **Replace Placeholders**: Use your actual API keys
4. **Save Changes**: Railway auto-deploys on variable updates

---

### 5. **Admin Panel URL Update** ⚠️ ACTION REQUIRED

**Update the admin panel to use your Railway backend URL:**

```javascript
// In cloudflare-worker-deploy.js, line 70:
// Replace this line:
const API_BASE = window.location.hostname === 'localhost' ? 
    'http://localhost:3001' : 
    'https://[YOUR_RAILWAY_BACKEND_URL]';

// With your actual Railway backend URL:
const API_BASE = window.location.hostname === 'localhost' ? 
    'http://localhost:3001' : 
    'https://aryv-backend-production-xxxx.railway.app'; // Your actual Railway URL
```

**Implementation Steps:**
1. **Get Railway URL**: From Railway dashboard after deployment
2. **Update Worker File**: Replace placeholder with actual URL
3. **Redeploy to Cloudflare**: Upload updated worker script

---

### 6. **Mobile App Production URLs** ⚠️ ACTION REQUIRED

**Update mobile app fallback URLs:**

```typescript
// In mobile-app/src/config/api.ts, lines 151-152:
fallbackApiUrl: 'https://api.aryv-app.com/api', // Your production domain
fallbackSocketUrl: 'https://api.aryv-app.com', // Your production domain
```

**Implementation Steps:**
1. **After Domain Setup**: Wait for DNS propagation
2. **Update Config**: Use your custom domain (api.aryv-app.com)
3. **Test Connectivity**: Ensure mobile app can reach production API

---

## 🎯 **Deployment Order**

**Follow this exact sequence:**

### **Step 1: Get API Keys (15 minutes)**
1. Stripe account + API keys
2. Google Maps API key
3. Gmail app password
4. AWS account + S3 bucket + IAM keys

### **Step 2: Deploy to Railway (10 minutes)**
1. Create Railway project
2. Add PostgreSQL service
3. Deploy backend with all environment variables
4. Get Railway backend URL

### **Step 3: Update Admin Panel (5 minutes)**
1. Replace Railway URL in cloudflare-worker-deploy.js
2. Deploy to Cloudflare Workers
3. Test admin panel connectivity

### **Step 4: Configure Domain (10 minutes)**
1. Add CNAME records for api.aryv-app.com
2. Configure Railway custom domain
3. Wait for SSL certificate
4. Update mobile app configuration

### **Step 5: Final Testing (10 minutes)**
1. Test all API endpoints
2. Verify admin panel functionality
3. Test mobile app connectivity
4. Confirm real-time features

---

## ✅ **What's Already Done**

**Security hardening completed:**
- ✅ Environment-specific secrets management
- ✅ PostgreSQL SSL connections enabled
- ✅ Production CORS configuration
- ✅ Input validation and sanitization middleware
- ✅ JWT secret rotation mechanism
- ✅ Rate limiting and security headers
- ✅ XSS and SQL injection protection

**Ready for immediate deployment with your configuration!**

---

## 🆘 **Support Commands**

**Test your configuration:**

```bash
# Test Railway backend health
curl https://your-railway-url.railway.app/health

# Test admin panel
curl https://aryv-admin-professional.majokoobo.workers.dev

# Test API endpoints
curl https://your-railway-url.railway.app/api/users
```

**Environment variable template for Railway:**
```bash
NODE_ENV=production
JWT_SECRET=your_generated_jwt_secret
SESSION_SECRET=your_generated_session_secret
CORS_ORIGINS=https://aryv-app.com,https://api.aryv-app.com,https://admin.aryv-app.com,https://aryv-admin-professional.majokoobo.workers.dev
VALIDATION_ENABLED=true
SANITIZATION_ENABLED=true
XSS_PROTECTION=true
SQL_INJECTION_PROTECTION=true
STRIPE_SECRET_KEY=sk_live_your_stripe_key
GOOGLE_MAPS_API_KEY=AIzaSy_your_google_key
SMTP_HOST=smtp.gmail.com
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
AWS_ACCESS_KEY_ID=AKIA_your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_S3_BUCKET=aryv-uploads
PGSSLMODE=require
```

---

**You're now ready for production deployment! 🚀**

All security hardening is complete. Just add your API keys and deploy to Railway following the steps above.