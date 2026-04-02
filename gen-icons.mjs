/**
 * ChronoShield — Icon & Favicon Generator
 * Run once: node gen-icons.mjs
 * Requires: sharp (installed in /tmp/icon-gen)
 */
import { createRequire } from 'module';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

// Load sharp from temp install
const SHARP_PATH = process.platform === 'win32'
  ? `${process.env.LOCALAPPDATA || process.env.APPDATA}/Local/Temp/icon-gen/node_modules/sharp/lib/index.js`
  : '/tmp/icon-gen/node_modules/sharp/lib/index.js';
const sharp = (await import(SHARP_PATH)).default;

const svgPath   = path.join(__dirname, 'chronoshield-logo-icon.svg');
const publicDir = path.join(__dirname, 'frontend/public');
const extDir    = path.join(__dirname, 'extension/icons');

// Ensure dirs exist
if (!existsSync(extDir)) mkdirSync(extDir, { recursive: true });

const svgBuf = readFileSync(svgPath);

// ── Extension icons ────────────────────────────────────────────────────────
const extSizes = [16, 32, 48, 128];
for (const size of extSizes) {
  const buf = await sharp(svgBuf).resize(size, size).png().toBuffer();
  writeFileSync(path.join(extDir, `icon${size}.png`), buf);
  console.log(`✓ extension/icons/icon${size}.png`);
}

// ── Favicon PNGs ───────────────────────────────────────────────────────────

// 16×16
const f16 = await sharp(svgBuf).resize(16, 16).png().toBuffer();
writeFileSync(path.join(publicDir, 'favicon-16x16.png'), f16);
console.log('✓ public/favicon-16x16.png');

// 32×32
const f32 = await sharp(svgBuf).resize(32, 32).png().toBuffer();
writeFileSync(path.join(publicDir, 'favicon-32x32.png'), f32);
console.log('✓ public/favicon-32x32.png');

// favicon.ico — use 32×32 PNG (modern browsers accept PNG as .ico)
writeFileSync(path.join(publicDir, 'favicon.ico'), f32);
console.log('✓ public/favicon.ico');

// ── Apple touch icon: 180×180, bg #050507, 20px padding ──────────────────
const appleSize  = 180;
const applePad   = 20;
const iconSize   = appleSize - applePad * 2; // 140px

const bgBuf = await sharp({
  create: {
    width: appleSize, height: appleSize,
    channels: 4,
    background: { r: 5, g: 5, b: 7, alpha: 255 },
  },
}).png().toBuffer();

const iconBuf = await sharp(svgBuf).resize(iconSize, iconSize).png().toBuffer();

await sharp(bgBuf)
  .composite([{ input: iconBuf, top: applePad, left: applePad }])
  .png()
  .toFile(path.join(publicDir, 'apple-touch-icon.png'));

console.log('✓ public/apple-touch-icon.png');
console.log('\n🎉 All icons generated!');
