#!/usr/bin/env node
/**
 * RAV-97: Fail when dashboard routes ship mock/roadmap shells (DEMO_MODE=false launch bar).
 * - No page.tsx under /dashboard imports ModuleRoadmapPage
 * - NAV_ITEM_READINESS must not mark routes as mock or planned (partial is OK)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const DASHBOARD_ROOT = path.join(ROOT, 'src/app/dashboard');
const NAV_READINESS = path.join(ROOT, 'src/lib/dashboard-nav-readiness.ts');

const failures = [];

function collectPageFiles(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectPageFiles(full));
    else if (entry.name === 'page.tsx') out.push(full);
  }
  return out;
}

function auditRoadmapImports() {
  for (const file of collectPageFiles(DASHBOARD_ROOT)) {
    const source = fs.readFileSync(file, 'utf8');
    if (/ModuleRoadmapPage/.test(source)) {
      failures.push(`Roadmap shell: ${path.relative(ROOT, file)}`);
    }
    if (/\b(DemoModeOnly|RoadmapPlaceholder|UnderConstruction)\b/.test(source)) {
      failures.push(`Mock gate component: ${path.relative(ROOT, file)}`);
    }
  }
}

function auditNavReadiness() {
  const source = fs.readFileSync(NAV_READINESS, 'utf8');
  const block = source.match(/NAV_ITEM_READINESS[^=]*=\s*\{([^}]+)\}/s);
  if (!block) {
    failures.push('Could not parse NAV_ITEM_READINESS');
    return;
  }
  for (const match of block[1].matchAll(/'([^']+)':\s*'(mock|planned)'/g)) {
    failures.push(`Nav readiness ${match[2]}: ${match[1]}`);
  }
}

function main() {
  console.log('\nRAV-97 dashboard mock-route audit\n');
  auditRoadmapImports();
  auditNavReadiness();

  if (failures.length) {
    console.log('FAIL — mock or roadmap routes detected:\n');
    for (const f of failures) console.log(`  ✗ ${f}`);
    console.log('');
    process.exit(1);
  }

  console.log('PASS — no mock/planned dashboard routes or roadmap page imports.\n');
}

main();
