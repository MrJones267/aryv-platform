#!/usr/bin/env node
/**
 * ARYV Production Configuration Validator
 * Validates that all API endpoints use production domain
 */

const fs = require('fs');
const path = require('path');

const PRODUCTION_DOMAIN = 'aryv-app.com';
const MOBILE_APP_SRC = '/mnt/c/users/majok/Hitch/mobile-app/src';

// Files to check for production configuration
const criticalFiles = [
  'services/api/baseApi.ts',
  'services/AuthService.ts',
  'services/ApiClient.ts', 
  'services/SocketService.ts',
  'services/RealTimeService.ts',
  'services/PredictiveAIService.ts',
  'services/GroupChatService.ts',
];

console.log('🔍 ARYV Production Configuration Validator');
console.log('==========================================');
console.log(`Target Domain: ${PRODUCTION_DOMAIN}`);
console.log(`Source Path: ${MOBILE_APP_SRC}`);
console.log('');

let allValid = true;
let totalChecks = 0;
let passedChecks = 0;

function validateFile(filePath) {
  const fullPath = path.join(MOBILE_APP_SRC, filePath);
  
  if (!fs.existsSync(fullPath)) {
    console.log(`❌ ${filePath} - FILE NOT FOUND`);
    return false;
  }
  
  const content = fs.readFileSync(fullPath, 'utf8');
  
  // Check for production domain
  const hasProductionDomain = content.includes(PRODUCTION_DOMAIN);
  
  // Check for localhost references (bad)
  const hasLocalhost = content.includes('localhost') || 
                      content.includes('10.0.2.2') || 
                      content.includes('127.0.0.1') ||
                      content.includes(':3001');
  
  totalChecks++;
  
  if (hasProductionDomain && !hasLocalhost) {
    console.log(`✅ ${filePath} - PRODUCTION READY`);
    passedChecks++;
    return true;
  } else if (hasProductionDomain && hasLocalhost) {
    console.log(`⚠️  ${filePath} - HAS PRODUCTION DOMAIN BUT ALSO LOCALHOST REFS`);
    return false;
  } else if (!hasProductionDomain && hasLocalhost) {
    console.log(`❌ ${filePath} - STILL USING LOCALHOST`);
    return false;
  } else {
    console.log(`❓ ${filePath} - NO API CONFIGURATION FOUND`);
    return false;
  }
}

// Validate critical files
console.log('Validating critical configuration files:');
console.log('');

for (const file of criticalFiles) {
  const isValid = validateFile(file);
  if (!isValid) {
    allValid = false;
  }
}

console.log('');
console.log('📊 VALIDATION SUMMARY');
console.log('====================');
console.log(`Total Files Checked: ${totalChecks}`);
console.log(`Passed: ${passedChecks}`);
console.log(`Failed: ${totalChecks - passedChecks}`);
console.log(`Success Rate: ${Math.round((passedChecks / totalChecks) * 100)}%`);
console.log('');

if (allValid && passedChecks === totalChecks) {
  console.log('🎉 ALL SYSTEMS GO! Mobile app is ready for production deployment.');
  console.log(`✅ All API endpoints configured for ${PRODUCTION_DOMAIN}`);
  console.log('✅ No localhost dependencies found');
  console.log('✅ Production-ready configuration verified');
  process.exit(0);
} else {
  console.log('❌ CONFIGURATION ISSUES FOUND');
  console.log('Some files still contain localhost references or missing production config.');
  console.log('Please review the failed files above.');
  process.exit(1);
}