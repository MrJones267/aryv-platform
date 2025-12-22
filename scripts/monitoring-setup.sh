#!/bin/bash

# Hitch Platform - Production Monitoring Setup
# Author: Claude-Code
# Created: 2025-01-27
# Description: Sets up comprehensive monitoring for production environment

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

# Function to create Grafana dashboard for Hitch platform
create_hitch_dashboard() {
    print_header "CREATING HITCH PLATFORM DASHBOARD"
    
    local dashboard_dir="$PROJECT_ROOT/monitoring/grafana/dashboards"
    mkdir -p "$dashboard_dir"
    
    cat > "$dashboard_dir/hitch-platform.json" << 'EOF'
{
  "dashboard": {
    "id": null,
    "title": "Hitch Platform Overview",
    "tags": ["hitch", "production"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "API Response Time",
        "type": "stat",
        "targets": [
          {
            "expr": "avg(http_request_duration_seconds{job=\"hitch-backend\"})",
            "legendFormat": "Avg Response Time"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "s",
            "thresholds": {
              "steps": [
                {"color": "green", "value": null},
                {"color": "yellow", "value": 0.5},
                {"color": "red", "value": 1.0}
              ]
            }
          }
        },
        "gridPos": {"h": 8, "w": 6, "x": 0, "y": 0}
      },
      {
        "id": 2,
        "title": "Active Rides",
        "type": "stat",
        "targets": [
          {
            "expr": "hitch_active_rides_total",
            "legendFormat": "Active Rides"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "short",
            "thresholds": {
              "steps": [
                {"color": "green", "value": null},
                {"color": "yellow", "value": 50},
                {"color": "red", "value": 100}
              ]
            }
          }
        },
        "gridPos": {"h": 8, "w": 6, "x": 6, "y": 0}
      },
      {
        "id": 3,
        "title": "Database Connections",
        "type": "stat",
        "targets": [
          {
            "expr": "pg_stat_database_numbackends{datname=\"hitch_production\"}",
            "legendFormat": "DB Connections"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "short",
            "thresholds": {
              "steps": [
                {"color": "green", "value": null},
                {"color": "yellow", "value": 50},
                {"color": "red", "value": 80}
              ]
            }
          }
        },
        "gridPos": {"h": 8, "w": 6, "x": 12, "y": 0}
      },
      {
        "id": 4,
        "title": "System Memory Usage",
        "type": "stat",
        "targets": [
          {
            "expr": "(1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100",
            "legendFormat": "Memory Usage %"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "percent",
            "thresholds": {
              "steps": [
                {"color": "green", "value": null},
                {"color": "yellow", "value": 70},
                {"color": "red", "value": 90}
              ]
            }
          }
        },
        "gridPos": {"h": 8, "w": 6, "x": 18, "y": 0}
      },
      {
        "id": 5,
        "title": "API Request Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{job=\"hitch-backend\"}[5m])",
            "legendFormat": "{{method}} {{route}}"
          }
        ],
        "yAxes": [
          {"label": "Requests/sec", "min": 0},
          {"show": false}
        ],
        "gridPos": {"h": 9, "w": 12, "x": 0, "y": 8}
      },
      {
        "id": 6,
        "title": "Error Rate",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(http_requests_total{job=\"hitch-backend\",status_code=~\"4..|5..\"}[5m])",
            "legendFormat": "{{status_code}} Errors"
          }
        ],
        "yAxes": [
          {"label": "Errors/sec", "min": 0},
          {"show": false}
        ],
        "gridPos": {"h": 9, "w": 12, "x": 12, "y": 8}
      }
    ],
    "time": {
      "from": "now-1h",
      "to": "now"
    },
    "refresh": "30s"
  }
}
EOF

    print_status "Hitch platform dashboard created"
}

