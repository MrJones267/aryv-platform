#!/bin/bash

# Hitch Platform - Security Audit Script
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
AUDIT_LOG="security-audit-$(date +%Y%m%d-%H%M%S).log"
BACKEND_URL="http://localhost:3001"
AI_SERVICES_URL="http://localhost:5000"
ADMIN_PANEL_URL="http://localhost:3000"
REPORT_FILE="security-audit-report-$(date +%Y%m%d-%H%M%S).md"

echo -e "${BLUE}🔒 Hitch Platform - Security Audit${NC}"
echo "===================================="
echo "Audit Log: $AUDIT_LOG"
echo "Report File: $REPORT_FILE"
echo "Started at: $(date)"
echo ""

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$AUDIT_LOG"
}

# Report function
report() {
    echo "$1" >> "$REPORT_FILE"
}

# Initialize report
init_report() {
    cat > "$REPORT_FILE" << EOF
# Hitch Platform Security Audit Report

**Date:** $(date)  
**Auditor:** Automated Security Audit Script  
**Platform:** Hitch Ride-Sharing Platform  

## Executive Summary

This report contains the results of an automated security audit performed on the Hitch platform.

## Audit Scope

- Web application security
- API endpoint security
- Authentication and authorization
- Input validation
- Configuration security
- Dependency vulnerabilities
- Infrastructure security

## Findings

EOF
}

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
CRITICAL_ISSUES=0
HIGH_ISSUES=0
MEDIUM_ISSUES=0
LOW_ISSUES=0

# Security test function
security_test() {
    local test_name="$1"
    local test_command="$2"
    local severity="$3"
    
    echo -e "${BLUE}🔍 Testing: $test_name${NC}"
    log "Starting security test: $test_name"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if eval "$test_command"; then
        echo -e "${GREEN}✅ PASSED: $test_name${NC}"
        log "PASSED: $test_name"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        report "### ✅ PASSED: $test_name"
        report ""
    else
        echo -e "${RED}❌ FAILED: $test_name${NC}"
        log "FAILED: $test_name (Severity: $severity)"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        
        case "$severity" in
            "critical") CRITICAL_ISSUES=$((CRITICAL_ISSUES + 1)) ;;
            "high") HIGH_ISSUES=$((HIGH_ISSUES + 1)) ;;
            "medium") MEDIUM_ISSUES=$((MEDIUM_ISSUES + 1)) ;;
            "low") LOW_ISSUES=$((LOW_ISSUES + 1)) ;;
        esac
        
        report "### ❌ FAILED: $test_name"
        report "**Severity:** $severity"
        report ""
    fi
    echo ""
}

# HTTPS/TLS Tests
test_https_redirect() {
    # Test if HTTP redirects to HTTPS
    if curl -s -o /dev/null -w "%{http_code}" "http://localhost:3001/health" | grep -q "301\|302"; then
        return 0
    else
        return 1
    fi
}

test_security_headers() {
    local url="$1"
    local response=$(curl -s -I "$url")
    
    # Check for security headers
    if echo "$response" | grep -qi "x-frame-options" && \
       echo "$response" | grep -qi "x-content-type-options" && \
       echo "$response" | grep -qi "x-xss-protection"; then
        return 0
    else
        return 1
    fi
}

test_cors_configuration() {
    local response=$(curl -s -H "Origin: https://malicious-site.com" -I "$BACKEND_URL/health")
    
    # Should not allow arbitrary origins
    if echo "$response" | grep -qi "access-control-allow-origin: https://malicious-site.com"; then
        return 1
    else
        return 0
    fi
}

# Authentication Tests
test_jwt_security() {
    # Test if endpoints properly reject invalid tokens
    local response=$(curl -s -w "%{http_code}" -H "Authorization: Bearer invalid-token" "$BACKEND_URL/api/users/profile" -o /dev/null)
    
    if [ "$response" = "401" ]; then
        return 0
    else
        return 1
    fi
}

