# ARYV APK Build Guide - Based on Last Successful Build (Dec 26)

## Last Successful Build Analysis
- **Date**: December 26, 2025
- **APK Size**: 48.7MB (`app-release.apk`)
- **AAB Size**: 49.9MB (`app-release.aab`)
- **Version**: 1.0.0 (Build 1)
- **App ID**: com.aryvmobile

## Current Status of Updates
✅ **All code changes are already in place:**
- ARYV branding fixed ("Join the ARYV community")
- Railway backend configured (`api.aryv-app.com`)
- ARYV icons installed in all mipmap directories
- Production certificates configured

## Memory-Optimized Build Process

### Method 1: Direct Gradle Build (Recommended)
```bash
# Navigate to project root
cd /mnt/c/users/majok/Hitch/mobile-app

# Build APK only (faster)
cd android
./gradlew assembleRelease --no-daemon --max-workers=1 --no-parallel

# Or build both APK + AAB
./gradlew assembleRelease bundleRelease --no-daemon --max-workers=1
```

### Method 2: Using Production Script (If available)
```bash
# Use the production build script
chmod +x scripts/build-production-release.sh
./scripts/build-production-release.sh
```

### Method 3: React Native CLI (Alternative)
```bash
# Generate release build
npx react-native run-android --mode=release
```

## Key Gradle Settings for Success
The `android/gradle.properties` has been optimized with:
- **Memory**: `-Xmx4g` (4GB heap)
- **Workers**: `max=1` (single worker)
- **Parallel**: `false` (sequential processing)
- **Daemon**: `false` (no background daemon)
- **Hermes**: `true` (JS engine optimization)

## Build Troubleshooting

### If Build Times Out:
1. **Close other applications** to free memory
2. **Restart WSL**: `wsl --shutdown` then restart
3. **Use smaller heap**: Change `-Xmx4g` to `-Xmx3g` in gradle.properties

### If Build Fails:
1. **Clean build cache**:
   ```bash
   ./gradlew clean
   rm -rf node_modules/.cache
   ```

2. **Check keystore**: Ensure `android/app/keystore.properties` exists

3. **Verify dependencies**:
   ```bash
   npm install
   cd android && ./gradlew --refresh-dependencies
   ```

## Expected Build Output Locations
- **APK**: `android/app/build/outputs/apk/release/app-release.apk`
- **AAB**: `android/app/build/outputs/bundle/release/app-release.aab`

## Build Time Expectations
- **APK Only**: 5-15 minutes (depending on system)
- **APK + AAB**: 10-25 minutes
- **With Clean**: Add 5-10 minutes

## Memory Requirements
- **Minimum**: 6GB available RAM
- **Recommended**: 8GB+ available RAM
- **Swap**: Ensure 4GB+ swap space available

## Pre-Build Checklist
- [ ] WSL has sufficient memory (check with `free -h`)
- [ ] Android SDK properly configured
- [ ] Node.js dependencies installed (`npm install`)
- [ ] Keystore files present in `android/app/`
- [ ] No other heavy processes running

## Build Command That Worked Last Time
Based on the successful December 26 build:
```bash
cd /mnt/c/users/majok/Hitch/mobile-app/android
./gradlew assembleRelease bundleRelease
```

## Alternative: Use Existing APK for Testing
The current APK contains all major features except the latest updates:
- Location: `/mnt/c/users/majok/Hitch/mobile-app/android/app/build/outputs/apk/release/app-release.apk`
- Size: 48.7MB
- Works with Railway backend for authentication testing

## Next Steps After Build
1. **Install APK**: Transfer to device and install
2. **Test Authentication**: Verify login/signup with Railway backend
3. **Test Core Features**: Rides, courier, payments
4. **Generate Screenshots**: For store submission

## Success Indicators
- Build completes without errors
- APK size ~48-50MB (similar to last successful build)
- APK installs and launches without crashes
- Authentication works with Railway backend