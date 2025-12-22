#!/bin/bash

# Production Deployment Script for Hitch Platform
# Author: Claude-Code  
# Created: 2025-01-24
# Description: Complete production deployment with health checks and rollback

set -e  # Exit on any error

# Configuration
COMPOSE_FILE="docker-compose.prod.yml"
ENV_FILE=".env.production"
BACKUP_DIR="./backup"
LOG_FILE="./logs/deployment.log"
HEALTH_CHECK_TIMEOUT=300  # 5 minutes
HEALTH_CHECK_INTERVAL=10   # 10 seconds

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1" | tee -a "$LOG_FILE"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1" | tee -a "$LOG_FILE"
    exit 1
}

success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1" | tee -a "$LOG_FILE"
}

warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1" | tee -a "$LOG_FILE"
}

# Create necessary directories
setup_directories() {
    log "Setting up directories..."
    
    # Create required directories
    mkdir -p logs
    mkdir -p backup
    mkdir -p nginx/ssl
    mkdir -p monitoring/{prometheus,grafana/dashboards,grafana/datasources,loki}
    mkdir -p /opt/hitch-data/{postgres,redis,uploads,ai-models,prometheus,grafana,loki}
    
    # Set proper permissions
    chmod 755 logs backup
    chmod 700 /opt/hitch-data/postgres
    
    success "Directories created successfully"
}

# Verify prerequisites
check_prerequisites() {
    log "Checking deployment prerequisites..."
    
    # Check if Docker is running
    if ! docker info &> /dev/null; then
        error "Docker is not running or not accessible"
    fi
    
    # Check if Docker Compose is available
    if ! command -v docker-compose &> /dev/null; then
        error "Docker Compose is not installed"
    fi
    
    # Check if compose file exists
    if [ ! -f "$COMPOSE_FILE" ]; then
        error "Docker Compose file not found: $COMPOSE_FILE"
    fi
    
    # Check if environment file exists
    if [ ! -f "$ENV_FILE" ]; then
        error "Environment file not found: $ENV_FILE"
    fi
    
    # Verify SSL certificates (warn if missing)
    if [ ! -f "nginx/ssl/hitch.com.crt" ] || [ ! -f "nginx/ssl/hitch.com.key" ]; then
        warning "SSL certificates not found. HTTPS will not work properly."
        warning "Please obtain SSL certificates and place them in nginx/ssl/"
    fi
    
    # Check available disk space (at least 10GB)
    local available=$(df -BG . | awk 'NR==2 {print $4}' | sed 's/G//')
    if [ "$available" -lt 10 ]; then
        warning "Low disk space: ${available}GB available. Consider freeing up space."
    fi
    
    success "Prerequisites check completed"
}

# Build Docker images
build_images() {
    log "Building Docker images..."
    
    # Build backend image
    log "Building backend image..."
    docker build -t hitch/backend:latest -f backend/Dockerfile backend/
    
    # Build AI services image (if directory exists)
    if [ -d "ai-services" ]; then
        log "Building AI services image..."
        docker build -t hitch/ai-services:latest -f ai-services/Dockerfile ai-services/
    fi
    
    # Build admin panel image (if directory exists)
    if [ -d "admin-panel" ]; then
        log "Building admin panel image..."
        docker build -t hitch/admin-panel:latest -f admin-panel/Dockerfile admin-panel/
    fi
    
    success "Docker images built successfully"
}

# Start services
start_services() {
    log "Starting production services..."
    
    # Pull any required external images
    docker-compose -f "$COMPOSE_FILE" pull postgres redis nginx prometheus grafana loki
    
    # Start services in specific order
    log "Starting database and cache services..."
    docker-compose -f "$COMPOSE_FILE" up -d postgres redis
    
    # Wait for database to be ready
    wait_for_service "postgres" "postgresql"
    wait_for_service "redis" "redis"
    
    log "Starting application services..."
    docker-compose -f "$COMPOSE_FILE" up -d backend ai-services admin-panel
    
    # Wait for backend to be ready
    wait_for_service "backend" "api"
    
    log "Starting reverse proxy and monitoring..."
    docker-compose -f "$COMPOSE_FILE" up -d nginx prometheus grafana loki
    
    success "All services started successfully"
}

