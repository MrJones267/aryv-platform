#!/bin/bash

# Hitch Mobile App - Device Testing Validation Script
# Automated testing and validation for Android devices

set -e

echo "📱 Hitch Mobile App - Device Testing Validation"
echo "============================================="

# Check if we're in the right directory (mobile app root)
if [ ! -f "package.json" ] || [ ! -d "android" ] || [ ! -d "src" ]; then
    echo "❌ Please run this script from the mobile-app directory"
    echo "Current directory: $(pwd)"
    echo "Expected files: package.json, android/, src/"
    exit 1
fi

echo "✅ Mobile app directory confirmed"

# Check backend servers are running
check_backend_status() {
    echo ""
    echo "🔍 Checking backend server status..."
    
    # Check real-time server
    if curl -s http://172.30.188.102:3002/health > /dev/null; then
        echo "✅ Real-time server (3002) is running"
    else
        echo "❌ Real-time server (3002) is not responding"
        echo "   Start with: node realtime-production-server.js"
        return 1
    fi
    
    # Check API backend
    if curl -s http://172.30.188.102:3001/api/health > /dev/null; then
        echo "✅ API backend (3001) is running"  
    else
        echo "❌ API backend (3001) is not responding"
        echo "   Start with: node simple-server.js"
        return 1
    fi
    
    echo "✅ All backend servers are operational"
    return 0
}

# Check Android device connection
check_device_connection() {
    echo ""
    echo "📱 Checking Android device connection..."
    
    if ! command -v adb &> /dev/null; then
        echo "❌ ADB (Android Debug Bridge) is not installed"
        echo "   Install Android SDK Platform Tools"
        return 1
    fi
    
    # Check for connected devices
    DEVICES=$(adb devices | grep -v "List of devices" | grep -v "^$" | wc -l)
    
    if [ $DEVICES -eq 0 ]; then
        echo "❌ No Android devices connected"
        echo "   Connect device via USB and enable USB debugging"
        echo "   Run: adb devices"
        return 1
    elif [ $DEVICES -eq 1 ]; then
        DEVICE_INFO=$(adb devices | grep -v "List" | grep -v "^$")
        echo "✅ Found 1 Android device: $DEVICE_INFO"
    else
        echo "✅ Found $DEVICES Android devices connected"
        adb devices
    fi
    
    # Check device is authorized
    if adb devices | grep -q "unauthorized"; then
        echo "❌ Device is connected but unauthorized"
        echo "   Check device screen for authorization dialog"
        return 1
    fi
    
    return 0
}

# Build and deploy to device
build_and_deploy() {
    echo ""
    echo "🔧 Building and deploying to Android device..."
    
    # Clean previous builds
    echo "Cleaning previous builds..."
    npx react-native clean || true
    cd android && ./gradlew clean && cd ..
    
    # Install dependencies  
    echo "Installing dependencies..."
    npm install
    
    # Build and run on device
    echo "Building and deploying to device..."
    echo "This may take 5-10 minutes for the first build..."
    
    timeout 600 npx react-native run-android --device || {
        echo "❌ Build/deployment failed or timed out"
        echo "Check the logs above for specific errors"
        return 1
    }
    
    echo "✅ App deployed to device successfully"
    return 0
}

# Wait for app to launch and test connectivity
test_app_functionality() {
    echo ""
    echo "🧪 Testing app functionality..."
    echo "Please perform the following tests on your device:"
    echo ""
    
    echo "📋 TESTING CHECKLIST:"
    echo "===================="
    
    read -p "1. App launched without crashes? (y/n): " app_launch
    read -p "2. Real-time connection status shows 🟢 Connected? (y/n): " realtime_connection
    read -p "3. Can authenticate/login successfully? (y/n): " authentication
    read -p "4. Location permission granted and GPS working? (y/n): " location_permission
    read -p "5. Can send/receive real-time messages? (y/n): " realtime_messaging
    read -p "6. Notifications appear correctly? (y/n): " notifications
    read -p "7. App responds smoothly during real-time updates? (y/n): " performance
    read -p "8. Network switching (WiFi ↔ Mobile) works? (y/n): " network_switching
    
    # Calculate test results
    tests_passed=0
    total_tests=8
    
    [[ $app_launch == "y" ]] && ((tests_passed++))
    [[ $realtime_connection == "y" ]] && ((tests_passed++))
    [[ $authentication == "y" ]] && ((tests_passed++))
    [[ $location_permission == "y" ]] && ((tests_passed++))
    [[ $realtime_messaging == "y" ]] && ((tests_passed++))
    [[ $notifications == "y" ]] && ((tests_passed++))
    [[ $performance == "y" ]] && ((tests_passed++))
    [[ $network_switching == "y" ]] && ((tests_passed++))
    
    success_rate=$((tests_passed * 100 / total_tests))
    
    echo ""
    echo "📊 TEST RESULTS:"
    echo "==============="
    echo "Tests Passed: $tests_passed/$total_tests"
    echo "Success Rate: $success_rate%"
    
    if [ $success_rate -ge 80 ]; then
        echo "✅ MOBILE DEVICE TESTING PASSED!"
        echo "   Your app is ready for production deployment"
        return 0
    elif [ $success_rate -ge 60 ]; then
        echo "⚠️  MOBILE DEVICE TESTING PARTIALLY PASSED"
        echo "   Some issues detected but app is functional"
        return 0
    else
        echo "❌ MOBILE DEVICE TESTING FAILED"
        echo "   Multiple issues need to be addressed"
        return 1
    fi
}

