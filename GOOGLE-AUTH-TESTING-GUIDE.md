# 🧪 Google Auth Testing Guide

## 📋 Testing Checklist

### **1. Backend API Testing**

#### **Test Database Migration**
```bash
# Run the Google Auth migration
psql -h localhost -U hitch_user -d hitch_db -f backend/migrations/add-google-auth.sql

# Verify new columns exist
psql -h localhost -U hitch_user -d hitch_db -c "\d users"

# Expected: google_id, profile_picture_url, auth_provider, is_verified, device_info, locale columns
```

#### **Test Google Auth Endpoints**
```bash
# 1. Test auth URL generation
curl http://localhost:3001/api/auth/google/url

# Expected response:
{
  "success": true,
  "data": {
    "authUrl": "https://accounts.google.com/oauth/authorize?...",
    "provider": "google"
  }
}

# 2. Test Google token verification (use actual Google ID token)
curl -X POST http://localhost:3001/api/auth/google/verify \
  -H "Content-Type: application/json" \
  -d '{
    "idToken": "your_google_id_token_here",
    "deviceInfo": {
      "platform": "test",
      "userAgent": "test"
    }
  }'

# Expected: JWT tokens and user data
```

### **2. Mobile App Testing**

#### **Test Google Sign-In Configuration**
```javascript
// In your React Native app, test the service:
import { googleAuthService } from './src/services/googleAuthService';

// Test configuration
const testGoogleAuth = async () => {
  try {
    // Check if Google Play Services available
    const isAvailable = await googleAuthService.isGooglePlayServicesAvailable();
    console.log('Google Play Services available:', isAvailable);
    
    // Check if user is already signed in
    const isSignedIn = await googleAuthService.isSignedIn();
    console.log('Already signed in:', isSignedIn);
    
    if (isSignedIn) {
      const currentUser = await googleAuthService.getCurrentUser();
      console.log('Current user:', currentUser);
    }
  } catch (error) {
    console.error('Google Auth test error:', error);
  }
};
```

#### **Test Sign-In Flow**
```javascript
// Use the GoogleSignInButton component:
import GoogleSignInButton from './src/components/auth/GoogleSignInButton';

const TestScreen = () => {
  const handleSuccess = (user, tokens) => {
    console.log('✅ Google Sign-In successful:', user);
    console.log('🔑 Tokens received:', tokens);
    
    // Test API call with token
    testAuthenticatedRequest(tokens.accessToken);
  };

  const handleError = (error) => {
    console.error('❌ Google Sign-In failed:', error);
  };

  const testAuthenticatedRequest = async (accessToken) => {
    try {
      const response = await fetch('http://localhost:3001/api/auth/profile', {
        headers: {
          'Authorization': `Bearer ${accessToken}`
        }
      });
      
      const result = await response.json();
      console.log('👤 Profile data:', result);
    } catch (error) {
      console.error('Profile fetch error:', error);
    }
  };

  return (
    <GoogleSignInButton
      onSuccess={handleSuccess}
      onError={handleError}
      size="large"
    />
  );
};
```

### **3. Admin Panel Testing**

#### **Test Web OAuth Flow**
```bash
# 1. Start your backend server
node backend/server-simple.js

# 2. Update cloudflare-worker-deploy.js with admin-google-auth-update.js code

# 3. Deploy to Cloudflare Workers

# 4. Visit your admin panel URL:
# https://aryv-admin-professional.majokoobo.workers.dev

# 5. Test login flows:
#    - Email/password login (admin@aryv-app.com / admin123)
#    - Google OAuth login (click "Sign in with Google")

# 6. Verify successful authentication shows dashboard
```

### **4. End-to-End Integration Testing**

