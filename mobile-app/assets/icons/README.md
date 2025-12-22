# Hitch App Icons and Assets

## App Icon Requirements

### iOS Icons Required:
- **App Store Icon**: 1024x1024px (iTunesArtwork@2x.png)
- **iPhone Icons**:
  - Icon-60@2x.png (120x120px) - iPhone 6s, 7, 8, SE
  - Icon-60@3x.png (180x180px) - iPhone 6s Plus, 7 Plus, 8 Plus, X, XS, 11 Pro, 12, 13, 14
- **Settings Icons**:
  - Icon-29@2x.png (58x58px)
  - Icon-29@3x.png (87x87px)
- **Notification Icons**:
  - Icon-20@2x.png (40x40px)
  - Icon-20@3x.png (60x60px)

### Android Icons Required:
- **Launcher Icons**:
  - ic_launcher.png (48x48dp - multiple densities)
  - mdpi: 48x48px
  - hdpi: 72x72px
  - xhdpi: 96x96px
  - xxhdpi: 144x144px
  - xxxhdpi: 192x192px
- **Adaptive Icons** (API 26+):
  - ic_launcher_foreground.xml
  - ic_launcher_background.xml
  - ic_launcher_round.xml

## Splash Screen Requirements

### iOS Splash Screens:
- LaunchScreen.storyboard (preferred)
- Launch images for different screen sizes

### Android Splash Screens:
- splash_screen.xml drawable
- Different densities for compatibility

## Design Guidelines

### Brand Colors:
- Primary: #2196F3 (Blue)
- Secondary: #FF4081 (Pink)
- Background: #FFFFFF (White)
- Text: #212121 (Dark Gray)

### Icon Design:
- Use simple, recognizable Hitch logo
- Ensure readability at small sizes
- Follow platform design guidelines
- Use vector graphics when possible

## Production Checklist:
- [ ] All icon sizes generated
- [ ] Icons optimized for file size
- [ ] Splash screens created
- [ ] Assets integrated in build process
- [ ] Icons tested on different devices
- [ ] App store assets prepared

## Tools for Icon Generation:
- Adobe Illustrator/Photoshop
- Figma
- Sketch
- Online tools like appicon.co
- Xcode Asset Catalog
- Android Studio Image Asset Studio