# Hitch Mobile App - Android Environment Setup Script
# Run this in PowerShell as Administrator

Write-Host "🚀 HITCH MOBILE APP - ANDROID ENVIRONMENT SETUP" -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Green
Write-Host ""

# Function to check if running as admin
function Test-Administrator {
    $currentUser = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($currentUser)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-NOT (Test-Administrator)) {
    Write-Host "❌ ERROR: This script must be run as Administrator" -ForegroundColor Red
    Write-Host "Right-click PowerShell and select 'Run as Administrator'" -ForegroundColor Yellow
    pause
    exit 1
}

Write-Host "✅ Running as Administrator" -ForegroundColor Green

# Check Node.js installation
Write-Host "🔍 Checking Node.js..." -ForegroundColor Cyan
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js found: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "❌ Node.js not found. Please install from https://nodejs.org" -ForegroundColor Red
    pause
    exit 1
}

# Check if Android Studio is installed
Write-Host "🔍 Checking for Android Studio..." -ForegroundColor Cyan
$androidStudioPaths = @(
    "${env:LOCALAPPDATA}\Android\Sdk",
    "${env:ProgramFiles}\Android\Android Studio\jre",
    "${env:ProgramFiles(x86)}\Android\Android Studio\jre"
)

$androidSdkPath = $null
foreach ($path in $androidStudioPaths) {
    if (Test-Path $path) {
        if ($path -like "*Sdk") {
            $androidSdkPath = $path
            break
        }
    }
}

if ($androidSdkPath) {
    Write-Host "✅ Android SDK found: $androidSdkPath" -ForegroundColor Green
} else {
    Write-Host "❌ Android SDK not found. Please install Android Studio first." -ForegroundColor Red
    Write-Host "Download from: https://developer.android.com/studio" -ForegroundColor Yellow
    pause
    exit 1
}

# Set ANDROID_HOME environment variable
Write-Host "🔧 Setting ANDROID_HOME environment variable..." -ForegroundColor Cyan
[Environment]::SetEnvironmentVariable("ANDROID_HOME", $androidSdkPath, "User")
$env:ANDROID_HOME = $androidSdkPath
Write-Host "✅ ANDROID_HOME set to: $androidSdkPath" -ForegroundColor Green

# Update PATH
Write-Host "🔧 Updating PATH..." -ForegroundColor Cyan
$currentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
$pathsToAdd = @(
    "$androidSdkPath\platform-tools",
    "$androidSdkPath\tools",
    "$androidSdkPath\emulator",
    "$androidSdkPath\cmdline-tools\latest\bin"
)

$newPath = $currentPath
foreach ($pathToAdd in $pathsToAdd) {
    if ($currentPath -notlike "*$pathToAdd*") {
        $newPath += ";$pathToAdd"
        Write-Host "  + Added: $pathToAdd" -ForegroundColor Gray
    }
}

[Environment]::SetEnvironmentVariable("PATH", $newPath, "User")
$env:PATH = $newPath
Write-Host "✅ PATH updated successfully" -ForegroundColor Green

# Test ADB
Write-Host "🧪 Testing ADB..." -ForegroundColor Cyan
try {
    $adbVersion = & "$androidSdkPath\platform-tools\adb.exe" version
    Write-Host "✅ ADB working: $($adbVersion -split "`n" | Select-Object -First 1)" -ForegroundColor Green
} catch {
    Write-Host "⚠️  ADB test failed, but continuing..." -ForegroundColor Yellow
}

# Install React Native CLI
Write-Host "🔧 Installing React Native CLI..." -ForegroundColor Cyan
try {
    npm install -g react-native-cli
    Write-Host "✅ React Native CLI installed" -ForegroundColor Green
} catch {
    Write-Host "⚠️  React Native CLI installation may have issues" -ForegroundColor Yellow
}

# Check for Java
Write-Host "🔍 Checking Java..." -ForegroundColor Cyan
try {
    $javaVersion = java -version 2>&1 | Select-Object -First 1
    Write-Host "✅ Java found: $javaVersion" -ForegroundColor Green
} catch {
    Write-Host "⚠️  Java not found. Android Studio should include OpenJDK." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "🎉 ANDROID ENVIRONMENT SETUP COMPLETE!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Green
Write-Host ""

Write-Host "📋 Next Steps:" -ForegroundColor Cyan
Write-Host "1. Restart PowerShell to apply environment changes" -ForegroundColor White
Write-Host "2. Open Android Studio and create an AVD (Virtual Device)" -ForegroundColor White
Write-Host "3. Run the mobile app with: .\QUICK_START_WINDOWS.bat" -ForegroundColor White
Write-Host ""

Write-Host "📞 Useful Commands:" -ForegroundColor Cyan
Write-Host "  adb devices          # Check connected devices" -ForegroundColor Gray
Write-Host "  emulator -list-avds  # List virtual devices" -ForegroundColor Gray
Write-Host "  node --version       # Check Node.js version" -ForegroundColor Gray
Write-Host ""

Write-Host "⚠️  IMPORTANT: Please restart PowerShell before continuing!" -ForegroundColor Yellow
pause