/**
 * @fileoverview ARYV Platform Deployment Readiness Checker
 * @author Claude-Code
 * @created 2025-01-27
 * @description Comprehensive verification of platform configuration for deployment
 */

const fs = require('fs');
const path = require('path');

// Colors for console output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
  bold: '\x1b[1m'
};

// Helper functions
const log = (message, color = colors.reset) => console.log(`${color}${message}${colors.reset}`);
const success = (message) => log(`✅ ${message}`, colors.green);
const error = (message) => log(`❌ ${message}`, colors.red);
const warning = (message) => log(`⚠️  ${message}`, colors.yellow);
const info = (message) => log(`ℹ️  ${message}`, colors.blue);

// Check if file exists
const fileExists = (filePath) => fs.existsSync(filePath);

// Read file content safely
const readFileContent = (filePath) => {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    return null;
  }
};

// Check for ARYV branding consistency
const checkBranding = () => {
  log('\n🎨 Checking ARYV Branding Consistency...', colors.bold);
  
  const criticalFiles = [
    'package.json',
    'mobile-app/package.json',
    'backend/package.json',
    'admin-panel/package.json',
    'README.md'
  ];
  
  let brandingScore = 0;
  let totalChecks = 0;
  
  criticalFiles.forEach(file => {
    if (fileExists(file)) {
      const content = readFileContent(file);
      if (content) {
        totalChecks++;
        if (content.includes('aryv') || content.includes('ARYV')) {
          brandingScore++;
          success(`${file} - ARYV branding found`);
        } else {
          warning(`${file} - No ARYV branding detected`);
        }
      }
    }
  });
  
  const brandingPercentage = Math.round((brandingScore / totalChecks) * 100);
  if (brandingPercentage >= 80) {
    success(`Branding consistency: ${brandingPercentage}%`);
  } else {
    warning(`Branding consistency: ${brandingPercentage}% (should be >80%)`);
  }
  
  return brandingScore;
};

// Check environment configuration
const checkEnvironmentConfig = () => {
  log('\n🔧 Checking Environment Configuration...', colors.bold);
  
  const envFiles = [
    'backend/.env',
    'backend/.env.production'
  ];
  
  let configScore = 0;
  
  envFiles.forEach(file => {
    if (fileExists(file)) {
      const content = readFileContent(file);
      if (content) {
        // Check for required environment variables
        const requiredVars = [
          'NODE_ENV',
          'PORT',
          'POSTGRES_HOST',
          'JWT_SECRET',
          'CLOUDFLARE_R2_ACCESS_KEY'
        ];
        
        let foundVars = 0;
        requiredVars.forEach(varName => {
          if (content.includes(varName)) {
            foundVars++;
          }
        });
        
        if (foundVars === requiredVars.length) {
          success(`${file} - All required variables present`);
          configScore++;
        } else {
          warning(`${file} - Missing ${requiredVars.length - foundVars} required variables`);
        }
        
        // Check for ARYV domain references
        if (content.includes('aryv-app.com')) {
          success(`${file} - ARYV domain configured`);
        } else {
          warning(`${file} - No ARYV domain references found`);
        }
      }
    } else {
      error(`${file} - File not found`);
    }
  });
  
  return configScore;
};

// Check mobile app configuration
const checkMobileAppConfig = () => {
  log('\n📱 Checking Mobile App Configuration...', colors.bold);
  
  let mobileScore = 0;
  
  // Check package.json
  if (fileExists('mobile-app/package.json')) {
    const packageContent = readFileContent('mobile-app/package.json');
    if (packageContent) {
      const packageData = JSON.parse(packageContent);
      if (packageData.name === 'aryv-mobile') {
        success('Mobile app package name: aryv-mobile');
        mobileScore++;
      } else {
        warning(`Mobile app package name: ${packageData.name} (should be aryv-mobile)`);
      }
    }
  }
  
  // Check Android configuration
  const androidManifest = 'mobile-app/android/app/src/main/AndroidManifest.xml';
  if (fileExists(androidManifest)) {
    success('Android manifest found');
    mobileScore++;
  } else {
    error('Android manifest not found');
  }
  
  // Check iOS configuration
  const iosInfo = 'mobile-app/ios/aryv/Info.plist';
  if (fileExists(iosInfo)) {
    success('iOS Info.plist found');
    mobileScore++;
  } else {
    warning('iOS Info.plist not found (path may be different)');
  }
  
  // Check for app icons
  const androidIcons = 'mobile-app/android/app/src/main/res/mipmap-hdpi/ic_launcher.png';
  if (fileExists(androidIcons)) {
    success('Android app icons generated');
    mobileScore++;
  } else {
    error('Android app icons not found');
  }
  
  // Check API configuration
  const apiConfig = 'mobile-app/src/config/api.ts';
  if (fileExists(apiConfig)) {
    const content = readFileContent(apiConfig);
    if (content && content.includes('aryv-app.com')) {
      success('API configuration points to ARYV domain');
      mobileScore++;
    } else {
      warning('API configuration may not have ARYV domain');
    }
  }
  
  return mobileScore;
};

