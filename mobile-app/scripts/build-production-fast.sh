#!/bin/bash

# Hitch Mobile App - Fast Production Build (Skip Tests)
# This script generates production builds while skipping tests and non-critical checks

set -e

echo "🚀 Starting ARYV Mobile App Fast Production Build"
echo "================================================="

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo -e "${RED}❌ Error: package.json not found. Please run this script from the project root.${NC}"
    exit 1
fi

echo -e "${BLUE}📋 Pre-build Setup${NC}"
echo "--------------------------------"

# Check Node.js version
echo -e "${YELLOW}🔍 Checking Node.js version...${NC}"
node_version=$(node --version)
echo "Node.js version: $node_version"

# Ensure dependencies are installed
echo -e "${YELLOW}📦 Ensuring dependencies are installed...${NC}"
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
fi

# Check environment configuration
echo -e "${YELLOW}🔧 Setting up production environment...${NC}"
if [ ! -f ".env.production" ]; then
    echo -e "${RED}❌ Error: .env.production file not found${NC}"
    echo "Please create .env.production with your production configuration"
    exit 1
fi

# Copy production environment
cp .env.production .env

# Create bundle analysis directory
mkdir -p bundle-analysis

# Build Android APK
echo -e "${BLUE}🤖 Building Android Production APK${NC}"
echo "=================================="
echo -e "${YELLOW}Starting Android build process...${NC}"

cd android

# Clean only build directories
echo -e "${YELLOW}Cleaning build outputs...${NC}"
rm -rf app/build/outputs/apk/release/
rm -rf app/build/outputs/bundle/release/

# Kill any gradle daemons to avoid issues
echo -e "${YELLOW}Stopping Gradle daemons...${NC}"
./gradlew --stop || true

echo -e "${YELLOW}Building release APK...${NC}"
./gradlew assembleRelease --no-daemon

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Android APK build successful!${NC}"
    echo -e "${GREEN}📍 APK Location: android/app/build/outputs/apk/release/app-release.apk${NC}"
else
    echo -e "${RED}❌ Android APK build failed${NC}"
fi

# Build Android App Bundle (AAB)
echo -e "${YELLOW}Building release App Bundle (AAB)...${NC}"
./gradlew bundleRelease --no-daemon

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Android AAB build successful!${NC}"
    echo -e "${GREEN}📍 AAB Location: android/app/build/outputs/bundle/release/app-release.aab${NC}"
else
    echo -e "${RED}❌ Android AAB build failed${NC}"
fi

cd ..

# Generate build summary
echo -e "${BLUE}📊 Build Summary${NC}"
echo "=================="

echo -e "${YELLOW}Build Date:${NC} $(date)"
echo -e "${YELLOW}Node.js Version:${NC} $node_version"
echo -e "${YELLOW}Environment:${NC} Production"

# Check build outputs
echo ""
echo -e "${BLUE}📁 Build Outputs:${NC}"

# Android outputs
if [ -f "android/app/build/outputs/apk/release/app-release.apk" ]; then
    apk_size=$(du -h android/app/build/outputs/apk/release/app-release.apk | cut -f1)
    echo -e "${GREEN}✅ Android APK:${NC} $apk_size (android/app/build/outputs/apk/release/app-release.apk)"
else
    echo -e "${RED}❌ Android APK: Build failed${NC}"
fi

if [ -f "android/app/build/outputs/bundle/release/app-release.aab" ]; then
    aab_size=$(du -h android/app/build/outputs/bundle/release/app-release.aab | cut -f1)
    echo -e "${GREEN}✅ Android AAB:${NC} $aab_size (android/app/build/outputs/bundle/release/app-release.aab)"
else
    echo -e "${RED}❌ Android AAB: Build failed${NC}"
fi

# Next steps
echo ""
echo -e "${BLUE}🎯 Next Steps:${NC}"
echo "1. Test the APK on physical Android devices"
echo "2. Upload AAB to Google Play Console for internal testing"
echo "3. Generate screenshots for app store listings"
echo "4. Complete app store metadata and submit for review"

echo ""
echo -e "${GREEN}🎉 Fast production build completed!${NC}"
echo "=========================================="

# Restore original environment
rm -f .env