#!/bin/bash

# Hitch Mobile App - Release Build Script
# This script prepares the mobile app for app store deployment

set -e

echo "📱 Preparing Hitch mobile app for release..."

# Configuration
APP_NAME="Hitch"
BUNDLE_ID="com.hitch.mobile"
VERSION_NAME="1.0.0"
VERSION_CODE="1"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Function to check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    
    # Check React Native CLI
    if ! command -v react-native &> /dev/null; then
        print_error "React Native CLI is not installed"
        exit 1
    fi
    
    # Check environment file
    if [ ! -f ".env" ]; then
        print_warning ".env file not found, copying from .env.production"
        cp .env.production .env
    fi
    
    print_success "Prerequisites check passed"
}

# Function to clean project
clean_project() {
    print_status "Cleaning project..."
    
    # Clean React Native
    npx react-native clean
    
    # Clean node modules and reinstall
    rm -rf node_modules
    npm install
    
    # Clean iOS (if on macOS)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        cd ios
        rm -rf build
        rm -rf Pods
        rm -f Podfile.lock
        pod install
        cd ..
    fi
    
    # Clean Android
    cd android
    ./gradlew clean
    cd ..
    
    print_success "Project cleaned successfully"
}

# Function to run tests
run_tests() {
    print_status "Running tests..."
    
    # Run TypeScript type checking
    npm run type-check
    
    # Run linting
    npm run lint
    
    # Run unit tests
    npm test -- --watchAll=false
    
    print_success "All tests passed"
}

# Function to build Android release
build_android() {
    print_status "Building Android release..."
    
    cd android
    
    # Generate signed APK
    ./gradlew assembleRelease
    
    # Generate signed AAB (for Play Store)
    ./gradlew bundleRelease
    
    cd ..
    
    # Check if files were generated
    APK_PATH="android/app/build/outputs/apk/release/app-release.apk"
    AAB_PATH="android/app/build/outputs/bundle/release/app-release.aab"
    
    if [ -f "$APK_PATH" ]; then
        print_success "Android APK generated: $APK_PATH"
    else
        print_error "Failed to generate Android APK"
        exit 1
    fi
    
    if [ -f "$AAB_PATH" ]; then
        print_success "Android AAB generated: $AAB_PATH"
    else
        print_error "Failed to generate Android AAB"
        exit 1
    fi
}

# Function to build iOS release
build_ios() {
    if [[ "$OSTYPE" != "darwin"* ]]; then
        print_warning "iOS build skipped (macOS required)"
        return
    fi
    
    print_status "Building iOS release..."
    
    # Build iOS app
    npx react-native run-ios --configuration Release
    
    # Archive for App Store (requires Xcode)
    cd ios
    xcodebuild -workspace HitchMobile.xcworkspace \
               -scheme HitchMobile \
               -configuration Release \
               -archivePath build/HitchMobile.xcarchive \
               archive
    
    # Export IPA
    xcodebuild -exportArchive \
               -archivePath build/HitchMobile.xcarchive \
               -exportPath build/ \
               -exportOptionsPlist exportOptions.plist
    
    cd ..
    
    print_success "iOS build completed"
}

# Function to generate app icons
generate_icons() {
    print_status "Checking app icons..."
    
    # Check if app icons exist
    if [ ! -d "android/app/src/main/res/mipmap-hdpi" ]; then
        print_warning "Android app icons not found"
    fi
    
    if [[ "$OSTYPE" == "darwin"* ]] && [ ! -d "ios/HitchMobile/Images.xcassets/AppIcon.appiconset" ]; then
        print_warning "iOS app icons not found"
    fi
    
    print_status "App icon check completed"
}

# Function to create release notes
create_release_notes() {
    print_status "Creating release notes..."
    
    cat > RELEASE_NOTES.md << EOF
# Hitch Mobile App - Release v$VERSION_NAME

## What's New
- Complete ride-sharing platform
- Real-time ride tracking
- In-app messaging
- Secure payment processing
- Courier package delivery service
- User verification system

## Features
- ✅ User registration and authentication
- ✅ Ride booking and management
- ✅ Real-time GPS tracking
- ✅ In-app payment with Stripe
- ✅ Push notifications
- ✅ Package delivery service
- ✅ Driver and passenger ratings
- ✅ Trip history and receipts

## Technical Details
- Version: $VERSION_NAME
- Build: $VERSION_CODE
- Platform: React Native 0.72.7
- Minimum iOS: 12.0
- Minimum Android: API 21 (Android 5.0)

## App Store Information
- Bundle ID: $BUNDLE_ID
- Category: Travel & Transportation
- Content Rating: 4+ (iOS) / Everyone (Android)

## Build Information
- Built on: $(date)
- Git Commit: $(git rev-parse --short HEAD 2>/dev/null || echo "N/A")
- Environment: Production

---
Generated automatically by build script
EOF

    print_success "Release notes created: RELEASE_NOTES.md"
}

