/**
 * @fileoverview App Icon Generation Script for ARYV Mobile App
 * @author Claude-Code
 * @created 2025-01-27
 * @description Generates all required app icon sizes from the master ARYV3.png logo
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Master logo path
const MASTER_LOGO = path.join(__dirname, '../../ARYV3.png');

// Android icon sizes (in pixels)
const ANDROID_SIZES = {
  'mipmap-ldpi': 36,
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192
};

// Additional Android sizes
const ANDROID_EXTRA_SIZES = {
  'play-store': 512,
  'notification': 24,
  'notification-large': 64
};

// iOS icon sizes (in pixels for @1x, @2x, @3x)
const IOS_SIZES = {
  'Icon-20': [20, 40, 60],
  'Icon-29': [29, 58, 87],
  'Icon-40': [40, 80, 120],
  'Icon-60': [60, 120, 180],
  'Icon-76': [76, 152],
  'Icon-83.5': [167],
  'Icon-1024': [1024]
};

// Ensure directories exist
const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Generate Android icons
const generateAndroidIcons = async () => {
  console.log('🤖 Generating Android icons...');
  
  const androidResPath = path.join(__dirname, '../android/app/src/main/res');
  
  // Standard mipmap icons
  for (const [folder, size] of Object.entries(ANDROID_SIZES)) {
    const outputDir = path.join(androidResPath, folder);
    ensureDir(outputDir);
    
    const outputPath = path.join(outputDir, 'ic_launcher.png');
    await sharp(MASTER_LOGO)
      .resize(size, size)
      .png()
      .toFile(outputPath);
    
    // Also create round version
    const roundOutputPath = path.join(outputDir, 'ic_launcher_round.png');
    await sharp(MASTER_LOGO)
      .resize(size, size)
      .png()
      .toFile(roundOutputPath);
    
    console.log(`  ✅ Generated ${folder}: ${size}x${size}px`);
  }
  
  // Play Store icon
  const playStoreDir = path.join(__dirname, '../android/app/src/main/play-store-assets');
  ensureDir(playStoreDir);
  
  await sharp(MASTER_LOGO)
    .resize(512, 512)
    .png()
    .toFile(path.join(playStoreDir, 'ic_launcher-play-store.png'));
  
  console.log('  ✅ Generated Play Store icon: 512x512px');
};

// Generate iOS icons
const generateIOSIcons = async () => {
  console.log('🍎 Generating iOS icons...');
  
  const iosIconsPath = path.join(__dirname, '../ios/aryv/Images.xcassets/AppIcon.appiconset');
  ensureDir(iosIconsPath);
  
  for (const [iconName, sizes] of Object.entries(IOS_SIZES)) {
    for (const size of sizes) {
      let fileName;
      
      if (size === 1024) {
        fileName = 'Icon-1024.png';
      } else {
        const scale = sizes.length > 1 ? sizes.indexOf(size) + 1 : 1;
        fileName = `${iconName}${scale > 1 ? `@${scale}x` : ''}.png`;
      }
      
      const outputPath = path.join(iosIconsPath, fileName);
      await sharp(MASTER_LOGO)
        .resize(size, size)
        .png()
        .toFile(outputPath);
      
      console.log(`  ✅ Generated ${fileName}: ${size}x${size}px`);
    }
  }
};

// Generate Contents.json for iOS
const generateIOSContentsJSON = () => {
  const iosIconsPath = path.join(__dirname, '../ios/aryv/Images.xcassets/AppIcon.appiconset');
  
  const contentsJSON = {
    "images": [
      {
        "idiom": "iphone",
        "scale": "2x",
        "size": "20x20",
        "filename": "Icon-20@2x.png"
      },
      {
        "idiom": "iphone",
        "scale": "3x",
        "size": "20x20",
        "filename": "Icon-20@3x.png"
      },
      {
        "idiom": "iphone",
        "scale": "2x",
        "size": "29x29",
        "filename": "Icon-29@2x.png"
      },
      {
        "idiom": "iphone",
        "scale": "3x",
        "size": "29x29",
        "filename": "Icon-29@3x.png"
      },
      {
        "idiom": "iphone",
        "scale": "2x",
        "size": "40x40",
        "filename": "Icon-40@2x.png"
      },
      {
        "idiom": "iphone",
        "scale": "3x",
        "size": "40x40",
        "filename": "Icon-40@3x.png"
      },
      {
        "idiom": "iphone",
        "scale": "2x",
        "size": "60x60",
        "filename": "Icon-60@2x.png"
      },
      {
        "idiom": "iphone",
        "scale": "3x",
        "size": "60x60",
        "filename": "Icon-60@3x.png"
      },
      {
        "idiom": "ios-marketing",
        "scale": "1x",
        "size": "1024x1024",
        "filename": "Icon-1024.png"
      }
    ],
    "info": {
      "author": "xcode",
      "version": 1
    }
  };
  
  fs.writeFileSync(
    path.join(iosIconsPath, 'Contents.json'),
    JSON.stringify(contentsJSON, null, 2)
  );
  
  console.log('  ✅ Generated Contents.json');
};

// Main function
const main = async () => {
  try {
    console.log('🚀 ARYV App Icon Generation');
    console.log('================================');
    
    // Check if master logo exists
    if (!fs.existsSync(MASTER_LOGO)) {
      console.error(`❌ Master logo not found at: ${MASTER_LOGO}`);
      process.exit(1);
    }
    
    console.log(`📱 Using master logo: ${MASTER_LOGO}\n`);
    
    // Generate icons
    await generateAndroidIcons();
    console.log('');
    await generateIOSIcons();
    generateIOSContentsJSON();
    
    console.log('\n🎉 App icon generation complete!');
    console.log('\nNext steps:');
    console.log('1. Clean and rebuild your React Native project');
    console.log('2. Test on both Android and iOS devices');
    console.log('3. Verify icon appears correctly on home screen');
    
  } catch (error) {
    console.error('❌ Error generating app icons:', error);
    process.exit(1);
  }
};

// Check if sharp is available
try {
  require.resolve('sharp');
} catch {
  console.error('❌ Sharp is required but not installed.');
  console.log('Install it with: npm install sharp --save-dev');
  process.exit(1);
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main };