#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

// Start Metro bundler directly
try {
  console.log('Starting Metro bundler...');
  const metroConfig = path.join(__dirname, 'metro.config.js');
  
  execSync(`npx @react-native/metro-config start --config=${metroConfig}`, {
    stdio: 'inherit',
    cwd: __dirname
  });
} catch (error) {
  console.error('Failed to start Metro:', error.message);
  process.exit(1);
}