#!/bin/bash

# Hitch Platform - SSL Certificate Setup Script
# This script sets up SSL certificates for production deployment

set -e

echo "🔐 Setting up SSL certificates for Hitch platform..."

# Configuration
DOMAIN_API=${1:-api.yourdomain.com}
DOMAIN_ADMIN=${2:-admin.yourdomain.com}
SSL_DIR="./nginx/ssl"

# Create SSL directory
mkdir -p "$SSL_DIR"

echo "📁 Created SSL directory: $SSL_DIR"

# Function to setup Let's Encrypt certificates
setup_letsencrypt() {
    echo "🌐 Setting up Let's Encrypt certificates..."
    
    # Check if certbot is installed
    if ! command -v certbot &> /dev/null; then
        echo "📦 Installing certbot..."
        sudo apt update
        sudo apt install -y certbot python3-certbot-nginx
    fi
    
    # Generate certificates
    echo "📜 Generating certificate for $DOMAIN_API..."
    sudo certbot certonly --standalone -d "$DOMAIN_API" --email admin@yourdomain.com --agree-tos --non-interactive
    
    echo "📜 Generating certificate for $DOMAIN_ADMIN..."
    sudo certbot certonly --standalone -d "$DOMAIN_ADMIN" --email admin@yourdomain.com --agree-tos --non-interactive
    
    # Copy certificates to nginx directory
    sudo cp "/etc/letsencrypt/live/$DOMAIN_API/fullchain.pem" "$SSL_DIR/$DOMAIN_API.crt"
    sudo cp "/etc/letsencrypt/live/$DOMAIN_API/privkey.pem" "$SSL_DIR/$DOMAIN_API.key"
    sudo cp "/etc/letsencrypt/live/$DOMAIN_ADMIN/fullchain.pem" "$SSL_DIR/$DOMAIN_ADMIN.crt"
    sudo cp "/etc/letsencrypt/live/$DOMAIN_ADMIN/privkey.pem" "$SSL_DIR/$DOMAIN_ADMIN.key"
    
    # Set proper permissions
    sudo chown $USER:$USER "$SSL_DIR"/*
    chmod 600 "$SSL_DIR"/*.key
    chmod 644 "$SSL_DIR"/*.crt
    
    echo "✅ Let's Encrypt certificates set up successfully!"
}

# Function to setup self-signed certificates (for testing)
setup_self_signed() {
    echo "🔧 Setting up self-signed certificates (for testing only)..."
    
    # Generate self-signed certificate for API domain
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$SSL_DIR/$DOMAIN_API.key" \
        -out "$SSL_DIR/$DOMAIN_API.crt" \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN_API"
    
    # Generate self-signed certificate for Admin domain
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$SSL_DIR/$DOMAIN_ADMIN.key" \
        -out "$SSL_DIR/$DOMAIN_ADMIN.crt" \
        -subj "/C=US/ST=State/L=City/O=Organization/CN=$DOMAIN_ADMIN"
    
    echo "✅ Self-signed certificates generated successfully!"
    echo "⚠️  Note: These are for testing only. Use Let's Encrypt for production."
}

# Function to setup certificate auto-renewal
setup_auto_renewal() {
    echo "🔄 Setting up certificate auto-renewal..."
    
    # Add cron job for certificate renewal
    (crontab -l 2>/dev/null; echo "0 12 * * * /usr/bin/certbot renew --quiet") | crontab -
    
    echo "✅ Auto-renewal set up successfully!"
}

# Main menu
echo "Choose SSL certificate setup method:"
echo "1) Let's Encrypt (Production - requires domain pointing to this server)"
echo "2) Self-signed (Development/Testing)"
echo "3) Skip SSL setup"

read -p "Enter your choice (1-3): " choice

case $choice in
    1)
        setup_letsencrypt
        setup_auto_renewal
        ;;
    2)
        setup_self_signed
        ;;
    3)
        echo "⏭️  Skipping SSL setup. You can run this script later."
        exit 0
        ;;
    *)
        echo "❌ Invalid choice. Exiting."
        exit 1
        ;;
esac

# Verify certificates
echo "🔍 Verifying certificate setup..."
for cert in "$SSL_DIR"/*.crt; do
    if [ -f "$cert" ]; then
        echo "✅ Certificate found: $(basename "$cert")"
        openssl x509 -in "$cert" -text -noout | grep "Subject:" | head -1
    fi
done

echo ""
echo "🎉 SSL certificate setup completed!"
echo "📁 Certificates are stored in: $SSL_DIR"
echo "🔧 Update your nginx configuration to use these certificates"
echo "🚀 Your Hitch platform is ready for HTTPS deployment!"

# Create certificate verification script
cat > scripts/verify-ssl.sh << 'EOF'
#!/bin/bash
echo "🔍 Verifying SSL certificates..."
for domain in api.yourdomain.com admin.yourdomain.com; do
    echo "Checking $domain..."
    if openssl s_client -connect $domain:443 -servername $domain < /dev/null 2>/dev/null | openssl x509 -noout -dates; then
        echo "✅ $domain certificate is valid"
    else
        echo "❌ $domain certificate check failed"
    fi
done
EOF

chmod +x scripts/verify-ssl.sh
echo "📝 Created SSL verification script: scripts/verify-ssl.sh"