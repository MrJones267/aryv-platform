#!/bin/bash

# Comprehensive Local Production Testing Script
# Tests all production features locally before deployment

echo "🧪 LOCAL PRODUCTION TESTING - COMPREHENSIVE TEST SUITE"
echo "======================================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run test
run_test() {
    local test_name="$1"
    local test_command="$2"
    local expected_pattern="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -n "Testing $test_name... "
    
    result=$(eval "$test_command" 2>/dev/null)
    
    if echo "$result" | grep -q "$expected_pattern"; then
        echo -e "${GREEN}✅ PASS${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}❌ FAIL${NC}"
        echo "   Expected: $expected_pattern"
        echo "   Got: $result"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

# Test JWT token extraction
extract_jwt_token() {
    curl -s -X POST http://localhost:3001/api/admin/auth/login \
        -H "Content-Type: application/json" \
        -d '{"email":"admin@hitch.com","password":"admin123"}' | \
        grep -o '"token":"[^"]*"' | \
        cut -d'"' -f4
}

echo "🔧 BACKEND PRODUCTION CONFIGURATION TESTS"
echo "==========================================="

# Test 1: Backend Health Check
run_test "Backend Health Check" \
    "curl -s http://localhost:3001/health" \
    '"success":true'

# Test 2: Admin Authentication with Production JWT
run_test "Admin Authentication (Production JWT)" \
    "curl -s -X POST http://localhost:3001/api/admin/auth/login -H 'Content-Type: application/json' -d '{\"email\":\"admin@hitch.com\",\"password\":\"admin123\"}'" \
    '"success":true'

# Test 3: JWT Token Validation
echo -n "Testing JWT Token Validation... "
JWT_TOKEN=$(extract_jwt_token)
if [ -n "$JWT_TOKEN" ] && [ ${#JWT_TOKEN} -gt 100 ]; then
    echo -e "${GREEN}✅ PASS${NC} (Token length: ${#JWT_TOKEN} chars)"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ FAIL${NC} (Token too short or missing)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Test 4: Production Rate Limiting Headers
run_test "Rate Limiting Headers" \
    "curl -s -I http://localhost:3001/health" \
    "X-RateLimit-"

# Test 5: Security Headers (Helmet.js)
run_test "Security Headers (Helmet)" \
    "curl -s -I http://localhost:3001/health" \
    "X-Content-Type-Options"

# Test 6: CORS Configuration
run_test "CORS Configuration" \
    "curl -s -H 'Origin: http://localhost:3000' -I http://localhost:3001/health" \
    "Access-Control-Allow-Origin"

echo ""
echo "📊 DATABASE INTEGRATION TESTS"
echo "============================="

# Test 7: Database Connection
run_test "Database Connection" \
    "docker exec hitch-postgres pg_isready -U hitch_user" \
    "accepting connections"

# Test 8: Redis Connection  
run_test "Redis Connection" \
    "docker exec hitch-redis redis-cli ping" \
    "PONG"

echo ""
echo "🔐 PRODUCTION SECURITY TESTS"
echo "============================"

# Test 9: Environment Variables
echo -n "Testing Production Environment Variables... "
if grep -q "NODE_ENV=production" backend/.env && grep -q "ADMIN_JWT_SECRET=" backend/.env; then
    echo -e "${GREEN}✅ PASS${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ FAIL${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Test 10: Strong Passwords
echo -n "Testing Strong Password Generation... "
PASSWORD_LENGTH=$(grep "POSTGRES_PASSWORD=" backend/.env | cut -d'=' -f2 | wc -c)
if [ $PASSWORD_LENGTH -gt 30 ]; then
    echo -e "${GREEN}✅ PASS${NC} (${PASSWORD_LENGTH} chars)"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ FAIL${NC} (${PASSWORD_LENGTH} chars - too short)"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

echo ""
echo "📱 MOBILE APP CONFIGURATION TESTS"
echo "=================================="

# Test 11: Mobile App Environment
echo -n "Testing Mobile App Environment... "
if grep -q "API_BASE_URL=http://localhost:3001" mobile-app/.env; then
    echo -e "${GREEN}✅ PASS${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
else
    echo -e "${RED}❌ FAIL${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

# Test 12: Web Test Interface
run_test "Web Test Interface" \
    "curl -s http://localhost:8082" \
    "Hitch Mobile App"

echo ""
echo "🚀 API ENDPOINT COMPREHENSIVE TESTS"
echo "===================================="

# Test 13: Dashboard Analytics
run_test "Dashboard Analytics API" \
    "curl -s http://localhost:3001/api/admin/analytics/dashboard" \
    "success"

# Test 14: Auth Token Verification
if [ -n "$JWT_TOKEN" ]; then
    run_test "Token Verification API" \
        "curl -s -H 'Authorization: Bearer $JWT_TOKEN' http://localhost:3001/api/admin/auth/verify" \
        "success"
else
    echo "Skipping token verification test (no token available)"
fi

echo ""
echo "📋 PRODUCTION READINESS CHECKLIST"
echo "=================================="

# Check production files exist
echo -n "Production environment files... "
if [ -f "backend/.env.production.secure" ] && [ -f "admin-panel/.env.production.secure" ] && [ -f "mobile-app/.env.production.secure" ]; then
    echo -e "${GREEN}✅ PRESENT${NC}"
else
    echo -e "${RED}❌ MISSING${NC}"
fi

# Check deployment scripts
echo -n "Deployment scripts... "
if [ -f "scripts/deploy-production.sh" ] && [ -f "scripts/configure-domains.sh" ] && [ -f "scripts/setup-ssl-certificates.sh" ]; then
    echo -e "${GREEN}✅ PRESENT${NC}"
else
    echo -e "${RED}❌ MISSING${NC}"
fi

# Check documentation
echo -n "Production documentation... "
if [ -f "PRODUCTION_DEPLOYMENT_COMPLETE.md" ] && [ -f "PRODUCTION_SETUP_ASSISTANT.md" ]; then
    echo -e "${GREEN}✅ PRESENT${NC}"
else
    echo -e "${RED}❌ MISSING${NC}"
fi

echo ""
echo "📊 TEST RESULTS SUMMARY"
echo "======================="
echo "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo ""
    echo -e "${GREEN}🎉 ALL TESTS PASSED! 🎉${NC}"
    echo -e "${GREEN}✅ Your Hitch platform is ready for production deployment!${NC}"
    echo ""
    echo "📋 Next Steps:"
    echo "1. Get a production server (DigitalOcean, AWS, etc.)"
    echo "2. Purchase a domain name"
    echo "3. Run: ./scripts/deploy-production.sh"
    echo "4. Configure external services (Stripe, SendGrid, etc.)"
    echo ""
else
    echo ""
    echo -e "${YELLOW}⚠️  Some tests failed. Please review and fix before production deployment.${NC}"
    echo ""
fi

echo "🔗 Test URLs:"
echo "• Backend API: http://localhost:3001"
echo "• Web Test Interface: http://localhost:8082"
echo "• Admin Panel: http://localhost:3000 (if running)"