#!/bin/bash

# Hitch Platform - Environment Configuration Script
# Author: Claude-Code
# Created: 2025-01-27
# Description: Sets up environment variables and configuration files

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

# Function to generate secure passwords
generate_password() {
    local length=${1:-32}
    openssl rand -base64 $length | tr -d "=+/" | cut -c1-$length
}

# Function to setup development environment
setup_development_env() {
    print_header "SETTING UP DEVELOPMENT ENVIRONMENT"
    
    local env_file="$PROJECT_ROOT/.env"
    
    if [[ -f "$env_file" ]]; then
        print_status "Development environment file already exists"
        return 0
    fi
    
    print_status "Creating development environment file..."
    
    cat > "$env_file" << EOF
# Hitch Platform - Development Environment Configuration
# Generated: $(date)

# === CORE APPLICATION ===
NODE_ENV=development
PORT=3001
DOMAIN_NAME=localhost

# === DATABASE CONFIGURATION ===
POSTGRES_DB=hitch_db
POSTGRES_USER=hitch_user
POSTGRES_PASSWORD=hitch_dev_password
DB_HOST=localhost
DB_PORT=5432
DB_NAME=hitch_db
DB_USER=hitch_user
DB_PASSWORD=hitch_dev_password
DATABASE_URL=postgresql://hitch_user:hitch_dev_password@localhost:5432/hitch_db

# === REDIS CONFIGURATION ===
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=

# === JWT & AUTHENTICATION ===
JWT_SECRET=dev_jwt_secret_key_not_for_production
JWT_EXPIRES_IN=7d

# === CORS & SECURITY ===
CORS_ORIGIN=http://localhost:3000,http://localhost:3002
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=1000

# === LOGGING ===
LOG_LEVEL=debug

# === COURIER SERVICE CONFIGURATION ===
QR_CODE_SECRET=dev_qr_secret
COURIER_AUTO_RELEASE_HOURS=24
COURIER_PLATFORM_FEE_PERCENT=10
COURIER_MAX_PACKAGE_WEIGHT=50
COURIER_MAX_DELIVERY_RADIUS=100

# === FRONTEND CONFIGURATION ===
REACT_APP_API_URL=http://localhost:3001
REACT_APP_SOCKET_URL=http://localhost:3001
VITE_API_BASE_URL=http://localhost:3001

# === DEVELOPMENT TOOLS ===
DEBUG=hitch:*
MOCK_EXTERNAL_APIS=true

# === OPTIONAL INTEGRATIONS (for development) ===
# STRIPE_SECRET_KEY=sk_test_...
# GOOGLE_MAPS_API_KEY=your_dev_key
# OPENAI_API_KEY=your_dev_key
EOF
    
    print_status "✅ Development environment file created: $env_file"
}

