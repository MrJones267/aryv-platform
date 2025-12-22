// Prepare Mobile App for Device Testing
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const os = require('os');

console.log('📱 Preparing Hitch Mobile App for Device Testing');
console.log('===============================================');

// Get network interfaces to find IP address
function getLocalIPAddress() {
  const interfaces = os.networkInterfaces();
  
  for (let interfaceName in interfaces) {
    const addresses = interfaces[interfaceName];
    for (let address of addresses) {
      if (address.family === 'IPv4' && !address.internal) {
        return address.address;
      }
    }
  }
  return 'localhost';
}

// Update RealTimeService configuration
function updateRealTimeService(ipAddress) {
  const servicePath = path.join(__dirname, 'mobile-app/src/services/RealTimeService.ts');
  
  if (!fs.existsSync(servicePath)) {
    console.log('❌ RealTimeService.ts not found');
    return false;
  }
  
  let serviceContent = fs.readFileSync(servicePath, 'utf8');
  
  // Update the getServerUrl method
  const oldPattern = /private getServerUrl\(\): string \{[\s\S]*?\}/;
  const newMethod = `private getServerUrl(): string {
    if (__DEV__) {
      return Platform.OS === 'android' 
        ? 'http://${ipAddress}:3002'  // Device testing IP
        : 'http://localhost:3002';     // iOS simulator
    }
    return 'https://realtime.hitchapp.com'; // Production URL
  }`;
  
  if (serviceContent.match(oldPattern)) {
    serviceContent = serviceContent.replace(oldPattern, newMethod);
    fs.writeFileSync(servicePath, serviceContent);
    console.log(`✅ Updated RealTimeService with IP: ${ipAddress}`);
    return true;
  } else {
    console.log('⚠️  Could not find getServerUrl method to update');
    return false;
  }
}

// Update BaseApi configuration
function updateBaseApi(ipAddress) {
  const apiPath = path.join(__dirname, 'mobile-app/src/services/api/baseApi.ts');
  
  if (!fs.existsSync(apiPath)) {
    console.log('❌ baseApi.ts not found');
    return false;
  }
  
  let apiContent = fs.readFileSync(apiPath, 'utf8');
  
  // Update BASE_URL configuration
  const oldPattern = /const BASE_URL = __DEV__[\s\S]*?;/;
  const newConfig = `const BASE_URL = __DEV__ 
  ? Platform.OS === 'android' 
    ? 'http://${ipAddress}:3001/api'  // Android device testing
    : 'http://localhost:3001/api'     // iOS simulator
  : 'https://api.hitchapp.com/api';`;
  
  if (apiContent.match(oldPattern)) {
    apiContent = apiContent.replace(oldPattern, newConfig);
    fs.writeFileSync(apiPath, apiContent);
    console.log(`✅ Updated BaseApi with IP: ${ipAddress}`);
    return true;
  } else {
    console.log('⚠️  Could not find BASE_URL to update');
    return false;
  }
}

// Create network security config for Android (allows HTTP in debug)
function createNetworkSecurityConfig() {
  const configDir = path.join(__dirname, 'mobile-app/android/app/src/main/res/xml');
  const configPath = path.join(configDir, 'network_security_config.xml');
  
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }
  
  const networkConfig = `<?xml version="1.0" encoding="utf-8"?>
<network-security-config>
    <domain-config cleartextTrafficPermitted="true">
        <domain includeSubdomains="false">localhost</domain>
        <domain includeSubdomains="false">10.0.2.2</domain>
        <domain includeSubdomains="false">127.0.0.1</domain>
        <domain includeSubdomains="false">192.168.1.1</domain>
        <domain includeSubdomains="false">192.168.1.100</domain>
        <domain includeSubdomains="false">192.168.1.101</domain>
        <domain includeSubdomains="false">192.168.0.1</domain>
        <domain includeSubdomains="false">192.168.0.100</domain>
    </domain-config>
</network-security-config>`;
  
  fs.writeFileSync(configPath, networkConfig);
  console.log('✅ Created network security config for Android');
  return true;
}

// Update AndroidManifest.xml to use network security config
function updateAndroidManifest() {
  const manifestPath = path.join(__dirname, 'mobile-app/android/app/src/main/AndroidManifest.xml');
  
  if (!fs.existsSync(manifestPath)) {
    console.log('❌ AndroidManifest.xml not found');
    return false;
  }
  
  let manifest = fs.readFileSync(manifestPath, 'utf8');
  
  // Add network security config if not present
  if (!manifest.includes('android:networkSecurityConfig')) {
    manifest = manifest.replace(
      '<application',
      '<application\n        android:networkSecurityConfig="@xml/network_security_config"'
    );
    
    fs.writeFileSync(manifestPath, manifest);
    console.log('✅ Updated AndroidManifest.xml with network security config');
  } else {
    console.log('ℹ️  AndroidManifest.xml already has network security config');
  }
  
  return true;
}

