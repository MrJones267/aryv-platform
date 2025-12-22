#!/bin/bash

# Hitch Platform - Database Setup Script
# Author: Claude-Code
# Created: 2025-01-27
# Description: Sets up PostgreSQL database with PostGIS for production

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

# Function to wait for database to be ready
wait_for_database() {
    print_header "WAITING FOR DATABASE CONNECTION"
    
    local max_attempts=30
    local attempt=1
    
    while [[ $attempt -le $max_attempts ]]; do
        if docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T postgres pg_isready -U "${POSTGRES_USER:-hitch_user}" -d "${POSTGRES_DB:-hitch_db}" >/dev/null 2>&1; then
            print_status "✅ Database is ready"
            return 0
        fi
        
        if [[ $attempt -eq $max_attempts ]]; then
            print_error "❌ Database connection timeout after $max_attempts attempts"
            return 1
        fi
        
        print_status "Attempt $attempt/$max_attempts: Database not ready, waiting..."
        sleep 5
        ((attempt++))
    done
}

# Function to create database if it doesn't exist
create_database() {
    print_header "CREATING DATABASE"
    
    local db_name="${POSTGRES_DB:-hitch_db}"
    local db_user="${POSTGRES_USER:-hitch_user}"
    
    print_status "Creating database '$db_name' if it doesn't exist..."
    
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T postgres psql -U "$db_user" -d postgres << EOF
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '$db_name') THEN
        CREATE DATABASE $db_name;
        RAISE NOTICE 'Database $db_name created successfully';
    ELSE
        RAISE NOTICE 'Database $db_name already exists';
    END IF;
END
\$\$;
EOF
    
    print_status "Database creation completed"
}

# Function to run database initialization
initialize_database() {
    print_header "INITIALIZING DATABASE SCHEMA"
    
    local db_name="${POSTGRES_DB:-hitch_db}"
    local db_user="${POSTGRES_USER:-hitch_user}"
    local init_file="$PROJECT_ROOT/backend/database/init.sql"
    
    if [[ ! -f "$init_file" ]]; then
        print_error "Database initialization file not found: $init_file"
        return 1
    fi
    
    print_status "Running database initialization script..."
    
    # Copy the init file to the container and execute it
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T postgres psql -U "$db_user" -d "$db_name" -f - < "$init_file"
    
    if [[ $? -eq 0 ]]; then
        print_status "✅ Database schema initialized successfully"
    else
        print_error "❌ Database initialization failed"
        return 1
    fi
}

