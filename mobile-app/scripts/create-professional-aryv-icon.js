const fs = require('fs');
const path = require('path');

/**
 * Professional ARYV App Icon Generator
 * Creates sophisticated SVG icons with modern design elements
 */

function createProfessionalARYVIcon(size = 1024) {
  const svg = `
<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Professional gradient background -->
    <radialGradient id="professionalBg" cx="50%" cy="40%" r="60%">
      <stop offset="0%" style="stop-color:#42A5F5;stop-opacity:1" />
      <stop offset="50%" style="stop-color:#2196F3;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1976D2;stop-opacity:1" />
    </radialGradient>
    
    <!-- Modern accent gradient -->
    <linearGradient id="accentGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#FF5722;stop-opacity:0.8" />
      <stop offset="100%" style="stop-color:#FF7043;stop-opacity:0.6" />
    </linearGradient>
    
    <!-- Text shadow filter -->
    <filter id="textShadow" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="4" dy="6" stdDeviation="8" flood-color="#0D47A1" flood-opacity="0.4"/>
      <feDropShadow dx="2" dy="3" stdDeviation="4" flood-color="#0D47A1" flood-opacity="0.3"/>
    </filter>
    
    <!-- Subtle pattern -->
    <pattern id="hexPattern" patternUnits="userSpaceOnUse" width="60" height="52">
      <polygon points="30,8 48,18 48,38 30,48 12,38 12,18" 
               fill="none" stroke="#FFFFFF" stroke-width="1" stroke-opacity="0.1"/>
    </pattern>
    
    <!-- Inner glow -->
    <filter id="innerGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
      <feMerge> 
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  
  <!-- Background circle with professional gradient -->
  <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 32}" fill="url(#professionalBg)"/>
  
  <!-- Subtle geometric pattern overlay -->
  <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 64}" fill="url(#hexPattern)" opacity="0.3"/>
  
  <!-- Main letter "A" with modern typography -->
  <text x="${size/2}" y="${size/2 + size*0.1}" 
        font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
        font-size="${size * 0.45}" 
        font-weight="700"
        text-anchor="middle" 
        fill="#FFFFFF" 
        filter="url(#textShadow)">A</text>
  
  <!-- Modern accent elements -->
  <!-- Top-right arc -->
  <path d="M ${size*0.65} ${size*0.25} A 40 40 0 0 1 ${size*0.75} ${size*0.35}" 
        fill="none" stroke="url(#accentGradient)" stroke-width="8" stroke-linecap="round"/>
  
  <!-- Bottom-left arc -->
  <path d="M ${size*0.25} ${size*0.65} A 30 30 0 0 1 ${size*0.35} ${size*0.75}" 
        fill="none" stroke="#42A5F5" stroke-width="6" stroke-opacity="0.7" stroke-linecap="round"/>
  
  <!-- Right side accent dots -->
  <circle cx="${size*0.7}" cy="${size*0.45}" r="6" fill="url(#accentGradient)" filter="url(#innerGlow)"/>
  <circle cx="${size*0.72}" cy="${size*0.5}" r="8" fill="url(#accentGradient)" filter="url(#innerGlow)"/>
  <circle cx="${size*0.7}" cy="${size*0.55}" r="6" fill="url(#accentGradient)" filter="url(#innerGlow)"/>
  
  <!-- Left side minimal line -->
  <line x1="${size*0.22}" y1="${size*0.42}" x2="${size*0.22}" y2="${size*0.58}" 
        stroke="#42A5F5" stroke-width="4" stroke-opacity="0.6" stroke-linecap="round"/>
  
  <!-- Subtle highlight on letter -->
  <text x="${size/2 - 2}" y="${size/2 + size*0.1 - 2}" 
        font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
        font-size="${size * 0.45}" 
        font-weight="700"
        text-anchor="middle" 
        fill="url(#accentGradient)" 
        opacity="0.3">A</text>
</svg>`;

  return svg;
}

function createiOSContentsJson() {
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
    info: { version: 1, author: 'aryv-professional-icon-generator' }
  };

  return JSON.stringify(contents, null, 2);
}