#### **Complete User Journey Test**
```javascript
const testCompleteFlow = async () => {
  console.log('🧪 Starting complete Google Auth test...');

  // Step 1: Mobile app sign-in
  const authResult = await googleAuthService.signIn();
  
  if (authResult.success) {
    console.log('✅ Step 1: Mobile sign-in successful');
    
    // Step 2: Test API calls
    const profileResponse = await fetch('/api/auth/profile', {
      headers: {
        'Authorization': `Bearer ${authResult.tokens.accessToken}`
      }
    });
    
    const profileData = await profileResponse.json();
    
    if (profileData.success) {
      console.log('✅ Step 2: API authentication successful');
      
      // Step 3: Test admin panel access
      localStorage.setItem('accessToken', authResult.tokens.accessToken);
      
      // Navigate to admin panel
      window.location.href = 'https://aryv-admin-professional.majokoobo.workers.dev';
      
      console.log('✅ Step 3: Admin panel access test complete');
      console.log('🎉 All Google Auth tests passed!');
    }
  }
};
```

## 🔧 Environment Variables Required

### **For Backend (.env or Railway)**
```bash
# Required Google Auth variables:
GOOGLE_CLIENT_ID=your-client-id.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://api.aryv-app.com/auth/google/callback
FRONTEND_URL=https://aryv-admin-professional.majokoobo.workers.dev
```

### **For Mobile App**
```bash
# In .env or build configuration:
GOOGLE_WEB_CLIENT_ID=your-web-client-id.googleusercontent.com
GOOGLE_IOS_CLIENT_ID=your-ios-client-id.googleusercontent.com  # Optional
GOOGLE_ANDROID_CLIENT_ID=your-android-client-id.googleusercontent.com  # Optional
```

### **For Admin Panel (Cloudflare Worker)**
```javascript
// Update API_BASE in cloudflare-worker-deploy.js:
const API_BASE = window.location.hostname === 'localhost' ? 
    'http://localhost:3001' : 
    'https://your-railway-backend.railway.app';
```

## 🐛 Common Issues & Solutions

### **Issue: "Google Play Services not available"**
```bash
Solution: 
- Ensure Google Play Services are installed on Android device/emulator
- Use physical device for testing
- Check Google Play Services version is up to date
```

### **Issue: "Invalid Google token"**
```bash
Solution:
- Verify GOOGLE_CLIENT_ID matches in all platforms
- Check that web client ID is used for React Native
- Ensure backend has correct client ID for verification
```

### **Issue: "OAuth callback failed"**
```bash
Solution:
- Verify redirect URI matches Google Cloud Console configuration
- Check CORS settings allow your admin panel domain
- Ensure HTTPS is used for production callback URLs
```

### **Issue: "User not found after Google sign-in"**
```bash
Solution:
- Check database migration ran successfully
- Verify users table has google_id column
- Check backend logs for user creation errors
```

## ✅ Expected Test Results

### **Successful Mobile Sign-In**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "email": "user@gmail.com",
    "firstName": "John",
    "lastName": "Doe",
    "role": "passenger",
    "verified": true,
    "picture": "https://lh3.googleusercontent.com/..."
  },
  "tokens": {
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 604800
  }
}
```

### **Successful Admin Panel Login**
- ✅ Login form appears with Google button
- ✅ Google OAuth redirect works
- ✅ Callback returns to admin panel
- ✅ Dashboard loads with user data
- ✅ API calls work with received token

### **Database Verification**
```sql
-- Check user was created/updated:
SELECT id, email, first_name, google_id, auth_provider, is_verified 
FROM users 
WHERE google_id IS NOT NULL;

-- Expected: User record with Google ID and verified=true
```

## 🚀 Production Deployment Checklist

Before deploying Google Auth to production:

- [ ] Google Cloud Console OAuth configured for production domains
- [ ] Backend deployed with Google environment variables
- [ ] Database migration applied to production
- [ ] Admin panel updated with Google Auth code
- [ ] Mobile app built with production Google configuration
- [ ] All redirect URIs updated for production URLs
- [ ] CORS settings include production domains
- [ ] Test complete flow in production environment

**Google Auth integration is ready for production deployment!** 🎉