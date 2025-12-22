#!/usr/bin/env python3
"""
ARYV App Icon Generator
Creates a professional app icon with the brand colors and generates all required sizes
"""

from PIL import Image, ImageDraw, ImageFont
import os
import subprocess

def create_master_icon():
    """Create the master 1024x1024 icon"""
    size = 1024
    image = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    
    # Brand colors
    primary_color = "#2196F3"  # Blue
    accent_color = "#FF4081"   # Pink
    white = "#FFFFFF"
    
    # Create gradient background
    for y in range(size):
        # Create a subtle gradient from primary to slightly darker
        ratio = y / size
        r = int(33 + (255 - 33) * (1 - ratio * 0.2))  # 33 = hex 21
        g = int(150 + (255 - 150) * (1 - ratio * 0.2)) # 150 = hex 96
        b = int(243 + (255 - 243) * (1 - ratio * 0.2)) # 243 = hex F3
        
        color = (r, g, b, 255)
        draw.line([(0, y), (size, y)], fill=color)
    
    # Create rounded rectangle background
    corner_radius = size // 8
    background_rect = [corner_radius, corner_radius, size - corner_radius, size - corner_radius]
    
    # Draw main icon elements
    center_x, center_y = size // 2, size // 2
    
    # Draw the letter "H" for ARYV
    try:
        # Try to use a system font
        font_size = size // 3
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
    except (IOError, OSError):
        try:
            # Fallback for Linux/Windows
            font = ImageFont.truetype("arial.ttf", font_size)
        except (IOError, OSError):
            # Use default font
            font = ImageFont.load_default()
            font_size = size // 4
    
    # Draw letter "A" for ARYV
    text = "A"
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    text_x = center_x - text_width // 2
    text_y = center_y - text_height // 2
    
    # Add text shadow for depth
    shadow_offset = 4
    draw.text((text_x + shadow_offset, text_y + shadow_offset), text, 
              fill=(0, 0, 0, 80), font=font)
    
    # Draw main text
    draw.text((text_x, text_y), text, fill=white, font=font)
    
    # Add small accent element - road/path symbol
    accent_size = size // 12
    accent_y = center_y + text_height // 2 + accent_size
    
    # Draw simple road dots
    dot_color = tuple(int(accent_color[i:i+2], 16) for i in (1, 3, 5)) + (255,)
    for i in range(3):
        dot_x = center_x - accent_size + (i * accent_size)
        draw.ellipse([dot_x - 8, accent_y - 8, dot_x + 8, accent_y + 8], fill=dot_color)
    
    return image

def generate_ios_icons(master_image):
    """Generate all iOS icon sizes"""
    ios_sizes = {
        "Icon-20@2x.png": 40,
        "Icon-20@3x.png": 60,
        "Icon-29@2x.png": 58,
        "Icon-29@3x.png": 87,
        "Icon-60@2x.png": 120,
        "Icon-60@3x.png": 180,
        "Icon-1024.png": 1024
    }
    
    ios_path = "ios/ARYVMobile/Images.xcassets/AppIcon.appiconset"
    os.makedirs(ios_path, exist_ok=True)
    
    for filename, size in ios_sizes.items():
        resized = master_image.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(f"{ios_path}/{filename}")
        print(f"Generated iOS icon: {filename} ({size}x{size})")

def generate_android_icons(master_image):
    """Generate all Android icon sizes"""
    android_sizes = [
        ("mipmap-ldpi", 36),
        ("mipmap-mdpi", 48),
        ("mipmap-hdpi", 72),
        ("mipmap-xhdpi", 96),
        ("mipmap-xxhdpi", 144),
        ("mipmap-xxxhdpi", 192)
    ]
    
    for folder, size in android_sizes:
        folder_path = f"android/app/src/main/res/{folder}"
        os.makedirs(folder_path, exist_ok=True)
        
        resized = master_image.resize((size, size), Image.Resampling.LANCZOS)
        resized.save(f"{folder_path}/ic_launcher.png")
        print(f"Generated Android icon: {folder}/ic_launcher.png ({size}x{size})")
    
    # Generate Play Store icon (512x512)
    play_store = master_image.resize((512, 512), Image.Resampling.LANCZOS)
    os.makedirs("android/app/src/main/play-store-assets", exist_ok=True)
    play_store.save("android/app/src/main/play-store-assets/ic_launcher-play-store.png")
    print("Generated Play Store icon: ic_launcher-play-store.png (512x512)")

def create_contents_json():
    """Create iOS Contents.json for AppIcon.appiconset"""
    contents = {
        "images": [
            {"size": "20x20", "idiom": "iphone", "filename": "Icon-20@2x.png", "scale": "2x"},
            {"size": "20x20", "idiom": "iphone", "filename": "Icon-20@3x.png", "scale": "3x"},
            {"size": "29x29", "idiom": "iphone", "filename": "Icon-29@2x.png", "scale": "2x"},
            {"size": "29x29", "idiom": "iphone", "filename": "Icon-29@3x.png", "scale": "3x"},
            {"size": "60x60", "idiom": "iphone", "filename": "Icon-60@2x.png", "scale": "2x"},
            {"size": "60x60", "idiom": "iphone", "filename": "Icon-60@3x.png", "scale": "3x"},
            {"size": "1024x1024", "idiom": "ios-marketing", "filename": "Icon-1024.png", "scale": "1x"}
        ],
        "info": {"version": 1, "author": "hitch-icon-generator"}
    }
    
    import json
    contents_path = "ios/ARYVMobile/Images.xcassets/AppIcon.appiconset/Contents.json"
    with open(contents_path, 'w') as f:
        json.dump(contents, f, indent=2)
    print("Generated iOS Contents.json")

def main():
    print("🎨 Generating ARYV App Icons...")
    print("=" * 40)
    
    # Create master icon
    print("Creating master 1024x1024 icon...")
    master_image = create_master_icon()
    
    # Save master icon
    os.makedirs("assets/icons", exist_ok=True)
    master_image.save("assets/icons/master-icon-1024.png")
    print("✅ Master icon saved: assets/icons/master-icon-1024.png")
    
    # Generate iOS icons
    print("\nGenerating iOS icons...")
    generate_ios_icons(master_image)
    create_contents_json()
    
    # Generate Android icons  
    print("\nGenerating Android icons...")
    generate_android_icons(master_image)
    
    print("\n🎉 All app icons generated successfully!")
    print("=" * 40)
    print("iOS Icons: ios/ARYVMobile/Images.xcassets/AppIcon.appiconset/")
    print("Android Icons: android/app/src/main/res/mipmap-*/")
    print("Play Store: android/app/src/main/play-store-assets/")
    print("Master: assets/icons/master-icon-1024.png")
    print("\n✅ Ready for production build!")

if __name__ == "__main__":
    main()