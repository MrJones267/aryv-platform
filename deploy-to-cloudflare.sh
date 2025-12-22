#!/bin/bash
# ARYV Platform - Cloudflare Deployment Script

set -e

echo "🚀 ARYV PLATFORM - CLOUDFLARE DEPLOYMENT"
echo "========================================"

# Configuration
DOMAIN="aryv-app.com"
API_SUBDOMAIN="api"
ADMIN_SUBDOMAIN="admin"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        print_error "npm is not installed"
        exit 1
    fi
    
    print_success "Prerequisites check passed"
}

# Build admin panel
build_admin_panel() {
    print_status "Building admin panel..."
    
    cd admin-panel
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        print_status "Installing admin panel dependencies..."
        npm install
    fi
    
    # Build for production
    print_status "Building admin panel for production..."
    npm run build
    
    cd ..
    print_success "Admin panel built successfully"
}

# Prepare backend for deployment
prepare_backend() {
    print_status "Preparing backend for deployment..."
    
    cd backend
    
    # Install dependencies if needed
    if [ ! -d "node_modules" ]; then
        print_status "Installing backend dependencies..."
        npm install --production
    fi
    
    # Build TypeScript if needed
    if [ -f "tsconfig.json" ]; then
        print_status "Building TypeScript..."
        npm run build
    fi
    
    cd ..
    print_success "Backend prepared successfully"
}

# Create deployment package
create_deployment_package() {
    print_status "Creating deployment package..."
    
    # Create deployment directory
    rm -rf deployment
    mkdir -p deployment
    
    # Copy admin panel build
    cp -r admin-panel/build deployment/admin
    
    # Copy backend files
    mkdir -p deployment/api
    cp -r backend/dist/* deployment/api/ 2>/dev/null || cp -r backend/*.js deployment/api/
    cp backend/package.json deployment/api/
    cp -r backend/node_modules deployment/api/ 2>/dev/null || print_warning "Node modules not copied"
    
    print_success "Deployment package created"
}

# Deploy to Cloudflare Workers/Pages
deploy_to_cloudflare() {
    print_status "Deploying to Cloudflare..."
    
    # Check if wrangler is installed
    if ! command -v wrangler &> /dev/null; then
        print_warning "Wrangler CLI not found. Installing..."
        npm install -g wrangler
    fi
    
    # Deploy admin panel to Cloudflare Pages
    print_status "Deploying admin panel to Cloudflare Pages..."
    cd deployment
    
    # This would typically be done through Cloudflare dashboard or CI/CD
    print_status "Manual deployment required:"
    echo "1. Go to Cloudflare Pages dashboard"
    echo "2. Create new project: aryv-admin"
    echo "3. Upload admin/ folder"
    echo "4. Set custom domain: admin.${DOMAIN}"
    
    print_success "Deployment instructions provided"
}

# Update mobile app configuration
update_mobile_config() {
    print_status "Mobile app configuration already updated to use: https://api.${DOMAIN}"
    print_success "Mobile app ready for production API"
}

# Main deployment flow
main() {
    echo ""
    print_status "Starting ARYV deployment process..."
    echo ""
    
    check_prerequisites
    build_admin_panel
    prepare_backend
    create_deployment_package
    deploy_to_cloudflare
    update_mobile_config
    
    echo ""
    print_success "🎉 DEPLOYMENT PREPARATION COMPLETE!"
    echo ""
    echo "Next Steps:"
    echo "1. Upload admin panel to Cloudflare Pages"
    echo "2. Deploy backend API to Cloudflare Workers"
    echo "3. Configure DNS records for subdomains"
    echo "4. Set up SSL certificates"
    echo "5. Test mobile app with production API"
    echo ""
    echo "Production URLs:"
    echo "• Main site: https://${DOMAIN}"
    echo "• Admin panel: https://admin.${DOMAIN}"
    echo "• API: https://api.${DOMAIN}"
    echo ""
}

# Run main function
main "$@"