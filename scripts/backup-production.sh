#!/bin/bash

# Production Backup Script for Hitch Platform
# Author: Claude-Code
# Created: 2025-01-24
# Description: Automated backup with retention and S3 upload

set -e  # Exit on any error

# Configuration
BACKUP_DIR="/backup"
S3_BUCKET="${BACKUP_S3_BUCKET:-hitch-production-backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"
LOG_FILE="/var/log/hitch/backup.log"

# Database connection
DB_HOST="${DB_HOST:-postgres}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-hitch_production}"
DB_USER="${DB_USER:-hitch_prod_user}"

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

# Create backup directories
setup_backup_dirs() {
    mkdir -p "$BACKUP_DIR"/{database,files,logs}
    mkdir -p "$(dirname "$LOG_FILE")"
}

# Database backup
backup_database() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/database/hitch_db_${timestamp}.sql"
    local compressed_file="${backup_file}.gz"
    
    log "Creating database backup..."
    
    # Create database backup
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
        --create \
        > "$backup_file"
    
    if [ $? -eq 0 ]; then
        # Compress backup
        gzip "$backup_file"
        
        # Verify compressed file
        if [ -f "$compressed_file" ]; then
            local size=$(du -sh "$compressed_file" | cut -f1)
            success "Database backup created: $compressed_file ($size)"
            echo "$compressed_file"
        else
            error "Failed to compress database backup"
        fi
    else
        error "Failed to create database backup"
    fi
}

# Application files backup
backup_files() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/files/hitch_files_${timestamp}.tar.gz"
    
    log "Creating application files backup..."
    
    # Backup important directories
    tar -czf "$backup_file" \
        --exclude="node_modules" \
        --exclude="*.log" \
        --exclude="dist" \
        --exclude="build" \
        uploads/ \
        logs/ \
        nginx/ssl/ \
        monitoring/ \
        .env.production \
        docker-compose.prod.yml 2>/dev/null || true
    
    if [ -f "$backup_file" ]; then
        local size=$(du -sh "$backup_file" | cut -f1)
        success "Files backup created: $backup_file ($size)"
        echo "$backup_file"
    else
        error "Failed to create files backup"
    fi
}

# Container volumes backup
backup_volumes() {
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/files/hitch_volumes_${timestamp}.tar.gz"
    
    log "Creating Docker volumes backup..."
    
    # Backup persistent volumes
    docker run --rm \
        -v hitch_backend_uploads_prod:/data/uploads:ro \
        -v hitch_grafana_data_prod:/data/grafana:ro \
        -v hitch_prometheus_data_prod:/data/prometheus:ro \
        -v "$BACKUP_DIR:/backup" \
        alpine:latest \
        tar -czf "/backup/files/hitch_volumes_${timestamp}.tar.gz" \
        -C /data . 2>/dev/null || true
    
    if [ -f "$backup_file" ]; then
        local size=$(du -sh "$backup_file" | cut -f1)
        success "Volumes backup created: $backup_file ($size)"
        echo "$backup_file"
    else
        warning "Volumes backup failed (containers may not be running)"
    fi
}

# Upload to S3 (if configured)
upload_to_s3() {
    local file_path="$1"
    
    if [ -z "$AWS_ACCESS_KEY_ID" ] || [ -z "$AWS_SECRET_ACCESS_KEY" ]; then
        warning "AWS credentials not configured, skipping S3 upload"
        return 0
    fi
    
    if ! command -v aws &> /dev/null; then
        warning "AWS CLI not installed, skipping S3 upload"
        return 0
    fi
    
    local filename=$(basename "$file_path")
    local s3_key="$(date +%Y/%m/%d)/$filename"
    
    log "Uploading to S3: s3://$S3_BUCKET/$s3_key"
    
    aws s3 cp "$file_path" "s3://$S3_BUCKET/$s3_key" \
        --storage-class STANDARD_IA \
        --metadata "backup-date=$(date -Iseconds),backup-type=automated"
    
    if [ $? -eq 0 ]; then
        success "Uploaded to S3: s3://$S3_BUCKET/$s3_key"
    else
        error "Failed to upload to S3"
    fi
}