# Wait for service to be healthy
wait_for_service() {
    local service_name="$1"
    local service_type="$2"
    local elapsed=0
    
    log "Waiting for $service_name to be healthy..."
    
    while [ $elapsed -lt $HEALTH_CHECK_TIMEOUT ]; do
        if docker-compose -f "$COMPOSE_FILE" exec -T "$service_name" echo "Service check" &> /dev/null; then
            # Service container is running, now check specific health
            case "$service_type" in
                "postgresql")
                    if docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_isready -U "$POSTGRES_USER" &> /dev/null; then
                        success "$service_name is healthy"
                        return 0
                    fi
                    ;;
                "redis")
                    if docker-compose -f "$COMPOSE_FILE" exec -T redis redis-cli ping | grep -q PONG; then
                        success "$service_name is healthy"
                        return 0
                    fi
                    ;;
                "api")
                    if curl -f http://localhost:3001/health &> /dev/null; then
                        success "$service_name is healthy"
                        return 0
                    fi
                    ;;
            esac
        fi
        
        sleep $HEALTH_CHECK_INTERVAL
        elapsed=$((elapsed + HEALTH_CHECK_INTERVAL))
        echo -n "."
    done
    
    error "$service_name failed to become healthy within ${HEALTH_CHECK_TIMEOUT}s"
}

# Run database migrations
run_migrations() {
    log "Running database migrations..."
    
    # Make migration script executable
    chmod +x backend/scripts/migrate-production.sh
    
    # Run migrations inside backend container
    docker-compose -f "$COMPOSE_FILE" exec -T backend bash -c "
        cd /app && 
        ./scripts/migrate-production.sh migrate
    "
    
    if [ $? -eq 0 ]; then
        success "Database migrations completed successfully"
    else
        error "Database migrations failed"
    fi
}

