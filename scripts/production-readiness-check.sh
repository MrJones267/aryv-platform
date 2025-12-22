#!/bin/bash

# Hitch Platform - Production Readiness Check
# Author: Claude-Code
# Created: 2025-01-25

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_ROOT/.env.production"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.prod.yml"

# Results tracking
PASSED=0
FAILED=0
WARNINGS=0

# Functions
check_pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

check_fail() {
    echo -e "${RED}✗${NC} $1"
    ((FAILED++))
}

check_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
    ((WARNINGS++))
}

section_header() {
    echo
    echo -e "${BLUE}==== $1 ====${NC}"
}

# Check functions
check_docker() {
    section_header "Docker Environment"
    
    if command -v docker &> /dev/null; then
        local docker_version=$(docker --version | grep -oP '\d+\.\d+\.\d+')
        check_pass "Docker is installed (version: $docker_version)"
        
        if docker info &> /dev/null; then
            check_pass "Docker daemon is running"
        else
            check_fail "Docker daemon is not accessible"
        fi
    else
        check_fail "Docker is not installed"
    fi
    
    if command -v docker-compose &> /dev/null; then
        local compose_version=$(docker-compose --version | grep -oP '\d+\.\d+\.\d+')
        check_pass "Docker Compose is installed (version: $compose_version)"
    else
        check_fail "Docker Compose is not installed"
    fi
}

check_files() {
    section_header "Required Files"
    
    local required_files=(
        "$ENV_FILE"
        "$COMPOSE_FILE"
        "$PROJECT_ROOT/nginx/nginx.prod.conf"
        "$PROJECT_ROOT/backend/Dockerfile.prod"
        "$PROJECT_ROOT/ai-services/Dockerfile.prod"
        "$PROJECT_ROOT/admin-panel/Dockerfile.prod"
    )
    
    for file in "${required_files[@]}"; do
        if [[ -f "$file" ]]; then
            check_pass "$(basename "$file") exists"
        else
            check_fail "$(basename "$file") is missing"
        fi
    done
}

