#!/bin/bash

# Hitch Platform - Local Setup Script
# This script sets up the Hitch platform for local development

set -e

echo "🚀 Setting up Hitch Platform locally..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
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
        print_error "Node.js is not installed. Please install Node.js 18+ from https://nodejs.org/"
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker from https://docker.com/"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose"
        exit 1
    fi
    
    print_success "All prerequisites are installed"
}

# Setup environment file
setup_environment() {
    print_status "Setting up environment configuration..."
    
    if [ ! -f .env ]; then
        cp .env.example .env
        print_success "Created .env file from template"
        print_warning "Please edit .env file to configure your API keys and passwords"
    else
        print_warning ".env file already exists, skipping creation"
    fi
}

# Install dependencies
install_dependencies() {
    print_status "Installing dependencies..."
    
    # Backend dependencies
    if [ -d "backend" ]; then
        print_status "Installing backend dependencies..."
        cd backend
        npm install
        cd ..
        print_success "Backend dependencies installed"
    fi
    
    # Admin panel dependencies
    if [ -d "admin-panel" ]; then
        print_status "Installing admin panel dependencies..."
        cd admin-panel
        npm install
        cd ..
        print_success "Admin panel dependencies installed"
    fi
    
    # Mobile app dependencies
    if [ -d "mobile-app" ]; then
        print_status "Installing mobile app dependencies..."
        cd mobile-app
        npm install
        cd ..
        print_success "Mobile app dependencies installed"
    fi
}

# Start Docker services
start_docker_services() {
    print_status "Starting Docker services..."
    
    # Start infrastructure services first
    print_status "Starting database and cache services..."
    docker-compose up -d postgres redis
    
    # Wait for databases to be ready
    print_status "Waiting for databases to be ready..."
    sleep 10
    
    # Start application services
    print_status "Starting application services..."
    docker-compose up -d backend admin-panel ai-services
    
    print_success "All Docker services started"
}

# Setup database
setup_database() {
    print_status "Setting up database..."
    
    # Wait a bit more for PostgreSQL to be fully ready
    sleep 5
    
    # Run database migrations and seeds
    print_status "Running database migrations..."
    cd backend
    if npm run db:migrate 2>/dev/null; then
        print_success "Database migrations completed"
    else
        print_warning "Database migrations failed or not configured yet"
    fi
    
    print_status "Seeding database with sample data..."
    if npm run db:seed 2>/dev/null; then
        print_success "Database seeded with sample data"
    else
        print_warning "Database seeding failed or not configured yet"
    fi
    
    cd ..
}

# Display service status
show_status() {
    print_status "Checking service status..."
    docker-compose ps
    
    echo ""
    print_success "🎉 Hitch Platform is now running locally!"
    echo ""
    echo "📱 Access your applications:"
    echo "   • Admin Panel:    http://localhost:3000"
    echo "   • Backend API:    http://localhost:3001"
    echo "   • API Docs:       http://localhost:3001/api-docs"
    echo "   • AI Services:    http://localhost:5000"
    echo "   • Grafana:        http://localhost:3003 (admin/admin)"
    echo "   • Prometheus:     http://localhost:9090"
    echo ""
    echo "🔑 Default login credentials:"
    echo "   • Admin: admin@hitch.com / admin123"
    echo "   • Rider: rider@test.com / test123"
    echo "   • Driver: driver@test.com / test123"
    echo ""
    echo "📱 To start the mobile app:"
    echo "   cd mobile-app && npm start"
    echo "   npm run android  # For Android"
    echo "   npm run ios      # For iOS (macOS only)"
    echo ""
    echo "🛠️  Development commands:"
    echo "   docker-compose logs <service>  # View logs"
    echo "   docker-compose restart <service>  # Restart service"
    echo "   docker-compose down  # Stop all services"
    echo ""
}

# Cleanup function
cleanup() {
    print_status "Stopping services..."
    docker-compose down
}

# Handle script interruption
trap cleanup EXIT

# Main execution
main() {
    echo "🚀 Hitch Platform Local Setup"
    echo "=============================="
    echo ""
    
    check_prerequisites
    setup_environment
    install_dependencies
    start_docker_services
    setup_database
    show_status
    
    echo ""
    print_success "Setup completed successfully!"
    print_status "Press Ctrl+C to stop all services"
    
    # Keep script running to show logs
    print_status "Showing service logs (Ctrl+C to exit)..."
    docker-compose logs -f
}

# Run main function
main "$@"