# Verify deployment health
verify_deployment() {
    log "Verifying deployment health..."
    
    # Check if all containers are running
    local failed_services=()
    local services=("postgres" "redis" "backend" "nginx")
    
    # Add optional services if they exist
    if docker-compose -f "$COMPOSE_FILE" config --services | grep -q "ai-services"; then
        services+=("ai-services")
    fi
    if docker-compose -f "$COMPOSE_FILE" config --services | grep -q "admin-panel"; then
        services+=("admin-panel")
    fi
    
    for service in "${services[@]}"; do
        if ! docker-compose -f "$COMPOSE_FILE" ps "$service" | grep -q "Up"; then
            failed_services+=("$service")
        fi
    done
    
    if [ ${#failed_services[@]} -gt 0 ]; then
        error "The following services are not running: ${failed_services[*]}"
    fi
    
    # Test API endpoints
    log "Testing API endpoints..."
    
    # Health check
    if ! curl -f http://localhost:3001/health &> /dev/null; then
        error "API health check failed"
    fi
    
    # Test with HTTPS if certificates exist
    if [ -f "nginx/ssl/hitch.com.crt" ]; then
        if ! curl -f -k https://localhost/health &> /dev/null; then
            warning "HTTPS health check failed"
        else
            success "HTTPS is working properly"
        fi
    fi
    
    success "Deployment health verification passed"
}

# Monitor logs
monitor_logs() {
    local duration="${1:-60}"  # Default 60 seconds
    
    log "Monitoring application logs for ${duration} seconds..."
    
    # Monitor logs for the specified duration
    timeout "$duration" docker-compose -f "$COMPOSE_FILE" logs -f --tail=50 backend nginx || true
    
    log "Log monitoring completed"
}

# Create backup before deployment
create_backup() {
    log "Creating pre-deployment backup..."
    
    local backup_name="pre_deploy_$(date +%Y%m%d_%H%M%S)"
    
    # Create database backup if postgres is running
    if docker-compose -f "$COMPOSE_FILE" ps postgres | grep -q "Up"; then
        docker-compose -f "$COMPOSE_FILE" exec -T postgres pg_dump \
            -U "$POSTGRES_USER" \
            -d "$POSTGRES_DB" \
            > "$BACKUP_DIR/${backup_name}.sql"
        
        success "Database backup created: $BACKUP_DIR/${backup_name}.sql"
    fi
    
    # Backup important configuration files
    tar -czf "$BACKUP_DIR/${backup_name}_config.tar.gz" \
        "$ENV_FILE" \
        "$COMPOSE_FILE" \
        nginx/ \
        monitoring/ 2>/dev/null || true
    
    success "Configuration backup created: $BACKUP_DIR/${backup_name}_config.tar.gz"
}

# Rollback deployment
rollback() {
    log "Rolling back deployment..."
    
    # Stop all services
    docker-compose -f "$COMPOSE_FILE" down
    
    # Find latest backup
    local latest_backup=$(ls -t "$BACKUP_DIR"/*.sql 2>/dev/null | head -n1)
    
    if [ -n "$latest_backup" ]; then
        log "Restoring from backup: $latest_backup"
        
        # Start only database for restore
        docker-compose -f "$COMPOSE_FILE" up -d postgres
        wait_for_service "postgres" "postgresql"
        
        # Restore database
        docker-compose -f "$COMPOSE_FILE" exec -T postgres psql \
            -U "$POSTGRES_USER" \
            -d "$POSTGRES_DB" \
            < "$latest_backup"
        
        success "Database restored from backup"
    else
        warning "No backup found for rollback"
    fi
    
    success "Rollback completed"
}

# Show deployment status
show_status() {
    log "Deployment Status:"
    echo ""
    
    # Show running containers
    echo -e "${GREEN}Running Services:${NC}"
    docker-compose -f "$COMPOSE_FILE" ps
    echo ""
    
    # Show resource usage
    echo -e "${GREEN}Resource Usage:${NC}"
    docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}"
    echo ""
    
    # Show recent logs (last 10 lines from each service)
    echo -e "${GREEN}Recent Logs:${NC}"
    docker-compose -f "$COMPOSE_FILE" logs --tail=5 backend nginx
}

# Print usage
usage() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  deploy     - Full production deployment (default)"
    echo "  start      - Start all services"
    echo "  stop       - Stop all services"
    echo "  restart    - Restart all services"
    echo "  status     - Show deployment status"
    echo "  logs       - Follow application logs"
    echo "  backup     - Create backup"
    echo "  rollback   - Rollback deployment"
    echo "  migrate    - Run database migrations only"
    echo "  build      - Build Docker images only"
    echo ""
    echo "Examples:"
    echo "  $0 deploy          # Full deployment"
    echo "  $0 logs            # Monitor logs"
    echo "  $0 status          # Check status"
    echo ""
}

# Main execution
main() {
    local command="${1:-deploy}"
    
    # Create log directory
    mkdir -p "$(dirname "$LOG_FILE")"
    
    case "$command" in
        "deploy")
            log "Starting full production deployment..."
            setup_directories
            check_prerequisites
            create_backup
            build_images
            start_services
            run_migrations
            verify_deployment
            success "🚀 Production deployment completed successfully!"
            echo ""
            echo -e "${GREEN}Access your application at:${NC}"
            echo "  • API: http://localhost:3001"
            echo "  • Admin: http://localhost:3000"
            echo "  • Monitoring: http://localhost:3000/grafana"
            echo ""
            echo -e "${YELLOW}Remember to:${NC}"
            echo "  • Configure SSL certificates for HTTPS"
            echo "  • Set up domain DNS records"
            echo "  • Configure monitoring alerts"
            echo "  • Schedule regular backups"
            ;;
        "start")
            start_services
            ;;
        "stop")
            log "Stopping all services..."
            docker-compose -f "$COMPOSE_FILE" down
            success "All services stopped"
            ;;
        "restart")
            log "Restarting all services..."
            docker-compose -f "$COMPOSE_FILE" restart
            success "All services restarted"
            ;;
        "status")
            show_status
            ;;
        "logs")
            monitor_logs "${2:-300}"  # Default 5 minutes
            ;;
        "backup")
            create_backup
            ;;
        "rollback")
            rollback
            ;;
        "migrate")
            run_migrations
            ;;
        "build")
            build_images
            ;;
        "help"|"-h"|"--help")
            usage
            ;;
        *)
            error "Unknown command: $command"
            usage
            exit 1
            ;;
    esac
}

# Run main function with all arguments
main "$@"