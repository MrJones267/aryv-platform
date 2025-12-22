const fs = require('fs');
const path = require('path');

/**
 * ARYV App Icon Generator using Node.js and Canvas
 * Creates professional app icons with brand colors
 */

// First, let's create SVG icons that can be converted later
function createSVGIcon() {
  const svg = `
<svg width="1024" height="1024" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#2196F3;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1976D2;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background with gradient -->
  <rect width="1024" height="1024" rx="128" ry="128" fill="url(#bg)"/>
  
  <!-- Main A letter -->
  <text x="512" y="580" font-family="Arial, sans-serif" font-size="400" font-weight="bold" 
        text-anchor="middle" fill="white" style="text-shadow: 0 4px 8px rgba(0,0,0,0.3);">A</text>
  
  <!-- Road dots accent -->
  <circle cx="412" cy="720" r="12" fill="#FF4081"/>
  <circle cx="512" cy="720" r="12" fill="#FF4081"/>
  <circle cx="612" cy="720" r="12" fill="#FF4081"/>
</svg>`;

  return svg;
}

// Create all required directories
function createDirectories() {
  const dirs = [
    'assets/icons',
    'ios/hitchmobile/Images.xcassets/AppIcon.appiconset',
    'android/app/src/main/res/mipmap-ldpi',
    'android/app/src/main/res/mipmap-mdpi',
    'android/app/src/main/res/mipmap-hdpi',
    'android/app/src/main/res/mipmap-xhdpi',
    'android/app/src/main/res/mipmap-xxhdpi',
    'android/app/src/main/res/mipmap-xxxhdpi',
    'android/app/src/main/res/mipmap-anydpi-v26',
    'android/app/src/main/play-store-assets'
  ];

  dirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
}

// Create iOS Contents.json
function createContentsJson() {
  const contents = {
    images: [
      { size: '20x20', idiom: 'iphone', filename: 'Icon-20@2x.png', scale: '2x' },
      { size: '20x20', idiom: 'iphone', filename: 'Icon-20@3x.png', scale: '3x' },
      { size: '29x29', idiom: 'iphone', filename: 'Icon-29@2x.png', scale: '2x' },
      { size: '29x29', idiom: 'iphone', filename: 'Icon-29@3x.png', scale: '3x' },
      { size: '60x60', idiom: 'iphone', filename: 'Icon-60@2x.png', scale: '2x' },
      { size: '60x60', idiom: 'iphone', filename: 'Icon-60@3x.png', scale: '3x' },
      { size: '1024x1024', idiom: 'ios-marketing', filename: 'Icon-1024.png', scale: '1x' }
    ],
    info: { version: 1, author: 'aryv-icon-generator' }
  };

  const contentsPath = 'ios/hitchmobile/Images.xcassets/AppIcon.appiconset/Contents.json';
  fs.writeFileSync(contentsPath, JSON.stringify(contents, null, 2));
  console.log('✅ Created iOS Contents.json');
}

// Create Android adaptive icon XMLs
function createAndroidAdaptiveIcons() {
  // ic_launcher.xml
  const launcherXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background"/>
    <foreground android:drawable="@drawable/ic_launcher_foreground"/>
</adaptive-icon>`;

  // ic_launcher_background.xml
  const backgroundXml = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportAeight="108">
  <group android:scaleX="1.0"
      android:scaleY="1.0"
      android:pivotX="54"
      android:pivotY="54">
    <path android:fillColor="#2196F3"
        android:pathData="M0,0h108v108h-108z"/>
  </group>
</vector>`;

  // ic_launcher_foreground.xml
  const foregroundXml = `<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp"
    android:height="108dp"
    android:viewportWidth="108"
    android:viewportAeight="108">
  <group android:scaleX="0.8"
      android:scaleY="0.8"
      android:pivotX="54"
      android:pivotY="54">
    <path android:fillColor="#FFFFFF"
        android:pathData="M30,35h10v15h8v-15h10v38h-10v-15h-8v15h-10z"/>
    <circle android:fillColor="#FF4081" android:cx="45" android:cy="80" android:r="2"/>
    <circle android:fillColor="#FF4081" android:cx="54" android:cy="80" android:r="2"/>
    <circle android:fillColor="#FF4081" android:cx="63" android:cy="80" android:r="2"/>
  </group>
</vector>`;

  // Write files
  const adaptiveDir = 'android/app/src/main/res/mipmap-anydpi-v26';
  fs.writeFileSync(`${adaptiveDir}/ic_launcher.xml`, launcherXml);
  
  const drawableDir = 'android/app/src/main/res/drawable';
  if (!fs.existsSync(drawableDir)) {
    fs.mkdirSync(drawableDir, { recursive: true });
  }
  fs.writeFileSync(`${drawableDir}/ic_launcher_background.xml`, backgroundXml);
  fs.writeFileSync(`${drawableDir}/ic_launcher_foreground.xml`, foregroundXml);

  console.log('✅ Created Android adaptive icon XMLs');
}

