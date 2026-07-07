/**
 * RAV-251 ISO-07: Fail CI when staff API routes use prisma without tenant auth,
 * or when global-prisma-in-tenant-route count regresses above baseline.
 *
 * Usage: npm run audit:api-prisma
 */
import fs from 'node:fs';
import path from 'node:path';

import {
  isExemptApiPath,
  usesDirectPrismaClient,
  usesOrgScopedAuth,
  usesTenantTransaction,
  usesTenantWrapper,
} from './tenant-audit-shared';

const ROOT = path.join(import.meta.dirname, '..');
const API_ROOT = path.join(ROOT, 'src/app/api');
const BASELINE_PATH = path.join(import.meta.dirname, 'tenant-isolation-baseline.json');

type Baseline = {
  prismaScope: {
    unscopedPrismaRoutes: number;
    globalPrismaInTenantRoutes: number;
  };
};

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function routeFileToApiPath(filePath: string): string {
  const rel = path.relative(API_ROOT, filePath).replace(/\\/g, '/');
  const dir = path.dirname(rel);
  if (dir === '.') return '/api';
  return `/api/${dir}`;
}

function collectApiRouteFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectApiRouteFiles(full));
    else if (entry.name === 'route.ts') out.push(full);
  }
  return out;
}

function main() {
  const routeFiles = collectApiRouteFiles(API_ROOT);
  const unscoped: string[] = [];
  const globalPrismaInTenant: string[] = [];

  for (const file of routeFiles) {
    const apiPath = routeFileToApiPath(file);
    if (isExemptApiPath(apiPath)) continue;

    const source = readFile(file);
    if (!usesDirectPrismaClient(source)) continue;

    const rel = path.relative(ROOT, file);
    if (!usesOrgScopedAuth(source)) {
      unscoped.push(rel);
      continue;
    }

    if (usesTenantWrapper(source) && !usesTenantTransaction(source)) {
      globalPrismaInTenant.push(rel);
    }
  }

  console.log('\n=== RAV-251 API prisma scope audit ===\n');
  console.log(`Unscoped prisma routes (hard fail): ${unscoped.length}`);
  console.log(`Tenant-wrapped routes still using global prisma (baseline): ${globalPrismaInTenant.length}\n`);

  if (unscoped.length) {
    console.log('UNSCOPED (must add withTenant / staff auth + withOrgContext):');
    for (const f of unscoped) console.log(`  ✗ ${f}`);
    console.log('');
  }

  const baseline = JSON.parse(readFile(BASELINE_PATH)) as Baseline;
  const errors: string[] = [];

  if (unscoped.length > baseline.prismaScope.unscopedPrismaRoutes) {
    errors.push(
      `Unscoped prisma routes increased: ${baseline.prismaScope.unscopedPrismaRoutes} → ${unscoped.length}`,
    );
  }
  if (unscoped.length > 0) {
    errors.push(`Found ${unscoped.length} API route(s) using prisma without tenant auth.`);
  }
  if (globalPrismaInTenant.length > baseline.prismaScope.globalPrismaInTenantRoutes) {
    errors.push(
      `Global prisma in tenant routes increased: ${baseline.prismaScope.globalPrismaInTenantRoutes} → ${globalPrismaInTenant.length}`,
    );
    console.log('New global-prisma-in-tenant-route files:');
    const baselineCount = baseline.prismaScope.globalPrismaInTenantRoutes;
    for (const f of globalPrismaInTenant.slice(baselineCount)) console.log(`  ✗ ${f}`);
    console.log('');
  }

  if (errors.length) {
    console.error('PRISMA SCOPE FAILURES:');
    for (const err of errors) console.error(`  ✗ ${err}`);
    console.error('\nFix: use withTenant + ctx.run(tx => …) instead of global prisma in staff routes.\n');
    process.exit(1);
  }

  console.log('Prisma scope audit: PASS\n');
}

main();
