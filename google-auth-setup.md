# 🔐 Google OAuth Setup Guide for ARYV

## Step 1: Google Cloud Console Setup

1. **Google Cloud Console**: https://console.cloud.google.com
2. **Create Project** (if new): "ARYV Production"
3. **Enable Google+ API**: APIs & Services → Library → Google+ API
4. **Enable OAuth API**: APIs & Services → Library → Google OAuth2 API

## Step 2: Create OAuth 2.0 Credentials

1. **APIs & Services** → Credentials → Create Credentials
2. **OAuth 2.0 Client ID**
3. **Application Type**: Web application
4. **Name**: "ARYV Production Auth"

## Step 3: Configure Authorized Origins

```bash
Authorized JavaScript origins:
├── https://aryv-app.com
├── https://admin.aryv-app.com
├── https://aryv-admin-professional.majokoobo.workers.dev
└── http://localhost:3000 (for development)

Authorized redirect URIs:
├── https://aryv-app.com/auth/google/callback
├── https://admin.aryv-app.com/auth/google/callback
├── https://api.aryv-app.com/auth/google/callback
└── http://localhost:3001/auth/google/callback (for development)
```

## Step 4: Get Client Credentials

1. **Download JSON** credentials file
2. **Copy Client ID** and **Client Secret**
3. **Store securely** (don't commit to git)

```json
{
  "client_id": "your-client-id.googleusercontent.com",
  "client_secret": "your-client-secret",
  "redirect_uris": ["https://api.aryv-app.com/auth/google/callback"]
}
```

## Step 5: Environment Variables for Railway

```bash
# Add to Railway environment variables:
GOOGLE_CLIENT_ID=your-client-id.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=https://api.aryv-app.com/auth/google/callback
```

## Step 6: OAuth Consent Screen

1. **APIs & Services** → OAuth consent screen
2. **External** user type (for public app)
3. **App Information**:
   - App name: "ARYV"
   - User support email: support@aryv-app.com
   - Developer email: your-email@aryv-app.com
4. **Scopes**: Add email, profile, openid
5. **Test Users** (for development): Add your email

## Step 7: Mobile App Configuration

### React Native Google Sign-In

```bash
# Install dependencies
npm install @react-native-google-signin/google-signin

# iOS Configuration (ios/GoogleService-Info.plist)
# Android Configuration (android/app/google-services.json)
```

### Mobile OAuth Configuration

```javascript
// mobile-app/src/config/auth.ts
export const GOOGLE_AUTH_CONFIG = {
  webClientId: 'your-client-id.googleusercontent.com', // Same as web
  iosClientId: 'your-ios-client-id.googleusercontent.com', // From GoogleService-Info.plist
  androidClientId: 'your-android-client-id.googleusercontent.com', // From google-services.json
};
```

**Total Setup Time: ~5 minutes**
**Cost: Free (Google OAuth)**