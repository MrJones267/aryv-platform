#!/usr/bin/env node
/**
 * @fileoverview Generates every Android launcher icon and Play Store graphic
 *               from the ARYV logo in assets/icons/aryv-logo-full.png.
 * @author Oabona-Majoko
 * @created 2026-08-22
 * @lastModified 2026-11-03
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
// The ARYV logo: the teal-to-purple arrow above the word "ARYV", on white.
// The launcher icon is the arrow alone; the word is unreadable at 48px.
//
// This used to render aryv-professional-master-1024.svg, an old placeholder
// (a white "A" on a blue disc), which replaced the real logo on every build
// from 2026-08-22 on.
const MASTER_LOGO = path.join(ROOT, 'assets/icons/aryv-logo-full.png');
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
// parallax. The arrow is fitted well inside that, since masks are often round.
const ADAPTIVE_DENSITIES = {
  'mipmap-mdpi': 108,
  'mipmap-hdpi': 162,
  'mipmap-xhdpi': 216,
  'mipmap-xxhdpi': 324,
  'mipmap-xxxhdpi': 432,
};

const ADAPTIVE_ART_RATIO = 0.52; // of 108dp: inside the 72dp safe zone, clear of a circle mask
const LEGACY_ART_RATIO = 0.62;   // of the square legacy icon
const BACKGROUND_COLOR = '#FFFFFF'; // The logo's own background.

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });

/**
 * The arrow on transparency, as a square PNG buffer.
 *
 * The logo is drawn on white, so transparency is recovered from how far each
 * pixel is from white, and the colour is un-blended from the white behind
 * it. That keeps the anti-aliased edge instead of leaving a white fringe.
 */
let markCache = null;
async function arrowMark() {
  if (markCache) return markCache;
  const { data, info } = await sharp(MASTER_LOGO).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;

  // Bands of rows that hold any ink; the first is the arrow, the second the word.
  const inked = (y) => {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      if (Math.min(data[i], data[i + 1], data[i + 2]) < 200) return true;
    }
    return false;
  };
  let top = 0;
  while (top < H && !inked(top)) top++;
  let bottom = top;
  while (bottom < H && inked(bottom)) bottom++;

  let left = W;
  let right = 0;
  for (let y = top; y < bottom; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 3;
      if (Math.min(data[i], data[i + 1], data[i + 2]) < 245) {
        if (x < left) left = x;
        if (x > right) right = x;
      }
    }
  }
  const pad = 6;
  const x0 = Math.max(0, left - pad);
  const y0 = Math.max(0, top - pad);
  const w = Math.min(W, right + pad) - x0;
  const h = Math.min(H, bottom + pad) - y0;

  const rgba = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = ((y + y0) * W + (x + x0)) * 3;
      const o = (y * w + x) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // In the arrow every pixel's darkest channel is 125 or below; the
      // paper is 240-254 (not quite white). Opaque at 125, clear from 248,
      // blended between, so the edge stays smooth and the paper vanishes.
      const a = Math.max(0, Math.min(1, (248 - Math.min(r, g, b)) / (248 - 125)));
      const unblend = (c) => (a > 0 ? Math.max(0, Math.min(255, Math.round((c - 255 * (1 - a)) / a))) : 0);
      rgba[o] = unblend(r);
      rgba[o + 1] = unblend(g);
      rgba[o + 2] = unblend(b);
      rgba[o + 3] = Math.round(a * 255);
    }
  }

  const side = Math.max(w, h);
  markCache = await sharp(rgba, { raw: { width: w, height: h, channels: 4 } })
    .extend({
      top: Math.floor((side - h) / 2),
      bottom: Math.ceil((side - h) / 2),
      left: Math.floor((side - w) / 2),
      right: Math.ceil((side - w) / 2),
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();
  return markCache;
}

/** The arrow scaled to `art` pixels, centred on a transparent `size` square. */
async function markOnCanvas(size, art) {
  const scaled = await sharp(await arrowMark()).resize(art, art, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const pad = Math.round((size - art) / 2);
  return sharp({ create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: scaled, top: pad, left: pad }])
    .png()
    .toBuffer();
}

/** Legacy square icon: the arrow on a white rounded square. */
async function renderSquare(size, outPath) {
  const radius = Math.round(size * 0.18);
  const plate = Buffer.from(
    `<svg width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="${BACKGROUND_COLOR}"/></svg>`
  );
  await sharp(plate)
    .composite([{ input: await markOnCanvas(size, Math.round(size * LEGACY_ART_RATIO)) }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

/** ic_launcher_round: the arrow on a white disc. */
async function renderRound(size, outPath) {
  const r = size / 2;
  const disc = Buffer.from(
    `<svg width="${size}" height="${size}"><circle cx="${r}" cy="${r}" r="${r}" fill="${BACKGROUND_COLOR}"/></svg>`
  );
  await sharp(disc)
    .composite([{ input: await markOnCanvas(size, Math.round(size * LEGACY_ART_RATIO * 0.92)) }])
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

/**
 * Themed ("monochrome") icons take only the alpha channel of the drawable they
 * point at, so this is the arrow's shape in solid black on transparency.
 */
async function renderMonochrome(size, outPath) {
  const art = await markOnCanvas(size, Math.round(size * ADAPTIVE_ART_RATIO));
  const { data, info } = await sharp(art).raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    data[i] = 0;
    data[i + 1] = 0;
    data[i + 2] = 0;
  }
  await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

/** Adaptive foreground: the arrow inside the safe zone, transparent around it. */
async function renderAdaptiveForeground(size, outPath) {
  await sharp(await markOnCanvas(size, Math.round(size * ADAPTIVE_ART_RATIO)))
    .png({ compressionLevel: 9 })
    .toFile(outPath);
}

async function main() {
  if (!fs.existsSync(MASTER_LOGO)) {
    throw new Error(`Master logo not found: ${MASTER_LOGO}`);
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

  // ── Splash logo (Android 11 and earlier draw it from the launch theme) ────
  // 120dp square, the arrow filling most of it, transparent around.
  const SPLASH_DENSITIES = {
    'drawable-mdpi': 120,
    'drawable-hdpi': 180,
    'drawable-xhdpi': 240,
    'drawable-xxhdpi': 360,
    'drawable-xxxhdpi': 480,
  };
  for (const [dir, size] of Object.entries(SPLASH_DENSITIES)) {
    const target = path.join(RES, dir);
    ensureDir(target);
    await sharp(await markOnCanvas(size, Math.round(size * 0.9)))
      .png({ compressionLevel: 9 })
      .toFile(path.join(target, 'launch_screen_logo.png'));
    console.log(`  ${dir}/launch_screen_logo.png    ${size}x${size}`);
  }

  // ── The arrow for the app's own screens (Welcome, loading) ────────────────
  // 96pt, at 1x/2x/3x so React Native picks the right one per screen.
  const IMAGES = path.join(ROOT, 'src/assets/images');
  ensureDir(IMAGES);
  for (const [suffix, scale] of [['', 1], ['@2x', 2], ['@3x', 3]]) {
    const size = 96 * scale;
    await sharp(await markOnCanvas(size, size))
      .png({ compressionLevel: 9 })
      .toFile(path.join(IMAGES, `aryv-mark${suffix}.png`));
    console.log(`  src/assets/images/aryv-mark${suffix}.png      ${size}x${size}`);
  }

  // ── Play Store listing graphics ───────────────────────────────────────────
  ensureDir(STORE_OUT);

  // Play requires a 512x512 32-bit PNG with no transparency.
  await sharp(await markOnCanvas(512, Math.round(512 * LEGACY_ART_RATIO)))
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
