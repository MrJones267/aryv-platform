# 🚀 Hitch Platform - Deployment & Testing Guide

**Step-by-step guide to deploy and test your Hitch platform**

---

## **STEP 1: Backend Deployment**

### 1.1 Start Database Services
The PostgreSQL and Redis containers are already running. Verify with:
```bash
docker ps | grep hitch
```

You should see:
- `hitch-postgres` on port 5433
- `hitch-redis` on port 6380

### 1.2 Start Backend API
```bash
cd backend
npm install
npm run dev
```

Wait for the message: "Server running on port 3001"

### 1.3 Verify Backend Health
```bash
curl http://localhost:3001/health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-27T...",
  "services": {
    "database": "connected",
    "redis": "connected"
  }
}
```

### 1.4 Test API Documentation
Open: http://localhost:3001/docs

---

## **STEP 2: Admin Panel Testing**

### 2.1 Configure Admin Panel Environment
```bash
cd admin-panel
cp .env.production .env
```

Edit `admin-panel/.env`:
```bash
VITE_API_BASE_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001
VITE_APP_ENV=development
VITE_DEBUG=true
```

### 2.2 Start Admin Panel
```bash
npm install
npm run dev
```

### 2.3 Access Admin Panel
Open: http://localhost:3000

Default admin credentials:
- Email: `admin@hitch.com`
- Password: `admin123`

---

## **STEP 3: React Native Mobile App Setup**

### 3.1 Prerequisites Check
Verify you have:
```bash
node --version    # Should be 18+
npm --version     # Should be 9+
```

**For Android:**
- Android Studio installed
- Android SDK configured
- Android emulator or physical device

**For iOS (macOS only):**
- Xcode installed
- iOS Simulator or physical device
- CocoaPods installed: `sudo gem install cocoapods`

### 3.2 Configure Mobile App Environment
```bash
cd mobile-app
cp .env.production .env
```

Edit `mobile-app/.env`:
```bash
API_BASE_URL=http://localhost:3001
SOCKET_URL=http://localhost:3001
APP_NAME=Hitch
BUNDLE_ID=com.hitch.mobile.dev
ENABLE_DEBUG_MODE=true
ENABLE_PUSH_NOTIFICATIONS=false
GOOGLE_MAPS_API_KEY=YOUR_DEVELOPMENT_API_KEY
```

### 3.3 Install Dependencies
```bash
npm install
```

**For iOS (macOS only):**
```bash
cd ios
pod install
cd ..
```

---

## **STEP 4: React Native Testing**

### 4.1 Start Metro Bundler
```bash
npm start
# or
npx react-native start
```

Keep this terminal open - it's the Metro bundler.

### 4.2 Run on Android
**Option A: Android Emulator**
1. Open Android Studio
2. Start an Android Virtual Device (AVD)
3. In a new terminal:
```bash
cd mobile-app
npm run android
# or
npx react-native run-android
```

**Option B: Physical Android Device**
1. Enable Developer Options and USB Debugging
2. Connect device via USB
3. Run: `npx react-native run-android`

### 4.3 Run on iOS (macOS only)
**Option A: iOS Simulator**
```bash
cd mobile-app
npm run ios
# or
npx react-native run-ios
```

**Option B: Physical iOS Device**
1. Open `ios/HitchMobile.xcworkspace` in Xcode
2. Select your device
3. Click "Run" button

---

## **STEP 5: UI Testing Checklist**

### 5.1 App Launch Testing
- [ ] App launches without crashes
- [ ] Splash screen displays correctly
- [ ] Navigation loads properly

### 5.2 Authentication Flow
- [ ] Registration screen loads
- [ ] Login screen loads
- [ ] Form validation works
- [ ] API calls connect to backend
- [ ] Success/error messages display

### 5.3 Main App Features
- [ ] Home screen loads
- [ ] Navigation tabs work
- [ ] Maps integration works (if Google Maps configured)
- [ ] Profile screen accessible
- [ ] Settings screen functional

### 5.4 API Integration Testing
- [ ] Network requests to http://localhost:3001 successful
- [ ] Real-time features work (Socket.io connection)
- [ ] Error handling displays properly
- [ ] Loading states work correctly

