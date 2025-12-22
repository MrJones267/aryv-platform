# 🔧 Hitch Mobile App - Troubleshooting Guide

## Quick Diagnostics

Run these commands in PowerShell to diagnose issues:

```powershell
# System Status Check
node --version
npm --version
adb --version
echo $env:ANDROID_HOME

# Service Status Check
netstat -an | findstr "3001 8081"
adb devices
emulator -list-avds

# Backend Health Check
curl http://localhost:3001/health
```

---

## Common Issues & Solutions

### 🔴 Issue: "Node.js not found"
**Symptoms:** `'node' is not recognized as an internal or external command`

**Solutions:**
```powershell
# Solution 1: Install Node.js
# Download from https://nodejs.org (LTS version)
# Restart PowerShell after installation

# Solution 2: Check PATH
echo $env:PATH | Select-String "nodejs"
```

---

### 🔴 Issue: "ANDROID_HOME not set"
**Symptoms:** `ANDROID_HOME environment variable not set`

**Solutions:**
```powershell
# Solution 1: Run the setup script
.\SETUP_ANDROID_ENVIRONMENT.ps1

# Solution 2: Manual setup
$androidSdk = "C:\Users\$env:USERNAME\AppData\Local\Android\Sdk"
[Environment]::SetEnvironmentVariable("ANDROID_HOME", $androidSdk, "User")

# Restart PowerShell
```

---

### 🔴 Issue: "ADB not found"
**Symptoms:** `'adb' is not recognized as an internal or external command`

**Solutions:**
```powershell
# Solution 1: Check ADB directly
$env:ANDROID_HOME\platform-tools\adb.exe version

# Solution 2: Add to PATH
$currentPath = $env:PATH
$env:PATH = "$currentPath;$env:ANDROID_HOME\platform-tools"

# Solution 3: Use full path
& "$env:ANDROID_HOME\platform-tools\adb.exe" devices
```

---

### 🔴 Issue: "No emulators found"
**Symptoms:** `No emulators found as an output of emulator -list-avds`

**Solutions:**
1. **Create AVD in Android Studio:**
   - Open Android Studio
   - Tools → AVD Manager
   - Create Virtual Device
   - Choose Pixel 4, API Level 33+

2. **Verify emulator path:**
   ```powershell
   & "$env:ANDROID_HOME\emulator\emulator.exe" -list-avds
   ```

3. **Start emulator manually:**
   ```powershell
   & "$env:ANDROID_HOME\emulator\emulator.exe" @YourAVDName
   ```

---

### 🔴 Issue: "Metro bundler connection failed"
**Symptoms:** App shows red screen with "Connection to Metro failed"

**Solutions:**
```powershell
# Solution 1: Restart Metro
# Stop current Metro (Ctrl+C)
npx react-native start --reset-cache

# Solution 2: Clear cache
npx react-native clean
rm -rf node_modules
npm install --legacy-peer-deps

# Solution 3: Check port 8081
netstat -an | findstr 8081
# Kill process if needed: taskkill /f /pid <PID>
```

---

### 🔴 Issue: "Backend API not accessible"
**Symptoms:** App shows "Network request failed"

**Solutions:**
```powershell
# Solution 1: Verify backend is running
curl http://localhost:3001/health
# Should return JSON with "success": true

# Solution 2: Check mobile app API URL
# In mobile-app/src/services/api/baseApi.ts
# Ensure: BASE_URL = 'http://10.0.2.2:3001/api'

# Solution 3: Test from emulator
adb shell curl http://10.0.2.2:3001/health
```

---

### 🔴 Issue: "Gradle build failed"
**Symptoms:** Build fails with Gradle-related errors

**Solutions:**
```powershell
# Solution 1: Clean and rebuild
cd mobile-app\android
.\gradlew clean
cd ..
npx react-native run-android

# Solution 2: Clear Gradle cache
rm -rf ~/.gradle/caches
rm -rf android\build
rm -rf android\app\build

# Solution 3: Update Gradle wrapper
cd android
gradle wrapper --gradle-version 8.1
```

---

### 🔴 Issue: "App crashes on startup"
**Symptoms:** App opens briefly then closes

**Solutions:**
```powershell
# Solution 1: Check device logs
adb logcat | grep -i error

# Solution 2: Debug build
npx react-native run-android --mode="debug"

# Solution 3: Check device specifications
# Ensure emulator has:
# - API Level 23+ (Android 6.0+)
# - 4GB+ RAM
# - Hardware acceleration enabled
```

---

### 🔴 Issue: "Hot reload not working"
**Symptoms:** Code changes don't update in app

**Solutions:**
```powershell
# Solution 1: Enable fast refresh
# Shake device or press Ctrl+M
# Enable "Fast Refresh"

# Solution 2: Manual reload
# Press 'r' in Metro terminal
# Or shake device → "Reload"

# Solution 3: Restart Metro
npx react-native start --reset-cache
```

---

### 🔴 Issue: "White screen on app launch"
**Symptoms:** App shows blank white screen

**Solutions:**
```powershell
# Solution 1: Check Metro bundler
# Ensure Metro is running and accessible

# Solution 2: Check bundle loading
# In Metro terminal, look for bundle requests

# Solution 3: Debug in Chrome
# Shake device → Debug → Chrome DevTools
# Check console for JavaScript errors
```

---

## 🛠️ Reset Everything (Nuclear Option)

If all else fails, completely reset the development environment:

```powershell
# Stop all processes
# Ctrl+C in all terminal windows

# Clean mobile app
cd C:\Users\majok\Hitch\mobile-app
npx react-native clean
rm -rf node_modules
rm -rf android\build
rm -rf android\app\build
npm cache clean --force

# Reinstall dependencies
npm install --legacy-peer-deps

# Reset Metro cache
npx react-native start --reset-cache

# Close and restart Android emulator
adb emu kill
# Then restart emulator from Android Studio

# Rebuild and deploy
npx react-native run-android
```

---

## 📊 Performance Optimization

### For Slow Build Times:
```powershell
# Enable Gradle daemon
echo "org.gradle.daemon=true" >> android\gradle.properties
echo "org.gradle.parallel=true" >> android\gradle.properties
echo "org.gradle.configureondemand=true" >> android\gradle.properties
```

### For Large Bundle Sizes:
```powershell
# Enable Hermes (if not already)
# In android/app/build.gradle:
# enableHermes: true

# Enable ProGuard for release builds
npx react-native run-android --mode="release"
```

---

## 📞 Getting Help

### Log Collection Commands:
```powershell
# Android device logs
adb logcat > android_logs.txt

# Metro bundler logs
# Save terminal output where Metro is running

# Backend logs  
# Save terminal output where backend is running

# System information
systeminfo > system_info.txt
```

### Useful Debugging Commands:
```powershell
# React Native info
npx react-native info

# Check React Native doctor
npx react-native doctor

# Android SDK packages
sdkmanager --list_installed

# Emulator details
emulator -list-avds -verbose
```

---

## ⚡ Quick Fixes Summary

| Issue | Quick Command |
|-------|---------------|
| Node.js not found | Download from nodejs.org |
| ADB not found | `.\SETUP_ANDROID_ENVIRONMENT.ps1` |
| Metro connection failed | `npx react-native start --reset-cache` |
| Build failed | `npx react-native clean && npm install` |
| App crashes | `adb logcat \| grep -i error` |
| Backend not accessible | `curl http://localhost:3001/health` |
| Emulator not found | Create AVD in Android Studio |
| Gradle issues | `cd android && .\gradlew clean` |

---

**Remember:** Most issues are resolved by restarting services and clearing caches! 🔄