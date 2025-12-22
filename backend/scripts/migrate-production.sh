#!/bin/bash

# Production Database Migration Script for Hitch Platform
# Author: Claude-Code
# Created: 2025-01-24
# Description: Safe production migration with rollback capabilities

set -e  # Exit on any error

# Configuration
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-hitch_production}"
DB_USER="${DB_USER:-hitch_prod_user}"
BACKUP_DIR="/backup"
MIGRATION_DIR="/app/migrations"
LOG_FILE="/var/log/hitch/migration.log"

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

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if PostgreSQL client is available
    if ! command -v psql &> /dev/null; then
        error "PostgreSQL client (psql) is not installed"
    fi
    
    # Check if database is accessible
    if ! PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &> /dev/null; then
        error "Cannot connect to database. Check connection parameters."
    fi
    
    # Check if migration directory exists
    if [ ! -d "$MIGRATION_DIR" ]; then
        error "Migration directory not found: $MIGRATION_DIR"
    fi
    
    # Create backup directory if it doesn't exist
    mkdir -p "$BACKUP_DIR"
    
    # Create log directory
    mkdir -p "$(dirname "$LOG_FILE")"
    
    success "Prerequisites check passed"
}

# Create database backup
create_backup() {
    local backup_file="$BACKUP_DIR/hitch_backup_$(date +%Y%m%d_%H%M%S).sql"
    
    log "Creating database backup: $backup_file"
    
    PGPASSWORD="$POSTGRES_PASSWORD" pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --verbose \
        --no-owner \
        --no-privileges \
        --clean \
        --if-exists \
        > "$backup_file"
    
    if [ $? -eq 0 ]; then
        success "Backup created successfully: $backup_file"
        echo "$backup_file" > "$BACKUP_DIR/latest_backup.txt"
    else
        error "Failed to create backup"
    fi
}

# Check if migration was already applied
is_migration_applied() {
    local migration_file="$1"
    local migration_name=$(basename "$migration_file" .sql)
    
    local count=$(PGPASSWORD="$POSTGRES_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'schema_migrations';" 2>/dev/null | tr -d ' ')
    
    if [ "$count" = "0" ]; then
        # Create schema_migrations table if it doesn't exist
        PGPASSWORD="$POSTGRES_PASSWORD" psql \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            -c "CREATE TABLE IF NOT EXISTS schema_migrations (
                version VARCHAR(255) PRIMARY KEY,
                applied_at TIMESTAMP DEFAULT NOW()
            );"
        return 1  # Migration not applied
    fi
    
    local applied=$(PGPASSWORD="$POSTGRES_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -t -c "SELECT COUNT(*) FROM schema_migrations WHERE version = '$migration_name';" | tr -d ' ')
    
    [ "$applied" != "0" ]
}

# Apply a single migration
apply_migration() {
    local migration_file="$1"
    local migration_name=$(basename "$migration_file" .sql)
    
    log "Applying migration: $migration_name"
    
    # Check if already applied
    if is_migration_applied "$migration_file"; then
        warning "Migration $migration_name already applied, skipping"
        return 0
    fi
    
    # Apply migration within transaction
    PGPASSWORD="$POSTGRES_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -v ON_ERROR_STOP=1 \
        -f "$migration_file"
    
    if [ $? -eq 0 ]; then
        # Record successful migration
        PGPASSWORD="$POSTGRES_PASSWORD" psql \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            -c "INSERT INTO schema_migrations (version) VALUES ('$migration_name');"
        
        success "Successfully applied migration: $migration_name"
        return 0
    else
        error "Failed to apply migration: $migration_name"
    fi
}