# Clean old backups
cleanup_old_backups() {
    log "Cleaning up backups older than $RETENTION_DAYS days..."
    
    # Clean local backups
    find "$BACKUP_DIR" -name "*.sql.gz" -type f -mtime +$RETENTION_DAYS -delete
    find "$BACKUP_DIR" -name "*.tar.gz" -type f -mtime +$RETENTION_DAYS -delete
    
    local cleaned=$(find "$BACKUP_DIR" -name "*.gz" -type f -mtime +$RETENTION_DAYS 2>/dev/null | wc -l)
    success "Cleaned up $cleaned old backup files"
    
    # Clean S3 backups (if configured)
    if [ -n "$AWS_ACCESS_KEY_ID" ] && command -v aws &> /dev/null; then
        local cutoff_date=$(date -d "$RETENTION_DAYS days ago" +%Y-%m-%d)
        
        aws s3 ls "s3://$S3_BUCKET/" --recursive | \
        awk '{print $1,$2,$4}' | \
        while read date time key; do
            if [[ "$date" < "$cutoff_date" ]]; then
                aws s3 rm "s3://$S3_BUCKET/$key"
                log "Deleted old S3 backup: $key"
            fi
        done
    fi
}

# Verify backup integrity
verify_backup() {
    local backup_file="$1"
    
    log "Verifying backup integrity: $(basename "$backup_file")"
    
    if [[ "$backup_file" == *.sql.gz ]]; then
        # Verify SQL backup
        if gzip -t "$backup_file" && zcat "$backup_file" | head -n 20 | grep -q "PostgreSQL database dump"; then
            success "Database backup verification passed"
        else
            error "Database backup verification failed"
        fi
    elif [[ "$backup_file" == *.tar.gz ]]; then
        # Verify tar backup
        if tar -tzf "$backup_file" > /dev/null 2>&1; then
            success "Files backup verification passed"
        else
            error "Files backup verification failed"
        fi
    fi
}

# Generate backup report
generate_report() {
    local report_file="$BACKUP_DIR/backup_report_$(date +%Y%m%d_%H%M%S).txt"
    
    cat > "$report_file" << EOF
# Hitch Platform Backup Report
Generated: $(date)
Host: $(hostname)
User: $(whoami)

## Backup Statistics
Total backup size: $(du -sh "$BACKUP_DIR" | cut -f1)
Number of database backups: $(find "$BACKUP_DIR/database" -name "*.sql.gz" | wc -l)
Number of file backups: $(find "$BACKUP_DIR/files" -name "*.tar.gz" | wc -l)

## Latest Backups
Database backups (latest 5):
$(find "$BACKUP_DIR/database" -name "*.sql.gz" | sort -r | head -5 | while read f; do echo "  $(basename "$f") - $(du -sh "$f" | cut -f1)"; done)

File backups (latest 5):
$(find "$BACKUP_DIR/files" -name "*.tar.gz" | sort -r | head -5 | while read f; do echo "  $(basename "$f") - $(du -sh "$f" | cut -f1)"; done)

## Disk Usage
$(df -h "$BACKUP_DIR")

## Process Information
Backup completed at: $(date)
Duration: ${SECONDS}s
Status: SUCCESS
EOF
    
    success "Backup report generated: $report_file"
}

# Send notification (placeholder)
send_notification() {
    local status="$1"
    local message="$2"
    
    # In a real implementation, this would send notifications via:
    # - Email (SMTP)
    # - Slack webhook
    # - Discord webhook
    # - SMS service
    # - PagerDuty (for failures)
    
    log "Notification: [$status] $message"
    
    # Example webhook notification (uncomment and configure)
    # if [ -n "$WEBHOOK_URL" ]; then
    #     curl -X POST "$WEBHOOK_URL" \
    #         -H "Content-Type: application/json" \
    #         -d "{\"text\":\"Hitch Backup [$status]: $message\"}"
    # fi
}

# Health check before backup
health_check() {
    log "Performing pre-backup health check..."
    
    # Check disk space (at least 5GB free)
    local available=$(df -BG "$BACKUP_DIR" | awk 'NR==2 {print $4}' | sed 's/G//')
    if [ "$available" -lt 5 ]; then
        error "Insufficient disk space: ${available}GB available, need at least 5GB"
    fi
    
    # Check database connectivity
    if ! PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" &> /dev/null; then
        error "Cannot connect to database"
    fi
    
    # Check if backup directory is writable
    if ! touch "$BACKUP_DIR/write_test" 2>/dev/null; then
        error "Backup directory is not writable: $BACKUP_DIR"
    fi
    rm -f "$BACKUP_DIR/write_test"
    
    success "Health check passed"
}