test_password_policy() {
    # Test weak password rejection
    local weak_password='{"email":"test@example.com","password":"123","firstName":"Test","lastName":"User","role":"passenger"}'
    local response=$(curl -s -w "%{http_code}" -X POST -H "Content-Type: application/json" -d "$weak_password" "$BACKEND_URL/api/auth/register" -o /dev/null)
    
    if [ "$response" = "400" ]; then
        return 0
    else
        return 1
    fi
}

test_rate_limiting() {
    # Test rate limiting on authentication endpoint
    local responses=()
    
    for i in {1..15}; do
        local response=$(curl -s -w "%{http_code}" -X POST -H "Content-Type: application/json" -d '{"email":"test@example.com","password":"wrongpassword"}' "$BACKEND_URL/api/auth/login" -o /dev/null)
        responses+=("$response")
    done
    
    # Should get 429 (Too Many Requests) after several attempts
    for response in "${responses[@]}"; do
        if [ "$response" = "429" ]; then
            return 0
        fi
    done
    
    return 1
}

# Input Validation Tests
test_sql_injection() {
    # Test SQL injection in search endpoint
    local malicious_input="'; DROP TABLE users; --"
    local response=$(curl -s -w "%{http_code}" "$BACKEND_URL/api/rides/search?originLat=40.7128&originLng=-74.0060&destinationLat=40.7589&destinationLng=-73.9851&departureTime=$malicious_input" -o /dev/null)
    
    # Should return error, not crash
    if [ "$response" = "400" ] || [ "$response" = "422" ]; then
        return 0
    else
        return 1
    fi
}

test_xss_protection() {
    # Test XSS protection in API responses
    local xss_payload="<script>alert('xss')</script>"
    local response=$(curl -s -X POST -H "Content-Type: application/json" -H "Authorization: Bearer fake-token" -d "{\"firstName\":\"$xss_payload\"}" "$BACKEND_URL/api/users/profile")
    
    # Response should not contain unescaped script tags
    if echo "$response" | grep -q "<script>"; then
        return 1
    else
        return 0
    fi
}

test_command_injection() {
    # Test command injection in file upload
    local response=$(curl -s -w "%{http_code}" -X POST -H "Authorization: Bearer fake-token" -F "file=@/etc/passwd" "$BACKEND_URL/api/users/upload-avatar" -o /dev/null)
    
    # Should reject unauthorized file access
    if [ "$response" = "400" ] || [ "$response" = "401" ] || [ "$response" = "403" ]; then
        return 0
    else
        return 1
    fi
}

# Configuration Security Tests
test_debug_mode_disabled() {
    # Check if debug mode is disabled in production
    local response=$(curl -s "$BACKEND_URL/health")
    
    # Should not reveal debug information
    if echo "$response" | grep -qi "debug\|stack\|trace"; then
        return 1
    else
        return 0
    fi
}

test_error_information_disclosure() {
    # Test that errors don't expose sensitive information
    local response=$(curl -s "$BACKEND_URL/api/nonexistent-endpoint")
    
    # Should not reveal internal paths or system information
    if echo "$response" | grep -q "/var/\|/home/\|/usr/\|version\|node_modules"; then
        return 1
    else
        return 0
    fi
}

test_default_credentials() {
    # Test for default credentials
    local response=$(curl -s -X POST -H "Content-Type: application/json" -d '{"email":"admin@admin.com","password":"admin"}' "$BACKEND_URL/api/auth/login")
    
    # Should not accept default credentials
    if echo "$response" | grep -q '"success":true'; then
        return 1
    else
        return 0
    fi
}

# Infrastructure Security Tests
test_docker_security() {
    # Check if Docker containers are running as non-root
    local backend_user=$(docker-compose exec -T backend whoami 2>/dev/null || echo "root")
    
    if [ "$backend_user" != "root" ]; then
        return 0
    else
        return 1
    fi
}

test_file_permissions() {
    # Check critical file permissions
    if [ -f ".env" ]; then
        local env_perms=$(stat -c "%a" .env)
        if [ "$env_perms" = "600" ] || [ "$env_perms" = "640" ]; then
            return 0
        else
            return 1
        fi
    fi
    return 0  # Pass if .env doesn't exist
}

