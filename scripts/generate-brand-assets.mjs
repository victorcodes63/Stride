#!/usr/bin/env node
/**
 * Sync Stride brand assets from app/brand-kit into public/.
 * Usage: node scripts/generate-brand-assets.mjs
 * Override kit path: STRIDE_LOGO_KIT=/path/to/stride-logo-kit
 */
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from 'playwright';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const kitRoot = process.env.STRIDE_LOGO_KIT ?? join(root, 'brand-kit');
const brandDir = join(root, 'public', 'brand');
const publicDir = join(root, 'public');
const ogDir = join(publicDir, 'og');

const CORAL = '#FF5436';
const PAPER = '#FBF8F4';
const INK = '#1A1714';
const INK_SUBTLE = '#8A8076';

async function copy(from, to) {
  await mkdir(dirname(to), { recursive: true });
  await copyFile(from, to);
}

async function syncKit() {
  const svgDir = join(kitRoot, 'svg');
  const pngDir = join(kitRoot, 'png');
  const faviconDir = join(kitRoot, 'favicon');

  await mkdir(brandDir, { recursive: true });

  const svgMap = [
    ['stride-mark-primary.svg', 'stride-mark.svg'],
    ['stride-mark-reversed.svg', 'stride-mark-reversed.svg'],
    ['stride-mark-mono-white.svg', 'stride-mark-mono-white.svg'],
    ['stride-mark-mono-black.svg', 'stride-mark-mono-black.svg'],
    ['stride-bolt-coral.svg', 'stride-bolt-coral.svg'],
    ['stride-bolt-white.svg', 'stride-bolt-white.svg'],
    ['stride-bolt-black.svg', 'stride-bolt-black.svg'],
  ];

  for (const [src, dest] of svgMap) {
    await copy(join(svgDir, src), join(brandDir, dest));
  }

  const wordmarkKit = join(kitRoot, 'stride-wordmark.svg');
  await copy(wordmarkKit, join(brandDir, 'stride-wordmark.svg'));

  const pngMap = [
    ['stride-mark-primary-1024.png', 'stride-mark.png'],
    ['stride-mark-primary-512.png', 'stride-mark-512.png'],
    ['stride-mark-primary-192.png', 'stride-mark-192.png'],
    ['stride-mark-primary-180.png', 'stride-mark-180.png'],
    ['stride-mark-primary-128.png', 'stride-mark-128.png'],
    ['stride-mark-primary-64.png', 'stride-mark-64.png'],
    ['stride-mark-primary-48.png', 'stride-mark-48.png'],
    ['stride-mark-primary-32.png', 'stride-mark-32.png'],
    ['stride-mark-primary-16.png', 'stride-mark-16.png'],
    ['stride-mark-reversed-512.png', 'stride-mark-reversed-512.png'],
    ['stride-mark-mono-white-512.png', 'stride-mark-mono-white-512.png'],
    ['stride-bolt-coral-512.png', 'stride-bolt-coral-512.png'],
    ['stride-bolt-white-512.png', 'stride-bolt-white-512.png'],
  ];

  for (const [src, dest] of pngMap) {
    await copy(join(pngDir, src), join(brandDir, dest));
  }

  await copy(join(faviconDir, 'favicon.ico'), join(publicDir, 'favicon.ico'));
  await copy(join(faviconDir, 'apple-touch-icon.png'), join(publicDir, 'apple-touch-icon.png'));
}

async function generateOgImage() {
  const wordmarkSvg = await readFile(join(brandDir, 'stride-wordmark.svg'), 'utf8');
  const wordmarkSrc = `data:image/svg+xml;base64,${Buffer.from(wordmarkSvg).toString('base64')}`;

  const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body {
    width: 1200px; height: 630px; overflow: hidden;
    background: ${PAPER};
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, Helvetica, Arial, sans-serif;
    position: relative;
  }
  .triangle {
    position: absolute; right: 0; bottom: 0;
    width: 0; height: 0;
    border-left: 220px solid transparent;
    border-bottom: 220px solid ${CORAL};
    opacity: 0.92;
  }
  .wrap { padding: 72px 80px; position: relative; z-index: 1; }
  .logo { height: 72px; width: auto; display: block; object-fit: contain; object-position: left; }
  .rule { margin-top: 28px; width: 72px; height: 5px; border-radius: 3px; background: ${CORAL}; }
  h1 { margin-top: 28px; font-size: 40px; font-weight: 700; color: ${INK}; line-height: 1.2; max-width: 760px; }
  p { margin-top: 16px; font-size: 26px; color: ${INK_SUBTLE}; line-height: 1.35; max-width: 720px; }
</style></head>
<body>
  <div class="triangle"></div>
  <div class="wrap">
    <img class="logo" src="${wordmarkSrc}" alt="Stride" />
    <div class="rule"></div>
    <h1>Move your business forward</h1>
    <p>Operations platform for East African businesses</p>
  </div>
</body></html>`;

  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.setContent(html, { waitUntil: 'load' });
  const png = await page.screenshot({ type: 'png' });
  await browser.close();
  return png;
}

async function writeReadme() {
  const readme = `# Stride brand assets

Synced from \`app/brand-kit/\` via \`npm run generate:brand-assets\`.

| File | Use |
|------|-----|
| \`stride-mark.svg\` | Primary mark — coral circle, white bolt (default) |
| \`stride-mark-reversed.svg\` | White circle, coral bolt — dark/coral backgrounds |
| \`stride-mark-mono-*.svg\` | Single-colour print variants |
| \`stride-bolt-*.svg\` | Bolt glyph only (transparent) |
| \`stride-wordmark.svg\` | Full logotype — marketing, auth, OG card |
| \`stride-mark-*.png\` | Raster exports for email, PWA, favicon fallbacks |
| \`../og/stride-default.png\` | Open Graph / WhatsApp share card (1200×630) |
| \`../favicon.ico\` | Browser favicon (from kit) |

Constants: \`src/lib/brand-constants.ts\`.
`;
  await writeFile(join(brandDir, 'README.md'), readme);
}

async function main() {
  await mkdir(ogDir, { recursive: true });
  await syncKit();
  const ogPng = await generateOgImage();
  await writeFile(join(ogDir, 'stride-default.png'), ogPng);
  await writeReadme();
  console.log('Synced brand kit → public/brand, favicon, and og/stride-default.png');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
