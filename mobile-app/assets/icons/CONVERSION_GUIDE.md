# ARYV Professional Icon Conversion Guide

## SVG to PNG Conversion

The professional ARYV icons have been generated as high-quality SVG files. To convert them to PNG format required by iOS and Android:

### Option 1: Online Conversion Tools
1. Visit: https://convertio.co/svg-png/ or https://svg2png.com/
2. Upload each SVG file
3. Download as PNG with the same filename (change .svg to .png)

### Option 2: Command Line (if available)
```bash
# Using ImageMagick (if installed)
convert icon.svg icon.png

# Using Inkscape (if installed)  
inkscape icon.svg --export-filename=icon.png
```

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