// Add device testing script to package.json
function addDeviceTestingScript() {
  const packagePath = path.join(__dirname, 'mobile-app/package.json');
  
  if (!fs.existsSync(packagePath)) {
    console.log('❌ mobile-app/package.json not found');
    return false;
  }
  
  let packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  
  // Add device testing scripts
  if (!packageJson.scripts['android:device']) {
    packageJson.scripts['android:device'] = 'react-native run-android --device';
    packageJson.scripts['test:device'] = 'react-native run-android --device --variant=debug';
    packageJson.scripts['device:logs'] = 'adb logcat | grep -i hitch';
    
    fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
    console.log('✅ Added device testing scripts to package.json');
  } else {
    console.log('ℹ️  Device testing scripts already exist');
  }
  
  return true;
}

// Check backend servers are running
function checkBackendStatus() {
  return new Promise((resolve) => {
    const http = require('http');
    
    const checkServer = (port, name) => {
      return new Promise((res) => {
        const req = http.get(`http://localhost:${port}/health`, (response) => {
          let data = '';
          response.on('data', chunk => data += chunk);
          response.on('end', () => {
            try {
              const result = JSON.parse(data);
              console.log(`✅ ${name} server running on port ${port}`);
              res(true);
            } catch (e) {
              console.log(`⚠️  ${name} server responding but not healthy on port ${port}`);
              res(false);
            }
          });
        });
        
        req.on('error', () => {
          console.log(`❌ ${name} server not running on port ${port}`);
          res(false);
        });
        
        req.setTimeout(5000, () => {
          req.abort();
          console.log(`⏰ ${name} server timeout on port ${port}`);
          res(false);
        });
      });
    };
    
    Promise.all([
      checkServer(3001, 'Backend API'),
      checkServer(3002, 'Real-time')
    ]).then(results => {
      resolve(results.every(r => r));
    });
  });
}

// Generate testing instructions
function generateTestingInstructions(ipAddress) {
  const instructions = `
📱 HITCH MOBILE APP - DEVICE TESTING READY!
=============================================

🖥️  Backend Status:
   • Real-time Server: http://${ipAddress}:3002
   • API Server: http://${ipAddress}:3001
   
📱 Mobile App Configuration:
   • Android Device IP: ${ipAddress}:3002
   • iOS Simulator: localhost:3002
   
🚀 Next Steps:

1. Connect Android Device:
   adb devices

2. Build and Run on Device:
   cd mobile-app
   npm run android:device

3. Test Real-time Features:
   • Check connection status in app
   • Test location sharing
   • Try real-time chat
   • Monitor notifications

4. Monitor Logs:
   npm run device:logs

🔧 Troubleshooting:
   • If connection fails, check firewall (allow port 3002)
   • Ensure device and computer on same WiFi network
   • Verify backend servers are running

✅ Ready for Device Testing!
`;
  
  console.log(instructions);
  
  // Save instructions to file
  fs.writeFileSync(path.join(__dirname, 'DEVICE_TESTING_INSTRUCTIONS.txt'), instructions);
  console.log('📝 Instructions saved to DEVICE_TESTING_INSTRUCTIONS.txt');
}

// Main execution
async function prepareMobileDeviceTesting() {
  console.log('🔍 Detecting network configuration...');
  const ipAddress = getLocalIPAddress();
  console.log(`📡 Local IP Address: ${ipAddress}`);
  
  console.log('\n🔧 Updating mobile app configuration...');
  updateRealTimeService(ipAddress);
  updateBaseApi(ipAddress);
  
  console.log('\n📱 Configuring Android settings...');
  createNetworkSecurityConfig();
  updateAndroidManifest();
  addDeviceTestingScript();
  
  console.log('\n🌐 Checking backend server status...');
  const serversRunning = await checkBackendStatus();
  
  if (serversRunning) {
    console.log('\n✅ Backend servers confirmed running');
  } else {
    console.log('\n⚠️  Some backend servers may not be running');
    console.log('   Start them with: node realtime-production-server.js & node simple-server.js');
  }
  
  generateTestingInstructions(ipAddress);
  
  console.log('\n🎯 MOBILE DEVICE TESTING PREPARATION COMPLETE!');
  console.log('   Your mobile app is configured and ready for device testing.');
}

// Run the preparation
prepareMobileDeviceTesting().catch(error => {
  console.error('💥 Preparation failed:', error);
  process.exit(1);
});