# Run all pending migrations
run_migrations() {
    log "Starting database migrations..."
    
    # Find all migration files and sort them
    local migration_files=($(find "$MIGRATION_DIR" -name "*.sql" | sort))
    
    if [ ${#migration_files[@]} -eq 0 ]; then
        warning "No migration files found in $MIGRATION_DIR"
        return 0
    fi
    
    log "Found ${#migration_files[@]} migration files"
    
    # Apply each migration
    for migration_file in "${migration_files[@]}"; do
        apply_migration "$migration_file"
    done
    
    success "All migrations completed successfully"
}

# Verify database health after migration
verify_database() {
    log "Verifying database health..."
    
    # Check if all expected tables exist
    local expected_tables=(
        "users"
        "rides"
        "packages"
        "delivery_agreements"
        "delivery_qr_codes"
        "courier_profiles"
        "courier_locations"
        "disputes"
        "chat_messages"
        "package_images"
        "schema_migrations"
    )
    
    for table in "${expected_tables[@]}"; do
        local count=$(PGPASSWORD="$POSTGRES_PASSWORD" psql \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = '$table';" | tr -d ' ')
        
        if [ "$count" = "0" ]; then
            error "Expected table '$table' not found after migration"
        else
            log "✓ Table '$table' exists"
        fi
    done
    
    # Verify PostgreSQL extensions
    local extensions=("postgis" "uuid-ossp")
    for ext in "${extensions[@]}"; do
        local installed=$(PGPASSWORD="$POSTGRES_PASSWORD" psql \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            -t -c "SELECT COUNT(*) FROM pg_extension WHERE extname = '$ext';" | tr -d ' ')
        
        if [ "$installed" = "0" ]; then
            error "Required extension '$ext' not installed"
        else
            log "✓ Extension '$ext' is installed"
        fi
    done
    
    success "Database health verification passed"
}

# Rollback to previous backup
rollback() {
    local backup_file="$1"
    
    if [ -z "$backup_file" ]; then
        if [ -f "$BACKUP_DIR/latest_backup.txt" ]; then
            backup_file=$(cat "$BACKUP_DIR/latest_backup.txt")
        else
            error "No backup file specified and no latest backup found"
        fi
    fi
    
    if [ ! -f "$backup_file" ]; then
        error "Backup file not found: $backup_file"
    fi
    
    warning "Rolling back database to: $backup_file"
    echo "This will DESTROY all current data. Are you sure? (yes/no)"
    read -r confirmation
    
    if [ "$confirmation" != "yes" ]; then
        log "Rollback cancelled"
        exit 0
    fi
    
    log "Restoring database from backup..."
    
    PGPASSWORD="$POSTGRES_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -f "$backup_file"
    
    if [ $? -eq 0 ]; then
        success "Database rolled back successfully"
    else
        error "Failed to rollback database"
    fi
}

# Show migration status
show_status() {
    log "Migration status:"
    
    # Check if schema_migrations table exists
    local count=$(PGPASSWORD="$POSTGRES_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'schema_migrations';" 2>/dev/null | tr -d ' ')
    
    if [ "$count" = "0" ]; then
        warning "No migrations have been applied yet"
        return 0
    fi
    
    # Show applied migrations
    echo -e "\n${GREEN}Applied migrations:${NC}"
    PGPASSWORD="$POSTGRES_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        -c "SELECT version, applied_at FROM schema_migrations ORDER BY applied_at;"
    
    # Show pending migrations
    echo -e "\n${YELLOW}Available migration files:${NC}"
    local migration_files=($(find "$MIGRATION_DIR" -name "*.sql" | sort))
    for migration_file in "${migration_files[@]}"; do
        local migration_name=$(basename "$migration_file" .sql)
        if is_migration_applied "$migration_file"; then
            echo "✓ $migration_name (applied)"
        else
            echo "⚠ $migration_name (pending)"
        fi
    done
}

# Print usage
usage() {
    echo "Usage: $0 [COMMAND]"
    echo ""
    echo "Commands:"
    echo "  migrate    - Run all pending migrations (default)"
    echo "  status     - Show migration status"
    echo "  rollback   - Rollback to previous backup"
    echo "  backup     - Create database backup only"
    echo "  verify     - Verify database health"
    echo ""
    echo "Environment Variables:"
    echo "  DB_HOST           - Database host (default: postgres)"
    echo "  DB_PORT           - Database port (default: 5432)"
    echo "  DB_NAME           - Database name (default: hitch_production)"
    echo "  DB_USER           - Database user (default: hitch_prod_user)"
    echo "  POSTGRES_PASSWORD - Database password (required)"
    echo ""
}

# Main execution
main() {
    local command="${1:-migrate}"
    
    case "$command" in
        "migrate")
            log "Starting production migration process..."
            check_prerequisites
            create_backup
            run_migrations
            verify_database
            success "Migration process completed successfully!"
            ;;
        "status")
            show_status
            ;;
        "rollback")
            rollback "$2"
            ;;
        "backup")
            check_prerequisites
            create_backup
            ;;
        "verify")
            check_prerequisites
            verify_database
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