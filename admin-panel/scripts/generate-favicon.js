/**
 * @fileoverview Favicon Generation Script for ARYV Admin Panel
 * @author Claude-Code
 * @created 2025-01-27
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const MASTER_LOGO = path.join(__dirname, '../src/assets/ARYV3.png');
const PUBLIC_DIR = path.join(__dirname, '../public');

const generateFavicons = async () => {
  console.log('🔧 Generating favicons for ARYV Admin Panel...');
  
  // Ensure public directory exists
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }
  
  // Standard favicon sizes
  const sizes = [16, 32, 48, 64, 128, 256];
  
  for (const size of sizes) {
    const outputPath = path.join(PUBLIC_DIR, `favicon-${size}x${size}.png`);
    await sharp(MASTER_LOGO)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    
    console.log(`  ✅ Generated favicon-${size}x${size}.png`);
  }
  
  // Generate standard favicon.ico (32x32)
  await sharp(MASTER_LOGO)
    .resize(32, 32)
    .png()
    .toFile(path.join(PUBLIC_DIR, 'favicon.png'));
  
  // Generate Apple touch icon
  await sharp(MASTER_LOGO)
    .resize(180, 180)
    .png()
    .toFile(path.join(PUBLIC_DIR, 'apple-touch-icon.png'));
  
  console.log('  ✅ Generated favicon.png');
  console.log('  ✅ Generated apple-touch-icon.png');
  console.log('\n🎉 Favicon generation complete!');
};

// Check if master logo exists
if (!fs.existsSync(MASTER_LOGO)) {
  console.error(`❌ Master logo not found at: ${MASTER_LOGO}`);
  process.exit(1);
}

// Run the script
generateFavicons().catch(console.error);