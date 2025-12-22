#!/bin/bash

# ARYV Platform - Production Environment Setup Script
# Author: Claude-Code
# Created: 2025-01-27
# Description: Sets up production environment from scratch

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

# Function to setup production environment file
setup_environment() {
    print_header "SETTING UP PRODUCTION ENVIRONMENT"
    
    local env_file="$PROJECT_ROOT/.env.production"
    
    if [[ -f "$env_file" ]]; then
        print_status "Production environment file already exists"
        return 0
    fi
    
    print_status "Creating production environment file..."
    
    # Generate secure random passwords
    local postgres_password=$(openssl rand -base64 32)
    local redis_password=$(openssl rand -base64 32)
    local jwt_secret=$(openssl rand -base64 64)
    local qr_secret=$(openssl rand -base64 32)
    local grafana_password=$(openssl rand -base64 16)
    
    cat > "$env_file" << EOF
# Hitch Platform - Production Environment Configuration
# Generated: $(date)

# === CORE APPLICATION ===
NODE_ENV=production
PORT=3001
DOMAIN_NAME=localhost

# === DATABASE CONFIGURATION ===
POSTGRES_DB=hitch_production
POSTGRES_USER=hitch_prod_user
POSTGRES_PASSWORD=$postgres_password
DB_HOST=postgres
DB_PORT=5432
DB_NAME=hitch_production
DB_USER=hitch_prod_user
DB_PASSWORD=$postgres_password

# === REDIS CONFIGURATION ===
REDIS_URL=redis://default:$redis_password@redis:6379
REDIS_PASSWORD=$redis_password

# === JWT & AUTHENTICATION ===
JWT_SECRET=$jwt_secret
JWT_EXPIRES_IN=7d

# === CORS & SECURITY ===
CORS_ORIGIN=http://localhost:3000,https://localhost
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# === LOGGING ===
LOG_LEVEL=info

# === COURIER SERVICE CONFIGURATION ===
QR_CODE_SECRET=$qr_secret
COURIER_AUTO_RELEASE_HOURS=24
COURIER_PLATFORM_FEE_PERCENT=10
COURIER_MAX_PACKAGE_WEIGHT=50
COURIER_MAX_DELIVERY_RADIUS=100

# === MONITORING ===
GRAFANA_PASSWORD=$grafana_password

# === FRONTEND CONFIGURATION ===
REACT_APP_API_URL=http://localhost:3001
REACT_APP_SOCKET_URL=http://localhost:3001
VITE_API_BASE_URL=http://localhost:3001

# === PRODUCTION SCALING ===
BACKEND_REPLICAS=1
MAX_CONNECTIONS=100
WORKER_PROCESSES=1
EOF

    print_status "Production environment file created: $env_file"
    print_warning "IMPORTANT: The environment file contains auto-generated passwords."
    print_warning "For production deployment, review and customize these settings."
}

# Function to create data directories
setup_data_directories() {
    print_header "SETTING UP DATA DIRECTORIES"
    
    local data_dirs=(
        "/opt/hitch-data/postgres"
        "/opt/hitch-data/redis"
        "/opt/hitch-data/uploads"
        "/opt/hitch-data/ai-models"
        "/opt/hitch-data/prometheus"
        "/opt/hitch-data/grafana"
        "/opt/hitch-data/loki"
        "/var/log/hitch"
    )
    
    print_status "Creating data directories..."
    for dir in "${data_dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            sudo mkdir -p "$dir"
            print_status "Created: $dir"
        else
            print_status "Exists: $dir"
        fi
    done
    
    # Set permissions if running as root/sudo
    if [[ $EUID -eq 0 || -n "${SUDO_USER:-}" ]]; then
        print_status "Setting directory permissions..."
        chown -R 999:999 /opt/hitch-data/postgres 2>/dev/null || true
        chown -R 999:999 /opt/hitch-data/redis 2>/dev/null || true
        chown -R 472:472 /opt/hitch-data/grafana 2>/dev/null || true
        chown -R 65534:65534 /opt/hitch-data/prometheus 2>/dev/null || true
        chmod -R 755 /opt/hitch-data 2>/dev/null || true
        chmod -R 755 /var/log/hitch 2>/dev/null || true
    fi
    
    print_status "Data directories setup completed"
}

