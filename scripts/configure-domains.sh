#!/bin/bash

# Hitch Platform - Domain Configuration Script
# This script helps configure domain settings for production deployment

set -e

echo "🌐 Configuring domains for Hitch platform..."

# Default domains (you should replace these)
DEFAULT_API_DOMAIN="api.yourdomain.com"
DEFAULT_ADMIN_DOMAIN="admin.yourdomain.com"
DEFAULT_MAIN_DOMAIN="yourdomain.com"

# Function to update environment files with domain configuration
update_env_files() {
    local api_domain=$1
    local admin_domain=$2
    local main_domain=$3
    
    echo "📝 Updating environment files with domain configuration..."
    
    # Update backend environment
    if [ -f "backend/.env" ]; then
        sed -i "s/yourdomain.com/$main_domain/g" backend/.env
        sed -i "s/api.yourdomain.com/$api_domain/g" backend/.env
        sed -i "s/admin.yourdomain.com/$admin_domain/g" backend/.env
        echo "✅ Updated backend/.env"
    fi
    
    # Update admin panel environment
    if [ -f "admin-panel/.env" ]; then
        sed -i "s/api.yourdomain.com/$api_domain/g" admin-panel/.env
        echo "✅ Updated admin-panel/.env"
    fi
    
    # Update mobile app environment
    if [ -f "mobile-app/.env" ]; then
        sed -i "s/api.yourdomain.com/$api_domain/g" mobile-app/.env
        echo "✅ Updated mobile-app/.env"
    fi
    
    # Update nginx configuration
    if [ -f "nginx/nginx.prod.conf" ]; then
        sed -i "s/api.yourdomain.com/$api_domain/g" nginx/nginx.prod.conf
        sed -i "s/admin.yourdomain.com/$admin_domain/g" nginx/nginx.prod.conf
        echo "✅ Updated nginx/nginx.prod.conf"
    fi
    
    # Update docker-compose production file
    if [ -f "docker-compose.prod.yml" ]; then
        sed -i "s/yourdomain.com/$main_domain/g" docker-compose.prod.yml
        echo "✅ Updated docker-compose.prod.yml"
    fi
}

# Function to generate DNS configuration guide
generate_dns_guide() {
    local api_domain=$1
    local admin_domain=$2
    local main_domain=$3
    local server_ip=$4
    
    cat > DNS_CONFIGURATION.md << EOF
# DNS Configuration Guide for Hitch Platform

## Required DNS Records

Configure the following DNS records with your domain registrar:

### A Records (point to your server IP: $server_ip)
\`\`\`
$main_domain        A    $server_ip
$api_domain         A    $server_ip
$admin_domain       A    $server_ip
\`\`\`

### Alternative: CNAME Records (if using a subdomain)
\`\`\`
$api_domain         CNAME    $main_domain
$admin_domain       CNAME    $main_domain
\`\`\`

### Optional: WWW Redirect
\`\`\`
www.$main_domain    CNAME    $main_domain
\`\`\`

## Verification Commands

After DNS propagation (can take up to 48 hours), verify with:

\`\`\`bash
# Check DNS resolution
dig $api_domain
dig $admin_domain

# Check if domains point to your server
nslookup $api_domain
nslookup $admin_domain

# Test HTTP connectivity (before SSL)
curl -I http://$api_domain
curl -I http://$admin_domain
\`\`\`

## SSL Certificate Commands

After DNS is configured, run:

\`\`\`bash
# Setup SSL certificates
./scripts/setup-ssl-certificates.sh $api_domain $admin_domain

# Verify SSL setup
./scripts/verify-ssl.sh
\`\`\`

## Production Deployment

Once DNS and SSL are configured:

\`\`\`bash
# Deploy to production
./scripts/deploy-production.sh
\`\`\`

---
Generated on: $(date)
Server IP: $server_ip
API Domain: $api_domain
Admin Domain: $admin_domain
Main Domain: $main_domain
EOF

    echo "📋 DNS configuration guide created: DNS_CONFIGURATION.md"
}

# Function to test domain connectivity
test_domains() {
    local api_domain=$1
    local admin_domain=$2
    
    echo "🔍 Testing domain connectivity..."
    
    for domain in "$api_domain" "$admin_domain"; do
        echo "Testing $domain..."
        if host "$domain" > /dev/null 2>&1; then
            local ip=$(dig +short "$domain" | tail -n1)
            echo "✅ $domain resolves to: $ip"
        else
            echo "❌ $domain does not resolve"
        fi
    done
}

# Get server IP
SERVER_IP=$(curl -s https://api.ipify.org 2>/dev/null || echo "YOUR_SERVER_IP")

echo "🔧 Domain Configuration Setup"
echo "Current server IP: $SERVER_IP"
echo ""

# Interactive domain configuration
read -p "Enter your main domain (e.g., hitch.com): " main_domain
main_domain=${main_domain:-$DEFAULT_MAIN_DOMAIN}

read -p "Enter your API domain (e.g., api.hitch.com): " api_domain
api_domain=${api_domain:-$DEFAULT_API_DOMAIN}

read -p "Enter your admin domain (e.g., admin.hitch.com): " admin_domain
admin_domain=${admin_domain:-$DEFAULT_ADMIN_DOMAIN}

echo ""
echo "📋 Configuration Summary:"
echo "Main Domain: $main_domain"
echo "API Domain: $api_domain"
echo "Admin Domain: $admin_domain"
echo "Server IP: $SERVER_IP"
echo ""

read -p "Is this configuration correct? (y/N): " confirm
if [[ $confirm =~ ^[Yy]$ ]]; then
    update_env_files "$api_domain" "$admin_domain" "$main_domain"
    generate_dns_guide "$api_domain" "$admin_domain" "$main_domain" "$SERVER_IP"
    test_domains "$api_domain" "$admin_domain"
    
    echo ""
    echo "🎉 Domain configuration completed!"
    echo "📋 Next steps:"
    echo "1. Configure DNS records as shown in DNS_CONFIGURATION.md"
    echo "2. Wait for DNS propagation (up to 48 hours)"
    echo "3. Run: ./scripts/setup-ssl-certificates.sh $api_domain $admin_domain"
    echo "4. Run: ./scripts/deploy-production.sh"
    echo ""
    echo "💡 Tip: You can test DNS propagation with: dig $api_domain"
else
    echo "❌ Configuration cancelled. Run this script again to reconfigure."
    exit 1
fi