# Function to create app store assets guide
create_store_guide() {
    print_status "Creating app store deployment guide..."
    
    cat > APP_STORE_DEPLOYMENT.md << EOF
# App Store Deployment Guide

## iOS App Store (Apple)

### Prerequisites
- Apple Developer Account (\$99/year)
- Xcode with valid signing certificates
- App Store Connect access

### Steps
1. Open \`ios/HitchMobile.xcworkspace\` in Xcode
2. Update signing certificates and provisioning profiles
3. Archive the app (Product → Archive)
4. Upload to App Store Connect
5. Fill out app information and metadata
6. Submit for review

### Required Information
- App Name: Hitch
- Bundle ID: $BUNDLE_ID
- Version: $VERSION_NAME
- Privacy Policy URL: https://yourdomain.com/privacy
- Terms of Service URL: https://yourdomain.com/terms

## Google Play Store (Android)

### Prerequisites
- Google Play Console account (\$25 one-time)
- Signed AAB file

### Steps
1. Upload \`android/app/build/outputs/bundle/release/app-release.aab\`
2. Fill out store listing information
3. Upload screenshots and app icons
4. Set content rating and pricing
5. Submit for review

### Required Assets
- App icon: 512x512 PNG
- Feature graphic: 1024x500 PNG
- Screenshots: Various sizes for phones and tablets
- Privacy Policy URL: https://yourdomain.com/privacy

## App Screenshots Required

### iOS Screenshots
- iPhone 6.7" Display (1284x2778): 3-10 screenshots
- iPhone 6.5" Display (1242x2688): 3-10 screenshots
- iPhone 5.5" Display (1242x2208): 3-10 screenshots
- iPad Pro 12.9" Display (2048x2732): 3-10 screenshots

### Android Screenshots
- Phone: 1080x1920 (minimum), up to 8 screenshots
- 7" Tablet: 1200x1920, up to 8 screenshots
- 10" Tablet: 1440x2560, up to 8 screenshots

## App Store Optimization (ASO)

### Keywords (iOS)
transportation, ride sharing, taxi, uber, lyft, car sharing, travel

### Description Template
Make traveling easier with Hitch - the complete ride-sharing and delivery platform.

KEY FEATURES:
• Book rides instantly with real-time tracking
• Secure in-app payments
• Professional verified drivers
• Package delivery service
• 24/7 customer support
• Ride history and receipts

SAFETY FIRST:
• GPS tracking for all rides
• Driver verification system
• Emergency contact features
• Insurance coverage

Download Hitch today and experience seamless transportation!

## Post-Launch Checklist
- [ ] Monitor app store reviews
- [ ] Track download metrics
- [ ] Set up crash reporting
- [ ] Plan update schedule
- [ ] Prepare customer support

---
Generated on: $(date)
EOF

    print_success "App store deployment guide created: APP_STORE_DEPLOYMENT.md"
}

# Main execution
main() {
    echo "🚀 Starting Hitch mobile app release build process..."
    echo ""
    
    # Check prerequisites
    check_prerequisites
    
    # Ask user what to build
    echo "What would you like to build?"
    echo "1) Android only"
    echo "2) iOS only (macOS required)"
    echo "3) Both Android and iOS"
    echo "4) Clean and prepare only"
    
    read -p "Enter your choice (1-4): " choice
    
    case $choice in
        1|3)
            echo "📱 Building Android release..."
            clean_project
            run_tests
            generate_icons
            build_android
            ;;
        2|3)
            echo "📱 Building iOS release..."
            if [[ $choice == "2" ]]; then
                clean_project
                run_tests
                generate_icons
            fi
            build_ios
            ;;
        4)
            echo "🧹 Cleaning and preparing project..."
            clean_project
            run_tests
            generate_icons
            ;;
        *)
            print_error "Invalid choice"
            exit 1
            ;;
    esac
    
    # Create documentation
    create_release_notes
    create_store_guide
    
    echo ""
    print_success "🎉 Mobile app release preparation completed!"
    echo ""
    print_status "Next steps:"
    echo "1. Review RELEASE_NOTES.md"
    echo "2. Follow APP_STORE_DEPLOYMENT.md for store submission"
    echo "3. Upload builds to respective app stores"
    echo "4. Fill out store listings and metadata"
    echo "5. Submit for review"
    echo ""
    print_status "Build artifacts:"
    if [ -f "android/app/build/outputs/apk/release/app-release.apk" ]; then
        echo "📦 Android APK: android/app/build/outputs/apk/release/app-release.apk"
    fi
    if [ -f "android/app/build/outputs/bundle/release/app-release.aab" ]; then
        echo "📦 Android AAB: android/app/build/outputs/bundle/release/app-release.aab"
    fi
    if [[ "$OSTYPE" == "darwin"* ]] && [ -d "ios/build" ]; then
        echo "📦 iOS Archive: ios/build/HitchMobile.xcarchive"
    fi
}

# Run main function
main "$@"