#!/bin/bash

# Hitch Platform - Production Logging Setup Script
# Author: Claude-Code
# Created: 2025-01-27
# Description: Sets up comprehensive logging infrastructure for production

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

# Function to create log directories
setup_log_directories() {
    print_header "SETTING UP LOG DIRECTORIES"
    
    local log_dirs=(
        "/var/log/hitch"
        "/var/log/hitch/backend"
        "/var/log/hitch/admin-panel"
        "/var/log/hitch/ai-services"
        "/var/log/hitch/nginx"
        "/var/log/hitch/postgres"
        "/var/log/hitch/redis"
        "/var/log/hitch/monitoring"
        "/var/log/hitch/system"
        "/var/log/hitch/security"
        "/var/log/hitch/audit"
    )
    
    print_status "Creating log directories..."
    for dir in "${log_dirs[@]}"; do
        if [[ ! -d "$dir" ]]; then
            sudo mkdir -p "$dir"
            print_status "Created: $dir"
        else
            print_status "Exists: $dir"
        fi
    done
    
    # Set appropriate permissions
    if [[ $EUID -eq 0 || -n "${SUDO_USER:-}" ]]; then
        print_status "Setting log directory permissions..."
        sudo chown -R root:root /var/log/hitch
        sudo chmod -R 755 /var/log/hitch
        sudo chmod -R 644 /var/log/hitch/*.log 2>/dev/null || true
    fi
    
    print_status "✅ Log directories setup completed"
}

# Function to create Winston logger configuration
create_winston_config() {
    print_header "CREATING WINSTON LOGGER CONFIGURATION"
    
    local config_dir="$PROJECT_ROOT/backend/src/config"
    mkdir -p "$config_dir"
    
    cat > "$config_dir/logger.js" << 'EOF'
/**
 * @fileoverview Winston Logger Configuration for Hitch Platform
 * @author Oabona-Majoko
 * @created 2025-01-27
 */

const winston = require('winston');
const path = require('path');

// Custom log format
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss'
  }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.prettyPrint()
);

// Console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'HH:mm:ss'
  }),
  winston.format.printf(({ timestamp, level, message, service, ...meta }) => {
    let msg = `${timestamp} [${service || 'APP'}] ${level}: ${message}`;
    
    // Add metadata if present
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    
    return msg;
  })
);

// Determine log level based on environment
const logLevel = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// Create the logger
const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: { 
    service: 'hitch-backend',
    environment: process.env.NODE_ENV || 'development',
    version: process.env.APP_VERSION || '1.0.0'
  },
  transports: []
});

// Console transport for development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat
  }));
}

// Production transports
if (process.env.NODE_ENV === 'production') {
  // Console transport with JSON format
  logger.add(new winston.transports.Console({
    format: logFormat
  }));

  // File transports
  logger.add(new winston.transports.File({
    filename: '/var/log/hitch/backend/error.log',
    level: 'error',
    maxsize: 50 * 1024 * 1024, // 50MB
    maxFiles: 5,
    tailable: true
  }));

  logger.add(new winston.transports.File({
    filename: '/var/log/hitch/backend/combined.log',
    maxsize: 50 * 1024 * 1024, // 50MB
    maxFiles: 10,
    tailable: true
  }));

  // Audit log for security events
  logger.add(new winston.transports.File({
    filename: '/var/log/hitch/audit/security.log',
    level: 'info',
    maxsize: 50 * 1024 * 1024, // 50MB
    maxFiles: 30,
    tailable: true,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    )
  }));
}

// Create specialized loggers
const securityLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { 
    service: 'hitch-security',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    new winston.transports.File({
      filename: '/var/log/hitch/security/security.log',
      maxsize: 50 * 1024 * 1024,
      maxFiles: 30,
      tailable: true
    })
  ]
});

const auditLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { 
    service: 'hitch-audit',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    new winston.transports.File({
      filename: '/var/log/hitch/audit/audit.log',
      maxsize: 50 * 1024 * 1024,
      maxFiles: 30,
      tailable: true
    })
  ]
});

const performanceLogger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { 
    service: 'hitch-performance',
    environment: process.env.NODE_ENV || 'development'
  },
  transports: [
    new winston.transports.File({
      filename: '/var/log/hitch/system/performance.log',
      maxsize: 50 * 1024 * 1024,
      maxFiles: 10,
      tailable: true
    })
  ]
});