function createPlayStoreFeatureGraphic() {
  const svg = `
<svg width="1024" height="500" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="featureBg" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#1976D2;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#2196F3;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="1024" height="500" fill="url(#featureBg)"/>
  
  <!-- App icon (embedded smaller version) -->
  <g transform="translate(80, 150)">
    ${createProfessionalARYVIcon(200).replace('<svg width="200" height="200" xmlns="http://www.w3.org/2000/svg">', '').replace('</svg>', '')}
  </g>
  
  <!-- App name and tagline -->
  <text x="320" y="220" font-family="system-ui, -apple-system, sans-serif" 
        font-size="72" font-weight="700" fill="#FFFFFF">ARYV</text>
  <text x="320" y="270" font-family="system-ui, -apple-system, sans-serif" 
        font-size="32" font-weight="400" fill="#FFFFFF" opacity="0.9">Smart Ride Sharing</text>
  <text x="320" y="310" font-family="system-ui, -apple-system, sans-serif" 
        font-size="24" font-weight="300" fill="#FFFFFF" opacity="0.7">AI-Powered • Secure • Efficient</text>
</svg>`;

  return svg;
}

function generateAllIconSizes() {
  console.log('🎨 Creating Professional ARYV App Icons');
  console.log('=' .repeat(50));
  console.log('Generating sophisticated, modern app icons with:');
  console.log('• Professional gradient backgrounds');
  console.log('• Modern typography and design');  
  console.log('• Contemporary accent elements');
  console.log('• Scalable SVG-based graphics');
  console.log();

  // Create directories
  const directories = [
    'assets/icons',
    'assets/app-store',
    'ios/hitchmobile/Images.xcassets/AppIcon.appiconset',
    'android/app/src/main/res/drawable',
    'android/app/src/main/play-store-assets'
  ];

  directories.forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });

  // Generate master SVG icons
  console.log('\n🎯 Creating master professional icons...');
  
  // Master 1024x1024 icon
  const masterIcon = createProfessionalARYVIcon(1024);
  fs.writeFileSync('assets/icons/aryv-professional-master-1024.svg', masterIcon);
  console.log('✅ Master professional icon saved: assets/icons/aryv-professional-master-1024.svg');

  // iOS icon sizes (as SVG for now - can be converted to PNG later)
  const iosSizes = [
    { name: 'Icon-20@2x.svg', size: 40 },
    { name: 'Icon-20@3x.svg', size: 60 },
    { name: 'Icon-29@2x.svg', size: 58 },
    { name: 'Icon-29@3x.svg', size: 87 },
    { name: 'Icon-60@2x.svg', size: 120 },
    { name: 'Icon-60@3x.svg', size: 180 },
    { name: 'Icon-1024.svg', size: 1024 }
  ];

  console.log('\n📱 Generating iOS icon set...');
  iosSizes.forEach(icon => {
    const iconSvg = createProfessionalARYVIcon(icon.size);
    const filePath = `ios/hitchmobile/Images.xcassets/AppIcon.appiconset/${icon.name}`;
    fs.writeFileSync(filePath, iconSvg);
    console.log(`✅ Generated iOS icon: ${icon.name} (${icon.size}x${icon.size})`);
  });

  // Android icon sizes
  const androidSizes = [
    { folder: 'mipmap-ldpi', size: 36 },
    { folder: 'mipmap-mdpi', size: 48 },
    { folder: 'mipmap-hdpi', size: 72 },
    { folder: 'mipmap-xhdpi', size: 96 },
    { folder: 'mipmap-xxhdpi', size: 144 },
    { folder: 'mipmap-xxxhdpi', size: 192 }
  ];

  console.log('\n🤖 Generating Android icon set...');
  androidSizes.forEach(icon => {
    const folderPath = `android/app/src/main/res/${icon.folder}`;
    if (!fs.existsSync(folderPath)) {
      fs.mkdirSync(folderPath, { recursive: true });
    }
    
    const iconSvg = createProfessionalARYVIcon(icon.size);
    fs.writeFileSync(`${folderPath}/ic_launcher.svg`, iconSvg);
    console.log(`✅ Generated Android icon: ${icon.folder}/ic_launcher.svg (${icon.size}x${icon.size})`);
  });

  // Play Store icon
  const playStoreIcon = createProfessionalARYVIcon(512);
  fs.writeFileSync('android/app/src/main/play-store-assets/ic_launcher-play-store.svg', playStoreIcon);
  console.log('✅ Generated Play Store icon: ic_launcher-play-store.svg (512x512)');

  // iOS Contents.json
  const contentsJson = createiOSContentsJson();
  // Update to reference SVG files temporarily
  const updatedContentsJson = contentsJson.replace(/\.png/g, '.svg');
  fs.writeFileSync('ios/hitchmobile/Images.xcassets/AppIcon.appiconset/Contents.json', contentsJson);
  console.log('✅ Created iOS Contents.json');

  // App Store promotional assets
  console.log('\n🏪 Creating app store promotional assets...');
  const featureGraphic = createPlayStoreFeatureGraphic();
  fs.writeFileSync('assets/app-store/play-store-feature-graphic.svg', featureGraphic);
  console.log('✅ Generated Play Store feature graphic (1024x500)');

  // Create icon conversion guide
  const conversionGuide = `# ARYV Professional Icon Conversion Guide

## SVG to PNG Conversion

The professional ARYV icons have been generated as high-quality SVG files. To convert them to PNG format required by iOS and Android:

### Option 1: Online Conversion Tools
1. Visit: https://convertio.co/svg-png/ or https://svg2png.com/
2. Upload each SVG file
3. Download as PNG with the same filename (change .svg to .png)

### Option 2: Command Line (if available)
\`\`\`bash
# Using ImageMagick (if installed)
convert icon.svg icon.png

# Using Inkscape (if installed)  
inkscape icon.svg --export-filename=icon.png
\`\`\`

### Option 3: Design Software
1. Open SVG files in Adobe Illustrator, Figma, or Sketch
2. Export as PNG at the required dimensions
3. Save with original filenames (change .svg to .png)

## Files to Convert

### iOS Icons (ios/hitchmobile/Images.xcassets/AppIcon.appiconset/)
- Icon-20@2x.svg → Icon-20@2x.png
- Icon-20@3x.svg → Icon-20@3x.png  
- Icon-29@2x.svg → Icon-29@2x.png
- Icon-29@3x.svg → Icon-29@3x.png
- Icon-60@2x.svg → Icon-60@2x.png
- Icon-60@3x.svg → Icon-60@3x.png
- Icon-1024.svg → Icon-1024.png

### Android Icons (android/app/src/main/res/)
- mipmap-*/ic_launcher.svg → mipmap-*/ic_launcher.png
- play-store-assets/ic_launcher-play-store.svg → ic_launcher-play-store.png

### After Conversion
1. Update Contents.json to reference .png files instead of .svg
2. Delete the .svg files if desired
3. Test build to ensure icons display correctly

The SVG files provide crisp, scalable graphics that will convert to high-quality PNG files at any resolution.
`;

  fs.writeFileSync('assets/icons/CONVERSION_GUIDE.md', conversionGuide);
  console.log('✅ Created SVG to PNG conversion guide');

  console.log('\n🎉 Professional ARYV Icons Generated Successfully!');
  console.log('=' .repeat(50));
  console.log('✅ iOS Icons: All 7 required sizes with professional design');
  console.log('✅ Android Icons: All 6 densities with modern aesthetics'); 
  console.log('✅ Play Store: Feature graphics and promotional assets');
  console.log('✅ Quality: Professional SVG-based scalable graphics');
  console.log('✅ Conversion: Guide provided for SVG to PNG conversion');
  console.log();
  console.log('📁 Icon Locations:');
  console.log('• Master: assets/icons/aryv-professional-master-1024.svg');
  console.log('• iOS: ios/hitchmobile/Images.xcassets/AppIcon.appiconset/');
  console.log('• Android: android/app/src/main/res/mipmap-*/');
  console.log('• Play Store: android/app/src/main/play-store-assets/');
  console.log('• Marketing: assets/app-store/');
  console.log();
  console.log('⚠️  Next Step: Convert SVG files to PNG format using the conversion guide');
  console.log('🚀 Then ready for professional app store submission!');
}

// Run the generator
generateAllIconSizes();