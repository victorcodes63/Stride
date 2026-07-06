/**
 * MOD-05 (RAV-289): Registry drift enforcement — CI fails on any layer diverging from module-registry.ts.
 *
 * Usage: npm run audit:module-registry
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

import { MODULE_KEYS, MODULE_REGISTRY, MODULE_UI_GROUPS } from '../src/lib/module-registry';
import { MODULE_DEFINITIONS } from '../src/lib/module-catalog';
import { getDashboardNavCatalogSections } from '../src/lib/dashboard-nav-catalog';
import { buildNavItemModules } from '../src/lib/module-nav-bindings';
import { resolveModuleForPath } from '../src/lib/module-routes';
import {
  buildDomainWorkspacesFromNav,
  getDomainNavModuleItems,
} from '../src/lib/dashboard-domain-nav';
import { ALL_MODULES_ENABLED } from '../src/lib/dashboard-nav-catalog';
import { validateMarketingModuleCoverage } from '../src/lib/marketing-module-map';

const ROOT = path.join(import.meta.dirname, '..');
const ENV_EXAMPLE = path.join(ROOT, '.env.example');
const ARTIFACT_PATH = path.join(ROOT, '../shared/module-registry-artifact.json');
const CP_MODULES = path.join(ROOT, '../control-plane/src/lib/modules.ts');
const PACKAGING_DOC = path.join(ROOT, 'docs/STRIDE-PACKAGING.md');

const failures: string[] = [];

function fail(msg: string) {
  failures.push(msg);
}

function syncArtifact(): boolean {
  const result = spawnSync('npx', ['tsx', 'scripts/export-module-registry-artifact.ts'], {
    cwd: ROOT,
    stdio: 'pipe',
    encoding: 'utf8',
  });
  if (result.status !== 0) {
    fail(`export-module-registry-artifact failed: ${result.stderr || result.stdout}`);
    return false;
  }
  return true;
}

function readArtifact() {
  if (!fs.existsSync(ARTIFACT_PATH)) {
    fail(`Missing shared artifact: ${ARTIFACT_PATH}`);
    return null;
  }
  return JSON.parse(fs.readFileSync(ARTIFACT_PATH, 'utf8')) as {
    keys: string[];
    modules: { key: string; label: string; bucket: string }[];
  };
}

function checkRegistryInternal() {
  if (MODULE_REGISTRY.length !== MODULE_KEYS.length) {
    fail(`MODULE_REGISTRY length ${MODULE_REGISTRY.length} !== MODULE_KEYS ${MODULE_KEYS.length}`);
  }
  if (MODULE_DEFINITIONS.length !== MODULE_KEYS.length) {
    fail(`MODULE_DEFINITIONS length mismatch`);
  }

  const grouped = MODULE_UI_GROUPS.flatMap((g) => g.keys);
  if (new Set(grouped).size !== MODULE_KEYS.length) {
    fail('MODULE_UI_GROUPS does not assign each ModuleKey exactly once');
  }

  for (const row of MODULE_REGISTRY) {
    for (const parent of row.requires ?? []) {
      if (!MODULE_KEYS.includes(parent)) {
        fail(`requires[] parent ${parent} missing for ${row.key}`);
      }
    }
    if (!row.envVar.startsWith('MODULE_')) {
      fail(`${row.key} envVar must start with MODULE_`);
    }
  }
}

function checkEnvExample() {
  const env = fs.readFileSync(ENV_EXAMPLE, 'utf8');
  for (const row of MODULE_REGISTRY) {
    if (!row.canDisable) continue;
    if (!env.includes(row.envVar)) {
      fail(`.env.example missing ${row.envVar} for ${row.key}`);
    }
  }
}

function checkNavBindings() {
  const navItemModules = buildNavItemModules(resolveModuleForPath);
  const sections = getDashboardNavCatalogSections();

  for (const section of sections) {
    for (const item of section.items) {
      const pathKey = item.href.split('?')[0] ?? item.href;
      const bound = navItemModules[pathKey] ?? resolveModuleForPath(pathKey);
      if (!bound) {
        fail(`Nav item ${item.href} (${item.label}) has no module binding`);
      } else if (!MODULE_KEYS.includes(bound)) {
        fail(`Nav item ${item.href} binds to unknown module ${bound}`);
      }
    }
  }
}

function checkOverviewSidebarParity() {
  const navOptions = {
    currentUserRole: 'admin' as const,
    hasAccountsAccess: true,
    canViewSystemAnalytics: true,
    canAccessCompanySetup: true,
    enabledModules: ALL_MODULES_ENABLED,
  };

  const domains = [
    'hr-payroll',
    'finance',
    'procurement',
    'legal-documents',
    'projects',
    'fleet-logistics',
    'hr-outsourcing',
    'admin-operations',
  ] as const;

  for (const domainId of domains) {
    const sidebarHrefs = getDomainNavModuleItems(navOptions, domainId).map((i) => i.href);
    const workspaceHrefs = buildDomainWorkspacesFromNav(navOptions, domainId).flatMap((ws) =>
      ws.links.map((l) => l.href),
    );
    const sidebarSet = new Set(sidebarHrefs);
    const workspaceSet = new Set(workspaceHrefs);
    if (sidebarSet.size !== workspaceSet.size) {
      fail(`${domainId}: overview workspace href count ${workspaceSet.size} !== sidebar ${sidebarSet.size}`);
    }
    for (const href of sidebarSet) {
      if (!workspaceSet.has(href)) {
        fail(`${domainId}: sidebar href ${href} missing from overview workspaces`);
      }
    }
  }
}

function checkMarketingCoverage() {
  try {
    validateMarketingModuleCoverage();
  } catch (e) {
    fail(`marketing-module-map: ${e instanceof Error ? e.message : String(e)}`);
  }
}

function checkArtifactSync(artifact: NonNullable<ReturnType<typeof readArtifact>>) {
  if (artifact.keys.length !== MODULE_KEYS.length) {
    fail(`Artifact key count ${artifact.keys.length} !== registry ${MODULE_KEYS.length}`);
  }
  const artifactKeys = [...artifact.keys].sort();
  const registryKeys = [...MODULE_KEYS].sort();
  if (artifactKeys.join(',') !== registryKeys.join(',')) {
    fail('Artifact keys diverge from MODULE_KEYS');
  }
  for (const row of MODULE_REGISTRY) {
    const art = artifact.modules.find((m) => m.key === row.key);
    if (!art) {
      fail(`Artifact missing module ${row.key}`);
      continue;
    }
    if (art.label !== row.label) {
      fail(`Artifact label for ${row.key}: "${art.label}" !== registry "${row.label}"`);
    }
    if (art.bucket !== row.bucket) {
      fail(`Artifact bucket for ${row.key} diverges`);
    }
  }
}

function checkPackagingDoc() {
  const doc = fs.readFileSync(PACKAGING_DOC, 'utf8');
  if (doc.includes('18 modules')) {
    fail('STRIDE-PACKAGING.md still references 18 modules — update from registry');
  }
  if (!doc.includes(String(MODULE_KEYS.length))) {
    fail(`STRIDE-PACKAGING.md should reference ${MODULE_KEYS.length} capabilities`);
  }
}

function checkControlPlaneLabels() {
  if (!fs.existsSync(CP_MODULES)) return;
  const src = fs.readFileSync(CP_MODULES, 'utf8');
  if (!src.includes('module-registry-artifact.json')) {
    fail('control-plane modules.ts must import from shared/module-registry-artifact.json');
  }
  if (src.includes('core: "People (HR Core)"')) {
    fail('control-plane modules.ts still has stale hand-maintained labels');
  }
}

function main() {
  console.log('MOD-05 module registry audit\n');

  checkRegistryInternal();
  checkEnvExample();
  checkNavBindings();
  checkOverviewSidebarParity();
  checkMarketingCoverage();
  checkPackagingDoc();
  checkControlPlaneLabels();

  if (!syncArtifact()) {
    process.exit(1);
  }
  const artifact = readArtifact();
  if (artifact) checkArtifactSync(artifact);

  if (failures.length > 0) {
    console.error('\nRegistry drift detected:\n');
    for (const f of failures) console.error(`  ✗ ${f}`);
    process.exit(1);
  }

  console.log(`\n✓ Registry audit passed (${MODULE_KEYS.length} capabilities)\n`);
}

main();
