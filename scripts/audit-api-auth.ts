/**
 * RAV-126: Scan API route handlers for authentication guards.
 * Flags route.ts files that export HTTP handlers but lack staff/ess/tenant/cron auth patterns.
 *
 * Usage: npm run audit:api-auth
 */
import fs from 'node:fs';
import path from 'node:path';

const API_ROOT = path.join(import.meta.dirname, '..', 'src/app/api');

const EXEMPT_PREFIXES = [
  '/api/auth/login',
  '/api/auth/me',
  '/api/auth/logout',
  '/api/auth/mfa',
  '/api/auth/microsoft',
  '/api/auth/google',
  '/api/ess/auth',
  '/api/ess/manifest',
  '/api/config',
  '/api/webhooks',
  '/api/cron',
  '/api/internal',
  '/api/marketing',
  '/api/contact',
  '/api/careers',
  '/api/interview/respond',
  '/api/upload/resume',
  '/api/test',
];

const AUTH_PATTERNS = [
  'requireStaffUser',
  'requireEssUser',
  'withTenant',
  'requireAdminActor',
  'verifyCellProvisionAuth',
  'authorizeCron',
  'requireDashboardAdmin',
  'parseStaffSession',
  'parseEssSession',
];

function routeFileToPath(filePath: string): string {
  const rel = path.relative(API_ROOT, filePath).replace(/\\/g, '/');
  const dir = path.dirname(rel);
  const base = path.basename(rel, '.ts');
  if (base === 'route') {
    return dir === '.' ? '/api' : `/api/${dir}`;
  }
  return `/api/${rel.replace(/\.ts$/, '')}`;
}

function isExempt(apiPath: string): boolean {
  return EXEMPT_PREFIXES.some((p) => apiPath === p || apiPath.startsWith(`${p}/`));
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (entry.name === 'route.ts') out.push(full);
  }
  return out;
}

function main() {
  const files = walk(API_ROOT);
  const unguarded: string[] = [];
  const noHandler: string[] = [];

  for (const file of files) {
    const apiPath = routeFileToPath(file);
    if (isExempt(apiPath)) continue;

    const src = fs.readFileSync(file, 'utf8');
    const hasHandler = /export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)\b/.test(src);
    if (!hasHandler) {
      noHandler.push(apiPath);
      continue;
    }

    const guarded = AUTH_PATTERNS.some((p) => src.includes(p));
    if (!guarded) unguarded.push(apiPath);
  }

  console.log(`Scanned ${files.length} API route files.\n`);

  if (unguarded.length) {
    console.log('⚠ Routes without recognized auth guard (review manually):');
    for (const p of unguarded.sort()) console.log(`  - ${p}`);
    console.log('');
  } else {
    console.log('✓ All non-exempt routes include a recognized auth guard.\n');
  }

  if (noHandler.length) {
    console.log(`ℹ ${noHandler.length} route files with no HTTP handlers (skipped).`);
  }

  console.log(`\n${unguarded.length} route(s) flagged for manual review (advisory — does not fail CI).`);
  process.exit(0);
}

main();