// Check backend configuration
const checkBackendConfig = () => {
  log('\n🖥️  Checking Backend Configuration...', colors.bold);
  
  let backendScore = 0;
  
  // Check package.json
  if (fileExists('backend/package.json')) {
    const content = readFileContent('backend/package.json');
    if (content) {
      const packageData = JSON.parse(content);
      if (packageData.name === 'aryv-backend') {
        success('Backend package name: aryv-backend');
        backendScore++;
      }
    }
  }
  
  // Check database initialization
  if (fileExists('backend/database/init.sql')) {
    const content = readFileContent('backend/database/init.sql');
    if (content && content.includes('ARYV Platform')) {
      success('Database initialization has ARYV branding');
      backendScore++;
    } else {
      warning('Database initialization may need ARYV branding update');
    }
  }
  
  // Check TypeScript configuration
  if (fileExists('backend/tsconfig.json')) {
    success('Backend TypeScript configuration found');
    backendScore++;
  }
  
  // Check for API documentation
  if (fileExists('backend/src/routes/docs.js')) {
    const content = readFileContent('backend/src/routes/docs.js');
    if (content && content.includes('ARYV')) {
      success('API documentation has ARYV branding');
      backendScore++;
    }
  }
  
  return backendScore;
};

// Check admin panel configuration
const checkAdminPanelConfig = () => {
  log('\n👨‍💼 Checking Admin Panel Configuration...', colors.bold);
  
  let adminScore = 0;
  
  // Check package.json
  if (fileExists('admin-panel/package.json')) {
    const content = readFileContent('admin-panel/package.json');
    if (content) {
      const packageData = JSON.parse(content);
      if (packageData.name === 'aryv-admin') {
        success('Admin panel package name: aryv-admin');
        adminScore++;
      }
    }
  }
  
  // Check index.html for branding
  if (fileExists('admin-panel/index.html')) {
    const content = readFileContent('admin-panel/index.html');
    if (content && content.includes('ARYV')) {
      success('Admin panel HTML has ARYV branding');
      adminScore++;
    }
  }
  
  // Check for favicon
  if (fileExists('admin-panel/public/favicon.png')) {
    success('Admin panel favicon found');
    adminScore++;
  } else {
    warning('Admin panel favicon not found');
  }
  
  return adminScore;
};

// Check Docker configuration
const checkDockerConfig = () => {
  log('\n🐳 Checking Docker Configuration...', colors.bold);
  
  let dockerScore = 0;
  
  // Check docker-compose files
  const composeFiles = ['docker-compose.yml', 'docker-compose.prod.yml'];
  
  composeFiles.forEach(file => {
    if (fileExists(file)) {
      const content = readFileContent(file);
      if (content && content.includes('aryv')) {
        success(`${file} - ARYV services configured`);
        dockerScore++;
      } else {
        warning(`${file} - May need ARYV service names`);
      }
    } else {
      error(`${file} - File not found`);
    }
  });
  
  // Check Dockerfiles
  const dockerfiles = [
    'backend/Dockerfile',
    'admin-panel/Dockerfile',
    'mobile-app/android/Dockerfile'
  ];
  
  dockerfiles.forEach(file => {
    if (fileExists(file)) {
      success(`${file} found`);
      dockerScore++;
    }
  });
  
  return dockerScore;
};

// Main verification function
const runDeploymentReadinessCheck = () => {
  log('🚀 ARYV Platform - Deployment Readiness Check', colors.bold + colors.blue);
  log('='.repeat(50), colors.blue);
  
  const scores = {
    branding: checkBranding(),
    environment: checkEnvironmentConfig(), 
    mobile: checkMobileAppConfig(),
    backend: checkBackendConfig(),
    admin: checkAdminPanelConfig(),
    docker: checkDockerConfig()
  };
  
  // Calculate overall score
  const totalScore = Object.values(scores).reduce((a, b) => a + b, 0);
  const maxPossibleScore = Object.keys(scores).length * 5; // Assume max 5 points per category
  const overallPercentage = Math.round((totalScore / maxPossibleScore) * 100);
  
  log('\n📊 Deployment Readiness Summary', colors.bold);
  log('='.repeat(35), colors.blue);
  
  Object.entries(scores).forEach(([category, score]) => {
    const capitalizedCategory = category.charAt(0).toUpperCase() + category.slice(1);
    if (score >= 3) {
      success(`${capitalizedCategory}: ${score}/5 points - Ready`);
    } else if (score >= 2) {
      warning(`${capitalizedCategory}: ${score}/5 points - Needs attention`);
    } else {
      error(`${capitalizedCategory}: ${score}/5 points - Critical issues`);
    }
  });
  
  log('\n🎯 Overall Deployment Readiness:', colors.bold);
  if (overallPercentage >= 85) {
    success(`${overallPercentage}% - READY FOR DEPLOYMENT! 🎉`);
  } else if (overallPercentage >= 70) {
    warning(`${overallPercentage}% - Almost ready, address warnings before deploying`);
  } else {
    error(`${overallPercentage}% - Critical issues must be resolved before deployment`);
  }
  
  // Next steps
  log('\n🔄 Next Steps:', colors.bold);
  if (overallPercentage >= 85) {
    info('1. Deploy backend to Railway');
    info('2. Update DNS settings for aryv-app.com');
    info('3. Deploy admin panel to Cloudflare Pages');
    info('4. Build and test mobile apps');
    info('5. Submit to app stores');
  } else {
    info('1. Address the issues identified above');
    info('2. Re-run this check until score is >85%');
    info('3. Proceed with deployment');
  }
  
  return overallPercentage;
};

// Run the check
if (require.main === module) {
  runDeploymentReadinessCheck();
}

module.exports = { runDeploymentReadinessCheck };