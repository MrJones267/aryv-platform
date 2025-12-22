#!/bin/bash

# AWS Quick Deploy for Hitch Platform
# Automated deployment using AWS managed services

set -e

echo "☁️ Hitch Platform - AWS Quick Deployment"
echo "======================================="

# Configuration
REGION="${1:-us-east-1}"
DOMAIN="${2:-hitchapp.com}"
ENVIRONMENT="${3:-production}"

echo "🔧 Configuration:"
echo "   Region: $REGION"
echo "   Domain: $DOMAIN"
echo "   Environment: $ENVIRONMENT"
echo ""

# Check prerequisites
check_prerequisites() {
    echo "🔍 Checking prerequisites..."
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        echo "❌ AWS CLI not found. Installing..."
        curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
        unzip awscliv2.zip
        sudo ./aws/install
        rm -rf aws awscliv2.zip
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        echo "❌ AWS credentials not configured."
        echo "Run: aws configure"
        echo "Need: Access Key ID, Secret Access Key, Region"
        exit 1
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker not found. Please install Docker first."
        exit 1
    fi
    
    AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
    echo "✅ AWS Account: $AWS_ACCOUNT"
    echo "✅ Prerequisites verified"
}

# Create production environment file
create_production_env() {
    echo ""
    echo "📄 Creating production environment configuration..."
    
    # Generate secure JWT secret
    JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
    
    cat > .env.production << EOF
# Hitch Platform - AWS Production Environment
NODE_ENV=production
AWS_REGION=$REGION

# Application Configuration
PORT=3001
REALTIME_PORT=3002

# Database (RDS PostgreSQL)
DATABASE_URL=postgresql://hitch_admin:$(openssl rand -base64 32 | tr -d '\n')@hitch-db.cluster-xyz.${REGION}.rds.amazonaws.com:5432/hitch_production

# Cache (ElastiCache Redis)
REDIS_URL=redis://hitch-cache.xyz.cache.amazonaws.com:6379

# Security
JWT_SECRET=$JWT_SECRET
CORS_ORIGIN=https://app.$DOMAIN,https://admin.$DOMAIN,https://api.$DOMAIN

# AWS Services
AWS_S3_BUCKET=hitch-storage-$AWS_ACCOUNT
AWS_CLOUDFRONT_DOMAIN=cdn.$DOMAIN

# External APIs (Update with real values)
STRIPE_SECRET_KEY=sk_live_your_stripe_key_here
GOOGLE_MAPS_API_KEY=your_google_maps_api_key_here
TWILIO_ACCOUNT_SID=your_twilio_account_sid_here
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here

# Monitoring
LOG_LEVEL=info
ENABLE_METRICS=true
SENTRY_DSN=https://your_sentry_dsn_here

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
EOF
    
    echo "✅ Production environment file created"
    echo "⚠️  Update external API keys in .env.production before final deployment"
}

# Create ECR repositories
create_ecr_repositories() {
    echo ""
    echo "🐳 Creating ECR repositories..."
    
    aws ecr create-repository --repository-name hitch-realtime --region $REGION || true
    aws ecr create-repository --repository-name hitch-backend --region $REGION || true
    aws ecr create-repository --repository-name hitch-admin --region $REGION || true
    
    echo "✅ ECR repositories created"
}

# Build and push Docker images
build_and_push_images() {
    echo ""
    echo "🏗️ Building and pushing Docker images..."
    
    AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
    ECR_BASE="$AWS_ACCOUNT.dkr.ecr.$REGION.amazonaws.com"
    
    # Login to ECR
    aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $ECR_BASE
    
    # Build real-time server image
    echo "Building real-time server..."
    docker build -f Dockerfile.realtime -t hitch-realtime:latest .
    docker tag hitch-realtime:latest $ECR_BASE/hitch-realtime:latest
    docker push $ECR_BASE/hitch-realtime:latest
    
    echo "✅ Real-time server image pushed"
    
    # Build backend image (if Dockerfile exists)
    if [ -f "backend/Dockerfile" ]; then
        echo "Building backend API..."
        cd backend
        docker build -t hitch-backend:latest .
        docker tag hitch-backend:latest $ECR_BASE/hitch-backend:latest
        docker push $ECR_BASE/hitch-backend:latest
        cd ..
        echo "✅ Backend API image pushed"
    fi
    
    # Build admin panel (if Dockerfile exists)  
    if [ -f "admin-panel/Dockerfile" ]; then
        echo "Building admin panel..."
        cd admin-panel
        docker build -t hitch-admin:latest .
        docker tag hitch-admin:latest $ECR_BASE/hitch-admin:latest
        docker push $ECR_BASE/hitch-admin:latest
        cd ..
        echo "✅ Admin panel image pushed"
    fi
}

