# 🚀 Hitch Mobile App - Windows PowerShell Setup Guide

## Overview
This guide will help you set up and run the Hitch mobile app using Windows PowerShell, avoiding WSL compatibility issues with React Native and Android development tools.

## 📋 Prerequisites Checklist

### ✅ Required Software
- [ ] **Node.js** (v18+ LTS) - Download from [nodejs.org](https://nodejs.org/)
- [ ] **Android Studio** - Download from [developer.android.com/studio](https://developer.android.com/studio)
- [ ] **JDK 11** - Included with Android Studio or download separately
- [ ] **Windows PowerShell** (Built-in to Windows)

### ✅ System Requirements
- [ ] Windows 10/11 (64-bit)
- [ ] 8GB+ RAM (16GB recommended)
- [ ] 50GB+ free disk space
- [ ] Virtualization enabled in BIOS (for Android Emulator)

---

## 🛠️ Step-by-Step Setup

### Step 1: Install Node.js and NPM

1. **Download Node.js LTS:**
   - Go to https://nodejs.org/
   - Download the LTS version (v20.x.x)
   - Run the installer with default settings

2. **Verify Installation:**
   ```powershell
   # Open PowerShell as Administrator
   node --version    # Should show v20.x.x
   npm --version     # Should show 10.x.x
   ```

### Step 2: Install Android Studio & SDK

1. **Install Android Studio:**
   - Download from https://developer.android.com/studio
   - Run installer and choose "Standard" installation
   - Complete the setup wizard

2. **Configure Android SDK:**
   - Open Android Studio
   - Go to **File → Settings → Appearance & Behavior → System Settings → Android SDK**
   - Install these SDK components:
     ```
     ✅ Android 13 (API Level 33)
     ✅ Android 14 (API Level 34)
     ✅ Android SDK Platform-Tools
     ✅ Android SDK Build-Tools 34.0.0
     ✅ Google Play Services
     ```

3. **Set Environment Variables:**
   ```powershell
   # Open PowerShell as Administrator
   # Set ANDROID_HOME (replace with your actual path)
   [Environment]::SetEnvironmentVariable("ANDROID_HOME", "C:\Users\$env:USERNAME\AppData\Local\Android\Sdk", "User")
   
   # Add to PATH
   $androidHome = [Environment]::GetEnvironmentVariable("ANDROID_HOME", "User")
   $currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
   $newPath = "$currentPath;$androidHome\platform-tools;$androidHome\tools;$androidHome\emulator"
   [Environment]::SetEnvironmentVariable("PATH", $newPath, "User")
   
   # Restart PowerShell to apply changes
   ```

4. **Create Android Virtual Device (AVD):**
   - In Android Studio: **Tools → AVD Manager**
   - Click **Create Virtual Device**
   - Choose **Phone → Pixel 4**
   - Select **API Level 33 or 34** system image
   - Name it `Hitch_Test_Device`
   - Click **Finish**

### Step 3: Verify Android Setup

```powershell
# Test ADB (Android Debug Bridge)
adb version

# List available virtual devices
emulator -list-avds

# Start the emulator
emulator @Hitch_Test_Device

# Check connected devices (in new PowerShell window)
adb devices
```

### Step 4: Install React Native CLI

```powershell
# Install React Native CLI globally
npm install -g react-native-cli

# Verify installation
react-native --version
```

---

## 📱 Running the Hitch Mobile App

### Step 1: Start Backend Services

```powershell
# Navigate to project directory
cd C:\Users\majok\Hitch

# Start backend server
node simple-server.js
```
*Keep this PowerShell window open - backend must stay running*

### Step 2: Start Android Emulator

```powershell
# In a new PowerShell window
emulator @Hitch_Test_Device
```
*Wait for emulator to fully boot (may take 2-3 minutes)*

### Step 3: Install Mobile App Dependencies

```powershell
# In a new PowerShell window, navigate to mobile app
cd C:\Users\majok\Hitch\mobile-app

# Install dependencies
npm install --legacy-peer-deps

# Clear any previous cache
npx react-native clean
```

### Step 4: Start Metro Bundler

```powershell
# In the mobile-app directory
npx react-native start --reset-cache
```
*Keep this window open - Metro must stay running*

### Step 5: Build and Deploy to Emulator

```powershell
# In a new PowerShell window, navigate to mobile-app
cd C:\Users\majok\Hitch\mobile-app

# Build and deploy to Android emulator
npx react-native run-android
```

---

## 🧪 Testing the Mobile App

### Backend Connectivity Test

The mobile app should automatically connect to:
- **Backend API:** `http://10.0.2.2:3001` (emulator network)
- **Test Credentials:**
  - User: `user@hitch.com` / `user123`
  - Admin: `admin@hitch.com` / `admin123`

### App Features to Test

1. **Authentication Screen:**
   - User registration
   - User login
   - Error handling

2. **Main Dashboard:**
   - Available rides display
   - Real-time updates
   - Navigation functionality

3. **Ride Booking:**
   - Location input
   - Ride search
   - Booking confirmation

4. **Courier Services:**
   - Package creation
   - Tracking interface
   - QR code functionality

---

## 🔧 Troubleshooting

### Common Issues & Solutions

#### ❌ "Metro bundler not found"
```powershell
# Solution: Clear npm cache and reinstall
npm cache clean --force
rm -rf node_modules
npm install --legacy-peer-deps
```

#### ❌ "Android emulator not detected"
```powershell
# Solution: Verify ADB and emulator paths
adb devices
emulator -list-avds

# Check environment variables
echo $env:ANDROID_HOME
```

#### ❌ "Build failed with Gradle error"
```powershell
# Solution: Clean and rebuild
cd android
.\gradlew clean
cd ..
npx react-native run-android
```

#### ❌ "Metro connection refused"
```powershell
# Solution: Check Metro is running on port 8081
netstat -an | findstr 8081

# Restart Metro
npx react-native start --reset-cache
```

#### ❌ "Backend API not accessible"
```powershell
# Solution: Test backend health
curl http://localhost:3001/health

# Verify backend is running
netstat -an | findstr 3001
```

---

## 🚀 Quick Start Commands

### For Daily Development (Copy & Paste Ready)

```powershell
# Terminal 1: Start Backend
cd C:\Users\majok\Hitch
node simple-server.js

# Terminal 2: Start Emulator  
emulator @Hitch_Test_Device

# Terminal 3: Start Metro
cd C:\Users\majok\Hitch\mobile-app
npx react-native start

# Terminal 4: Deploy App
cd C:\Users\majok\Hitch\mobile-app
npx react-native run-android
```

---

## 📊 System URLs & Access Points

### Development URLs
- **Backend API:** http://localhost:3001
- **Admin Dashboard:** http://localhost:8080/admin-dashboard.html
- **Mobile Test Interface:** http://localhost:8080/mobile-test.html
- **Metro Bundler:** http://localhost:8081

### Mobile App Network (from emulator)
- **Backend API:** http://10.0.2.2:3001
- **Test Interface:** http://10.0.2.2:8080/mobile-test.html

---

## 🎯 Success Indicators

You'll know everything is working when:

✅ **Backend:** Responds to `http://localhost:3001/health`  
✅ **Emulator:** Shows device in `adb devices`  
✅ **Metro:** Shows "Metro Server running on port 8081"  
✅ **App:** Launches on emulator with Hitch login screen  
✅ **API:** Mobile app can login with test credentials  

---

## 📞 Support & Debugging

### Useful Commands for Debugging

```powershell
# System Information
node --version
npm --version
adb --version
java -version

# Service Status
netstat -an | findstr "3001 8081"
adb devices
emulator -list-avds

# Clear Everything (Nuclear Option)
npx react-native clean
rm -rf node_modules
npm cache clean --force
npm install --legacy-peer-deps
```

### Log Files Location
- **Metro Logs:** Terminal output where Metro is running
- **Android Logs:** `adb logcat | grep -i hitch`
- **Backend Logs:** Terminal output where backend is running

---

## 🏆 Final Notes

- **Performance:** First build may take 5-10 minutes
- **Hot Reload:** Code changes will update automatically
- **Debugging:** Use Chrome DevTools for React Native debugging
- **Production:** This setup is for development only

**Ready to start developing! 🎉**