# Function to setup production environment
setup_production_env() {
    print_header "SETTING UP PRODUCTION ENVIRONMENT"
    
    local env_file="$PROJECT_ROOT/.env.production"
    
    if [[ -f "$env_file" ]]; then
        print_warning "Production environment file already exists"
        read -p "Do you want to regenerate it? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            return 0
        fi
    fi
    
    print_status "Generating secure production environment file..."
    
    # Generate secure passwords
    local postgres_password=$(generate_password 32)
    local redis_password=$(generate_password 32)
    local jwt_secret=$(generate_password 64)
    local qr_secret=$(generate_password 32)
    local grafana_password=$(generate_password 16)
    local session_secret=$(generate_password 32)
    
    cat > "$env_file" << EOF
# Hitch Platform - Production Environment Configuration
# Generated: $(date)
# WARNING: This file contains sensitive information. Do not commit to version control.

# === CORE APPLICATION ===
NODE_ENV=production
PORT=3001
DOMAIN_NAME=your-domain.com

# === DATABASE CONFIGURATION ===
POSTGRES_DB=hitch_production
POSTGRES_USER=hitch_prod_user
POSTGRES_PASSWORD=$postgres_password
DB_HOST=postgres
DB_PORT=5432
DB_NAME=hitch_production
DB_USER=hitch_prod_user
DB_PASSWORD=$postgres_password
DATABASE_URL=postgresql://hitch_prod_user:$postgres_password@postgres:5432/hitch_production

# === REDIS CONFIGURATION ===
REDIS_URL=redis://default:$redis_password@redis:6379
REDIS_PASSWORD=$redis_password

# === JWT & AUTHENTICATION ===
JWT_SECRET=$jwt_secret
JWT_EXPIRES_IN=7d
SESSION_SECRET=$session_secret

# === CORS & SECURITY ===
CORS_ORIGIN=https://your-domain.com,https://admin.your-domain.com
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# === LOGGING ===
LOG_LEVEL=info

# === SSL CONFIGURATION ===
SSL_KEY_PATH=/etc/nginx/ssl/private.key
SSL_CERT_PATH=/etc/nginx/ssl/certificate.crt
SSL_CHAIN_PATH=/etc/nginx/ssl/chain.crt

# === EMAIL CONFIGURATION ===
SMTP_HOST=smtp.sendgrid.net
SMTP_PORT=587
SMTP_USER=apikey
SMTP_PASS=your_sendgrid_api_key
FROM_EMAIL=noreply@your-domain.com
SUPPORT_EMAIL=support@your-domain.com

# === PAYMENT PROCESSING ===
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key
STRIPE_WEBHOOK_SECRET=whsec_your_stripe_webhook_secret
STRIPE_CONNECT_CLIENT_ID=ca_your_stripe_connect_client_id

# === CLOUD STORAGE ===
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_S3_BUCKET=hitch-production-uploads
AWS_REGION=us-east-1
CLOUDFRONT_DOMAIN=cdn.your-domain.com

# === EXTERNAL APIS ===
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
OPENAI_API_KEY=your_openai_api_key
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id

# === COURIER SERVICE CONFIGURATION ===
QR_CODE_SECRET=$qr_secret
COURIER_AUTO_RELEASE_HOURS=24
COURIER_PLATFORM_FEE_PERCENT=10
COURIER_MAX_PACKAGE_WEIGHT=50
COURIER_MAX_DELIVERY_RADIUS=100

# === BLOCKCHAIN CONFIGURATION ===
ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/your_project_id
ETHEREUM_PRIVATE_KEY=your_ethereum_private_key
SMART_CONTRACT_ADDRESS=0x...
GAS_LIMIT=300000

# === MONITORING ===
GRAFANA_PASSWORD=$grafana_password
PROMETHEUS_RETENTION_DAYS=30
LOG_RETENTION_DAYS=90

# === FRONTEND CONFIGURATION ===
REACT_APP_API_URL=https://api.your-domain.com
REACT_APP_SOCKET_URL=https://api.your-domain.com
VITE_API_BASE_URL=https://api.your-domain.com
VITE_APP_ENV=production

# === SCALING CONFIGURATION ===
BACKEND_REPLICAS=2
MAX_CONNECTIONS=100
WORKER_PROCESSES=2
PM2_INSTANCES=max

# === BACKUP CONFIGURATION ===
BACKUP_SCHEDULE=0 2 * * *
BACKUP_RETENTION_DAYS=30
S3_BACKUP_BUCKET=hitch-backups

# === RATE LIMITING ===
REDIS_RATE_LIMIT_PREFIX=rl:
API_RATE_LIMIT_POINTS=100
API_RATE_LIMIT_DURATION=3600

# === SECURITY ===
BCRYPT_ROUNDS=12
PASSWORD_MIN_LENGTH=8
MAX_LOGIN_ATTEMPTS=5
ACCOUNT_LOCKOUT_DURATION=3600

# === FEATURE FLAGS ===
ENABLE_AI_MATCHING=true
ENABLE_SURGE_PRICING=true
ENABLE_COURIER_SERVICE=true
ENABLE_REAL_TIME_TRACKING=true
ENABLE_PAYMENT_PROCESSING=true
ENABLE_PUSH_NOTIFICATIONS=true
EOF
    
    # Set restrictive permissions
    chmod 600 "$env_file"
    
    print_status "✅ Production environment file created: $env_file"
    print_warning "🔒 File permissions set to 600 for security"
    print_warning "📝 Remember to update the placeholder values with actual credentials"
}

