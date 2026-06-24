/**
 * RAV-67: Audit tenant migration gate per licensed module.
 * - Schema: tenant models have organizationId + RLS policies
 * - Routes: staff API handlers under module prefixes use withTenant()
 *
 * Usage: npm run audit:module-tenant
 * Exit 1 on schema/RLS violations; exit 0 with warnings for unmigrated routes.
 */
import fs from 'node:fs';
import path from 'node:path';

import {
  GLOBAL_PRISMA_MODELS,
  MODULE_MIGRATION_TRACKING,
  apiPrefixesForModule,
  type ModuleMigrationPhase,
} from '../src/lib/module-migration-registry';
import { ROUTE_MODULE_BINDINGS } from '../src/lib/module-routes';
import type { ModuleKey } from '../src/lib/modules';

const ROOT = path.join(import.meta.dirname, '..');
const SCHEMA_PATH = path.join(ROOT, 'prisma/schema.prisma');
const RLS_PATH = path.join(ROOT, 'prisma/migrations/rls_policies.sql');
const API_ROOT = path.join(ROOT, 'src/app/api');

const ROUTE_EXEMPT_PREFIXES = [
  '/api/auth',
  '/api/config',
  '/api/webhooks',
  '/api/internal',
  '/api/cron',
  '/api/ess/auth',
  '/api/ess/manifest',
  '/api/marketing',
  '/api/contact',
  '/api/test',
  '/api/upload',
  '/api/interview/respond',
];

function readFile(filePath: string): string {
  return fs.readFileSync(filePath, 'utf8');
}

function parsePrismaModels(schema: string): Map<string, { hasOrgId: boolean }> {
  const models = new Map<string, { hasOrgId: boolean }>();
  const blocks = schema.split(/^model /m).slice(1);
  for (const block of blocks) {
    const name = block.split(/\s/)[0];
    const body = block.slice(name.length);
    models.set(name, { hasOrgId: /organizationId\s+String/.test(body) });
  }
  return models;
}

function parseRlsTables(sql: string): Set<string> {
  const tables = new Set<string>();
  const re = /ALTER TABLE "([^"]+)" ENABLE ROW LEVEL SECURITY/g;
  for (const match of sql.matchAll(re)) {
    tables.add(match[1]);
  }
  return tables;
}

function routeFileToApiPath(filePath: string): string {
  const rel = path.relative(API_ROOT, filePath).replace(/\\/g, '/');
  const dir = path.dirname(rel);
  if (dir === '.') return '/api';
  return `/api/${dir}`;
}

function resolveModuleForApiPath(apiPath: string): ModuleKey | null {
  const sorted = [...ROUTE_MODULE_BINDINGS]
    .filter((b) => b.prefix.startsWith('/api/'))
    .sort((a, b) => b.prefix.length - a.prefix.length);
  for (const binding of sorted) {
    if (apiPath === binding.prefix || apiPath.startsWith(`${binding.prefix}/`)) {
      return binding.module;
    }
  }
  return null;
}

function isExemptApiPath(apiPath: string): boolean {
  return ROUTE_EXEMPT_PREFIXES.some(
    (prefix) => apiPath === prefix || apiPath.startsWith(`${prefix}/`),
  );
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

function usesTenantWrapper(source: string): boolean {
  return (
    /\bwithTenant\s*\(/.test(source) ||
    /\bwithTenantAudit\s*\(/.test(source) ||
    (/\bwithOrgContext\s*\(/.test(source) && /\brequireStaffUser\b/.test(source))
  );
}

type ModuleRouteStats = {
  total: number;
  migrated: number;
  files: string[];
};

function main() {
  const schema = readFile(SCHEMA_PATH);
  const rlsSql = fs.existsSync(RLS_PATH) ? readFile(RLS_PATH) : '';
  const models = parsePrismaModels(schema);
  const rlsTables = parseRlsTables(rlsSql);

  const schemaErrors: string[] = [];
  for (const [name, meta] of models) {
    if (GLOBAL_PRISMA_MODELS.has(name)) continue;
    if (!meta.hasOrgId) {
      schemaErrors.push(`Model ${name} is missing organizationId`);
    }
    if (rlsSql && !rlsTables.has(name)) {
      schemaErrors.push(`Table ${name} has no RLS policy in rls_policies.sql`);
    }
  }

  const routeFiles = collectApiRouteFiles(API_ROOT);
  const byModule = new Map<ModuleKey, ModuleRouteStats>();

  for (const file of routeFiles) {
    const apiPath = routeFileToApiPath(file);
    if (isExemptApiPath(apiPath)) continue;

    const module = resolveModuleForApiPath(apiPath);
    if (!module) continue;

    const source = readFile(file);
    const migrated = usesTenantWrapper(source);
    const stats = byModule.get(module) ?? { total: 0, migrated: 0, files: [] };
    stats.total += 1;
    if (migrated) stats.migrated += 1;
    else stats.files.push(path.relative(ROOT, file));
    byModule.set(module, stats);
  }

  console.log('\n=== RAV-67 Module tenant migration audit ===\n');

  if (schemaErrors.length) {
    console.log('SCHEMA / RLS FAILURES:');
    for (const err of schemaErrors) console.log(`  ✗ ${err}`);
    console.log('');
  } else {
    console.log(`Schema: ${models.size - GLOBAL_PRISMA_MODELS.size} tenant models — organizationId + RLS OK\n`);
  }

  console.log('Module route migration (withTenant / withOrgContext+staff):');
  console.log('─'.repeat(72));
  console.log(
    `${'Module'.padEnd(16)}${'Phase'.padEnd(16)}${'Routes'.padEnd(12)}${'Migrated'.padEnd(12)}Status`,
  );
  console.log('─'.repeat(72));

  for (const record of MODULE_MIGRATION_TRACKING) {
    const stats = byModule.get(record.module) ?? { total: 0, migrated: 0, files: [] };
    const pct =
      stats.total === 0 ? '—' : `${stats.migrated}/${stats.total}`;
    const autoPhase: ModuleMigrationPhase =
      stats.total === 0
        ? record.phase
        : stats.migrated === stats.total
          ? 'tenant-safe'
          : stats.migrated > 0
            ? 'routes-partial'
            : 'schema-ready';

    const status =
      autoPhase === 'tenant-safe'
        ? '✓ tenant-safe'
        : autoPhase === 'routes-partial'
          ? '◐ partial'
          : stats.total > 0
            ? '○ routes pending'
            : '· no API routes';

    console.log(
      `${record.module.padEnd(16)}${record.phase.padEnd(16)}${String(stats.total).padEnd(12)}${pct.padEnd(12)}${status}`,
    );

    const prefixes = apiPrefixesForModule(record.module);
    if (prefixes.length && stats.total === 0) {
      console.log(`  prefixes: ${prefixes.slice(0, 3).join(', ')}${prefixes.length > 3 ? '…' : ''}`);
    }
  }

  const pending = [...byModule.entries()].filter(([, s]) => s.migrated < s.total);
  if (pending.length) {
    console.log('\nSample unmigrated route files (first 8 per module):');
    for (const [module, stats] of pending) {
      if (!stats.files.length) continue;
      console.log(`\n  [${module}]`);
      for (const f of stats.files.slice(0, 8)) console.log(`    - ${f}`);
      if (stats.files.length > 8) console.log(`    … +${stats.files.length - 8} more`);
    }
  }

  console.log('\nRunbook: docs/MODULE-MIGRATION-CHECKLIST.md\n');

  if (schemaErrors.length) {
    process.exit(1);
  }
}

main();