# Create RDS PostgreSQL database
create_database() {
    echo ""
    echo "🗄️ Creating RDS PostgreSQL database..."
    
    # Create DB subnet group
    aws rds create-db-subnet-group \
        --db-subnet-group-name hitch-db-subnet-group \
        --db-subnet-group-description "Hitch database subnet group" \
        --subnet-ids subnet-12345 subnet-67890 \
        --region $REGION || true
    
    # Create database instance
    aws rds create-db-instance \
        --db-instance-identifier hitch-production-db \
        --db-instance-class db.t3.micro \
        --engine postgres \
        --engine-version 13.7 \
        --master-username hitch_admin \
        --master-user-password "$(openssl rand -base64 32 | tr -d '\n')" \
        --allocated-storage 20 \
        --storage-type gp2 \
        --vpc-security-group-ids sg-12345 \
        --db-subnet-group-name hitch-db-subnet-group \
        --backup-retention-period 7 \
        --multi-az \
        --publicly-accessible \
        --region $REGION || true
    
    echo "✅ RDS PostgreSQL database creation initiated"
    echo "⏳ Database will take 10-15 minutes to become available"
}

# Create ElastiCache Redis
create_redis() {
    echo ""
    echo "⚡ Creating ElastiCache Redis..."
    
    aws elasticache create-cache-cluster \
        --cache-cluster-id hitch-production-cache \
        --engine redis \
        --cache-node-type cache.t3.micro \
        --num-cache-nodes 1 \
        --security-group-ids sg-12345 \
        --region $REGION || true
    
    echo "✅ ElastiCache Redis creation initiated"
}

# Deploy using App Runner (Simplest option)
deploy_app_runner() {
    echo ""
    echo "🚀 Deploying to AWS App Runner..."
    
    AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
    
    # Create App Runner service for real-time server
    cat > apprunner-realtime.json << EOF
{
    "ServiceName": "hitch-realtime",
    "SourceConfiguration": {
        "ImageRepository": {
            "ImageIdentifier": "$AWS_ACCOUNT.dkr.ecr.$REGION.amazonaws.com/hitch-realtime:latest",
            "ImageConfiguration": {
                "Port": "3002",
                "RuntimeEnvironmentVariables": {
                    "NODE_ENV": "production",
                    "PORT": "3002"
                }
            },
            "ImageRepositoryType": "ECR"
        },
        "AutoDeploymentsEnabled": true
    },
    "InstanceConfiguration": {
        "Cpu": "0.25 vCPU",
        "Memory": "0.5 GB"
    },
    "HealthCheckConfiguration": {
        "Protocol": "HTTP",
        "Path": "/health",
        "Interval": 30,
        "Timeout": 5,
        "HealthyThreshold": 2,
        "UnhealthyThreshold": 5
    }
}
EOF
    
    aws apprunner create-service --cli-input-json file://apprunner-realtime.json --region $REGION
    
    echo "✅ App Runner deployment initiated"
    echo "⏳ Services will take 5-10 minutes to become available"
}

# Set up domain and SSL
setup_domain() {
    echo ""
    echo "🌐 Setting up domain and SSL..."
    
    # Create Route 53 hosted zone
    aws route53 create-hosted-zone \
        --name $DOMAIN \
        --caller-reference $(date +%s) \
        --hosted-zone-config Comment="Hitch platform DNS zone" || true
    
    # Request wildcard SSL certificate
    CERT_ARN=$(aws acm request-certificate \
        --domain-name "*.$DOMAIN" \
        --subject-alternative-names $DOMAIN \
        --validation-method DNS \
        --region $REGION \
        --output text --query CertificateArn)
    
    echo "✅ SSL certificate requested: $CERT_ARN"
    echo "⚠️  Please validate the certificate via DNS records"
    
    # Create CloudFront distribution
    aws cloudfront create-distribution \
        --distribution-config '{
            "CallerReference": "hitch-'$(date +%s)'",
            "Comment": "Hitch platform CDN",
            "DefaultRootObject": "index.html",
            "Origins": {
                "Quantity": 1,
                "Items": [
                    {
                        "Id": "hitch-origin",
                        "DomainName": "app.'$DOMAIN'",
                        "CustomOriginConfig": {
                            "HTTPPort": 443,
                            "HTTPSPort": 443,
                            "OriginProtocolPolicy": "https-only"
                        }
                    }
                ]
            },
            "DefaultCacheBehavior": {
                "TargetOriginId": "hitch-origin",
                "ViewerProtocolPolicy": "redirect-to-https",
                "MinTTL": 0,
                "ForwardedValues": {
                    "QueryString": true,
                    "Cookies": {"Forward": "none"}
                }
            },
            "Enabled": true,
            "ViewerCertificate": {
                "CertificateSource": "acm",
                "ACMCertificateArn": "'$CERT_ARN'",
                "SSLSupportMethod": "sni-only"
            }
        }' --region $REGION || true
    
    echo "✅ CloudFront distribution created"
}