# Main backup function
run_backup() {
    local backup_type="${1:-full}"
    
    log "Starting $backup_type backup..."
    local start_time=$(date +%s)
    
    # Health check
    health_check
    
    local backup_files=()
    
    # Database backup
    if [[ "$backup_type" == "full" || "$backup_type" == "database" ]]; then
        local db_backup=$(backup_database)
        verify_backup "$db_backup"
        backup_files+=("$db_backup")
        
        # Upload to S3 if configured
        if [ -n "$AWS_ACCESS_KEY_ID" ]; then
            upload_to_s3 "$db_backup"
        fi
    fi
    
    # Files backup
    if [[ "$backup_type" == "full" || "$backup_type" == "files" ]]; then
        local files_backup=$(backup_files)
        verify_backup "$files_backup"
        backup_files+=("$files_backup")
        
        # Volume backup
        local volumes_backup=$(backup_volumes)
        if [ -n "$volumes_backup" ]; then
            verify_backup "$volumes_backup"
            backup_files+=("$volumes_backup")
        fi
        
        # Upload to S3 if configured
        if [ -n "$AWS_ACCESS_KEY_ID" ]; then
            upload_to_s3 "$files_backup"
            if [ -n "$volumes_backup" ]; then
                upload_to_s3 "$volumes_backup"
            fi
        fi
    fi
    
    # Cleanup old backups
    cleanup_old_backups
    
    # Generate report
    generate_report
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    success "Backup completed successfully in ${duration}s"
    success "Created ${#backup_files[@]} backup files"
    
    # Send success notification
    send_notification "SUCCESS" "Backup completed in ${duration}s (${#backup_files[@]} files)"
}

# List backups
list_backups() {
    log "Available backups:"
    echo ""
    
    echo -e "${GREEN}Database Backups:${NC}"
    find "$BACKUP_DIR/database" -name "*.sql.gz" | sort -r | while read f; do
        local size=$(du -sh "$f" | cut -f1)
        local date=$(stat -c %y "$f" | cut -d' ' -f1)
        echo "  $(basename "$f") - $size - $date"
    done
    echo ""
    
    echo -e "${GREEN}File Backups:${NC}"
    find "$BACKUP_DIR/files" -name "*.tar.gz" | sort -r | while read f; do
        local size=$(du -sh "$f" | cut -f1)
        local date=$(stat -c %y "$f" | cut -d' ' -f1)
        echo "  $(basename "$f") - $size - $date"
    done
    echo ""
    
    echo -e "${GREEN}Total backup size:${NC} $(du -sh "$BACKUP_DIR" | cut -f1)"
}

# Restore from backup
restore_backup() {
    local backup_file="$1"
    
    if [ -z "$backup_file" ]; then
        error "Please specify backup file to restore"
    fi
    
    if [ ! -f "$backup_file" ]; then
        error "Backup file not found: $backup_file"
    fi
    
    warning "This will OVERWRITE current data. Are you sure? (yes/no)"
    read -r confirmation
    
    if [ "$confirmation" != "yes" ]; then
        log "Restore cancelled"
        exit 0
    fi
    
    log "Restoring from backup: $backup_file"
    
    if [[ "$backup_file" == *.sql.gz ]]; then
        # Restore database
        log "Restoring database..."
        zcat "$backup_file" | PGPASSWORD="$POSTGRES_PASSWORD" psql \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME"
        
        success "Database restored successfully"
    elif [[ "$backup_file" == *.tar.gz ]]; then
        # Restore files
        log "Restoring files..."
        tar -xzf "$backup_file" -C /
        
        success "Files restored successfully"
    fi
}

# Print usage
usage() {
    echo "Usage: $0 [COMMAND] [OPTIONS]"
    echo ""
    echo "Commands:"
    echo "  backup [TYPE]  - Create backup (TYPE: full|database|files, default: full)"
    echo "  list           - List available backups"
    echo "  restore FILE   - Restore from backup file"
    echo "  cleanup        - Clean old backups only"
    echo ""
    echo "Examples:"
    echo "  $0 backup           # Full backup"
    echo "  $0 backup database  # Database only"
    echo "  $0 list             # List backups"
    echo "  $0 restore /backup/database/hitch_db_20250124_120000.sql.gz"
    echo ""
    echo "Environment Variables:"
    echo "  BACKUP_RETENTION_DAYS - Days to keep backups (default: 30)"
    echo "  BACKUP_S3_BUCKET     - S3 bucket for remote backups"
    echo "  AWS_ACCESS_KEY_ID    - AWS access key for S3 upload"
    echo "  AWS_SECRET_ACCESS_KEY - AWS secret key for S3 upload"
    echo ""
}

# Main execution
main() {
    local command="${1:-backup}"
    
    # Setup directories
    setup_backup_dirs
    
    case "$command" in
        "backup")
            run_backup "${2:-full}"
            ;;
        "list")
            list_backups
            ;;
        "restore")
            restore_backup "$2"
            ;;
        "cleanup")
            cleanup_old_backups
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

# Trap errors and send failure notification
trap 'send_notification "FAILED" "Backup failed with error"; exit 1' ERR

# Run main function with all arguments
main "$@"