# Function to build production images
build_production_images() {
    print_header "BUILDING PRODUCTION IMAGES"
    
    cd "$PROJECT_ROOT"
    
    print_status "Building backend production image..."
    if [[ -f "backend/Dockerfile" ]]; then
        docker build -t hitch/backend:latest \
            --target production \
            -f backend/Dockerfile \
            backend/
        print_status "Backend image built successfully"
    else
        print_warning "Backend Dockerfile not found, skipping backend build"
    fi
    
    print_status "Building admin panel production image..."
    if [[ -f "admin-panel/Dockerfile" ]]; then
        docker build -t hitch/admin-panel:latest \
            --target production \
            -f admin-panel/Dockerfile \
            admin-panel/
        print_status "Admin panel image built successfully"
    else
        print_warning "Admin panel Dockerfile not found, skipping admin panel build"
    fi
    
    # Build AI services if directory exists
    if [[ -d "ai-services" && -f "ai-services/Dockerfile" ]]; then
        print_status "Building AI services production image..."
        docker build -t hitch/ai-services:latest \
            -f ai-services/Dockerfile \
            ai-services/
        print_status "AI services image built successfully"
    else
        print_warning "AI services not found, skipping AI services build"
    fi
    
    print_status "Production images built successfully"
}

# Function to start production services
start_production() {
    print_header "STARTING PRODUCTION SERVICES"
    
    cd "$PROJECT_ROOT"
    
    # Stop any existing services
    print_status "Stopping existing services..."
    docker-compose -f docker-compose.prod.yml down --remove-orphans 2>/dev/null || true
    
    # Start core services
    print_status "Starting core services (postgres, redis)..."
    docker-compose -f docker-compose.prod.yml up -d postgres redis
    
    # Wait for core services
    print_status "Waiting for core services to be ready..."
    sleep 20
    
    # Start application services
    print_status "Starting application services..."
    docker-compose -f docker-compose.prod.yml up -d backend admin-panel
    
    # Wait for application services
    print_status "Waiting for application services..."
    sleep 15
    
    # Start monitoring and proxy
    print_status "Starting monitoring and proxy services..."
    docker-compose -f docker-compose.prod.yml up -d nginx prometheus grafana
    
    print_status "All services started successfully"
}

# Function to run health checks
run_health_checks() {
    print_header "RUNNING HEALTH CHECKS"
    
    local max_attempts=30
    local attempt=1
    
    # Test backend health
    print_status "Testing backend health..."
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -s "http://localhost:3001/health" > /dev/null 2>&1; then
            print_status "✅ Backend is healthy"
            break
        fi
        
        if [[ $attempt -eq $max_attempts ]]; then
            print_error "❌ Backend health check failed after $max_attempts attempts"
            return 1
        fi
        
        print_status "Attempt $attempt/$max_attempts: Backend not ready, waiting..."
        sleep 5
        ((attempt++))
    done
    
    # Test admin panel
    attempt=1
    print_status "Testing admin panel..."
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -s "http://localhost:3000" > /dev/null 2>&1; then
            print_status "✅ Admin panel is healthy"
            break
        fi
        
        if [[ $attempt -eq $max_attempts ]]; then
            print_warning "⚠️  Admin panel health check timeout (this may be normal)"
            break
        fi
        
        print_status "Attempt $attempt/$max_attempts: Admin panel not ready, waiting..."
        sleep 5
        ((attempt++))
    done
    
    print_status "Health checks completed"
}

# Function to display setup summary
show_setup_summary() {
    print_header "PRODUCTION SETUP SUMMARY"
    
    echo -e "${GREEN}✅ Hitch Platform Production Setup Completed!${NC}"
    echo ""
    echo "📊 Service Status:"
    docker-compose -f docker-compose.prod.yml ps 2>/dev/null || echo "Unable to fetch service status"
    echo ""
    echo "🌐 Access URLs:"
    echo "  • Backend API: http://localhost:3001"
    echo "  • Admin Panel: http://localhost:3000"
    echo "  • Health Check: http://localhost:3001/health"
    echo "  • Grafana: http://localhost:3003 (admin/[check .env.production])"
    echo "  • Prometheus: http://localhost:9090"
    echo ""
    echo "📁 Important Files:"
    echo "  • Environment: $PROJECT_ROOT/.env.production"
    echo "  • Data Directory: /opt/hitch-data/"
    echo "  • Logs: /var/log/hitch/"
    echo ""
    echo "🔧 Next Steps:"
    echo "  1. Test the API: curl http://localhost:3001/health"
    echo "  2. Access admin panel: http://localhost:3000"
    echo "  3. Check logs: docker-compose -f docker-compose.prod.yml logs -f"
    echo "  4. Scale services: docker-compose -f docker-compose.prod.yml up -d --scale backend=2"
    echo ""
    echo "⚠️  Security Notes:"
    echo "  • Review and update passwords in .env.production"
    echo "  • Configure proper SSL certificates for production"
    echo "  • Set up firewall rules and network security"
    echo "  • Enable automated backups"
}

# Main function
main() {
    print_header "HITCH PLATFORM PRODUCTION SETUP"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    print_status "Starting production setup at $(date)"
    
    # Run setup steps
    setup_environment
    setup_data_directories
    build_production_images
    start_production
    run_health_checks
    show_setup_summary
    
    print_status "Production setup completed successfully!"
}

# Run main function
main "$@"