#!/bin/bash

# Hitch Platform - Database Migration Script
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
MIGRATIONS_DIR="./backend/migrations"
BACKUP_DIR="./backup/migrations"
LOG_FILE="migration-$(date +%Y%m%d-%H%M%S).log"

# Database connection settings
DB_HOST=${POSTGRES_HOST:-postgres}
DB_PORT=${POSTGRES_PORT:-5432}
DB_NAME=${POSTGRES_DB:-hitch_db}
DB_USER=${POSTGRES_USER:-hitch_user}
DB_PASSWORD=${POSTGRES_PASSWORD:-hitch_secure_password_change_me}

echo -e "${BLUE}🚀 Hitch Platform - Database Migration${NC}"
echo "======================================"
echo "Log file: $LOG_FILE"
echo "Started at: $(date)"
echo ""

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1" | tee -a "$LOG_FILE"
}

# Error handling
handle_error() {
    echo -e "${RED}❌ Migration failed at line $1${NC}"
    log "ERROR: Migration failed at line $1"
    exit 1
}

trap 'handle_error $LINENO' ERR

# Check if Docker Compose is running
check_docker_compose() {
    if ! docker-compose ps postgres | grep -q "Up"; then
        echo -e "${RED}❌ PostgreSQL container is not running${NC}"
        echo "Please run 'docker-compose up -d postgres' first"
        exit 1
    fi
    echo -e "${GREEN}✅ PostgreSQL container is running${NC}"
}

# Check database connectivity
check_database_connection() {
    echo "Checking database connection..."
    
    if docker-compose exec -T postgres pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME; then
        echo -e "${GREEN}✅ Database connection successful${NC}"
        log "Database connection verified"
    else
        echo -e "${RED}❌ Cannot connect to database${NC}"
        exit 1
    fi
}

# Create backup directory
create_backup_dir() {
    mkdir -p "$BACKUP_DIR"
    echo -e "${GREEN}✅ Backup directory created: $BACKUP_DIR${NC}"
}

# Create database backup before migration
create_backup() {
    local backup_file="$BACKUP_DIR/pre_migration_$(date +%Y%m%d_%H%M%S).sql"
    
    echo "Creating database backup..."
    log "Creating backup: $backup_file"
    
    docker-compose exec -T postgres pg_dump -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME > "$backup_file"
    
    if [ -f "$backup_file" ] && [ -s "$backup_file" ]; then
        echo -e "${GREEN}✅ Database backup created: $backup_file${NC}"
        log "Backup created successfully: $backup_file"
    else
        echo -e "${RED}❌ Failed to create database backup${NC}"
        exit 1
    fi
}

# Check if migrations table exists, create if not
create_migrations_table() {
    echo "Ensuring migrations tracking table exists..."
    
    docker-compose exec -T postgres psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
    CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(255) PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        checksum VARCHAR(64) NOT NULL,
        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        applied_by VARCHAR(100) DEFAULT CURRENT_USER,
        execution_time_ms INTEGER
    );"
    
    echo -e "${GREEN}✅ Migrations tracking table ready${NC}"
    log "Migrations tracking table created/verified"
}

# Get list of applied migrations
get_applied_migrations() {
    docker-compose exec -T postgres psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
    SELECT version FROM schema_migrations ORDER BY version;" | grep -v '^$' | tr -d ' '
}

# Calculate file checksum
calculate_checksum() {
    local file="$1"
    sha256sum "$file" | cut -d' ' -f1
}

# Apply single migration
apply_migration() {
    local migration_file="$1"
    local version="$2"
    local filename=$(basename "$migration_file")
    local checksum=$(calculate_checksum "$migration_file")
    
    echo -e "${BLUE}📁 Applying migration: $filename${NC}"
    log "Applying migration: $filename (version: $version)"
    
    local start_time=$(date +%s%3N)
    
    # Apply the migration
    if docker-compose exec -T postgres psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f - < "$migration_file"; then
        local end_time=$(date +%s%3N)
        local execution_time=$((end_time - start_time))
        
        # Record the migration
        docker-compose exec -T postgres psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
        INSERT INTO schema_migrations (version, filename, checksum, execution_time_ms)
        VALUES ('$version', '$filename', '$checksum', $execution_time)
        ON CONFLICT (version) DO UPDATE SET
            filename = EXCLUDED.filename,
            checksum = EXCLUDED.checksum,
            applied_at = CURRENT_TIMESTAMP,
            applied_by = CURRENT_USER,
            execution_time_ms = EXCLUDED.execution_time_ms;"
        
        echo -e "${GREEN}✅ Migration applied successfully: $filename (${execution_time}ms)${NC}"
        log "Migration applied: $filename in ${execution_time}ms"
        return 0
    else
        echo -e "${RED}❌ Failed to apply migration: $filename${NC}"
        log "Failed to apply migration: $filename"
        return 1
    fi
}

