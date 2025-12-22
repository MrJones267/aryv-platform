#!/bin/bash

# Hitch Platform - Setup Verification Script
# This script verifies that all services are running correctly

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[CHECK]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

# Check if a service is responding
check_service() {
    local service_name=$1
    local url=$2
    local expected_code=${3:-200}
    
    print_status "Checking $service_name at $url"
    
    if curl -s -o /dev/null -w "%{http_code}" "$url" | grep -q "$expected_code"; then
        print_success "$service_name is responding"
        return 0
    else
        print_error "$service_name is not responding"
        return 1
    fi
}

# Check Docker services
check_docker_services() {
    print_status "Checking Docker services..."
    
    if ! docker-compose ps | grep -q "Up"; then
        print_error "No Docker services are running"
        print_status "Try running: docker-compose up -d"
        return 1
    fi
    
    # Check individual services
    local services=("postgres" "redis" "backend" "admin-panel")
    for service in "${services[@]}"; do
        if docker-compose ps | grep "$service" | grep -q "Up"; then
            print_success "$service container is running"
        else
            print_warning "$service container is not running"
        fi
    done
}

# Check database connectivity
check_database() {
    print_status "Checking database connectivity..."
    
    if docker exec hitch-postgres pg_isready -U hitch_user -d hitch_db >/dev/null 2>&1; then
        print_success "PostgreSQL database is ready"
    else
        print_error "PostgreSQL database is not accessible"
        return 1
    fi
}

# Check Redis connectivity
check_redis() {
    print_status "Checking Redis connectivity..."
    
    if docker exec hitch-redis redis-cli ping >/dev/null 2>&1; then
        print_success "Redis is responding"
    else
        print_error "Redis is not accessible"
        return 1
    fi
}

# Check web services
check_web_services() {
    print_status "Checking web services..."
    
    # Wait a moment for services to be ready
    sleep 5
    
    # Check backend API
    if check_service "Backend API" "http://localhost:3001/health"; then
        print_success "Backend API is healthy"
    else
        print_error "Backend API health check failed"
    fi
    
    # Check admin panel
    if check_service "Admin Panel" "http://localhost:3000" "200"; then
        print_success "Admin Panel is accessible"
    else
        print_error "Admin Panel is not accessible"
    fi
    
    # Check AI services (if running)
    if docker-compose ps | grep "ai-services" | grep -q "Up"; then
        if check_service "AI Services" "http://localhost:5000/health"; then
            print_success "AI Services are responding"
        else
            print_warning "AI Services are not responding (this is optional)"
        fi
    fi
}

# Check API endpoints
check_api_endpoints() {
    print_status "Checking API endpoints..."
    
    # Test authentication endpoint
    if curl -s "http://localhost:3001/api/auth/register" >/dev/null 2>&1; then
        print_success "Authentication endpoints are accessible"
    else
        print_warning "Authentication endpoints may not be ready yet"
    fi
    
    # Test API documentation
    if curl -s "http://localhost:3001/api-docs" >/dev/null 2>&1; then
        print_success "API documentation is available"
    else
        print_warning "API documentation is not accessible"
    fi
}

# Show service URLs
show_access_info() {
    echo ""
    echo "🌐 Service Access Information:"
    echo "================================"
    echo ""
    echo "Web Applications:"
    echo "  📊 Admin Panel:     http://localhost:3000"
    echo "  🔗 Backend API:     http://localhost:3001"
    echo "  📚 API Docs:        http://localhost:3001/api-docs"
    echo "  🤖 AI Services:     http://localhost:5000"
    echo ""
    echo "Monitoring:"
    echo "  📈 Grafana:         http://localhost:3003 (admin/admin)"
    echo "  📊 Prometheus:      http://localhost:9090"
    echo ""
    echo "Default Credentials:"
    echo "  👤 Admin:           admin@hitch.com / admin123"
    echo "  🚗 Driver:          driver@test.com / test123"
    echo "  👤 Rider:           rider@test.com / test123"
    echo ""
}

# Main verification function
main() {
    echo "🔍 Hitch Platform - Setup Verification"
    echo "======================================="
    echo ""
    
    local checks_passed=0
    local total_checks=5
    
    # Run checks
    if check_docker_services; then
        ((checks_passed++))
    fi
    
    if check_database; then
        ((checks_passed++))
    fi
    
    if check_redis; then
        ((checks_passed++))
    fi
    
    if check_web_services; then
        ((checks_passed++))
    fi
    
    if check_api_endpoints; then
        ((checks_passed++))
    fi
    
    echo ""
    echo "Verification Results:"
    echo "===================="
    echo "Checks passed: $checks_passed/$total_checks"
    
    if [ $checks_passed -eq $total_checks ]; then
        print_success "🎉 All checks passed! Your Hitch platform is ready to use."
        show_access_info
    elif [ $checks_passed -gt 2 ]; then
        print_warning "⚠️  Most services are running, but some issues were detected."
        print_status "The platform should still be usable for basic testing."
        show_access_info
    else
        print_error "❌ Multiple issues detected. Please check the Docker services."
        echo ""
        echo "Try these commands:"
        echo "  docker-compose down"
        echo "  docker-compose up -d"
        echo "  ./scripts/verify-setup.sh"
    fi
    
    echo ""
    echo "For detailed logs: docker-compose logs <service-name>"
    echo "For help: see LOCAL_DEPLOYMENT_GUIDE.md"
}

# Run verification
main "$@"