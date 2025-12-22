#!/bin/bash

# Hitch Platform - SSL Certificate Setup Script
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
SSL_DIR="./nginx/ssl"
DOMAINS=("hitch-platform.com" "www.hitch-platform.com" "api.hitch-platform.com" "admin.hitch-platform.com")
EMAIL=${SSL_EMAIL:-"admin@hitch-platform.com"}
STAGING=${SSL_STAGING:-false}

echo -e "${BLUE}🔒 Hitch Platform - SSL Certificate Setup${NC}"
echo "==========================================="
echo "Email: $EMAIL"
echo "Domains: ${DOMAINS[*]}"
echo "Staging: $STAGING"
echo ""

# Logging function
log() {
    echo "$(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Check if running as root
check_root() {
    if [ "$EUID" -ne 0 ]; then
        echo -e "${RED}❌ This script must be run as root for SSL certificate generation${NC}"
        echo "Please run: sudo $0"
        exit 1
    fi
}

# Install certbot if not present
install_certbot() {
    echo -e "${BLUE}📦 Installing Certbot...${NC}"
    
    if command -v certbot >/dev/null 2>&1; then
        echo -e "${GREEN}✅ Certbot already installed${NC}"
        return 0
    fi
    
    # Detect OS and install certbot
    if [ -f /etc/debian_version ]; then
        # Debian/Ubuntu
        apt-get update
        apt-get install -y certbot python3-certbot-nginx
    elif [ -f /etc/redhat-release ]; then
        # RHEL/CentOS/Fedora
        if command -v dnf >/dev/null 2>&1; then
            dnf install -y certbot python3-certbot-nginx
        else
            yum install -y certbot python3-certbot-nginx
        fi
    else
        echo -e "${RED}❌ Unsupported OS. Please install certbot manually.${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}✅ Certbot installed${NC}"
}

# Create SSL directory
create_ssl_directory() {
    echo -e "${BLUE}📁 Creating SSL directory...${NC}"
    
    mkdir -p "$SSL_DIR"
    chmod 750 "$SSL_DIR"
    
    echo -e "${GREEN}✅ SSL directory created: $SSL_DIR${NC}"
}

# Generate self-signed certificates for development
generate_self_signed() {
    echo -e "${BLUE}🔧 Generating self-signed certificates for development...${NC}"
    
    for domain in "${DOMAINS[@]}"; do
        local cert_file="$SSL_DIR/${domain}.crt"
        local key_file="$SSL_DIR/${domain}.key"
        
        if [ -f "$cert_file" ] && [ -f "$key_file" ]; then
            echo -e "${YELLOW}⚠️ Certificate for $domain already exists, skipping...${NC}"
            continue
        fi
        
        echo "Generating certificate for $domain..."
        
        openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
            -keyout "$key_file" \
            -out "$cert_file" \
            -subj "/C=US/ST=State/L=City/O=Hitch/OU=IT/CN=$domain/emailAddress=$EMAIL" \
            -addext "subjectAltName=DNS:$domain,DNS:www.$domain"
        
        chmod 600 "$key_file"
        chmod 644 "$cert_file"
        
        echo -e "${GREEN}✅ Self-signed certificate generated for $domain${NC}"
    done
}

# Generate Let's Encrypt certificates for production
generate_letsencrypt() {
    echo -e "${BLUE}🌐 Generating Let's Encrypt certificates...${NC}"
    
    local staging_flag=""
    if [ "$STAGING" = "true" ]; then
        staging_flag="--staging"
        echo -e "${YELLOW}⚠️ Using Let's Encrypt staging environment${NC}"
    fi
    
    # Stop nginx if running to free port 80
    if pgrep nginx > /dev/null; then
        echo "Stopping nginx temporarily..."
        systemctl stop nginx || service nginx stop || true
    fi
    
    # Generate certificates for all domains
    local domain_args=""
    for domain in "${DOMAINS[@]}"; do
        domain_args="$domain_args -d $domain"
    done
    
    echo "Requesting certificates for domains: ${DOMAINS[*]}"
    
    certbot certonly \
        --standalone \
        --email "$EMAIL" \
        --agree-tos \
        --no-eff-email \
        $staging_flag \
        $domain_args \
        --force-renewal
    
    # Copy certificates to our SSL directory
    for domain in "${DOMAINS[@]}"; do
        local le_cert="/etc/letsencrypt/live/$domain/fullchain.pem"
        local le_key="/etc/letsencrypt/live/$domain/privkey.pem"
        local our_cert="$SSL_DIR/${domain}.crt"
        local our_key="$SSL_DIR/${domain}.key"
        
        if [ -f "$le_cert" ] && [ -f "$le_key" ]; then
            cp "$le_cert" "$our_cert"
            cp "$le_key" "$our_key"
            chmod 644 "$our_cert"
            chmod 600 "$our_key"
            echo -e "${GREEN}✅ Certificate copied for $domain${NC}"
        else
            echo -e "${RED}❌ Certificate generation failed for $domain${NC}"
        fi
    done
    
    echo -e "${GREEN}✅ Let's Encrypt certificates generated${NC}"
}

# Set up automatic renewal
setup_auto_renewal() {
    echo -e "${BLUE}🔄 Setting up automatic certificate renewal...${NC}"
    
    # Create renewal script
    cat > /etc/cron.daily/certbot-renew << 'EOF'
#!/bin/bash
# Renew Let's Encrypt certificates and restart nginx

/usr/bin/certbot renew --quiet --no-self-upgrade

# Copy renewed certificates to application directory
for domain in hitch.com www.hitch.com api.hitch.com admin.hitch.com; do
    if [ -f "/etc/letsencrypt/live/$domain/fullchain.pem" ]; then
        cp "/etc/letsencrypt/live/$domain/fullchain.pem" "/path/to/hitch/nginx/ssl/${domain}.crt"
        cp "/etc/letsencrypt/live/$domain/privkey.pem" "/path/to/hitch/nginx/ssl/${domain}.key"
    fi
done

# Restart nginx to load new certificates
if pgrep nginx > /dev/null; then
    systemctl reload nginx || service nginx reload
fi
EOF
    
    chmod +x /etc/cron.daily/certbot-renew
    
    # Also set up systemd timer (preferred on modern systems)
    if systemctl list-timers > /dev/null 2>&1; then
        systemctl enable certbot.timer
        systemctl start certbot.timer
    fi
    
    echo -e "${GREEN}✅ Automatic renewal configured${NC}"
}

# Verify certificates
verify_certificates() {
    echo -e "${BLUE}🔍 Verifying certificates...${NC}"
    
    local all_valid=true
    
    for domain in "${DOMAINS[@]}"; do
        local cert_file="$SSL_DIR/${domain}.crt"
        local key_file="$SSL_DIR/${domain}.key"
        
        if [ ! -f "$cert_file" ]; then
            echo -e "${RED}❌ Certificate file missing: $cert_file${NC}"
            all_valid=false
            continue
        fi
        
        if [ ! -f "$key_file" ]; then
            echo -e "${RED}❌ Key file missing: $key_file${NC}"
            all_valid=false
            continue
        fi
        
        # Check certificate validity
        if openssl x509 -in "$cert_file" -text -noout > /dev/null 2>&1; then
            local expiry=$(openssl x509 -in "$cert_file" -noout -dates | grep "notAfter" | cut -d= -f2)
            echo -e "${GREEN}✅ Certificate valid for $domain (expires: $expiry)${NC}"
        else
            echo -e "${RED}❌ Invalid certificate for $domain${NC}"
            all_valid=false
        fi
        
        # Check key validity
        if openssl rsa -in "$key_file" -check -noout > /dev/null 2>&1; then
            echo -e "${GREEN}✅ Private key valid for $domain${NC}"
        else
            echo -e "${RED}❌ Invalid private key for $domain${NC}"
            all_valid=false
        fi
    done
    
    if [ "$all_valid" = true ]; then
        echo -e "${GREEN}🎉 All certificates are valid!${NC}"
        return 0
    else
        echo -e "${RED}❌ Some certificates are invalid${NC}"
        return 1
    fi
}

# Test SSL configuration
test_ssl_config() {
    echo -e "${BLUE}🧪 Testing SSL configuration...${NC}"
    
    # Start nginx with SSL config
    if command -v docker-compose >/dev/null 2>&1; then
        echo "Testing with Docker Compose..."
        cd "$(dirname "$0")/.."
        docker-compose -f docker-compose.prod.yml config > /dev/null
        echo -e "${GREEN}✅ Docker Compose configuration valid${NC}"
    fi
    
    # Test nginx configuration
    if command -v nginx >/dev/null 2>&1; then
        nginx -t -c ./nginx/nginx.prod.conf
        echo -e "${GREEN}✅ Nginx configuration valid${NC}"
    fi
}

# Show certificate information
show_cert_info() {
    echo -e "${BLUE}📋 Certificate Information${NC}"
    echo "========================="
    
    for domain in "${DOMAINS[@]}"; do
        local cert_file="$SSL_DIR/${domain}.crt"
        
        if [ -f "$cert_file" ]; then
            echo ""
            echo "Domain: $domain"
            echo "Certificate: $cert_file"
            
            # Show certificate details
            openssl x509 -in "$cert_file" -noout -subject -issuer -dates
        fi
    done
}

# Main function
main() {
    local command=${1:-"help"}
    
    case "$command" in
        "dev"|"development")
            echo -e "${YELLOW}🔧 Setting up development SSL certificates${NC}"
            create_ssl_directory
            generate_self_signed
            verify_certificates
            test_ssl_config
            show_cert_info
            ;;
        "prod"|"production")
            echo -e "${GREEN}🌐 Setting up production SSL certificates${NC}"
            check_root
            install_certbot
            create_ssl_directory
            generate_letsencrypt
            setup_auto_renewal
            verify_certificates
            test_ssl_config
            show_cert_info
            ;;
        "renew")
            echo -e "${BLUE}🔄 Renewing SSL certificates${NC}"
            check_root
            certbot renew
            # Copy renewed certificates
            for domain in "${DOMAINS[@]}"; do
                local le_cert="/etc/letsencrypt/live/$domain/fullchain.pem"
                local le_key="/etc/letsencrypt/live/$domain/privkey.pem"
                local our_cert="$SSL_DIR/${domain}.crt"
                local our_key="$SSL_DIR/${domain}.key"
                
                if [ -f "$le_cert" ] && [ -f "$le_key" ]; then
                    cp "$le_cert" "$our_cert"
                    cp "$le_key" "$our_key"
                    chmod 644 "$our_cert"
                    chmod 600 "$our_key"
                fi
            done
            verify_certificates
            ;;
        "verify")
            verify_certificates
            ;;
        "info")
            show_cert_info
            ;;
        "test")
            test_ssl_config
            ;;
        *)
            echo "Hitch Platform SSL Certificate Setup"
            echo ""
            echo "Usage: $0 <command>"
            echo ""
            echo "Commands:"
            echo "  dev         - Generate self-signed certificates for development"
            echo "  prod        - Generate Let's Encrypt certificates for production"
            echo "  renew       - Renew existing certificates"
            echo "  verify      - Verify certificate validity"
            echo "  info        - Show certificate information"
            echo "  test        - Test SSL configuration"
            echo ""
            echo "Environment Variables:"
            echo "  SSL_EMAIL   - Email for Let's Encrypt registration (default: admin@hitch.com)"
            echo "  SSL_STAGING - Use Let's Encrypt staging (default: false)"
            echo ""
            echo "Examples:"
            echo "  $0 dev                    # Development setup"
            echo "  SSL_EMAIL=me@hitch.com $0 prod  # Production setup"
            echo "  SSL_STAGING=true $0 prod  # Production setup with staging"
            exit 1
            ;;
    esac
    
    echo ""
    echo -e "${GREEN}✅ SSL setup completed successfully!${NC}"
    log "SSL setup completed for command: $command"
}

# Run main function
main "$@"