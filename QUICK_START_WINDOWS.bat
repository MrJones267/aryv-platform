@echo off
echo ============================================
echo    HITCH MOBILE APP - QUICK START
echo ============================================
echo.

REM Check if we're in the right directory
if not exist "simple-server.js" (
    echo ERROR: Please run this from the Hitch project root directory
    echo Expected to find: simple-server.js
    pause
    exit /b 1
)

echo Checking prerequisites...

REM Check Node.js
node --version >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js not found. Please install Node.js from nodejs.org
    pause
    exit /b 1
)

REM Check Android SDK
if not defined ANDROID_HOME (
    echo WARNING: ANDROID_HOME not set. Please set up Android SDK environment variables.
    echo See WINDOWS_MOBILE_SETUP_GUIDE.md for details
    pause
)

echo ✅ Prerequisites check completed
echo.

echo Starting Hitch Development Environment...
echo.

REM Create log directory
if not exist logs mkdir logs

echo 🚀 Step 1: Starting Backend Server...
start "Hitch Backend" cmd /k "echo Backend Server Starting... & node simple-server.js"
timeout /t 3 >nul

echo 📱 Step 2: Starting Android Emulator...
if defined ANDROID_HOME (
    start "Android Emulator" cmd /k "echo Starting Android Emulator... & %ANDROID_HOME%\emulator\emulator.exe @Pixel_4"
) else (
    echo Please start your Android emulator manually
)
timeout /t 3 >nul

echo 📦 Step 3: Installing Mobile App Dependencies...
cd mobile-app
if not exist node_modules (
    echo Installing dependencies... This may take a few minutes.
    npm install --legacy-peer-deps
)

echo 🔄 Step 4: Starting Metro Bundler...
start "Metro Bundler" cmd /k "echo Metro Bundler Starting... & npx react-native start --reset-cache"
timeout /t 5 >nul

echo 🔨 Step 5: Building and Deploying Mobile App...
echo This may take several minutes for the first build...
npx react-native run-android

echo.
echo ============================================
echo    HITCH MOBILE APP STARTED!
echo ============================================
echo.
echo Next Steps:
echo 1. Wait for the app to build and deploy (2-5 minutes)
echo 2. Test login with: user@hitch.com / user123
echo 3. Check backend at: http://localhost:3001/health
echo 4. Access admin panel at: http://localhost:8080/admin-dashboard.html
echo.
echo Windows open:
echo - Backend Server (keep running)
echo - Android Emulator (keep running)  
echo - Metro Bundler (keep running)
echo - This deployment window
echo.

pause