# Run all pending migrations
run_migrations() {
    local applied_migrations=($(get_applied_migrations))
    local migration_count=0
    
    echo "Checking for pending migrations..."
    
    # Convert applied migrations to associative array for faster lookup
    declare -A applied_map
    for migration in "${applied_migrations[@]}"; do
        applied_map["$migration"]=1
    done
    
    # Find and apply pending migrations
    for migration_file in "$MIGRATIONS_DIR"/*.sql; do
        if [ ! -f "$migration_file" ]; then
            continue
        fi
        
        local filename=$(basename "$migration_file")
        local version=$(echo "$filename" | sed 's/\([0-9]\{3\}\)_.*/\1/')
        
        if [ -z "${applied_map[$version]}" ]; then
            apply_migration "$migration_file" "$version"
            migration_count=$((migration_count + 1))
        else
            echo "⏭️  Skipping already applied migration: $filename"
            log "Skipped migration: $filename (already applied)"
        fi
    done
    
    if [ $migration_count -eq 0 ]; then
        echo -e "${YELLOW}ℹ️  No pending migrations found${NC}"
        log "No pending migrations found"
    else
        echo -e "${GREEN}✅ Applied $migration_count migration(s)${NC}"
        log "Applied $migration_count migrations successfully"
    fi
}

# Verify migration integrity
verify_migrations() {
    echo "Verifying migration integrity..."
    
    local errors=0
    
    # Check for missing migration files
    local applied_migrations=($(get_applied_migrations))
    for version in "${applied_migrations[@]}"; do
        local expected_file="$MIGRATIONS_DIR/${version}_"*.sql
        if ! ls $expected_file &> /dev/null; then
            echo -e "${RED}❌ Missing migration file for version: $version${NC}"
            errors=$((errors + 1))
        fi
    done
    
    # Check for checksum mismatches
    local migration_data=$(docker-compose exec -T postgres psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -t -c "
    SELECT version, filename, checksum FROM schema_migrations ORDER BY version;")
    
    while read -r line; do
        if [ -z "$line" ] || [[ "$line" =~ ^[[:space:]]*$ ]]; then
            continue
        fi
        
        local version=$(echo "$line" | awk '{print $1}' | tr -d ' ')
        local filename=$(echo "$line" | awk '{print $2}' | tr -d ' ')
        local stored_checksum=$(echo "$line" | awk '{print $3}' | tr -d ' ')
        
        local migration_file="$MIGRATIONS_DIR/$filename"
        if [ -f "$migration_file" ]; then
            local current_checksum=$(calculate_checksum "$migration_file")
            if [ "$stored_checksum" != "$current_checksum" ]; then
                echo -e "${RED}❌ Checksum mismatch for $filename${NC}"
                echo "  Stored: $stored_checksum"
                echo "  Current: $current_checksum"
                errors=$((errors + 1))
            fi
        fi
    done <<< "$migration_data"
    
    if [ $errors -eq 0 ]; then
        echo -e "${GREEN}✅ Migration integrity verified${NC}"
        log "Migration integrity verification passed"
    else
        echo -e "${RED}❌ Found $errors integrity issue(s)${NC}"
        log "Migration integrity verification failed with $errors errors"
        exit 1
    fi
}

# Show migration status
show_status() {
    echo -e "${BLUE}📊 Migration Status${NC}"
    echo "=================="
    
    local applied_migrations=($(get_applied_migrations))
    echo "Applied migrations: ${#applied_migrations[@]}"
    
    docker-compose exec -T postgres psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -c "
    SELECT 
        version,
        filename,
        applied_at,
        applied_by,
        execution_time_ms || ' ms' as execution_time
    FROM schema_migrations 
    ORDER BY version;"
}

# Main function
main() {
    local command=${1:-"migrate"}
    
    case "$command" in
        "migrate")
            echo -e "${YELLOW}🔍 Starting database migration...${NC}"
            check_docker_compose
            check_database_connection
            create_backup_dir
            create_backup
            create_migrations_table
            run_migrations
            verify_migrations
            show_status
            echo -e "${GREEN}🎉 Database migration completed successfully!${NC}"
            ;;
        "status")
            check_docker_compose
            check_database_connection
            create_migrations_table
            show_status
            ;;
        "verify")
            check_docker_compose
            check_database_connection
            create_migrations_table
            verify_migrations
            ;;
        "backup")
            check_docker_compose
            check_database_connection
            create_backup_dir
            create_backup
            echo -e "${GREEN}✅ Database backup completed${NC}"
            ;;
        *)
            echo "Usage: $0 [migrate|status|verify|backup]"
            echo ""
            echo "Commands:"
            echo "  migrate  - Run pending migrations (default)"
            echo "  status   - Show migration status"
            echo "  verify   - Verify migration integrity"
            echo "  backup   - Create database backup"
            exit 1
            ;;
    esac
    
    log "Migration script completed: $command"
}

# Run main function
main "$@"