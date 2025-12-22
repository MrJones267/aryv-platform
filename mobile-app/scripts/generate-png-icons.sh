#!/bin/bash

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
for filename in "${!ios_sizes[@]}"; do
  size="${ios_sizes[$filename]}"
  output_path="ios/hitchmobile/Images.xcassets/AppIcon.appiconset/$filename"
  create_placeholder_png "$output_path" "$size"
  echo "Created: $filename ($size x $size)"
done

# Generate Android icons
echo "Generating Android icons..."
for folder in "${!android_sizes[@]}"; do
  size="${android_sizes[$folder]}"
  output_path="android/app/src/main/res/$folder/ic_launcher.png"
  create_placeholder_png "$output_path" "$size"
  echo "Created: $folder/ic_launcher.png ($size x $size)"
done

# Generate Play Store icon
echo "Generating Play Store icon..."
create_placeholder_png "android/app/src/main/play-store-assets/ic_launcher-play-store.png" "512"

echo "✅ Icon generation completed!"
echo "Note: These are placeholder icons. Replace with professional designs before app store submission."