---

## **STEP 6: Testing Commands Reference**

### Backend Commands
```bash
# Start backend
cd backend && npm run dev

# Run tests
npm test

# Check logs
tail -f logs/combined.log

# Health check
curl http://localhost:3001/health

# Test admin endpoint
curl -X POST http://localhost:3001/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@hitch.com","password":"admin123"}'
```

### Mobile App Commands
```bash
# Install dependencies
npm install

# Start Metro bundler
npm start

# Run on Android
npm run android

# Run on iOS (macOS)
npm run ios

# Run tests
npm test

# Type checking
npm run type-check

# Lint code
npm run lint

# Clean project
npm run clean
```

### Debug Commands
```bash
# Check React Native environment
npx react-native doctor

# List Android devices
adb devices

# View Android logs
npx react-native log-android

# View iOS logs
npx react-native log-ios

# Open React Native debugger
# Press 'd' in Metro terminal, then 'j' for debugger
```

---

## **STEP 7: Troubleshooting**

### Common Issues & Solutions

#### Backend Issues
**Issue: Backend won't start**
```bash
# Check if ports are in use
netstat -an | grep 3001

# Kill process on port 3001
npx kill-port 3001

# Restart backend
cd backend && npm run dev
```

**Issue: Database connection failed**
```bash
# Check containers
docker ps | grep hitch

# Restart database
docker restart hitch-postgres hitch-redis

# Check database logs
docker logs hitch-postgres
```

#### Mobile App Issues
**Issue: Metro bundler won't start**
```bash
# Clear cache
npx react-native start --reset-cache

# Clean project
cd mobile-app
npm run clean
```

**Issue: Android build fails**
```bash
# Clean Android build
cd android
./gradlew clean
cd ..

# Rebuild
npm run android
```

**Issue: iOS build fails (macOS)**
```bash
# Clean iOS build
cd ios
rm -rf build
rm -rf Pods
rm Podfile.lock
pod install
cd ..

# Rebuild
npm run ios
```

**Issue: Network requests fail**
- Check if backend is running on `http://localhost:3001`
- Verify `.env` file has correct `API_BASE_URL`
- For Android emulator, use `http://10.0.2.2:3001` instead of `localhost`

---

## **STEP 8: Testing URLs**

### Backend Services
- **API Health**: http://localhost:3001/health
- **API Docs**: http://localhost:3001/docs
- **Admin Login**: POST http://localhost:3001/api/admin/auth/login

### Admin Panel
- **Admin Dashboard**: http://localhost:3000
- **Login**: admin@hitch.com / admin123

### Mobile App
- **Metro Bundler**: http://localhost:8081
- **Debugger**: http://localhost:8081/debugger-ui

---

## **STEP 9: Development Workflow**

### Daily Development Process
1. **Start Services**:
   ```bash
   # Terminal 1: Backend
   cd backend && npm run dev
   
   # Terminal 2: Admin Panel
   cd admin-panel && npm run dev
   
   # Terminal 3: Mobile App
   cd mobile-app && npm start
   
   # Terminal 4: Mobile App Run
   cd mobile-app && npm run android # or ios
   ```

2. **Make Changes**: Edit code in your preferred IDE

3. **Hot Reload**: Changes automatically reload in React Native

4. **Test**: Use the testing checklist above

5. **Debug**: Use React Native debugger for issues

---

## **🎉 Success Indicators**

### ✅ Backend Deployed Successfully
- Health endpoint returns 200 OK
- API docs accessible
- Database connections working
- Admin login successful

### ✅ Mobile App Running Successfully
- App launches on device/emulator
- No red error screens
- Navigation works smoothly
- API calls to backend successful
- Real-time features connecting

### ✅ Full Integration Working
- Mobile app can authenticate with backend
- Data flows between mobile and backend
- Admin panel shows mobile app activity
- Real-time features synchronized

---

**You're now ready to develop and test your Hitch platform!** 

The complete stack is running:
- **Backend API**: http://localhost:3001
- **Admin Panel**: http://localhost:3000  
- **Mobile App**: On your device/emulator
- **Database**: PostgreSQL with sample data
- **Real-time**: Socket.io connections active

Happy coding! 🚀