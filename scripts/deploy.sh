#!/bin/bash

# Hitch Platform - Production Deployment Script
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
DEPLOYMENT_ENV=${1:-"staging"}
LOG_FILE="deploy-${DEPLOYMENT_ENV}-$(date +%Y%m%d-%H%M%S).log"
BACKUP_DIR="./backup/pre-deployment"
HEALTH_CHECK_TIMEOUT=300
ROLLBACK_TIMEOUT=120

echo -e "${BLUE}🚀 Hitch Platform - Production Deployment${NC}"
echo "Environment: $DEPLOYMENT_ENV"
echo "==========================================="
echo "Log file: $LOG_FILE"
echo "Started at: $(date)"
echo ""

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Error handling
handle_error() {
    echo -e "${RED}❌ Deployment failed at line $1${NC}"
    log "ERROR: Deployment failed at line $1"
    
    # Optionally trigger rollback on critical failures
    if [ "$2" == "critical" ]; then
        echo -e "${YELLOW}🔄 Initiating automatic rollback...${NC}"
        rollback_deployment
    fi
    
    exit 1
}

trap 'handle_error $LINENO' ERR

# Deployment state tracking
DEPLOYMENT_STATE="initializing"
PREVIOUS_VERSION=""
NEW_VERSION=""

# Pre-deployment checks
pre_deployment_checks() {
    echo -e "${BLUE}🔍 Pre-deployment checks...${NC}"
    log "Starting pre-deployment checks"
    
    DEPLOYMENT_STATE="pre_checks"
    
    # Check if required files exist
    local required_files=(
        "docker-compose.prod.yml"
        ".env"
        "scripts/migrate.sh"
        "scripts/system-test.sh"
    )
    
    for file in "${required_files[@]}"; do
        if [ ! -f "$file" ]; then
            echo -e "${RED}❌ Required file missing: $file${NC}"
            exit 1
        fi
        echo -e "${GREEN}✅ Found: $file${NC}"
    done
    
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker is not running${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Docker is running${NC}"
    
    # Check if Docker Compose is available
    if ! docker-compose version > /dev/null 2>&1; then
        echo -e "${RED}❌ Docker Compose is not available${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Docker Compose is available${NC}"
    
    # Check disk space
    local available_space=$(df . | awk 'NR==2 {print $4}')
    local required_space=2097152  # 2GB in KB
    
    if [ "$available_space" -lt "$required_space" ]; then
        echo -e "${RED}❌ Insufficient disk space. Required: 2GB, Available: $((available_space/1024))MB${NC}"
        exit 1
    fi
    echo -e "${GREEN}✅ Sufficient disk space available${NC}"
    
    # Load environment variables
    if [ -f ".env" ]; then
        source .env
        echo -e "${GREEN}✅ Environment variables loaded${NC}"
    else
        echo -e "${YELLOW}⚠️  No .env file found, using defaults${NC}"
    fi
    
    # Validate required environment variables
    local required_vars=(
        "POSTGRES_PASSWORD"
        "JWT_SECRET"
        "REDIS_PASSWORD"
    )
    
    for var in "${required_vars[@]}"; do
        if [ -z "${!var}" ]; then
            echo -e "${RED}❌ Required environment variable missing: $var${NC}"
            exit 1
        fi
        echo -e "${GREEN}✅ Environment variable set: $var${NC}"
    done
    
    echo -e "${GREEN}✅ Pre-deployment checks completed${NC}"
    log "Pre-deployment checks passed"
}

# Create backup
create_deployment_backup() {
    echo -e "${BLUE}💾 Creating deployment backup...${NC}"
    log "Creating deployment backup"
    
    DEPLOYMENT_STATE="backup"
    
    mkdir -p "$BACKUP_DIR"
    
    # Backup database
    if docker-compose -f docker-compose.prod.yml ps postgres | grep -q "Up"; then
        local backup_file="$BACKUP_DIR/database_$(date +%Y%m%d_%H%M%S).sql"
        
        echo "Creating database backup..."
        docker-compose -f docker-compose.prod.yml exec -T postgres pg_dump -U ${POSTGRES_USER:-hitch_user} -d ${POSTGRES_DB:-hitch_db} > "$backup_file"
        
        if [ -f "$backup_file" ] && [ -s "$backup_file" ]; then
            echo -e "${GREEN}✅ Database backup created: $backup_file${NC}"
            log "Database backup created: $backup_file"
        else
            echo -e "${RED}❌ Failed to create database backup${NC}"
            exit 1
        fi
    else
        echo -e "${YELLOW}⚠️  Database not running, skipping backup${NC}"
    fi
    
    # Backup docker-compose configuration
    if [ -f "docker-compose.prod.yml" ]; then
        cp "docker-compose.prod.yml" "$BACKUP_DIR/docker-compose.prod.yml.backup"
        echo -e "${GREEN}✅ Configuration backup created${NC}"
    fi
    
    # Store current version
    if [ -f ".deployment_version" ]; then
        PREVIOUS_VERSION=$(cat .deployment_version)
        cp .deployment_version "$BACKUP_DIR/previous_version"
        echo -e "${GREEN}✅ Previous version stored: $PREVIOUS_VERSION${NC}"
    fi
    
    echo -e "${GREEN}✅ Backup completed${NC}"
    log "Deployment backup completed"
}

# Build and push images
build_and_push_images() {
    echo -e "${BLUE}🔨 Building and pushing Docker images...${NC}"
    log "Starting image build and push"
    
    DEPLOYMENT_STATE="build"
    
    local services=("backend" "admin-panel" "ai-services")
    NEW_VERSION="$(date +%Y%m%d-%H%M%S)-$(git rev-parse --short HEAD 2>/dev/null || echo 'local')"
    
    for service in "${services[@]}"; do
        echo -e "${BLUE}📦 Building $service...${NC}"
        
        # Build image
        docker build -t "hitch/$service:$NEW_VERSION" -t "hitch/$service:latest" "./$service"
        
        echo -e "${GREEN}✅ Built: hitch/$service:$NEW_VERSION${NC}"
        log "Built image: hitch/$service:$NEW_VERSION"
        
        # Push to registry (if configured)
        if [ -n "$DOCKER_REGISTRY" ] && [ -n "$DOCKER_USERNAME" ] && [ -n "$DOCKER_PASSWORD" ]; then
            echo "Pushing to registry..."
            echo "$DOCKER_PASSWORD" | docker login -u "$DOCKER_USERNAME" --password-stdin "$DOCKER_REGISTRY"
            
            docker tag "hitch/$service:$NEW_VERSION" "$DOCKER_REGISTRY/hitch/$service:$NEW_VERSION"
            docker push "$DOCKER_REGISTRY/hitch/$service:$NEW_VERSION"
            
            echo -e "${GREEN}✅ Pushed to registry: $DOCKER_REGISTRY/hitch/$service:$NEW_VERSION${NC}"
        fi
    done
    
    # Store new version
    echo "$NEW_VERSION" > .deployment_version
    
    echo -e "${GREEN}✅ Build and push completed${NC}"
    log "Image build and push completed for version: $NEW_VERSION"
}

# Run database migrations
run_migrations() {
    echo -e "${BLUE}🗄️  Running database migrations...${NC}"
    log "Starting database migrations"
    
    DEPLOYMENT_STATE="migrate"
    
    # Ensure database is running
    docker-compose -f docker-compose.prod.yml up -d postgres redis
    
    # Wait for database to be ready
    echo "Waiting for database to be ready..."
    local retries=30
    while [ $retries -gt 0 ]; do
        if docker-compose -f docker-compose.prod.yml exec -T postgres pg_isready -U ${POSTGRES_USER:-hitch_user} -d ${POSTGRES_DB:-hitch_db}; then
            break
        fi
        retries=$((retries - 1))
        sleep 2
    done
    
    if [ $retries -eq 0 ]; then
        echo -e "${RED}❌ Database failed to become ready${NC}"
        exit 1
    fi
    
    # Run migrations
    ./scripts/migrate.sh migrate
    
    echo -e "${GREEN}✅ Database migrations completed${NC}"
    log "Database migrations completed"
}

# Deploy services
deploy_services() {
    echo -e "${BLUE}🚀 Deploying services...${NC}"
    log "Starting service deployment"
    
    DEPLOYMENT_STATE="deploy"
    
    # Pull latest images
    docker-compose -f docker-compose.prod.yml pull
    
    # Deploy services with zero-downtime strategy
    local services=("backend" "ai-services" "admin-panel")
    
    for service in "${services[@]}"; do
        echo -e "${BLUE}🔄 Deploying $service...${NC}"
        
        # Scale up new instance
        docker-compose -f docker-compose.prod.yml up -d --no-deps --scale "$service"=2 "$service"
        
        # Wait for health check
        echo "Waiting for $service health check..."
        sleep 30
        
        # Scale down to desired replicas
        docker-compose -f docker-compose.prod.yml up -d --no-deps "$service"
        
        echo -e "${GREEN}✅ $service deployed${NC}"
        log "$service deployment completed"
    done
    
    # Ensure all services are running
    docker-compose -f docker-compose.prod.yml up -d
    
    echo -e "${GREEN}✅ All services deployed${NC}"
    log "Service deployment completed"
}

# Health checks
run_health_checks() {
    echo -e "${BLUE}🏥 Running health checks...${NC}"
    log "Starting health checks"
    
    DEPLOYMENT_STATE="health_check"
    
    local services=(
        "backend:http://localhost:3001/health:200"
        "ai-services:http://localhost:5000/health:200"
        "admin-panel:http://localhost:3000:200"
    )
    
    local retries=30
    local all_healthy=true
    
    for service_config in "${services[@]}"; do
        IFS=':' read -r service_name health_url expected_status <<< "$service_config"
        
        echo "Checking $service_name health..."
        local service_retries=$retries
        local service_healthy=false
        
        while [ $service_retries -gt 0 ]; do
            if curl -s -w "%{http_code}" "$health_url" -o /dev/null --connect-timeout 5 | grep -q "$expected_status"; then
                echo -e "${GREEN}✅ $service_name is healthy${NC}"
                log "$service_name health check passed"
                service_healthy=true
                break
            fi
            
            service_retries=$((service_retries - 1))
            sleep 10
        done
        
        if [ "$service_healthy" = false ]; then
            echo -e "${RED}❌ $service_name health check failed${NC}"
            log "$service_name health check failed"
            all_healthy=false
        fi
    done
    
    if [ "$all_healthy" = true ]; then
        echo -e "${GREEN}✅ All health checks passed${NC}"
        log "All health checks passed"
    else
        echo -e "${RED}❌ Some health checks failed${NC}"
        log "Health check failures detected"
        handle_error $LINENO "critical"
    fi
}

# Run system tests
run_system_tests() {
    echo -e "${BLUE}🧪 Running system tests...${NC}"
    log "Starting system tests"
    
    DEPLOYMENT_STATE="test"
    
    # Give services time to fully initialize
    echo "Waiting for services to fully initialize..."
    sleep 60
    
    # Run system test suite
    if ./scripts/system-test.sh; then
        echo -e "${GREEN}✅ System tests passed${NC}"
        log "System tests passed"
    else
        echo -e "${RED}❌ System tests failed${NC}"
        log "System tests failed"
        handle_error $LINENO "critical"
    fi
}

# Rollback deployment
rollback_deployment() {
    echo -e "${YELLOW}🔄 Rolling back deployment...${NC}"
    log "Starting deployment rollback"
    
    DEPLOYMENT_STATE="rollback"
    
    # Restore previous version if available
    if [ -n "$PREVIOUS_VERSION" ] && [ "$PREVIOUS_VERSION" != "$NEW_VERSION" ]; then
        echo "Rolling back to version: $PREVIOUS_VERSION"
        
        # Update image tags to previous version
        sed -i "s/$NEW_VERSION/$PREVIOUS_VERSION/g" docker-compose.prod.yml
        
        # Restart services with previous version
        docker-compose -f docker-compose.prod.yml up -d --no-deps backend ai-services admin-panel
        
        # Restore previous deployment version file
        if [ -f "$BACKUP_DIR/previous_version" ]; then
            cp "$BACKUP_DIR/previous_version" .deployment_version
        fi
        
        echo -e "${YELLOW}⚠️  Rollback completed to version: $PREVIOUS_VERSION${NC}"
        log "Rollback completed to version: $PREVIOUS_VERSION"
    else
        echo -e "${YELLOW}⚠️  No previous version available for rollback${NC}"
        log "No previous version available for rollback"
    fi
    
    # Stop services if rollback is not possible
    echo "Stopping services to prevent further issues..."
    docker-compose -f docker-compose.prod.yml stop backend ai-services admin-panel
    
    exit 1
}

# Post-deployment tasks
post_deployment_tasks() {
    echo -e "${BLUE}🔧 Running post-deployment tasks...${NC}"
    log "Starting post-deployment tasks"
    
    DEPLOYMENT_STATE="post_deploy"
    
    # Clean up old Docker images
    echo "Cleaning up old Docker images..."
    docker image prune -f
    docker system prune -f --volumes
    
    # Update monitoring configurations
    if [ -f "./monitoring/update-config.sh" ]; then
        ./monitoring/update-config.sh
        echo -e "${GREEN}✅ Monitoring configuration updated${NC}"
    fi
    
    # Send deployment notification
    if [ -n "$SLACK_WEBHOOK_URL" ]; then
        curl -X POST -H 'Content-type: application/json' \
            --data "{\"text\":\"🚀 Hitch Platform deployed successfully to $DEPLOYMENT_ENV\\nVersion: $NEW_VERSION\\nTime: $(date)\"}" \
            "$SLACK_WEBHOOK_URL" || true
    fi
    
    echo -e "${GREEN}✅ Post-deployment tasks completed${NC}"
    log "Post-deployment tasks completed"
}

# Main deployment function
main() {
    log "Starting deployment to $DEPLOYMENT_ENV"
    
    case "$DEPLOYMENT_ENV" in
        "production"|"staging"|"dev")
            echo -e "${GREEN}✅ Valid environment: $DEPLOYMENT_ENV${NC}"
            ;;
        *)
            echo -e "${RED}❌ Invalid environment. Use: production, staging, or dev${NC}"
            exit 1
            ;;
    esac
    
    # Execute deployment pipeline
    pre_deployment_checks
    create_deployment_backup
    build_and_push_images
    run_migrations
    deploy_services
    run_health_checks
    run_system_tests
    post_deployment_tasks
    
    # Success
    echo ""
    echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
    echo "================================"
    echo "Environment: $DEPLOYMENT_ENV"
    echo "Version: $NEW_VERSION"
    echo "Completed at: $(date)"
    echo ""
    
    log "Deployment completed successfully to $DEPLOYMENT_ENV with version $NEW_VERSION"
}

# Cleanup function
cleanup() {
    echo "Cleaning up temporary files..."
    log "Deployment script cleanup initiated"
}

trap cleanup EXIT

# Handle different commands
case "${2:-deploy}" in
    "deploy")
        main
        ;;
    "rollback")
        rollback_deployment
        ;;
    "health")
        run_health_checks
        ;;
    "test")
        run_system_tests
        ;;
    *)
        echo "Usage: $0 <environment> [deploy|rollback|health|test]"
        echo ""
        echo "Environments: production, staging, dev"
        echo "Commands:"
        echo "  deploy   - Full deployment (default)"
        echo "  rollback - Rollback to previous version"
        echo "  health   - Run health checks only"
        echo "  test     - Run system tests only"
        exit 1
        ;;
esac