# Function to setup admin panel environment
setup_admin_env() {
    print_header "SETTING UP ADMIN PANEL ENVIRONMENT"
    
    local env_file="$PROJECT_ROOT/admin-panel/.env"
    
    if [[ -f "$env_file" ]]; then
        print_status "Admin panel environment file already exists"
        return 0
    fi
    
    print_status "Creating admin panel environment file..."
    
    cat > "$env_file" << EOF
# Hitch Admin Panel - Environment Configuration
# Generated: $(date)

# === API Configuration ===
VITE_API_BASE_URL=http://localhost:3001
VITE_SOCKET_URL=http://localhost:3001

# === App Configuration ===
VITE_APP_ENV=development
VITE_APP_NAME=Hitch Admin Panel
VITE_APP_VERSION=1.0.0

# === Debug Configuration ===
VITE_DEBUG=true
VITE_LOG_LEVEL=debug

# === Feature Flags ===
VITE_ENABLE_REAL_TIME_UPDATES=true
VITE_ENABLE_ANALYTICS=true
VITE_ENABLE_NOTIFICATIONS=true

# === Map Configuration ===
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_api_key
VITE_DEFAULT_MAP_CENTER_LAT=40.7128
VITE_DEFAULT_MAP_CENTER_LNG=-74.0060
VITE_DEFAULT_MAP_ZOOM=12

# === Monitoring ===
VITE_SENTRY_DSN=your_sentry_dsn
VITE_ANALYTICS_ID=your_analytics_id
EOF
    
    print_status "✅ Admin panel environment file created: $env_file"
}

# Function to setup mobile app environment
setup_mobile_env() {
    print_header "SETTING UP MOBILE APP ENVIRONMENT"
    
    local env_file="$PROJECT_ROOT/mobile-app/.env"
    
    if [[ -f "$env_file" ]]; then
        print_status "Mobile app environment file already exists"
        return 0
    fi
    
    print_status "Creating mobile app environment file..."
    
    cat > "$env_file" << EOF
# Hitch Mobile App - Environment Configuration
# Generated: $(date)

# === API Configuration ===
API_BASE_URL=http://localhost:3001
SOCKET_URL=http://localhost:3001

# === App Configuration ===
APP_ENV=development
APP_NAME=Hitch
APP_VERSION=1.0.0
BUNDLE_ID=com.hitch.mobile

# === Map Configuration ===
GOOGLE_MAPS_API_KEY=your_google_maps_api_key
APPLE_MAPS_API_KEY=your_apple_maps_api_key

# === Push Notifications ===
FCM_SERVER_KEY=your_fcm_server_key
APNS_KEY_ID=your_apns_key_id
APNS_TEAM_ID=your_apns_team_id

# === Analytics ===
GOOGLE_ANALYTICS_ID=your_ga_id
FIREBASE_CONFIG=your_firebase_config

# === Feature Flags ===
ENABLE_BIOMETRIC_AUTH=true
ENABLE_OFFLINE_MODE=true
ENABLE_CRASH_REPORTING=true

# === Development ===
DEBUG_MODE=true
MOCK_LOCATION=false
MOCK_PAYMENTS=true

# === Deep Linking ===
URL_SCHEME=hitch
UNIVERSAL_LINK_DOMAIN=app.your-domain.com
EOF
    
    print_status "✅ Mobile app environment file created: $env_file"
}

# Function to validate environment files
validate_environment() {
    print_header "VALIDATING ENVIRONMENT CONFIGURATION"
    
    local files=(
        "$PROJECT_ROOT/.env"
        "$PROJECT_ROOT/.env.production"
        "$PROJECT_ROOT/admin-panel/.env"
        "$PROJECT_ROOT/mobile-app/.env"
    )
    
    for file in "${files[@]}"; do
        if [[ -f "$file" ]]; then
            print_status "✅ Found: $file"
            
            # Check for placeholder values
            if grep -q "your_" "$file" || grep -q "placeholder" "$file"; then
                print_warning "⚠️  $file contains placeholder values that need to be updated"
            fi
            
            # Check for required variables
            if [[ "$file" == *".env.production" ]]; then
                local required_vars=("POSTGRES_PASSWORD" "JWT_SECRET" "REDIS_PASSWORD")
                for var in "${required_vars[@]}"; do
                    if ! grep -q "^${var}=" "$file"; then
                        print_error "❌ Missing required variable $var in $file"
                    fi
                done
            fi
        else
            print_error "❌ Missing: $file"
        fi
    done
}