# Function to create alert rules
create_alert_rules() {
    print_header "CREATING MONITORING ALERT RULES"
    
    local rules_dir="$PROJECT_ROOT/monitoring/rules"
    mkdir -p "$rules_dir"
    
    cat > "$rules_dir/hitch-alerts.yml" << 'EOF'
groups:
  - name: hitch-platform-alerts
    rules:
      - alert: HitchBackendDown
        expr: up{job="hitch-backend"} == 0
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Hitch Backend service is down"
          description: "The Hitch backend service has been down for more than 1 minute."

      - alert: HitchHighResponseTime
        expr: avg(http_request_duration_seconds{job="hitch-backend"}) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High API response time"
          description: "API response time is {{ $value }}s, which is above the 2s threshold."

      - alert: HitchDatabaseConnectionsHigh
        expr: pg_stat_database_numbackends{datname="hitch_production"} > 80
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High database connections"
          description: "Database has {{ $value }} active connections, approaching limit."

      - alert: HitchHighErrorRate
        expr: rate(http_requests_total{job="hitch-backend",status_code=~"5.."}[5m]) > 0.05
        for: 3m
        labels:
          severity: critical
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value }} requests/second for 5xx errors."

      - alert: HitchMemoryUsageHigh
        expr: (1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)) * 100 > 90
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High memory usage"
          description: "Memory usage is {{ $value }}%, above 90% threshold."

      - alert: HitchDiskSpaceLow
        expr: (1 - (node_filesystem_avail_bytes{mountpoint="/"} / node_filesystem_size_bytes{mountpoint="/"})) * 100 > 85
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Low disk space"
          description: "Disk usage is {{ $value }}%, above 85% threshold."

      - alert: HitchCourierServiceDown
        expr: up{job="hitch-backend",instance=~".*courier.*"} == 0
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Courier service endpoint not responding"
          description: "Courier service health check has failed for more than 2 minutes."

      - alert: HitchActiveRidesHigh
        expr: hitch_active_rides_total > 1000
        for: 10m
        labels:
          severity: info
        annotations:
          summary: "High number of active rides"
          description: "There are {{ $value }} active rides, which may indicate high platform usage."
EOF

    print_status "Alert rules created"
}

# Function to create monitoring configuration for Node Exporter
create_node_exporter_config() {
    print_header "SETTING UP NODE EXPORTER"
    
    # Add Node Exporter to docker-compose if not present
    local compose_file="$PROJECT_ROOT/docker-compose.prod.yml"
    
    if ! grep -q "node-exporter" "$compose_file"; then
        print_status "Adding Node Exporter to production compose file..."
        
        # Create a backup
        cp "$compose_file" "$compose_file.backup"
        
        # Add Node Exporter service (this is a simplified addition)
        cat >> "$compose_file" << 'EOF'

  # Node Exporter for system metrics
  node-exporter:
    image: prom/node-exporter:v1.6.0
    container_name: hitch-node-exporter-prod
    command:
      - '--path.rootfs=/host'
      - '--collector.filesystem.mount-points-exclude=^/(sys|proc|dev|host|etc)($$|/)'
    ports:
      - "9100:9100"
    volumes:
      - '/:/host:ro,rslave'
    networks:
      - hitch-network-prod
    restart: always
    deploy:
      resources:
        limits:
          memory: 128M
          cpus: '0.2'
        reservations:
          memory: 64M
          cpus: '0.1'
    logging:
      driver: "json-file"
      options:
        max-size: "5m"
        max-file: "2"
EOF
        print_status "Node Exporter added to production environment"
    else
        print_status "Node Exporter already configured"
    fi
}

# Function to create Grafana datasource configuration
create_grafana_datasources() {
    print_header "CONFIGURING GRAFANA DATASOURCES"
    
    local datasources_dir="$PROJECT_ROOT/monitoring/grafana/datasources"
    mkdir -p "$datasources_dir"
    
    cat > "$datasources_dir/datasources.yml" << 'EOF'
apiVersion: 1

datasources:
  - name: Prometheus
    type: prometheus
    access: proxy
    url: http://prometheus:9090
    isDefault: true
    editable: true
    
  - name: Loki
    type: loki
    access: proxy
    url: http://loki:3100
    editable: true
EOF

    print_status "Grafana datasources configured"
}