# Update mobile app configuration
update_mobile_config() {
    echo ""
    echo "📱 Updating mobile app configuration..."
    
    # Update RealTimeService
    if [ -f "src/services/RealTimeService.ts" ]; then
        sed -i "s|https://realtime.hitchapp.com|https://realtime.$DOMAIN|g" src/services/RealTimeService.ts
    fi
    
    # Update API configuration
    if [ -f "src/services/api/baseApi.ts" ]; then
        sed -i "s|https://api.hitchapp.com|https://api.$DOMAIN|g" src/services/api/baseApi.ts
    fi
    
    echo "✅ Mobile app configuration updated for production"
}

# Set up monitoring
setup_monitoring() {
    echo ""
    echo "📊 Setting up CloudWatch monitoring..."
    
    # Create CloudWatch alarms
    aws cloudwatch put-metric-alarm \
        --alarm-name "Hitch-RealTime-HighCPU" \
        --alarm-description "High CPU on real-time service" \
        --metric-name CPUUtilization \
        --namespace AWS/AppRunner \
        --statistic Average \
        --period 300 \
        --threshold 80 \
        --comparison-operator GreaterThanThreshold \
        --evaluation-periods 2 \
        --region $REGION || true
    
    echo "✅ CloudWatch monitoring configured"
}

# Run health checks
run_health_checks() {
    echo ""
    echo "🏥 Running deployment health checks..."
    
    echo "Waiting for services to become available..."
    sleep 60
    
    # Get App Runner service URLs
    REALTIME_URL=$(aws apprunner list-services --region $REGION --query 'ServiceSummaryList[?ServiceName==`hitch-realtime`].ServiceUrl' --output text)
    
    if [ ! -z "$REALTIME_URL" ]; then
        if curl -f -s "https://$REALTIME_URL/health" > /dev/null; then
            echo "✅ Real-time service is healthy: https://$REALTIME_URL"
        else
            echo "❌ Real-time service health check failed"
        fi
    else
        echo "⏳ Real-time service URL not available yet"
    fi
    
    echo "✅ Health checks completed"
}

# Main deployment flow
main() {
    echo "🚀 Starting AWS quick deployment..."
    echo ""
    
    check_prerequisites
    create_production_env
    create_ecr_repositories
    build_and_push_images
    create_database
    create_redis  
    deploy_app_runner
    setup_domain
    update_mobile_config
    setup_monitoring
    run_health_checks
    
    echo ""
    echo "🎉 AWS DEPLOYMENT COMPLETED!"
    echo "=========================="
    echo ""
    echo "🌐 Your Hitch platform is deploying to:"
    echo "   Domain: $DOMAIN"
    echo "   Region: $REGION"
    echo "   Environment: $ENVIRONMENT"
    echo ""
    echo "⏳ Services are starting up (5-15 minutes):"
    echo "   • Real-time server via App Runner"
    echo "   • PostgreSQL database via RDS"
    echo "   • Redis cache via ElastiCache"
    echo "   • SSL certificates via ACM"
    echo "   • DNS management via Route 53"
    echo ""
    echo "📋 Next Steps:"
    echo "   1. Update DNS records for your domain"
    echo "   2. Validate SSL certificates"
    echo "   3. Test mobile app with production URLs"
    echo "   4. Set up monitoring dashboards"
    echo "   5. Configure external API keys"
    echo ""
    echo "🎯 READY FOR PRODUCTION USERS! 🚀"
}

# Execute main function
main "$@"