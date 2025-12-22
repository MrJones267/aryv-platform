#!/bin/bash

# Mobile Device Testing Setup Script
# Configures the mobile app for testing on real Android and iOS devices

echo "📱 HITCH MOBILE APP - DEVICE TESTING SETUP"
echo "==========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get current IP address
echo "🔍 Detecting your computer's IP address..."
IP_ADDRESS=$(ip addr show | grep "inet " | grep -v 127.0.0.1 | head -1 | awk '{print $2}' | cut -d'/' -f1)

if [ -z "$IP_ADDRESS" ]; then
    echo "❌ Could not detect IP address automatically"
    echo "Please enter your computer's IP address manually:"
    read -p "IP Address: " IP_ADDRESS
fi

echo -e "${GREEN}✅ Using IP Address: $IP_ADDRESS${NC}"
echo ""

# Update mobile app configuration
echo "🔧 Updating mobile app configuration..."
cd mobile-app

# Backup current config
cp .env .env.backup.$(date +%Y%m%d_%H%M%S)

# Update API URLs
sed -i "s/localhost/$IP_ADDRESS/g" .env
sed -i "s/127.0.0.1/$IP_ADDRESS/g" .env

echo -e "${GREEN}✅ Mobile app configured for device testing${NC}"
echo ""

# Update backend CORS configuration
echo "🔧 Updating backend CORS for mobile device access..."
cd ../backend

# Create CORS update for mobile testing
cat > src/middleware/corsConfig.mobile.ts << EOF
// CORS Configuration for Mobile Device Testing
import { CorsOptions } from 'cors';

const corsOptions: CorsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:8081',
    'http://localhost:8082',
    'http://$IP_ADDRESS:3000',
    'http://$IP_ADDRESS:3001',
    'http://$IP_ADDRESS:8081',
    'http://$IP_ADDRESS:8082',
    'http://192.168.*.*',
    'http://10.0.*.*',
    'http://172.*.*.*',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

export default corsOptions;
EOF

echo -e "${GREEN}✅ Backend CORS configured for mobile device access${NC}"
echo ""

# Test network connectivity
echo "🌐 Testing network connectivity..."
if curl -s http://$IP_ADDRESS:3001/health > /dev/null; then
    echo -e "${GREEN}✅ Backend accessible from IP address${NC}"
else
    echo -e "${YELLOW}⚠️  Backend not currently running or not accessible${NC}"
    echo "   Make sure to start the backend: cd backend && npm run dev"
fi
echo ""

# Display device setup instructions
echo "📱 DEVICE SETUP INSTRUCTIONS"
echo "============================="
echo ""
echo -e "${BLUE}For Android Devices:${NC}"
echo "1. Enable Developer Options (Settings → About → Tap Build Number 7 times)"
echo "2. Enable USB Debugging (Settings → Developer Options)"
echo "3. Connect device via USB"
echo "4. Run: cd mobile-app && npx react-native run-android"
echo ""

echo -e "${BLUE}For iOS Devices (Mac required):${NC}"
echo "1. Open Xcode"
echo "2. Connect device via USB"
echo "3. Trust computer on device"
echo "4. Run: cd mobile-app && npx react-native run-ios --device"
echo ""

echo -e "${BLUE}Alternative - APK/IPA Installation:${NC}"
echo "Android: cd mobile-app && ./scripts/build-release.sh android"
echo "iOS: cd mobile-app && ./scripts/build-release.sh ios"
echo ""

# Display testing URLs
echo "🔗 TESTING URLS"
echo "==============="
echo "Backend API: http://$IP_ADDRESS:3001"
echo "Backend Health: http://$IP_ADDRESS:3001/health"
echo "Admin Panel: http://$IP_ADDRESS:3000 (if running)"
echo ""

# Create quick test commands
echo "⚡ QUICK TEST COMMANDS"
echo "====================="
echo "# Test backend from mobile device browser:"
echo "curl http://$IP_ADDRESS:3001/health"
echo ""
echo "# Start backend server:"
echo "cd backend && npm run dev"
echo ""
echo "# Run on Android:"
echo "cd mobile-app && npx react-native run-android"
echo ""
echo "# Run on iOS:"
echo "cd mobile-app && npx react-native run-ios --device"
echo ""

# Final instructions
echo -e "${GREEN}🎉 MOBILE DEVICE TESTING SETUP COMPLETE!${NC}"
echo ""
echo "📋 Next Steps:"
echo "1. Start the backend server: cd backend && npm run dev"
echo "2. Connect your Android/iOS device"
echo "3. Run the app on your device using the commands above"
echo "4. Test from device browser: http://$IP_ADDRESS:3001/health"
echo ""
echo "📚 Complete guide available in: MOBILE_TESTING_ON_DEVICES.md"
echo ""