// Logging helper functions
const logHelpers = {
  // Security events
  logSecurityEvent: (event, details) => {
    securityLogger.warn('Security Event', {
      event,
      details,
      timestamp: new Date().toISOString(),
      severity: 'high'
    });
  },

  // Authentication events
  logAuthEvent: (userId, action, success, ip, userAgent) => {
    securityLogger.info('Authentication Event', {
      userId,
      action,
      success,
      ip,
      userAgent,
      timestamp: new Date().toISOString()
    });
  },

  // Audit trail
  logAuditEvent: (userId, action, resource, oldValue, newValue, ip) => {
    auditLogger.info('Audit Event', {
      userId,
      action,
      resource,
      oldValue,
      newValue,
      ip,
      timestamp: new Date().toISOString()
    });
  },

  // Performance metrics
  logPerformance: (operation, duration, metadata) => {
    performanceLogger.info('Performance Metric', {
      operation,
      duration,
      metadata,
      timestamp: new Date().toISOString()
    });
  },

  // API requests
  logApiRequest: (method, url, statusCode, duration, userId, ip) => {
    logger.info('API Request', {
      method,
      url,
      statusCode,
      duration,
      userId,
      ip,
      timestamp: new Date().toISOString()
    });
  },

  // Database operations
  logDatabaseOperation: (operation, table, duration, success) => {
    logger.debug('Database Operation', {
      operation,
      table,
      duration,
      success,
      timestamp: new Date().toISOString()
    });
  },

  // Payment events
  logPaymentEvent: (userId, amount, currency, status, paymentId) => {
    auditLogger.info('Payment Event', {
      userId,
      amount,
      currency,
      status,
      paymentId,
      timestamp: new Date().toISOString(),
      sensitive: true
    });
  }
};

// Export logger and helpers
module.exports = {
  logger,
  securityLogger,
  auditLogger,
  performanceLogger,
  ...logHelpers
};
EOF
    
    print_status "✅ Winston logger configuration created"
}