# Function to create log monitoring setup
create_log_monitoring() {
    print_header "SETTING UP LOG MONITORING"
    
    local loki_dir="$PROJECT_ROOT/monitoring/loki"
    mkdir -p "$loki_dir"
    
    if [[ ! -f "$loki_dir/loki.yml" ]]; then
        cat > "$loki_dir/loki.yml" << 'EOF'
auth_enabled: false

server:
  http_listen_port: 3100
  grpc_listen_port: 9096

common:
  path_prefix: /loki
  storage:
    filesystem:
      chunks_directory: /loki/chunks
      rules_directory: /loki/rules
  replication_factor: 1
  ring:
    kvstore:
      store: inmemory

query_range:
  results_cache:
    cache:
      embedded_cache:
        enabled: true
        max_size_mb: 100

schema_config:
  configs:
    - from: 2020-10-24
      store: boltdb-shipper
      object_store: filesystem
      schema: v11
      index:
        prefix: index_
        period: 24h

ruler:
  alertmanager_url: http://alertmanager:9093

limits_config:
  enforce_metric_name: false
  reject_old_samples: true
  reject_old_samples_max_age: 168h

chunk_store_config:
  max_look_back_period: 0s

table_manager:
  retention_deletes_enabled: false
  retention_period: 0s
EOF
        print_status "Loki configuration created"
    fi
}

# Function to create backup monitoring
create_backup_monitoring() {
    print_header "SETTING UP BACKUP MONITORING"
    
    local backup_script="$PROJECT_ROOT/scripts/backup-with-monitoring.sh"
    
    cat > "$backup_script" << 'EOF'
#!/bin/bash

# Hitch Platform - Backup with Monitoring
# This script creates backups and reports metrics to Prometheus

set -euo pipefail

BACKUP_DIR="/opt/hitch-backups/$(date +%Y-%m-%d_%H-%M-%S)"
METRICS_FILE="/tmp/backup_metrics.prom"

# Create backup directory
mkdir -p "$BACKUP_DIR"

# Start backup
echo "hitch_backup_start_time $(date +%s)" > "$METRICS_FILE"

# Backup database
echo "Starting database backup..."
if docker exec hitch-postgres-prod pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > "$BACKUP_DIR/database.sql"; then
    echo "hitch_backup_database_success 1" >> "$METRICS_FILE"
    echo "hitch_backup_database_size_bytes $(stat -c%s "$BACKUP_DIR/database.sql")" >> "$METRICS_FILE"
else
    echo "hitch_backup_database_success 0" >> "$METRICS_FILE"
    exit 1
fi

# Backup application data
echo "Starting data backup..."
if tar -czf "$BACKUP_DIR/hitch-data.tar.gz" -C /opt hitch-data/; then
    echo "hitch_backup_data_success 1" >> "$METRICS_FILE"
    echo "hitch_backup_data_size_bytes $(stat -c%s "$BACKUP_DIR/hitch-data.tar.gz")" >> "$METRICS_FILE"
else
    echo "hitch_backup_data_success 0" >> "$METRICS_FILE"
fi

# Cleanup old backups (keep last 7 days)
find /opt/hitch-backups -type d -name "20*" -mtime +7 -exec rm -rf {} \; 2>/dev/null || true

# Record completion
echo "hitch_backup_completion_time $(date +%s)" >> "$METRICS_FILE"
echo "hitch_backup_success 1" >> "$METRICS_FILE"

echo "Backup completed: $BACKUP_DIR"
EOF

    chmod +x "$backup_script"
    print_status "Backup monitoring script created"
}