check_environment() {
    section_header "Environment Configuration"
    
    if [[ ! -f "$ENV_FILE" ]]; then
        check_fail "Environment file not found: $ENV_FILE"
        return
    fi
    
    # Check for placeholder values
    local placeholders=("CHANGE_ME" "your_" "YOUR_" "example.com")
    local has_placeholders=false
    
    for placeholder in "${placeholders[@]}"; do
        if grep -q "$placeholder" "$ENV_FILE"; then
            check_fail "Environment file contains placeholder: $placeholder"
            has_placeholders=true
        fi
    done
    
    if [[ "$has_placeholders" == false ]]; then
        check_pass "No placeholder values found in environment"
    fi
    
    # Check required variables
    local required_vars=(
        "POSTGRES_PASSWORD"
        "REDIS_PASSWORD"
        "JWT_SECRET"
        "STRIPE_SECRET_KEY"
        "DOMAIN_NAME"
    )
    
    for var in "${required_vars[@]}"; do
        if grep -q "^${var}=" "$ENV_FILE" && ! grep -q "^${var}=$" "$ENV_FILE"; then
            check_pass "$var is set"
        else
            check_fail "$var is not set or empty"
        fi
    done
    
    # Check JWT secret length
    local jwt_secret=$(grep "^JWT_SECRET=" "$ENV_FILE" | cut -d'=' -f2-)
    if [[ ${#jwt_secret} -ge 32 ]]; then
        check_pass "JWT secret is sufficiently long"
    else
        check_fail "JWT secret is too short (minimum 32 characters)"
    fi
}

check_ssl_certificates() {
    section_header "SSL Certificates"
    
    local ssl_dir="$PROJECT_ROOT/nginx/ssl"
    local domains=("hitch.com" "api.hitch.com" "admin.hitch.com")
    
    if [[ ! -d "$ssl_dir" ]]; then
        check_fail "SSL directory does not exist: $ssl_dir"
        return
    fi
    
    for domain in "${domains[@]}"; do
        local cert_file="$ssl_dir/$domain.crt"
        local key_file="$ssl_dir/$domain.key"
        
        if [[ -f "$cert_file" && -f "$key_file" ]]; then
            # Check if certificate is valid
            if openssl x509 -in "$cert_file" -noout -checkend 0 &> /dev/null; then
                local expiry=$(openssl x509 -in "$cert_file" -noout -enddate | cut -d'=' -f2)
                check_pass "SSL certificate for $domain is valid (expires: $expiry)"
            else
                check_fail "SSL certificate for $domain is expired or invalid"
            fi
        else
            check_warn "SSL certificate for $domain not found (will use self-signed)"
        fi
    done
}

check_directories() {
    section_header "Production Directories"
    
    local required_dirs=(
        "/opt/hitch-data"
        "/opt/hitch-data/postgres"
        "/opt/hitch-data/redis"
        "/opt/hitch-data/uploads"
        "/var/log/hitch"
    )
    
    for dir in "${required_dirs[@]}"; do
        if [[ -d "$dir" ]]; then
            check_pass "Directory exists: $dir"
        else
            check_warn "Directory missing: $dir (will be created during deployment)"
        fi
    done
}

check_system_resources() {
    section_header "System Resources"
    
    # Check available memory
    local mem_total=$(free -m | awk 'NR==2{print $2}')
    if [[ $mem_total -ge 8192 ]]; then
        check_pass "Sufficient memory: ${mem_total}MB"
    elif [[ $mem_total -ge 4096 ]]; then
        check_warn "Limited memory: ${mem_total}MB (8GB+ recommended)"
    else
        check_fail "Insufficient memory: ${mem_total}MB (minimum 4GB required)"
    fi
    
    # Check available disk space
    local disk_avail=$(df -BG "$PROJECT_ROOT" | awk 'NR==2 {print $4}' | sed 's/G//')
    if [[ $disk_avail -ge 100 ]]; then
        check_pass "Sufficient disk space: ${disk_avail}GB"
    elif [[ $disk_avail -ge 50 ]]; then
        check_warn "Limited disk space: ${disk_avail}GB (100GB+ recommended)"
    else
        check_fail "Insufficient disk space: ${disk_avail}GB (minimum 50GB required)"
    fi
    
    # Check CPU cores
    local cpu_cores=$(nproc)
    if [[ $cpu_cores -ge 4 ]]; then
        check_pass "Sufficient CPU cores: $cpu_cores"
    elif [[ $cpu_cores -ge 2 ]]; then
        check_warn "Limited CPU cores: $cpu_cores (4+ recommended)"
    else
        check_fail "Insufficient CPU cores: $cpu_cores (minimum 2 required)"
    fi
}

check_network() {
    section_header "Network Configuration"
    
    # Check if ports are available
    local required_ports=(80 443 3001 5432 6379)
    
    for port in "${required_ports[@]}"; do
        if ! netstat -tuln 2>/dev/null | grep -q ":$port "; then
            check_pass "Port $port is available"
        else
            check_fail "Port $port is already in use"
        fi
    done
    
    # Test internet connectivity
    if curl -s --connect-timeout 5 https://google.com > /dev/null; then
        check_pass "Internet connectivity is working"
    else
        check_fail "No internet connectivity"
    fi
}

check_external_services() {
    section_header "External Services"
    
    # Test Stripe API (if key is available)
    if grep -q "^STRIPE_SECRET_KEY=sk_" "$ENV_FILE"; then
        check_pass "Stripe secret key format is correct"
    else
        check_warn "Stripe secret key not configured or invalid format"
    fi
    
    # Test Google Maps API (basic format check)
    if grep -q "^GOOGLE_MAPS_API_KEY=AIza" "$ENV_FILE"; then
        check_pass "Google Maps API key format is correct"
    else
        check_warn "Google Maps API key not configured or invalid format"
    fi
    
    # Check email configuration
    if grep -q "^SMTP_HOST=" "$ENV_FILE" && grep -q "^SMTP_USER=" "$ENV_FILE"; then
        check_pass "SMTP configuration is present"
    else
        check_warn "SMTP configuration is incomplete"
    fi
}

check_security() {
    section_header "Security Configuration"
    
    # Check if running as root
    if [[ $EUID -eq 0 ]]; then
        check_warn "Running as root (consider using a dedicated user)"
    else
        check_pass "Not running as root"
    fi
    
    # Check firewall status
    if command -v ufw &> /dev/null; then
        if ufw status | grep -q "Status: active"; then
            check_pass "UFW firewall is active"
        else
            check_warn "UFW firewall is not active"
        fi
    else
        check_warn "UFW firewall is not installed"
    fi
    
    # Check for default passwords
    if grep -q "password" "$ENV_FILE" | grep -qi "default\|admin\|123"; then
        check_fail "Default passwords detected in environment"
    else
        check_pass "No obvious default passwords found"
    fi
}

check_monitoring() {
    section_header "Monitoring Configuration"
    
    # Check if monitoring configs exist
    local monitoring_files=(
        "$PROJECT_ROOT/monitoring/prometheus.prod.yml"
        "$PROJECT_ROOT/monitoring/grafana/dashboards"
    )
    
    for file in "${monitoring_files[@]}"; do
        if [[ -e "$file" ]]; then
            check_pass "Monitoring config exists: $(basename "$file")"
        else
            check_warn "Monitoring config missing: $(basename "$file") (will be created)"
        fi
    done
    
    # Check Grafana password
    if grep -q "^GRAFANA_PASSWORD=" "$ENV_FILE" && ! grep -q "^GRAFANA_PASSWORD=$" "$ENV_FILE"; then
        check_pass "Grafana password is configured"
    else
        check_fail "Grafana password is not set"
    fi
}

print_summary() {
    echo
    echo -e "${BLUE}==== PRODUCTION READINESS SUMMARY ====${NC}"
    echo
    echo -e "${GREEN}Passed checks: $PASSED${NC}"
    echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
    echo -e "${RED}Failed checks: $FAILED${NC}"
    echo
    
    if [[ $FAILED -eq 0 ]]; then
        if [[ $WARNINGS -eq 0 ]]; then
            echo -e "${GREEN}🎉 READY FOR PRODUCTION DEPLOYMENT!${NC}"
            echo "All checks passed. You can proceed with deployment."
        else
            echo -e "${YELLOW}⚠️  READY WITH WARNINGS${NC}"
            echo "Most checks passed, but please review the warnings above."
        fi
    else
        echo -e "${RED}❌ NOT READY FOR PRODUCTION${NC}"
        echo "Please fix the failed checks before deploying to production."
    fi
    
    echo
    echo "Next steps:"
    if [[ $FAILED -eq 0 ]]; then
        echo "1. Review any warnings above"
        echo "2. Run: ./scripts/deploy-production.sh deploy"
        echo "3. Test your deployment thoroughly"
        echo "4. Configure monitoring alerts"
    else
        echo "1. Fix all failed checks"
        echo "2. Re-run this script"
        echo "3. Proceed with deployment once all checks pass"
    fi
}

# Main execution
main() {
    echo -e "${BLUE}Hitch Platform - Production Readiness Check${NC}"
    echo "Checking production deployment requirements..."
    
    check_docker
    check_files
    check_environment
    check_ssl_certificates
    check_directories
    check_system_resources
    check_network
    check_external_services
    check_security
    check_monitoring
    
    print_summary
}

# Run the checks
main "$@"