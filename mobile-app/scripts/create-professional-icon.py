#!/usr/bin/env python3
"""
ARYV Professional App Icon Generator
Creates a sophisticated, modern app icon with professional design elements
"""

from PIL import Image, ImageDraw, ImageFont, ImageFilter
import os
import math

def create_professional_aryv_icon():
    """Create a professional ARYV app icon with modern design elements"""
    size = 1024
    image = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)
    
    # Professional brand colors
    primary_blue = "#1976D2"     # Deeper blue
    accent_blue = "#2196F3"      # Bright blue  
    highlight_blue = "#42A5F5"   # Light blue
    accent_orange = "#FF5722"    # Modern orange accent
    white = "#FFFFFF"
    shadow = "#0D47A1"           # Dark blue shadow
    
    center_x, center_y = size // 2, size // 2
    
    # Create modern gradient background with depth
    create_modern_background(draw, size, primary_blue, accent_blue, highlight_blue)
    
    # Add subtle geometric pattern
    add_geometric_pattern(draw, size, highlight_blue)
    
    # Create main "A" letterform with modern typography
    create_modern_letterform(draw, size, center_x, center_y, white, shadow, accent_orange)
    
    # Add modern accent elements
    add_modern_accents(draw, center_x, center_y, accent_orange, highlight_blue)
    
    return image