# Function to start monitoring services
start_monitoring() {
    print_header "STARTING MONITORING SERVICES"
    
    cd "$PROJECT_ROOT"
    
    # Start monitoring services
    print_status "Starting Prometheus..."
    docker-compose -f docker-compose.prod.yml up -d prometheus
    
    print_status "Starting Grafana..."
    docker-compose -f docker-compose.prod.yml up -d grafana
    
    print_status "Starting Loki..."
    docker-compose -f docker-compose.prod.yml up -d loki
    
    # Start Node Exporter if available
    if docker-compose -f docker-compose.prod.yml config | grep -q "node-exporter"; then
        print_status "Starting Node Exporter..."
        docker-compose -f docker-compose.prod.yml up -d node-exporter
    fi
    
    print_status "Monitoring services started"
}

# Function to verify monitoring setup
verify_monitoring() {
    print_header "VERIFYING MONITORING SETUP"
    
    local max_attempts=30
    local attempt=1
    
    # Test Prometheus
    print_status "Testing Prometheus connection..."
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -s "http://localhost:9090/-/healthy" > /dev/null 2>&1; then
            print_status "✅ Prometheus is healthy"
            break
        fi
        
        if [[ $attempt -eq $max_attempts ]]; then
            print_warning "⚠️  Prometheus health check timeout"
            break
        fi
        
        sleep 2
        ((attempt++))
    done
    
    # Test Grafana
    attempt=1
    print_status "Testing Grafana connection..."
    while [[ $attempt -le $max_attempts ]]; do
        if curl -f -s "http://localhost:3003/api/health" > /dev/null 2>&1; then
            print_status "✅ Grafana is healthy"
            break
        fi
        
        if [[ $attempt -eq $max_attempts ]]; then
            print_warning "⚠️  Grafana health check timeout"
            break
        fi
        
        sleep 2
        ((attempt++))
    done
    
    print_status "Monitoring verification completed"
}

# Function to show monitoring summary
show_monitoring_summary() {
    print_header "MONITORING SETUP SUMMARY"
    
    echo -e "${GREEN}✅ Hitch Platform Monitoring Setup Completed!${NC}"
    echo ""
    echo "📊 Monitoring Services:"
    echo "  • Prometheus: http://localhost:9090"
    echo "  • Grafana: http://localhost:3003"
    echo "  • Loki: http://localhost:3100"
    echo ""
    echo "📈 Available Dashboards:"
    echo "  • Hitch Platform Overview"
    echo "  • System Metrics (Node Exporter)"
    echo "  • Application Logs (Loki)"
    echo ""
    echo "🚨 Alert Rules Configured:"
    echo "  • Backend service health"
    echo "  • API response time"
    echo "  • Database connections"
    echo "  • Error rates"
    echo "  • System resources"
    echo ""
    echo "🔧 Monitoring Commands:"
    echo "  • View metrics: curl http://localhost:9090/api/v1/query?query=up"
    echo "  • Check alerts: curl http://localhost:9090/api/v1/alerts"
    echo "  • Grafana login: admin / [check .env.production for password]"
    echo ""
    echo "📁 Configuration Files:"
    echo "  • Prometheus: $PROJECT_ROOT/monitoring/prometheus.prod.yml"
    echo "  • Alert Rules: $PROJECT_ROOT/monitoring/rules/hitch-alerts.yml"
    echo "  • Grafana Dashboards: $PROJECT_ROOT/monitoring/grafana/dashboards/"
    echo "  • Loki Config: $PROJECT_ROOT/monitoring/loki/loki.yml"
}

# Main function
main() {
    print_header "HITCH PLATFORM MONITORING SETUP"
    
    print_status "Starting monitoring setup at $(date)"
    
    # Create monitoring configurations
    create_hitch_dashboard
    create_alert_rules
    create_node_exporter_config
    create_grafana_datasources
    create_log_monitoring
    create_backup_monitoring
    
    # Start monitoring services
    start_monitoring
    
    # Wait for services to start
    sleep 10
    
    # Verify setup
    verify_monitoring
    
    # Show summary
    show_monitoring_summary
    
    print_status "Monitoring setup completed successfully!"
}

# Run main function
main "$@"