# Function to run database migrations
run_migrations() {
    print_header "RUNNING DATABASE MIGRATIONS"
    
    local migrations_dir="$PROJECT_ROOT/backend/database/migrations"
    
    if [[ ! -d "$migrations_dir" ]]; then
        print_warning "No migrations directory found, skipping migrations"
        return 0
    fi
    
    local db_name="${POSTGRES_DB:-hitch_db}"
    local db_user="${POSTGRES_USER:-hitch_user}"
    
    # Create migrations table if it doesn't exist
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T postgres psql -U "$db_user" -d "$db_name" << 'EOF'
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    filename VARCHAR(255) UNIQUE NOT NULL,
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
EOF
    
    # Find and run migration files
    if ls "$migrations_dir"/*.sql >/dev/null 2>&1; then
        for migration_file in "$migrations_dir"/*.sql; do
            local filename=$(basename "$migration_file")
            
            # Check if migration has already been applied
            local already_applied=$(docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T postgres psql -U "$db_user" -d "$db_name" -t -c "SELECT COUNT(*) FROM schema_migrations WHERE filename = '$filename';")
            
            if [[ $already_applied -gt 0 ]]; then
                print_status "Migration $filename already applied, skipping"
                continue
            fi
            
            print_status "Applying migration: $filename"
            
            # Run the migration
            if docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T postgres psql -U "$db_user" -d "$db_name" -f - < "$migration_file"; then
                # Record successful migration
                docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T postgres psql -U "$db_user" -d "$db_name" -c "INSERT INTO schema_migrations (filename) VALUES ('$filename');"
                print_status "✅ Migration $filename applied successfully"
            else
                print_error "❌ Migration $filename failed"
                return 1
            fi
        done
    else
        print_status "No migration files found"
    fi
}

# Function to verify database setup
verify_database() {
    print_header "VERIFYING DATABASE SETUP"
    
    local db_name="${POSTGRES_DB:-hitch_db}"
    local db_user="${POSTGRES_USER:-hitch_user}"
    
    print_status "Checking PostGIS extension..."
    local postgis_version=$(docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T postgres psql -U "$db_user" -d "$db_name" -t -c "SELECT PostGIS_Version();")
    if [[ -n "$postgis_version" ]]; then
        print_status "✅ PostGIS is installed: $postgis_version"
    else
        print_error "❌ PostGIS extension not found"
        return 1
    fi
    
    print_status "Checking required tables..."
    local table_count=$(docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T postgres psql -U "$db_user" -d "$db_name" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';")
    if [[ $table_count -gt 10 ]]; then
        print_status "✅ Database tables created ($table_count tables found)"
    else
        print_warning "⚠️  Limited tables found ($table_count tables)"
    fi
    
    print_status "Checking indexes..."
    local index_count=$(docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T postgres psql -U "$db_user" -d "$db_name" -t -c "SELECT COUNT(*) FROM pg_indexes WHERE schemaname = 'public';")
    print_status "✅ Database indexes created ($index_count indexes found)"
    
    print_status "Testing geospatial functions..."
    local distance_test=$(docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T postgres psql -U "$db_user" -d "$db_name" -t -c "SELECT calculate_distance_km(40.7128, -74.0060, 40.7589, -73.9851);")
    if [[ -n "$distance_test" ]]; then
        print_status "✅ Geospatial functions working (test distance: ${distance_test}km)"
    else
        print_error "❌ Geospatial functions not working"
    fi
}

# Function to create sample data for development
create_sample_data() {
    print_header "CREATING SAMPLE DATA"
    
    local db_name="${POSTGRES_DB:-hitch_db}"
    local db_user="${POSTGRES_USER:-hitch_user}"
    
    print_status "Creating sample users and data..."
    
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T postgres psql -U "$db_user" -d "$db_name" << 'EOF'
-- Sample rider
INSERT INTO users (email, password_hash, first_name, last_name, role, status, email_verified) VALUES
('rider@test.com', '$2b$10$rQ1K8/NQ9X.x/xXa/xXa/OQrQqQqQqQqQqQqQqQqQqQqQqQqQqQqQ', 'John', 'Rider', 'user', 'active', true)
ON CONFLICT (email) DO NOTHING;

-- Sample driver
INSERT INTO users (email, password_hash, first_name, last_name, role, status, email_verified) VALUES
('driver@test.com', '$2b$10$rQ1K8/NQ9X.x/xXa/xXa/OQrQqQqQqQqQqQqQqQqQqQqQqQqQqQqQ', 'Jane', 'Driver', 'driver', 'active', true)
ON CONFLICT (email) DO NOTHING;

-- Sample courier
INSERT INTO users (email, password_hash, first_name, last_name, role, status, email_verified) VALUES
('courier@test.com', '$2b$10$rQ1K8/NQ9X.x/xXa/xXa/OQrQqQqQqQqQqQqQqQqQqQqQqQqQqQqQ', 'Mike', 'Courier', 'courier', 'active', true)
ON CONFLICT (email) DO NOTHING;

-- Sample vehicle
INSERT INTO vehicles (user_id, make, model, year, color, license_plate, vehicle_type, is_verified) 
SELECT id, 'Toyota', 'Camry', 2020, 'Black', 'ABC123', 'car', true
FROM users WHERE email = 'driver@test.com'
ON CONFLICT (license_plate) DO NOTHING;

-- Sample addresses
INSERT INTO user_addresses (user_id, label, address_line_1, city, state, postal_code, location, is_default)
SELECT id, 'home', '123 Main St', 'New York', 'NY', '10001', ST_GeogFromText('POINT(-74.0060 40.7128)'), true
FROM users WHERE email = 'rider@test.com'
ON CONFLICT DO NOTHING;

INSERT INTO user_addresses (user_id, label, address_line_1, city, state, postal_code, location, is_default)
SELECT id, 'home', '456 Oak Ave', 'New York', 'NY', '10002', ST_GeogFromText('POINT(-73.9851 40.7589)'), true
FROM users WHERE email = 'driver@test.com'
ON CONFLICT DO NOTHING;
EOF
    
    print_status "✅ Sample data created"
}

# Function to backup database
backup_database() {
    print_header "CREATING DATABASE BACKUP"
    
    local db_name="${POSTGRES_DB:-hitch_db}"
    local db_user="${POSTGRES_USER:-hitch_user}"
    local backup_dir="$PROJECT_ROOT/backup"
    local backup_file="$backup_dir/hitch-db-backup-$(date +%Y%m%d-%H%M%S).sql"
    
    mkdir -p "$backup_dir"
    
    print_status "Creating backup: $backup_file"
    
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T postgres pg_dump -U "$db_user" -d "$db_name" --clean --if-exists > "$backup_file"
    
    if [[ $? -eq 0 ]]; then
        print_status "✅ Database backup created: $backup_file"
        
        # Compress the backup
        gzip "$backup_file"
        print_status "✅ Backup compressed: $backup_file.gz"
        
        # Keep only last 7 backups
        find "$backup_dir" -name "hitch-db-backup-*.sql.gz" -mtime +7 -delete
        print_status "Old backups cleaned up"
    else
        print_error "❌ Database backup failed"
        return 1
    fi
}

# Function to show database summary
show_database_summary() {
    print_header "DATABASE SETUP SUMMARY"
    
    local db_name="${POSTGRES_DB:-hitch_db}"
    local db_user="${POSTGRES_USER:-hitch_user}"
    
    echo -e "${GREEN}✅ Hitch Platform Database Setup Completed!${NC}"
    echo ""
    echo "📊 Database Information:"
    echo "  • Database: $db_name"
    echo "  • User: $db_user"
    echo "  • PostGIS: Enabled"
    echo ""
    
    # Get table stats
    echo "📋 Database Statistics:"
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T postgres psql -U "$db_user" -d "$db_name" -c "
    SELECT 
        schemaname,
        tablename,
        pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
    FROM pg_tables 
    WHERE schemaname = 'public'
    ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
    LIMIT 10;
    "
    
    echo ""
    echo "🔧 Database Management Commands:"
    echo "  • Connect: docker-compose -f docker-compose.prod.yml exec postgres psql -U $db_user -d $db_name"
    echo "  • Backup: ./scripts/database-setup.sh backup"
    echo "  • Monitor: ./scripts/database-setup.sh monitor"
    echo ""
    echo "📁 Important Files:"
    echo "  • Schema: $PROJECT_ROOT/backend/database/init.sql"
    echo "  • Backups: $PROJECT_ROOT/backup/"
    echo "  • Migrations: $PROJECT_ROOT/backend/database/migrations/"
}

# Function to monitor database
monitor_database() {
    print_header "DATABASE MONITORING"
    
    local db_name="${POSTGRES_DB:-hitch_db}"
    local db_user="${POSTGRES_USER:-hitch_user}"
    
    echo "🔍 Current Database Status:"
    
    # Connection count
    echo "Active Connections:"
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T postgres psql -U "$db_user" -d "$db_name" -c "
    SELECT count(*) as active_connections FROM pg_stat_activity WHERE state = 'active';
    "
    
    # Database size
    echo "Database Size:"
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T postgres psql -U "$db_user" -d "$db_name" -c "
    SELECT pg_size_pretty(pg_database_size('$db_name')) as database_size;
    "
    
    # Recent activity
    echo "Recent Activity:"
    docker-compose -f "$PROJECT_ROOT/docker-compose.prod.yml" exec -T postgres psql -U "$db_user" -d "$db_name" -c "
    SELECT 
        schemaname,
        tablename,
        n_tup_ins as inserts,
        n_tup_upd as updates,
        n_tup_del as deletes
    FROM pg_stat_user_tables 
    WHERE n_tup_ins + n_tup_upd + n_tup_del > 0
    ORDER BY n_tup_ins + n_tup_upd + n_tup_del DESC;
    "
}

# Main function
main() {
    local command="${1:-setup}"
    
    # Load environment variables
    if [[ -f "$PROJECT_ROOT/.env.production" ]]; then
        source "$PROJECT_ROOT/.env.production"
    else
        print_warning "Production environment file not found"
    fi
    
    case "$command" in
        "setup"|"")
            print_header "HITCH PLATFORM DATABASE SETUP"
            wait_for_database
            create_database
            initialize_database
            run_migrations
            verify_database
            create_sample_data
            show_database_summary
            ;;
        "init")
            print_header "DATABASE INITIALIZATION ONLY"
            wait_for_database
            initialize_database
            ;;
        "migrate")
            print_header "DATABASE MIGRATIONS ONLY"
            wait_for_database
            run_migrations
            ;;
        "verify")
            print_header "DATABASE VERIFICATION ONLY"
            wait_for_database
            verify_database
            ;;
        "backup")
            backup_database
            ;;
        "monitor")
            monitor_database
            ;;
        "sample")
            wait_for_database
            create_sample_data
            ;;
        *)
            echo "Usage: $0 [setup|init|migrate|verify|backup|monitor|sample]"
            exit 1
            ;;
    esac
    
    print_status "Database operation completed successfully!"
}

# Run main function
main "$@"