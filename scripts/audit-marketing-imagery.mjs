#!/usr/bin/env node
/**
 * RAV-167 — Audit marketing imagery references vs files on disk.
 * Flags legacy Imara strings in PNG assets when `strings` is available.
 *
 * Usage: node scripts/audit-marketing-imagery.mjs
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const CONFIG_PATH = join(ROOT, 'src/lib/marketing-config.ts');
const config = readFileSync(CONFIG_PATH, 'utf8');

const IMAGE_REFS = [...config.matchAll(/src:\s*['"]([^'"]+\.(?:png|jpg|jpeg|webp))['"]/g)].map(
  (match) => match[1],
);

const LEGACY_PATTERNS = [/imara/i, /@imara\.co\.ke/i, /Heritage Members/i];

function publicPath(urlPath) {
  return join(ROOT, 'public', urlPath.replace(/^\//, ''));
}

function scanBinaryForLegacy(filePath) {
  try {
    const out = execSync(`strings "${filePath}"`, { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
    return LEGACY_PATTERNS.filter((pattern) => pattern.test(out)).map((pattern) => pattern.source);
  } catch {
    return null;
  }
}

console.log('\nMarketing imagery audit (RAV-167)\n');

const missing = [];
const legacyHits = [];

for (const ref of IMAGE_REFS) {
  const abs = publicPath(ref);
  const exists = existsSync(abs);
  console.log(`${exists ? '✓' : '✗'} ${ref}${exists ? '' : ' — MISSING'}`);
  if (!exists) {
    missing.push(ref);
    continue;
  }

  if (ref.endsWith('.png') || ref.endsWith('.jpg') || ref.endsWith('.jpeg')) {
    const hits = scanBinaryForLegacy(abs);
    if (hits?.length) {
      legacyHits.push({ ref, hits });
      console.log(`  ⚠ legacy strings in file: ${hits.join(', ')}`);
    }
  }
}

const marketingDir = join(ROOT, 'public', 'marketing');
if (existsSync(marketingDir)) {
  console.log('\nOrphan files in public/marketing/ (not referenced in marketing-config):');
  const referenced = new Set(IMAGE_REFS.map((ref) => ref.replace(/^\/marketing\//, '')));
  for (const file of readdirSync(marketingDir)) {
    if (!referenced.has(file)) {
      console.log(`  · ${file} (wireframe-only — safe to archive)`);
    }
  }
}

console.log('\nLive screenshot usage after RAV-167 wireframe pass:');
console.log('  · Homepage hero → /images/dashboard_home.png (SwiftFreight capture)');
console.log('  · Section 4 pay-run → ComplianceBento animation (no PNG)');
console.log('  · Why / industries / platform → component wireframes');

if (missing.length) {
  console.error(`\nFAIL: ${missing.length} referenced image(s) missing`);
  process.exit(1);
}

if (legacyHits.length) {
  console.warn(`\nWARN: ${legacyHits.length} PNG(s) still contain legacy brand strings — re-run capture scripts`);
  process.exit(legacyHits.length > 0 ? 2 : 0);
}

console.log('\nAudit: PASS (no missing refs)\n');