# Function to setup environment-specific configurations
setup_service_configs() {
    print_header "SETTING UP SERVICE CONFIGURATIONS"
    
    # Create nginx configuration directory
    local nginx_dir="$PROJECT_ROOT/nginx/conf.d"
    mkdir -p "$nginx_dir"
    
    if [[ ! -f "$nginx_dir/default.conf" ]]; then
        print_status "Creating nginx configuration..."
        cat > "$nginx_dir/default.conf" << 'EOF'
# Hitch Platform - Nginx Configuration
upstream backend {
    server backend:3001;
}

upstream admin_panel {
    server admin-panel:3000;
}

server {
    listen 80;
    server_name localhost;
    
    # Security headers
    add_header X-Frame-Options DENY;
    add_header X-Content-Type-Options nosniff;
    add_header X-XSS-Protection "1; mode=block";
    
    # API routes
    location /api/ {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # WebSocket support
    location /socket.io/ {
        proxy_pass http://backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
    
    # Admin panel
    location / {
        proxy_pass http://admin_panel;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
        print_status "✅ Nginx configuration created"
    fi
}

# Function to show setup summary
show_setup_summary() {
    print_header "ENVIRONMENT SETUP SUMMARY"
    
    echo -e "${GREEN}✅ Hitch Platform Environment Setup Completed!${NC}"
    echo ""
    echo "📁 Environment Files Created:"
    echo "  • Development: $PROJECT_ROOT/.env"
    echo "  • Production: $PROJECT_ROOT/.env.production"
    echo "  • Admin Panel: $PROJECT_ROOT/admin-panel/.env"
    echo "  • Mobile App: $PROJECT_ROOT/mobile-app/.env"
    echo ""
    echo "⚠️  Important Next Steps:"
    echo "  1. Update placeholder values in .env.production with real credentials"
    echo "  2. Set up SSL certificates for production"
    echo "  3. Configure external service API keys"
    echo "  4. Review and adjust security settings"
    echo ""
    echo "🔧 Environment Commands:"
    echo "  • Validate: ./scripts/environment-setup.sh validate"
    echo "  • Development: source .env"
    echo "  • Production: source .env.production"
    echo ""
    echo "🔒 Security Notes:"
    echo "  • Never commit .env.production to version control"
    echo "  • Use secrets management in production"
    echo "  • Regularly rotate passwords and API keys"
    echo "  • Monitor for exposed credentials"
}

# Main function
main() {
    local command="${1:-all}"
    
    print_header "HITCH PLATFORM ENVIRONMENT SETUP"
    
    case "$command" in
        "all"|"")
            setup_development_env
            setup_production_env
            setup_admin_env
            setup_mobile_env
            setup_service_configs
            validate_environment
            show_setup_summary
            ;;
        "dev"|"development")
            setup_development_env
            ;;
        "prod"|"production")
            setup_production_env
            ;;
        "admin")
            setup_admin_env
            ;;
        "mobile")
            setup_mobile_env
            ;;
        "validate")
            validate_environment
            ;;
        "configs")
            setup_service_configs
            ;;
        *)
            echo "Usage: $0 [all|dev|prod|admin|mobile|validate|configs]"
            echo ""
            echo "Commands:"
            echo "  all         - Setup all environment files (default)"
            echo "  dev         - Setup development environment only"
            echo "  prod        - Setup production environment only"
            echo "  admin       - Setup admin panel environment only"
            echo "  mobile      - Setup mobile app environment only"
            echo "  validate    - Validate existing environment files"
            echo "  configs     - Setup service configuration files"
            exit 1
            ;;
    esac
    
    print_status "Environment setup completed successfully!"
}

# Run main function
main "$@"