# Function to create log rotation configuration
create_logrotate_config() {
    print_header "CREATING LOG ROTATION CONFIGURATION"
    
    local config_file="/etc/logrotate.d/hitch"
    
    print_status "Creating logrotate configuration..."
    
    sudo tee "$config_file" > /dev/null << 'EOF'
# Hitch Platform Log Rotation Configuration

/var/log/hitch/*/*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    copytruncate
    postrotate
        # Reload services if needed
        systemctl reload nginx 2>/dev/null || true
        docker-compose -f /opt/hitch/docker-compose.prod.yml restart backend 2>/dev/null || true
    endscript
}

/var/log/hitch/backend/*.log {
    daily
    missingok
    rotate 7
    compress
    delaycompress
    notifempty
    size 100M
    copytruncate
}

/var/log/hitch/security/*.log {
    daily
    missingok
    rotate 90
    compress
    delaycompress
    notifempty
    copytruncate
}

/var/log/hitch/audit/*.log {
    daily
    missingok
    rotate 365
    compress
    delaycompress
    notifempty
    copytruncate
}

/var/log/hitch/nginx/*.log {
    daily
    missingok
    rotate 14
    compress
    delaycompress
    notifempty
    sharedscripts
    postrotate
        nginx -s reload 2>/dev/null || true
    endscript
}
EOF
    
    print_status "✅ Logrotate configuration created"
}

# Function to create Fluentd configuration
create_fluentd_config() {
    print_header "CREATING FLUENTD LOG AGGREGATION CONFIGURATION"
    
    local fluentd_dir="$PROJECT_ROOT/monitoring/fluentd"
    mkdir -p "$fluentd_dir"
    
    cat > "$fluentd_dir/fluentd.conf" << 'EOF'
# Hitch Platform - Fluentd Configuration
# Collects logs from all services and forwards to Loki

<system>
  log_level info
</system>

# Backend application logs
<source>
  @type tail
  path /var/log/hitch/backend/*.log
  pos_file /var/log/fluentd/backend.log.pos
  tag hitch.backend
  format json
  time_key timestamp
  keep_time_key true
</source>

# Security logs
<source>
  @type tail
  path /var/log/hitch/security/*.log
  pos_file /var/log/fluentd/security.log.pos
  tag hitch.security
  format json
  time_key timestamp
  keep_time_key true
</source>

# Audit logs
<source>
  @type tail
  path /var/log/hitch/audit/*.log
  pos_file /var/log/fluentd/audit.log.pos
  tag hitch.audit
  format json
  time_key timestamp
  keep_time_key true
</source>

# Nginx access logs
<source>
  @type tail
  path /var/log/hitch/nginx/access.log
  pos_file /var/log/fluentd/nginx_access.log.pos
  tag hitch.nginx.access
  format nginx
</source>

# Nginx error logs
<source>
  @type tail
  path /var/log/hitch/nginx/error.log
  pos_file /var/log/fluentd/nginx_error.log.pos
  tag hitch.nginx.error
  format /^(?<time>\d{4}/\d{2}/\d{2} \d{2}:\d{2}:\d{2}) \[(?<log_level>\w+)\] (?<pid>\d+).(?<tid>\d+): (?<message>.*)$/
</source>

# PostgreSQL logs
<source>
  @type tail
  path /var/log/hitch/postgres/*.log
  pos_file /var/log/fluentd/postgres.log.pos
  tag hitch.postgres
  format /^(?<time>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3} \w+) \[(?<pid>\d+)\] (?<level>\w+):  (?<message>.*)$/
</source>

# System logs
<source>
  @type systemd
  tag hitch.system
  path /var/log/journal
  filters [{ "_SYSTEMD_UNIT": "docker.service" }]
</source>

# Add common fields to all logs
<filter hitch.**>
  @type record_transformer
  <record>
    environment "#{ENV['NODE_ENV'] || 'development'}"
    service "${tag_parts[1]}"
    hostname "#{Socket.gethostname}"
    timestamp ${time}
  </record>
</filter>

# Parse and enrich logs
<filter hitch.backend>
  @type parser
  key_name message
  reserve_data true
  <parse>
    @type json
  </parse>
</filter>

# Forward to Loki
<match hitch.**>
  @type loki
  url http://loki:3100
  username ""
  password ""
  extra_labels {"environment":"#{ENV['NODE_ENV'] || 'development'}"}
  flush_interval 10s
  flush_at_shutdown true
  buffer_chunk_limit 1m
</match>

# Metrics for monitoring Fluentd itself
<source>
  @type monitor_agent
  bind 0.0.0.0
  port 24220
</source>
EOF
    
    print_status "✅ Fluentd configuration created"
}

# Function to create log monitoring alerts
create_log_alerts() {
    print_header "CREATING LOG MONITORING ALERTS"
    
    local alerts_dir="$PROJECT_ROOT/monitoring/rules"
    mkdir -p "$alerts_dir"
    
    cat > "$alerts_dir/log-alerts.yml" << 'EOF'
groups:
  - name: hitch-log-alerts
    rules:
      - alert: HitchHighErrorRate
        expr: |
          (
            rate(fluentd_output_status_num_records_total{status="retry"}[5m]) +
            rate(fluentd_output_status_num_records_total{status="error"}[5m])
          ) > 10
        for: 2m
        labels:
          severity: warning
          service: logging
        annotations:
          summary: "High error rate in log processing"
          description: "Fluentd is experiencing high error/retry rates: {{ $value }} errors per second"

      - alert: HitchLogVolumeSpike
        expr: |
          rate(fluentd_input_status_num_records_total[5m]) > 
          avg_over_time(rate(fluentd_input_status_num_records_total[5m])[1h]) * 5
        for: 5m
        labels:
          severity: warning
          service: logging
        annotations:
          summary: "Unusual spike in log volume"
          description: "Log volume is {{ $value }}x higher than normal"

      - alert: HitchSecurityEvent
        expr: |
          increase(hitch_security_events_total[5m]) > 5
        for: 1m
        labels:
          severity: critical
          service: security
        annotations:
          summary: "Multiple security events detected"
          description: "{{ $value }} security events in the last 5 minutes"

      - alert: HitchAuditLogFailure
        expr: |
          increase(hitch_audit_log_failures_total[5m]) > 0
        for: 1m
        labels:
          severity: critical
          service: audit
        annotations:
          summary: "Audit log writing failure"
          description: "Audit logs failed to write {{ $value }} times in the last 5 minutes"

      - alert: HitchDiskSpaceLogPartition
        expr: |
          (1 - (node_filesystem_avail_bytes{mountpoint="/var/log"} / node_filesystem_size_bytes{mountpoint="/var/log"})) * 100 > 85
        for: 5m
        labels:
          severity: warning
          service: system
        annotations:
          summary: "Log partition disk space low"
          description: "Log partition is {{ $value }}% full"

      - alert: HitchLogIngestionLatency
        expr: |
          histogram_quantile(0.95, rate(fluentd_input_status_received_bytes_bucket[5m])) > 1000
        for: 5m
        labels:
          severity: warning
          service: logging
        annotations:
          summary: "High log ingestion latency"
          description: "95th percentile log ingestion latency is {{ $value }}ms"

      - alert: HitchFailedLogins
        expr: |
          sum(rate(hitch_auth_failed_attempts_total[5m])) > 10
        for: 2m
        labels:
          severity: warning
          service: security
        annotations:
          summary: "High rate of failed login attempts"
          description: "{{ $value }} failed login attempts per second"

      - alert: HitchPaymentAnomalies
        expr: |
          sum(rate(hitch_payment_failures_total[5m])) > 5
        for: 3m
        labels:
          severity: critical
          service: payments
        annotations:
          summary: "High payment failure rate"
          description: "{{ $value }} payment failures per second"
EOF
    
    print_status "✅ Log monitoring alerts created"
}

# Function to create log analysis scripts
create_log_analysis_scripts() {
    print_header "CREATING LOG ANALYSIS SCRIPTS"
    
    local scripts_dir="$PROJECT_ROOT/scripts/logging"
    mkdir -p "$scripts_dir"
    
    # Error analysis script
    cat > "$scripts_dir/analyze-errors.sh" << 'EOF'
#!/bin/bash

# Hitch Platform - Error Log Analysis Script
# Analyzes error patterns and generates reports

LOG_DIR="/var/log/hitch"
REPORT_DIR="$LOG_DIR/reports"
DATE=$(date +%Y%m%d)

mkdir -p "$REPORT_DIR"

echo "=== Hitch Platform Error Analysis Report ===" > "$REPORT_DIR/error-analysis-$DATE.txt"
echo "Generated: $(date)" >> "$REPORT_DIR/error-analysis-$DATE.txt"
echo "" >> "$REPORT_DIR/error-analysis-$DATE.txt"

# Backend errors
echo "=== Backend Errors (Last 24 hours) ===" >> "$REPORT_DIR/error-analysis-$DATE.txt"
find "$LOG_DIR/backend" -name "*.log" -mtime -1 -exec grep -E "(ERROR|FATAL)" {} \; | \
  awk '{print $1, $2, $4}' | sort | uniq -c | sort -nr >> "$REPORT_DIR/error-analysis-$DATE.txt"
echo "" >> "$REPORT_DIR/error-analysis-$DATE.txt"

# Security events
echo "=== Security Events (Last 24 hours) ===" >> "$REPORT_DIR/error-analysis-$DATE.txt"
find "$LOG_DIR/security" -name "*.log" -mtime -1 -exec grep -i "security" {} \; | \
  head -20 >> "$REPORT_DIR/error-analysis-$DATE.txt"
echo "" >> "$REPORT_DIR/error-analysis-$DATE.txt"

# Failed authentication attempts
echo "=== Failed Authentication Attempts ===" >> "$REPORT_DIR/error-analysis-$DATE.txt"
find "$LOG_DIR" -name "*.log" -mtime -1 -exec grep -i "authentication.*failed" {} \; | \
  awk '{print $1, $2}' | sort | uniq -c | sort -nr >> "$REPORT_DIR/error-analysis-$DATE.txt"
echo "" >> "$REPORT_DIR/error-analysis-$DATE.txt"

# Payment failures
echo "=== Payment Failures ===" >> "$REPORT_DIR/error-analysis-$DATE.txt"
find "$LOG_DIR" -name "*.log" -mtime -1 -exec grep -i "payment.*failed\|payment.*error" {} \; | \
  head -10 >> "$REPORT_DIR/error-analysis-$DATE.txt"

echo "Report generated: $REPORT_DIR/error-analysis-$DATE.txt"
EOF
    
    # Performance analysis script
    cat > "$scripts_dir/analyze-performance.sh" << 'EOF'
#!/bin/bash

# Hitch Platform - Performance Log Analysis Script
# Analyzes performance metrics from logs

LOG_DIR="/var/log/hitch"
REPORT_DIR="$LOG_DIR/reports"
DATE=$(date +%Y%m%d)

mkdir -p "$REPORT_DIR"

echo "=== Hitch Platform Performance Analysis Report ===" > "$REPORT_DIR/performance-analysis-$DATE.txt"
echo "Generated: $(date)" >> "$REPORT_DIR/performance-analysis-$DATE.txt"
echo "" >> "$REPORT_DIR/performance-analysis-$DATE.txt"

# API response times
echo "=== API Response Times (Last 24 hours) ===" >> "$REPORT_DIR/performance-analysis-$DATE.txt"
find "$LOG_DIR/backend" -name "*.log" -mtime -1 -exec grep "API Request" {} \; | \
  grep -o '"duration":[0-9]*' | cut -d: -f2 | sort -n | \
  awk '
    BEGIN { sum = 0; count = 0; }
    { 
      sum += $1; count++; 
      if (count == 1) min = $1;
      max = $1;
      a[count] = $1;
    }
    END { 
      avg = sum / count;
      if (count % 2 == 1) median = a[(count + 1) / 2];
      else median = (a[count / 2] + a[count / 2 + 1]) / 2;
      printf "Min: %.2fms, Max: %.2fms, Avg: %.2fms, Median: %.2fms, Count: %d\n", min, max, avg, median, count;
    }
  ' >> "$REPORT_DIR/performance-analysis-$DATE.txt"
echo "" >> "$REPORT_DIR/performance-analysis-$DATE.txt"

# Database operation times
echo "=== Database Operations (Last 24 hours) ===" >> "$REPORT_DIR/performance-analysis-$DATE.txt"
find "$LOG_DIR/backend" -name "*.log" -mtime -1 -exec grep "Database Operation" {} \; | \
  grep -o '"duration":[0-9]*' | cut -d: -f2 | sort -n | tail -20 >> "$REPORT_DIR/performance-analysis-$DATE.txt"
echo "" >> "$REPORT_DIR/performance-analysis-$DATE.txt"

# Memory usage patterns
echo "=== Memory Usage Patterns ===" >> "$REPORT_DIR/performance-analysis-$DATE.txt"
find "$LOG_DIR/system" -name "*.log" -mtime -1 -exec grep -i "memory" {} \; | \
  head -10 >> "$REPORT_DIR/performance-analysis-$DATE.txt"

echo "Report generated: $REPORT_DIR/performance-analysis-$DATE.txt"
EOF
    
    chmod +x "$scripts_dir"/*.sh
    print_status "✅ Log analysis scripts created"
}

# Function to create log monitoring dashboard
create_log_dashboard() {
    print_header "CREATING LOG MONITORING DASHBOARD"
    
    local dashboard_dir="$PROJECT_ROOT/monitoring/grafana/dashboards"
    mkdir -p "$dashboard_dir"
    
    cat > "$dashboard_dir/logs-dashboard.json" << 'EOF'
{
  "dashboard": {
    "id": null,
    "title": "Hitch Platform - Logs Dashboard",
    "tags": ["hitch", "logs", "monitoring"],
    "timezone": "browser",
    "panels": [
      {
        "id": 1,
        "title": "Log Volume by Service",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(fluentd_input_status_num_records_total[5m])",
            "legendFormat": "{{service}} - {{instance}}"
          }
        ],
        "yAxes": [
          {"label": "Logs/sec", "min": 0},
          {"show": false}
        ],
        "gridPos": {"h": 8, "w": 12, "x": 0, "y": 0}
      },
      {
        "id": 2,
        "title": "Error Rate by Service",
        "type": "graph",
        "targets": [
          {
            "expr": "rate(hitch_errors_total[5m])",
            "legendFormat": "{{service}} - {{level}}"
          }
        ],
        "yAxes": [
          {"label": "Errors/sec", "min": 0},
          {"show": false}
        ],
        "gridPos": {"h": 8, "w": 12, "x": 12, "y": 0}
      },
      {
        "id": 3,
        "title": "Security Events",
        "type": "stat",
        "targets": [
          {
            "expr": "sum(increase(hitch_security_events_total[1h]))",
            "legendFormat": "Security Events (1h)"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "short",
            "thresholds": {
              "steps": [
                {"color": "green", "value": null},
                {"color": "yellow", "value": 5},
                {"color": "red", "value": 20}
              ]
            }
          }
        },
        "gridPos": {"h": 4, "w": 6, "x": 0, "y": 8}
      },
      {
        "id": 4,
        "title": "Failed Logins",
        "type": "stat",
        "targets": [
          {
            "expr": "sum(increase(hitch_auth_failed_attempts_total[1h]))",
            "legendFormat": "Failed Logins (1h)"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "short",
            "thresholds": {
              "steps": [
                {"color": "green", "value": null},
                {"color": "yellow", "value": 10},
                {"color": "red", "value": 50}
              ]
            }
          }
        },
        "gridPos": {"h": 4, "w": 6, "x": 6, "y": 8}
      },
      {
        "id": 5,
        "title": "Top Error Messages",
        "type": "table",
        "targets": [
          {
            "expr": "topk(10, sum by (message) (increase(hitch_errors_total[1h])))",
            "format": "table"
          }
        ],
        "gridPos": {"h": 8, "w": 24, "x": 0, "y": 12}
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
    
    print_status "✅ Log monitoring dashboard created"
}

# Function to start logging services
start_logging_services() {
    print_header "STARTING LOGGING SERVICES"
    
    cd "$PROJECT_ROOT"
    
    print_status "Starting Loki..."
    docker-compose -f docker-compose.prod.yml up -d loki
    
    print_status "Starting Fluentd..."
    if docker-compose -f docker-compose.prod.yml config | grep -q "fluentd"; then
        docker-compose -f docker-compose.prod.yml up -d fluentd
    else
        print_warning "Fluentd not configured in docker-compose.prod.yml"
    fi
    
    print_status "✅ Logging services started"
}

# Function to test logging setup
test_logging() {
    print_header "TESTING LOGGING SETUP"
    
    # Test log directories
    print_status "Testing log directory permissions..."
    if [[ -w "/var/log/hitch/backend" ]]; then
        print_status "✅ Backend log directory is writable"
    else
        print_warning "⚠️  Backend log directory is not writable"
    fi
    
    # Test log rotation
    print_status "Testing logrotate configuration..."
    if logrotate -d /etc/logrotate.d/hitch >/dev/null 2>&1; then
        print_status "✅ Logrotate configuration is valid"
    else
        print_warning "⚠️  Logrotate configuration has issues"
    fi
    
    # Test Loki connectivity
    print_status "Testing Loki connectivity..."
    if curl -f -s "http://localhost:3100/ready" >/dev/null 2>&1; then
        print_status "✅ Loki is accessible"
    else
        print_warning "⚠️  Loki is not accessible"
    fi
    
    print_status "✅ Logging setup tests completed"
}

# Function to show logging summary
show_logging_summary() {
    print_header "LOGGING SETUP SUMMARY"
    
    echo -e "${GREEN}✅ Hitch Platform Logging Setup Completed!${NC}"
    echo ""
    echo "📁 Log Directories:"
    echo "  • Backend Logs: /var/log/hitch/backend/"
    echo "  • Security Logs: /var/log/hitch/security/"
    echo "  • Audit Logs: /var/log/hitch/audit/"
    echo "  • System Logs: /var/log/hitch/system/"
    echo ""
    echo "🔧 Log Management:"
    echo "  • Configuration: $PROJECT_ROOT/backend/src/config/logger.js"
    echo "  • Rotation: /etc/logrotate.d/hitch"
    echo "  • Aggregation: Fluentd -> Loki -> Grafana"
    echo ""
    echo "📊 Monitoring:"
    echo "  • Grafana Dashboard: Logs Dashboard"
    echo "  • Alerts: Log volume, error rates, security events"
    echo "  • Reports: /var/log/hitch/reports/"
    echo ""
    echo "🔍 Analysis Scripts:"
    echo "  • Error Analysis: ./scripts/logging/analyze-errors.sh"
    echo "  • Performance Analysis: ./scripts/logging/analyze-performance.sh"
    echo ""
    echo "⚠️  Important Notes:"
    echo "  • Logs are rotated daily and compressed"
    echo "  • Security logs are kept for 90 days"
    echo "  • Audit logs are kept for 365 days"
    echo "  • Monitor disk space in /var/log/hitch/"
}

# Main function
main() {
    local command="${1:-setup}"
    
    print_header "HITCH PLATFORM LOGGING SETUP"
    
    case "$command" in
        "setup"|"")
            setup_log_directories
            create_winston_config
            create_logrotate_config
            create_fluentd_config
            create_log_alerts
            create_log_analysis_scripts
            create_log_dashboard
            start_logging_services
            test_logging
            show_logging_summary
            ;;
        "directories")
            setup_log_directories
            ;;
        "config")
            create_winston_config
            create_logrotate_config
            create_fluentd_config
            ;;
        "alerts")
            create_log_alerts
            ;;
        "scripts")
            create_log_analysis_scripts
            ;;
        "dashboard")
            create_log_dashboard
            ;;
        "start")
            start_logging_services
            ;;
        "test")
            test_logging
            ;;
        *)
            echo "Usage: $0 [setup|directories|config|alerts|scripts|dashboard|start|test]"
            exit 1
            ;;
    esac
    
    print_status "Logging setup operation completed successfully!"
}

# Run main function
main "$@"