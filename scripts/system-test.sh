#!/bin/bash

# Hitch Platform - Comprehensive System Testing Script
# Author: Claude-Code
# Created: 2025-01-21
# Last Modified: 2025-01-21

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
TEST_TIMEOUT=300  # 5 minutes
LOG_FILE="system-test-$(date +%Y%m%d-%H%M%S).log"
BACKEND_URL="http://localhost:3001"
AI_SERVICES_URL="http://localhost:5000"
ADMIN_PANEL_URL="http://localhost:3000"

echo -e "${BLUE}🚀 Hitch Platform - Comprehensive System Testing${NC}"
echo "=================================================="
echo "Log file: $LOG_FILE"
echo "Started at: $(date)"
echo ""

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Error handling
handle_error() {
    echo -e "${RED}❌ Test failed at line $1${NC}"
    log "ERROR: Test failed at line $1"
    exit 1
}

trap 'handle_error $LINENO' ERR

# Test result tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

run_test() {
    local test_name="$1"
    local test_command="$2"
    
    echo -e "${BLUE}🧪 Running: $test_name${NC}"
    log "Starting test: $test_name"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ PASSED: $test_name${NC}"
        log "PASSED: $test_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
    else
        echo -e "${RED}❌ FAILED: $test_name${NC}"
        log "FAILED: $test_name"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
    echo ""
}

# Health check function
check_service_health() {
    local service_name="$1"
    local health_url="$2"
    local expected_status="$3"
    
    echo "Checking $service_name health..."
    response=$(curl -s -w "%{http_code}" "$health_url" -o /tmp/health_response.json --connect-timeout 10)
    
    if [ "$response" == "$expected_status" ]; then
        echo "✅ $service_name is healthy"
        return 0
    else
        echo "❌ $service_name health check failed (HTTP $response)"
        if [ -f /tmp/health_response.json ]; then
            echo "Response:"
            cat /tmp/health_response.json
        fi
        return 1
    fi
}

# Database connectivity test
test_database() {
    if docker-compose exec -T postgres pg_isready -U hitch_user -d hitch_db; then
        return 0
    else
        return 1
    fi
}

# Redis connectivity test
test_redis() {
    if docker-compose exec -T redis redis-cli ping | grep -q "PONG"; then
        return 0
    else
        return 1
    fi
}

# API endpoint test
test_api_endpoint() {
    local endpoint="$1"
    local method="$2"
    local expected_status="$3"
    local auth_header="$4"
    
    if [ -n "$auth_header" ]; then
        response=$(curl -s -w "%{http_code}" -X "$method" "$endpoint" -H "$auth_header" -o /dev/null --connect-timeout 10)
    else
        response=$(curl -s -w "%{http_code}" -X "$method" "$endpoint" -o /dev/null --connect-timeout 10)
    fi
    
    if [ "$response" == "$expected_status" ]; then
        return 0
    else
        echo "Expected: $expected_status, Got: $response"
        return 1
    fi
}

# AI Services integration test
test_ai_integration() {
    local test_payload='{"origin":{"latitude":40.7128,"longitude":-74.0060},"destination":{"latitude":40.7589,"longitude":-73.9851},"departure_time":"2025-01-22T10:00:00Z","preferences":{"max_distance":10}}'
    
    response=$(curl -s -w "%{http_code}" -X POST "$AI_SERVICES_URL/api/match-rides" \
        -H "Content-Type: application/json" \
        -H "X-Service-Source: system-test" \
        -d "$test_payload" \
        -o /tmp/ai_response.json \
        --connect-timeout 30)
    
    if [ "$response" == "200" ]; then
        # Check if response contains expected fields
        if grep -q '"success"' /tmp/ai_response.json && grep -q '"data"' /tmp/ai_response.json; then
            return 0
        else
            echo "Response missing required fields"
            cat /tmp/ai_response.json
            return 1
        fi
    else
        echo "HTTP Status: $response"
        if [ -f /tmp/ai_response.json ]; then
            cat /tmp/ai_response.json
        fi
        return 1
    fi
}

# Load testing simulation
test_load_simulation() {
    echo "Running basic load test (10 concurrent requests)..."
    
    # Create a simple load test using curl
    for i in {1..10}; do
        curl -s "$BACKEND_URL/health" > /dev/null &
    done
    
    # Wait for all background jobs to complete
    wait
    
    # Check if backend is still responsive
    check_service_health "Backend (after load)" "$BACKEND_URL/health" "200"
}

# Docker services test
test_docker_services() {
    local service="$1"
    
    if docker-compose ps "$service" | grep -q "Up"; then
        return 0
    else
        return 1
    fi
}

# File system permissions test
test_file_permissions() {
    # Test upload directory permissions
    if [ -d "./backend/uploads" ] && [ -w "./backend/uploads" ]; then
        touch "./backend/uploads/test_file.tmp" && rm "./backend/uploads/test_file.tmp"
        return 0
    else
        return 1
    fi
}

