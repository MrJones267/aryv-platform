#!/usr/bin/env node
/**
 * @fileoverview Generates every Android launcher icon and Play Store graphic
 *               from the SVG masters in assets/.
 * @author Oabona-Majoko
 * @created 2026-08-22
 * @lastModified 2026-08-22
 *
 * Replaces the previous state, where all six mipmap density buckets held the
 * same 1024x1024 PNG, ic_launcher_round was a square image, and there was no
 * adaptive icon at all — so launchers on Android 8+ masked and cropped the
 * legacy bitmap unpredictably.
 *
 * Run: node scripts/generate-play-assets.js
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const MASTER_ICON = path.join(ROOT, 'assets/icons/aryv-professional-master-1024.svg');
const MASTER_FEATURE = path.join(ROOT, 'assets/app-store/play-store-feature-graphic.svg');
const RES = path.join(ROOT, 'android/app/src/main/res');
const STORE_OUT = path.join(ROOT, 'assets/app-store/generated');

// Android launcher icon sizes, in dp * density.
const LEGACY_DENSITIES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

// Adaptive icon foregrounds are 108dp, of which only the centre 72dp is
// guaranteed visible — the rest is reserved for the launcher's mask and
// parallax. The master art is scaled to that safe zone and padded out.
const ADAPTIVE_DENSITIES = {
  'mipmap-mdpi': 108,
  'mipmap-hdpi': 162,
  'mipmap-xhdpi': 216,
  'mipmap-xxhdpi': 324,
  'mipmap-xxxhdpi': 432,
};

const SAFE_ZONE_RATIO = 72 / 108;
const BACKGROUND_COLOR = '#1976D2'; // Matches the master's darkest gradient stop.

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });

/** Square PNG at an exact pixel size, rendered from the SVG at that density. */
async function renderSquare(size, outPath) {
  await sharp(MASTER_ICON, { density: 400 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

/** Circular mask for ic_launcher_round, which must actually be round. */
async function renderRound(size, outPath) {
  const r = size / 2;
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${r}" cy="${r}" r="${r}" fill="#fff"/></svg>`
  );

  const square = await sharp(MASTER_ICON, { density: 400 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp(square)
    .composite([{ input: mask, blend: 'dest-in' }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

/**
 * Themed ("monochrome") icons take only the alpha channel of the drawable they
 * point at. Reusing the colour foreground would hand Android a fully opaque
 * disc, so the whole icon would theme as a solid blob with no letter in it.
 * This renders the glyph alone on transparency instead.
 */
const MONOCHROME_SVG = (size) => Buffer.from(
  `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
     <text x="${size / 2}" y="${size * 0.74}"
           font-family="system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif"
           font-size="${size * 0.68}" font-weight="700"
           text-anchor="middle" fill="#000000">A</text>
   </svg>`
);

async function renderMonochrome(size, outPath) {
  // The explicit resize is load-bearing: `density` rasterises the SVG at
  // 400/72 the nominal size, so without it every monochrome layer came out at
  // 2400x2400 regardless of which density bucket it was written to.
  await sharp(MONOCHROME_SVG(size), { density: 400 })
    .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

/** Adaptive foreground: art confined to the 72/108 safe zone, transparent around it. */
async function renderAdaptiveForeground(size, outPath) {
  const art = Math.round(size * SAFE_ZONE_RATIO);
  const pad = Math.round((size - art) / 2);

  const scaled = await sharp(MASTER_ICON, { density: 400 })
    .resize(art, art, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: scaled, top: pad, left: pad }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

async function main() {
  if (!fs.existsSync(MASTER_ICON)) {
    throw new Error(`Master icon not found: ${MASTER_ICON}`);
  }

  // ── Legacy + round launcher icons, correctly sized per density ────────────
  for (const [dir, size] of Object.entries(LEGACY_DENSITIES)) {
    const target = path.join(RES, dir);
    ensureDir(target);
    await renderSquare(size, path.join(target, 'ic_launcher.png'));
    await renderRound(size, path.join(target, 'ic_launcher_round.png'));
    console.log(`  ${dir}/ic_launcher.png             ${size}x${size}`);
    console.log(`  ${dir}/ic_launcher_round.png       ${size}x${size} (masked)`);
  }

  // ── Adaptive icon foregrounds ─────────────────────────────────────────────
  for (const [dir, size] of Object.entries(ADAPTIVE_DENSITIES)) {
    const target = path.join(RES, dir);
    ensureDir(target);
    await renderAdaptiveForeground(size, path.join(target, 'ic_launcher_foreground.png'));
    await renderMonochrome(size, path.join(target, 'ic_launcher_monochrome.png'));
    console.log(`  ${dir}/ic_launcher_foreground.png  ${size}x${size}`);
    console.log(`  ${dir}/ic_launcher_monochrome.png  ${size}x${size}`);
  }

  // ── Adaptive icon declarations and background colour ──────────────────────
  const anydpi = path.join(RES, 'mipmap-anydpi-v26');
  ensureDir(anydpi);

  const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
    <monochrome android:drawable="@mipmap/ic_launcher_monochrome" />
</adaptive-icon>
`;
  fs.writeFileSync(path.join(anydpi, 'ic_launcher.xml'), adaptiveXml);
  fs.writeFileSync(path.join(anydpi, 'ic_launcher_round.xml'), adaptiveXml);
  console.log('  mipmap-anydpi-v26/ic_launcher.xml       (adaptive + monochrome)');
  console.log('  mipmap-anydpi-v26/ic_launcher_round.xml');

  const valuesDir = path.join(RES, 'values');
  ensureDir(valuesDir);
  fs.writeFileSync(
    path.join(valuesDir, 'ic_launcher_background.xml'),
    `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">${BACKGROUND_COLOR}</color>
</resources>
`
  );
  console.log(`  values/ic_launcher_background.xml       ${BACKGROUND_COLOR}`);

  // ── Play Store listing graphics ───────────────────────────────────────────
  ensureDir(STORE_OUT);

  // Play requires a 512x512 32-bit PNG with no transparency.
  await sharp(MASTER_ICON, { density: 400 })
    .resize(512, 512, { fit: 'contain', background: BACKGROUND_COLOR })
    .flatten({ background: BACKGROUND_COLOR })
    .png({ compressionLevel: 9 })
    .toFile(path.join(STORE_OUT, 'play-store-icon-512.png'));
  console.log('  assets/app-store/generated/play-store-icon-512.png   512x512');

  if (fs.existsSync(MASTER_FEATURE)) {
    await sharp(MASTER_FEATURE, { density: 400 })
      .resize(1024, 500, { fit: 'cover' })
      .flatten({ background: BACKGROUND_COLOR })
      .png({ compressionLevel: 9 })
      .toFile(path.join(STORE_OUT, 'play-store-feature-graphic-1024x500.png'));
    console.log('  assets/app-store/generated/play-store-feature-graphic-1024x500.png   1024x500');
  } else {
    console.warn(`  ! Feature graphic master missing: ${MASTER_FEATURE}`);
  }
}

main()
  .then(() => console.log('\nDone.'))
  .catch((error) => {
    console.error(`\nAsset generation failed: ${error.message}`);
    process.exit(1);
  });