// Create simple PNG generation script
function createPngGenerationScript() {
  const script = `#!/bin/bash

# ARYV Icon PNG Generation Script
# This script creates placeholder PNG files using simple text-based approach

echo "🎨 Generating PNG icons..."

# Create simple colored squares as placeholders
# These will be replaced with proper icons once design tools are available

# iOS icon sizes
declare -A ios_sizes=(
  ["Icon-20@2x.png"]="40"
  ["Icon-20@3x.png"]="60" 
  ["Icon-29@2x.png"]="58"
  ["Icon-29@3x.png"]="87"
  ["Icon-60@2x.png"]="120"
  ["Icon-60@3x.png"]="180"
  ["Icon-1024.png"]="1024"
)

# Android icon sizes
declare -A android_sizes=(
  ["mipmap-ldpi"]="36"
  ["mipmap-mdpi"]="48"
  ["mipmap-hdpi"]="72"
  ["mipmap-xhdpi"]="96"
  ["mipmap-xxhdpi"]="144"
  ["mipmap-xxxhdpi"]="192"
)

# Function to create a simple colored square PNG
create_placeholder_png() {
  local output_file="$1"
  local size="$2"
  
  # Create a simple text-based approach using built-in tools
  # This creates a blue square with white "A" text
  cat > temp_svg.svg << EOF
<svg width="$size" height="$size" xmlns="http://www.w3.org/2000/svg">
  <rect width="$size" height="$size" fill="#2196F3"/>
  <text x="$(($size/2))" y="$(($size*3/5))" font-family="Arial" font-size="$(($size*2/5))" 
        font-weight="bold" text-anchor="middle" fill="white">A</text>
  <circle cx="$(($size*2/5))" cy="$(($size*4/5))" r="$(($size/40))" fill="#FF4081"/>
  <circle cx="$(($size/2))" cy="$(($size*4/5))" r="$(($size/40))" fill="#FF4081"/>
  <circle cx="$(($size*3/5))" cy="$(($size*4/5))" r="$(($size/40))" fill="#FF4081"/>
</svg>
EOF

  # Convert SVG to PNG (if available tools)
  if command -v rsvg-convert &> /dev/null; then
    rsvg-convert -w $size -h $size temp_svg.svg -o "$output_file"
  elif command -v inkscape &> /dev/null; then
    inkscape -w $size -h $size temp_svg.svg --export-filename="$output_file"
  else
    # Fallback: create a simple placeholder file
    echo "Warning: No SVG converter available. Creating placeholder."
    cp temp_svg.svg "$output_file.svg"
  fi
  
  rm -f temp_svg.svg
}

# Generate iOS icons
echo "Generating iOS icons..."
for filename in "\${!ios_sizes[@]}"; do
  size="\${ios_sizes[$filename]}"
  output_path="ios/hitchmobile/Images.xcassets/AppIcon.appiconset/$filename"
  create_placeholder_png "$output_path" "$size"
  echo "Created: $filename ($size x $size)"
done

# Generate Android icons
echo "Generating Android icons..."
for folder in "\${!android_sizes[@]}"; do
  size="\${android_sizes[$folder]}"
  output_path="android/app/src/main/res/$folder/ic_launcher.png"
  create_placeholder_png "$output_path" "$size"
  echo "Created: $folder/ic_launcher.png ($size x $size)"
done

# Generate Play Store icon
echo "Generating Play Store icon..."
create_placeholder_png "android/app/src/main/play-store-assets/ic_launcher-play-store.png" "512"

echo "✅ Icon generation completed!"
echo "Note: These are placeholder icons. Replace with professional designs before app store submission."
`;

  fs.writeFileSync('scripts/generate-png-icons.sh', script);
  console.log('✅ Created PNG generation script');
}

function main() {
  console.log('🎨 ARYV App Icon Generator');
  console.log('=' * 40);

  try {
    // Create directories
    createDirectories();

    // Create master SVG icon
    const svgIcon = createSVGIcon();
    fs.writeFileSync('assets/icons/master-icon.svg', svgIcon);
    console.log('✅ Created master SVG icon');

    // Create iOS configuration
    createContentsJson();

    // Create Android adaptive icons
    createAndroidAdaptiveIcons();

    // Create PNG generation script
    createPngGenerationScript();

    console.log('\n🎉 Icon structure created successfully!');
    console.log('=' * 40);
    console.log('Next steps:');
    console.log('1. Run: chmod +x scripts/generate-png-icons.sh');
    console.log('2. Run: ./scripts/generate-png-icons.sh');
    console.log('3. Test build with new icons');
    console.log('\n✅ Ready for production build preparation!');

  } catch (error) {
    console.error('❌ Error generating icons:', error.message);
    process.exit(1);
  }
}

main();