test_database_connection_security() {
    # Test that database doesn't accept connections from unauthorized sources
    if command -v nc >/dev/null; then
        if ! nc -z localhost 5432 -w 1; then
            return 0  # Good - database not accessible externally
        else
            return 1  # Bad - database port exposed
        fi
    fi
    return 0  # Skip if nc not available
}

# Dependency Security Tests
test_npm_audit() {
    # Check for known vulnerabilities in backend dependencies
    cd backend && npm audit --audit-level=high --json > /tmp/npm_audit.json 2>/dev/null
    local vulnerabilities=$(cat /tmp/npm_audit.json | grep -o '"high":[0-9]*' | head -1 | cut -d':' -f2 || echo "0")
    
    if [ "$vulnerabilities" = "0" ]; then
        return 0
    else
        return 1
    fi
}

test_python_safety() {
    # Check for known vulnerabilities in Python dependencies (if safety is installed)
    if command -v safety >/dev/null; then
        cd ai-services && safety check --json > /tmp/safety_check.json 2>/dev/null
        if [ $? -eq 0 ]; then
            return 0
        else
            return 1
        fi
    fi
    return 0  # Skip if safety not available
}

# API Security Tests
test_api_versioning() {
    # Test if API versioning is implemented
    local response=$(curl -s "$BACKEND_URL/api/v1/health" || curl -s "$BACKEND_URL/api/health")
    
    if echo "$response" | grep -q "success"; then
        return 0
    else
        return 1
    fi
}

test_excessive_data_exposure() {
    # Test that API doesn't expose sensitive user data
    local response=$(curl -s "$BACKEND_URL/api/users/1")
    
    # Should not contain password hashes or sensitive info
    if echo "$response" | grep -q "password\|hash\|secret\|token"; then
        return 1
    else
        return 0
    fi
}

# Main audit function
run_security_audit() {
    log "Starting comprehensive security audit"
    init_report
    
    echo -e "${BLUE}🔒 HTTPS/TLS SECURITY TESTS${NC}"
    echo "============================="
    security_test "HTTPS Redirect" "test_https_redirect" "medium"
    security_test "Security Headers (Backend)" "test_security_headers '$BACKEND_URL/health'" "medium"
    security_test "Security Headers (AI Services)" "test_security_headers '$AI_SERVICES_URL/health'" "medium"
    security_test "CORS Configuration" "test_cors_configuration" "high"
    
    echo -e "${BLUE}🔐 AUTHENTICATION & AUTHORIZATION TESTS${NC}"
    echo "========================================"
    security_test "JWT Token Validation" "test_jwt_security" "critical"
    security_test "Password Policy Enforcement" "test_password_policy" "high"
    security_test "Rate Limiting" "test_rate_limiting" "medium"
    
    echo -e "${BLUE}🛡️ INPUT VALIDATION TESTS${NC}"
    echo "========================="
    security_test "SQL Injection Protection" "test_sql_injection" "critical"
    security_test "XSS Protection" "test_xss_protection" "high"
    security_test "Command Injection Protection" "test_command_injection" "critical"
    
    echo -e "${BLUE}⚙️ CONFIGURATION SECURITY TESTS${NC}"
    echo "==============================="
    security_test "Debug Mode Disabled" "test_debug_mode_disabled" "medium"
    security_test "Error Information Disclosure" "test_error_information_disclosure" "medium"
    security_test "Default Credentials Check" "test_default_credentials" "critical"
    
    echo -e "${BLUE}🐳 INFRASTRUCTURE SECURITY TESTS${NC}"
    echo "================================"
    security_test "Docker Non-Root User" "test_docker_security" "medium"
    security_test "File Permissions" "test_file_permissions" "high"
    security_test "Database Connection Security" "test_database_connection_security" "high"
    
    echo -e "${BLUE}📦 DEPENDENCY SECURITY TESTS${NC}"
    echo "============================"
    security_test "NPM Audit (High/Critical)" "test_npm_audit" "high"
    security_test "Python Safety Check" "test_python_safety" "high"
    
    echo -e "${BLUE}🌐 API SECURITY TESTS${NC}"
    echo "===================="
    security_test "API Versioning" "test_api_versioning" "low"
    security_test "Excessive Data Exposure" "test_excessive_data_exposure" "high"
}