def create_modern_background(draw, size, primary, accent, highlight):
    """Create a sophisticated gradient background with depth"""
    # Create radial gradient with multiple layers
    for radius in range(size//2, 0, -2):
        # Calculate gradient progression
        progress = radius / (size//2)
        
        # Multi-stop gradient
        if progress > 0.7:
            # Outer edge - darker
            color = hex_to_rgb(primary)
        elif progress > 0.4:
            # Mid section - blend
            color = blend_colors(hex_to_rgb(primary), hex_to_rgb(accent), (0.7 - progress) / 0.3)
        else:
            # Center - lighter
            color = blend_colors(hex_to_rgb(accent), hex_to_rgb(highlight), (0.4 - progress) / 0.4)
        
        # Add transparency for depth
        alpha = int(255 * (0.7 + 0.3 * progress))
        color_with_alpha = color + (alpha,)
        
        # Draw concentric circles for gradient effect
        bbox = [size//2 - radius, size//2 - radius, size//2 + radius, size//2 + radius]
        draw.ellipse(bbox, fill=color_with_alpha)

def add_geometric_pattern(draw, size, highlight_color):
    """Add subtle geometric pattern for modern look"""
    color = hex_to_rgb(highlight_color)
    pattern_color = color + (30,)  # Very subtle
    
    # Create subtle hexagonal pattern
    for x in range(0, size + 100, 60):
        for y in range(0, size + 100, 52):
            # Offset every other row
            offset_x = 30 if (y // 52) % 2 else 0
            hex_x = x + offset_x - 50
            hex_y = y - 50
            
            # Only draw if within bounds and not in center
            dist_from_center = math.sqrt((hex_x - size//2)**2 + (hex_y - size//2)**2)
            if 150 < dist_from_center < size//2 - 50:
                draw_hexagon(draw, hex_x, hex_y, 15, pattern_color)

def draw_hexagon(draw, x, y, radius, color):
    """Draw a hexagon at specified position"""
    points = []
    for i in range(6):
        angle = i * math.pi / 3
        px = x + radius * math.cos(angle)
        py = y + radius * math.sin(angle)
        points.append((px, py))
    
    if len(points) >= 3:
        draw.polygon(points, outline=color, width=1)

def create_modern_letterform(draw, size, center_x, center_y, white, shadow, accent):
    """Create a modern, sophisticated 'A' letterform"""
    # Try to use modern font
    try:
        font_size = size // 3
        # Try different modern fonts
        font_paths = [
            "/System/Library/Fonts/SF-Pro-Display-Bold.otf",  # macOS
            "/System/Library/Fonts/Helvetica-Bold.ttc",       # macOS fallback
            "C:/Windows/Fonts/segoeui.ttf",                   # Windows
            "/usr/share/fonts/truetype/dejavu/DejaVu-Sans-Bold.ttf",  # Linux
        ]
        
        font = None
        for font_path in font_paths:
            try:
                font = ImageFont.truetype(font_path, font_size)
                break
            except (IOError, OSError):
                continue
                
        if font is None:
            font = ImageFont.load_default()
            font_size = size // 4
            
    except Exception:
        font = ImageFont.load_default()
        font_size = size // 4
    
    text = "A"
    
    # Get text dimensions
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    text_x = center_x - text_width // 2
    text_y = center_y - text_height // 2
    
    # Create layered text effect for depth
    shadow_layers = [
        (6, hex_to_rgb(shadow) + (150,)),     # Deep shadow
        (4, hex_to_rgb(shadow) + (100,)),     # Mid shadow
        (2, hex_to_rgb(shadow) + (50,)),      # Light shadow
    ]
    
    # Draw shadow layers
    for offset, color in shadow_layers:
        draw.text((text_x + offset, text_y + offset), text, fill=color, font=font)
    
    # Draw main text with subtle inner shadow
    draw.text((text_x, text_y), text, fill=hex_to_rgb(white), font=font)
    
    # Add accent highlight
    accent_color = hex_to_rgb(accent) + (180,)
    draw.text((text_x - 1, text_y - 1), text, fill=accent_color, font=font)

def add_modern_accents(draw, center_x, center_y, accent_orange, highlight_blue):
    """Add modern accent elements around the letter"""
    orange = hex_to_rgb(accent_orange)
    blue = hex_to_rgb(highlight_blue)
    
    # Modern geometric accents
    accents = [
        # Top right arc
        {
            'type': 'arc',
            'bbox': [center_x + 80, center_y - 120, center_x + 140, center_y - 60],
            'start': 180, 'end': 270,
            'color': orange + (200,), 'width': 8
        },
        # Bottom left arc  
        {
            'type': 'arc',
            'bbox': [center_x - 140, center_y + 60, center_x - 80, center_y + 120],
            'start': 0, 'end': 90,
            'color': blue + (150,), 'width': 6
        },
        # Right side dots
        {
            'type': 'dots',
            'positions': [
                (center_x + 100, center_y - 30),
                (center_x + 110, center_y),
                (center_x + 100, center_y + 30)
            ],
            'color': orange + (180,), 'radius': 8
        },
        # Left side minimal line
        {
            'type': 'line',
            'start': (center_x - 120, center_y - 40),
            'end': (center_x - 120, center_y + 40),
            'color': blue + (120,), 'width': 4
        }
    ]
    
    for accent in accents:
        if accent['type'] == 'arc':
            draw.arc(accent['bbox'], accent['start'], accent['end'], 
                    fill=accent['color'], width=accent['width'])
        elif accent['type'] == 'dots':
            for pos in accent['positions']:
                x, y = pos
                r = accent['radius']
                draw.ellipse([x-r, y-r, x+r, y+r], fill=accent['color'])
        elif accent['type'] == 'line':
            draw.line([accent['start'], accent['end']], 
                     fill=accent['color'], width=accent['width'])

def hex_to_rgb(hex_color):
    """Convert hex color to RGB tuple"""
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def blend_colors(color1, color2, ratio):
    """Blend two RGB colors with given ratio"""
    return tuple(int(c1 + (c2 - c1) * ratio) for c1, c2 in zip(color1, color2))

def generate_ios_icons(master_image):
    """Generate all iOS icon sizes from master image"""
    ios_sizes = {
        "Icon-20@2x.png": 40,
        "Icon-20@3x.png": 60,
        "Icon-29@2x.png": 58,
        "Icon-29@3x.png": 87,
        "Icon-60@2x.png": 120,
        "Icon-60@3x.png": 180,
        "Icon-1024.png": 1024
    }
    
    ios_path = "ios/hitchmobile/Images.xcassets/AppIcon.appiconset"
    os.makedirs(ios_path, exist_ok=True)
    
    for filename, icon_size in ios_sizes.items():
        # High-quality resize using Lanczos algorithm
        resized = master_image.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
        
        # Apply subtle sharpening for smaller sizes
        if icon_size < 120:
            resized = resized.filter(ImageFilter.UnsharpMask(radius=0.5, percent=120))
        
        resized.save(f"{ios_path}/{filename}", "PNG", optimize=True, quality=95)
        print(f"✅ Generated iOS icon: {filename} ({icon_size}x{icon_size})")

def generate_android_icons(master_image):
    """Generate all Android icon sizes from master image"""
    android_sizes = [
        ("mipmap-ldpi", 36),
        ("mipmap-mdpi", 48),
        ("mipmap-hdpi", 72),
        ("mipmap-xhdpi", 96),
        ("mipmap-xxhdpi", 144),
        ("mipmap-xxxhdpi", 192)
    ]
    
    for folder, icon_size in android_sizes:
        folder_path = f"android/app/src/main/res/{folder}"
        os.makedirs(folder_path, exist_ok=True)
        
        # High-quality resize
        resized = master_image.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
        
        # Apply subtle sharpening for smaller sizes  
        if icon_size < 96:
            resized = resized.filter(ImageFilter.UnsharpMask(radius=0.5, percent=120))
        
        resized.save(f"{folder_path}/ic_launcher.png", "PNG", optimize=True, quality=95)
        print(f"✅ Generated Android icon: {folder}/ic_launcher.png ({icon_size}x{icon_size})")
    
    # Generate Play Store icon (512x512)
    play_store = master_image.resize((512, 512), Image.Resampling.LANCZOS)
    os.makedirs("android/app/src/main/play-store-assets", exist_ok=True)
    play_store.save("android/app/src/main/play-store-assets/ic_launcher-play-store.png", 
                   "PNG", optimize=True, quality=95)
    print("✅ Generated Play Store icon: ic_launcher-play-store.png (512x512)")

def create_app_store_assets(master_image):
    """Create additional app store promotional assets"""
    assets_dir = "assets/app-store"
    os.makedirs(assets_dir, exist_ok=True)
    
    # Create feature graphic for Play Store (1024x500)
    feature_graphic = Image.new('RGBA', (1024, 500), hex_to_rgb("#1976D2"))
    draw = ImageDraw.Draw(feature_graphic)
    
    # Add icon to feature graphic
    icon_for_feature = master_image.resize((200, 200), Image.Resampling.LANCZOS)
    feature_graphic.paste(icon_for_feature, (100, 150), icon_for_feature)
    
    # Add app name
    try:
        font = ImageFont.truetype("arial.ttf", 72)
    except:
        font = ImageFont.load_default()
    
    draw.text((350, 200), "ARYV", fill=(255, 255, 255), font=font)
    draw.text((350, 280), "Smart Ride Sharing", fill=(255, 255, 255, 180), font=ImageFont.load_default())
    
    feature_graphic.save(f"{assets_dir}/play-store-feature-graphic.png", "PNG", optimize=True)
    print("✅ Generated Play Store feature graphic (1024x500)")
    
    # Save high-res master for other marketing materials
    master_image.save(f"{assets_dir}/aryv-icon-master-1024.png", "PNG", optimize=True, quality=100)
    print("✅ Saved master icon for marketing (1024x1024)")

def main():
    print("🎨 Creating Professional ARYV App Icons")
    print("=" * 50)
    print("Generating sophisticated, modern app icon with:")
    print("• Professional gradient background")
    print("• Modern typography and letterforms")  
    print("• Subtle geometric patterns")
    print("• Layered depth and shadows")
    print("• Contemporary accent elements")
    print()
    
    # Create master professional icon
    print("🎯 Creating master 1024x1024 professional icon...")
    master_image = create_professional_aryv_icon()
    
    # Save master icon
    os.makedirs("assets/icons", exist_ok=True)
    master_image.save("assets/icons/aryv-professional-master-1024.png", "PNG", optimize=True, quality=100)
    print("✅ Master professional icon saved: assets/icons/aryv-professional-master-1024.png")
    print()
    
    # Generate iOS icons
    print("📱 Generating iOS icon set...")
    generate_ios_icons(master_image)
    print()
    
    # Generate Android icons
    print("🤖 Generating Android icon set...")
    generate_android_icons(master_image)
    print()
    
    # Create app store assets
    print("🏪 Creating app store promotional assets...")
    create_app_store_assets(master_image)
    print()
    
    print("🎉 Professional ARYV Icons Generated Successfully!")
    print("=" * 50)
    print("✅ iOS Icons: All 7 required sizes with high-quality scaling")
    print("✅ Android Icons: All 6 densities with optimized rendering") 
    print("✅ Play Store: 512x512 store icon ready")
    print("✅ Marketing: Feature graphics and promotional assets")
    print("✅ Quality: Professional design with modern aesthetics")
    print()
    print("📁 Icon Locations:")
    print("• iOS: ios/hitchmobile/Images.xcassets/AppIcon.appiconset/")
    print("• Android: android/app/src/main/res/mipmap-*/")
    print("• Play Store: android/app/src/main/play-store-assets/")
    print("• Marketing: assets/app-store/")
    print("• Master: assets/icons/aryv-professional-master-1024.png")
    print()
    print("🚀 Ready for professional app store submission!")

if __name__ == "__main__":
    main()