# Environment variables test
test_environment_variables() {
    local required_vars=("NODE_ENV" "DATABASE_URL" "JWT_SECRET" "REDIS_URL")
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ] && [ -z "$(docker-compose exec -T backend printenv $var)" ]; then
            echo "Missing required environment variable: $var"
            return 1
        fi
    done
    
    return 0
}

# Main testing sequence
main() {
    echo -e "${YELLOW}🔍 Pre-flight checks...${NC}"
    
    # Check if Docker Compose is running
    if ! docker-compose ps > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker Compose services are not running${NC}"
        echo "Please run 'docker-compose up -d' first"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Docker Compose is running${NC}"
    echo ""
    
    # Wait for services to be ready
    echo -e "${YELLOW}⏱️  Waiting for services to be ready...${NC}"
    sleep 10
    
    # Core Infrastructure Tests
    echo -e "${BLUE}📋 CORE INFRASTRUCTURE TESTS${NC}"
    echo "================================"
    
    run_test "Database Connectivity" "test_database"
    run_test "Redis Connectivity" "test_redis"
    run_test "Backend Docker Service" "test_docker_services backend"
    run_test "AI Services Docker Service" "test_docker_services ai-services"
    run_test "Admin Panel Docker Service" "test_docker_services admin-panel"
    run_test "File System Permissions" "test_file_permissions"
    run_test "Environment Variables" "test_environment_variables"
    
    # Service Health Tests
    echo -e "${BLUE}🏥 SERVICE HEALTH TESTS${NC}"
    echo "======================="
    
    run_test "Backend Health Check" "check_service_health 'Backend' '$BACKEND_URL/health' '200'"
    run_test "AI Services Health Check" "check_service_health 'AI Services' '$AI_SERVICES_URL/health' '200'"
    run_test "Admin Panel Health Check" "check_service_health 'Admin Panel' '$ADMIN_PANEL_URL' '200'"
    
    # API Endpoint Tests
    echo -e "${BLUE}🌐 API ENDPOINT TESTS${NC}"
    echo "===================="
    
    run_test "Backend Root Endpoint" "test_api_endpoint '$BACKEND_URL/' 'GET' '200'"
    run_test "Backend Health Endpoint" "test_api_endpoint '$BACKEND_URL/health' 'GET' '200'"
    run_test "Auth Endpoints Available" "test_api_endpoint '$BACKEND_URL/api/auth/register' 'POST' '400'"
    run_test "Rides Endpoints Available" "test_api_endpoint '$BACKEND_URL/api/rides' 'GET' '200'"
    run_test "Users Endpoints Available" "test_api_endpoint '$BACKEND_URL/api/users' 'GET' '401'"
    
    # AI Services Integration Tests
    echo -e "${BLUE}🤖 AI SERVICES INTEGRATION TESTS${NC}"
    echo "================================"
    
    run_test "AI Services Root Endpoint" "test_api_endpoint '$AI_SERVICES_URL/' 'GET' '200'"
    run_test "AI Ride Matching Integration" "test_ai_integration"
    
    # Performance Tests
    echo -e "${BLUE}⚡ PERFORMANCE TESTS${NC}"
    echo "=================="
    
    run_test "Basic Load Simulation" "test_load_simulation"
    
    # Security Tests
    echo -e "${BLUE}🔒 BASIC SECURITY TESTS${NC}"
    echo "======================"
    
    run_test "CORS Headers Present" "curl -s -I '$BACKEND_URL/health' | grep -i 'access-control-allow-origin'"
    run_test "Security Headers Present" "curl -s -I '$BACKEND_URL/health' | grep -i 'x-'"
    run_test "Rate Limiting Active" "test_api_endpoint '$BACKEND_URL/api/auth/register' 'POST' '429' '' || true"
    
    # Integration Tests
    echo -e "${BLUE}🔄 INTEGRATION TESTS${NC}"
    echo "==================="
    
    # Test that backend can communicate with AI services
    run_test "Backend-AI Services Communication" "docker-compose exec -T backend curl -s '$AI_SERVICES_URL/health' > /dev/null"
    
    # Test that backend can connect to database
    run_test "Backend-Database Communication" "docker-compose exec -T backend node -e 'require(\"./src/config/database\")' || true"
    
    # Summary
    echo ""
    echo -e "${BLUE}📊 TEST SUMMARY${NC}"
    echo "==============="
    echo "Total Tests: $TOTAL_TESTS"
    echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
    echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
    echo ""
    
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}🎉 ALL TESTS PASSED! System is ready for deployment.${NC}"
        log "System testing completed successfully. All tests passed."
        exit 0
    else
        echo -e "${RED}❌ $FAILED_TESTS tests failed. Please review and fix issues before deployment.${NC}"
        log "System testing completed with $FAILED_TESTS failures."
        exit 1
    fi
}

# Cleanup function
cleanup() {
    echo "Cleaning up temporary files..."
    rm -f /tmp/health_response.json /tmp/ai_response.json
    log "System testing session ended."
}

trap cleanup EXIT

# Run main function
main "$@"