# Monitor device logs for issues
monitor_logs() {
    echo ""
    echo "📋 Monitoring device logs for issues..."
    echo "Press Ctrl+C to stop monitoring"
    echo ""
    
    # Monitor for crashes and errors
    adb logcat | grep -i -E "(hitch|react|error|crash|exception)" --color=always &
    LOG_PID=$!
    
    echo "Monitoring logs... (running in background)"
    echo "Log monitoring PID: $LOG_PID"
    echo "To stop: kill $LOG_PID"
    
    return 0
}

# Generate test report
generate_test_report() {
    echo ""
    echo "📄 Generating mobile device test report..."
    
    REPORT_FILE="mobile-device-test-report-$(date +%Y%m%d-%H%M%S).md"
    
    cat > "$REPORT_FILE" << EOF
# Mobile Device Test Report
**Date**: $(date)
**Platform**: Android
**Device**: $(adb shell getprop ro.product.model) 
**Android Version**: $(adb shell getprop ro.build.version.release)
**Test Duration**: $(date)

## Backend Status
- Real-time Server (3002): $(curl -s http://172.30.188.102:3002/health | grep -o '"success":[^,]*' || echo "❌ Not responding")
- API Backend (3001): $(curl -s http://172.30.188.102:3001/api/health | grep -o '"success":[^,]*' || echo "❌ Not responding")

## Device Configuration  
- IP Configuration: 172.30.188.102 (real-time server)
- Network: $(adb shell dumpsys connectivity | grep -A 1 "Active default network" || echo "Unknown")
- Battery Level: $(adb shell dumpsys battery | grep level | cut -d: -f2)%

## Test Results Summary
- App Launch: $app_launch
- Real-time Connection: $realtime_connection  
- Authentication: $authentication
- Location Services: $location_permission
- Real-time Messaging: $realtime_messaging
- Notifications: $notifications
- Performance: $performance
- Network Switching: $network_switching

**Overall Success Rate**: $success_rate%

## Recommendations
EOF

    if [ $success_rate -ge 80 ]; then
        echo "✅ PROCEED TO PRODUCTION DEPLOYMENT" >> "$REPORT_FILE"
        echo "The mobile app is working excellently on device." >> "$REPORT_FILE"
    elif [ $success_rate -ge 60 ]; then
        echo "⚠️ PROCEED WITH MONITORING" >> "$REPORT_FILE" 
        echo "Address minor issues but suitable for beta testing." >> "$REPORT_FILE"
    else
        echo "❌ REQUIRES FIXES BEFORE DEPLOYMENT" >> "$REPORT_FILE"
        echo "Multiple critical issues need resolution." >> "$REPORT_FILE"
    fi
    
    echo ""
    echo "📄 Test report saved to: $REPORT_FILE"
    echo "✅ Mobile device testing validation complete!"
}

# Main execution flow
main() {
    echo "🚀 Starting mobile device testing validation..."
    echo ""
    
    # Step 1: Check backend servers
    if ! check_backend_status; then
        echo ""
        echo "❌ Backend servers not ready. Please start them first:"
        echo "   Terminal 1: node realtime-production-server.js"
        echo "   Terminal 2: node simple-server.js"
        exit 1
    fi
    
    # Step 2: Check device connection
    if ! check_device_connection; then
        echo ""
        echo "❌ Android device not ready. Please:"
        echo "   1. Connect device via USB"
        echo "   2. Enable Developer Options"
        echo "   3. Enable USB Debugging"
        echo "   4. Authorize computer on device"
        exit 1
    fi
    
    # Step 3: Build and deploy
    echo ""
    read -p "Proceed with building and deploying to device? (y/n): " proceed_build
    if [[ $proceed_build != "y" ]]; then
        echo "❌ Build cancelled by user"
        exit 1
    fi
    
    if ! build_and_deploy; then
        echo ""
        echo "❌ Build/deployment failed. Check error messages above."
        exit 1
    fi
    
    # Step 4: Wait for app to launch
    echo ""
    echo "⏳ Waiting for app to launch on device..."
    echo "The app should appear on your device screen in 30-60 seconds."
    sleep 30
    
    # Step 5: Interactive testing
    test_app_functionality
    test_result=$?
    
    # Step 6: Generate report
    generate_test_report
    
    # Step 7: Next steps
    echo ""
    echo "🎯 NEXT STEPS:"
    echo "=============="
    
    if [ $test_result -eq 0 ]; then
        echo "✅ Mobile device testing successful!"
        echo ""
        echo "🚀 Ready for production deployment:"
        echo "   1. Set up cloud infrastructure (AWS/GCP)"
        echo "   2. Deploy backend services to cloud"  
        echo "   3. Update mobile app with production URLs"
        echo "   4. Submit to App Store/Google Play"
        echo ""
        echo "📈 Your Hitch platform is ready for real users!"
    else
        echo "❌ Mobile device testing needs attention"
        echo ""
        echo "🔧 Recommended fixes:"
        echo "   1. Review test failures above"
        echo "   2. Check device logs for specific errors"
        echo "   3. Test network connectivity"
        echo "   4. Verify backend server functionality"
    fi
    
    echo ""
    echo "📄 Detailed report saved to: $REPORT_FILE"
    echo "✅ Mobile device testing validation complete!"
    
    exit $test_result
}

# Execute main function
main "$@"