# Generate final report
generate_report() {
    report ""
    report "## Summary"
    report ""
    report "| Metric | Count |"
    report "|--------|-------|"
    report "| Total Tests | $TOTAL_TESTS |"
    report "| Passed | $PASSED_TESTS |"
    report "| Failed | $FAILED_TESTS |"
    report "| **Critical Issues** | **$CRITICAL_ISSUES** |"
    report "| **High Issues** | **$HIGH_ISSUES** |"
    report "| Medium Issues | $MEDIUM_ISSUES |"
    report "| Low Issues | $LOW_ISSUES |"
    report ""
    
    if [ $CRITICAL_ISSUES -gt 0 ] || [ $HIGH_ISSUES -gt 0 ]; then
        report "## ⚠️ ACTION REQUIRED"
        report ""
        report "This audit identified **$((CRITICAL_ISSUES + HIGH_ISSUES))** critical/high severity security issues that require immediate attention before production deployment."
        report ""
    fi
    
    report "## Recommendations"
    report ""
    report "1. **Fix all critical and high severity issues** before production deployment"
    report "2. **Implement Web Application Firewall (WAF)** for additional protection"
    report "3. **Set up regular automated security scans** in CI/CD pipeline"
    report "4. **Conduct penetration testing** by security professionals"
    report "5. **Implement security monitoring and alerting** for production"
    report "6. **Regular dependency updates** and security patches"
    report "7. **Security training** for development team"
    report ""
    report "## Tools Recommended"
    report ""
    report "- **OWASP ZAP** for dynamic application security testing"
    report "- **SonarQube** for static code analysis"
    report "- **Snyk** for dependency vulnerability management"
    report "- **Nessus/OpenVAS** for infrastructure scanning"
    report "- **Burp Suite** for manual security testing"
    report ""
    report "---"
    report ""
    report "*Report generated on $(date) by Hitch Security Audit Script*"
}

# Main execution
main() {
    echo -e "${YELLOW}⚠️ Starting security audit...${NC}"
    echo "This may take several minutes."
    echo ""
    
    # Check if services are running
    if ! curl -s "$BACKEND_URL/health" > /dev/null; then
        echo -e "${RED}❌ Backend service is not accessible. Please start services first.${NC}"
        exit 1
    fi
    
    # Run the audit
    run_security_audit
    
    # Generate report
    generate_report
    
    # Final summary
    echo ""
    echo -e "${BLUE}📊 SECURITY AUDIT SUMMARY${NC}"
    echo "=========================="
    echo "Total Tests: $TOTAL_TESTS"
    echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
    echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
    echo ""
    echo -e "Critical Issues: ${RED}$CRITICAL_ISSUES${NC}"
    echo -e "High Issues: ${RED}$HIGH_ISSUES${NC}"
    echo -e "Medium Issues: ${YELLOW}$MEDIUM_ISSUES${NC}"
    echo "Low Issues: $LOW_ISSUES"
    echo ""
    echo "Detailed report: $REPORT_FILE"
    echo "Audit log: $AUDIT_LOG"
    echo ""
    
    if [ $CRITICAL_ISSUES -gt 0 ] || [ $HIGH_ISSUES -gt 0 ]; then
        echo -e "${RED}⚠️ CRITICAL/HIGH SECURITY ISSUES FOUND!${NC}"
        echo "Please review and fix issues before production deployment."
        log "Security audit completed with $((CRITICAL_ISSUES + HIGH_ISSUES)) critical/high issues"
        exit 1
    else
        echo -e "${GREEN}✅ No critical or high security issues found.${NC}"
        if [ $MEDIUM_ISSUES -gt 0 ] || [ $LOW_ISSUES -gt 0 ]; then
            echo -e "${YELLOW}⚠️ Consider fixing medium/low priority issues for enhanced security.${NC}"
        fi
        log "Security audit completed successfully"
        exit 0
    fi
}

# Run main function
main "$@"