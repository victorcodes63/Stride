/**
 * Rebuild the demo database as a single, clean flagship company.
 *
 * This DB is maintained with `prisma db push` (its migration history is
 * incomplete), so we reset the SCHEMA with `db push --force-reset` rather than
 * `migrate reset`. A fixed allow-list of operator logins is (re)created with a
 * known password after seeding — idempotent and safe to re-run before a demo.
 *
 * Steps:
 *   1. Load .env.local (DATABASE_URL / DIRECT_DATABASE_URL) without shell sourcing.
 *   2. `prisma db push --force-reset --accept-data-loss` (drops ALL data, rebuilds schema).
 *   3. Seed the flagship demo pack (single company, KE + UG) — core is fatal,
 *      enrichment seeds are best-effort.
 *   4. Ensure operator logins exist (create-if-missing, never overwrites a password).
 *
 * Usage (from app/):
 *   node prisma/rebuild-demo-flagship.mjs
 *   DEMO_PACK=cargo-logistics node prisma/rebuild-demo-flagship.mjs
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

function loadEnvLocal() {
  const text = readFileSync(path.join(root, '.env.local'), 'utf8');
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq === -1) continue;
    process.env[t.slice(0, eq)] = t.slice(eq + 1).replace(/^"|"$/g, '');
  }
}
loadEnvLocal();

const DEMO_PACK = process.env.DEMO_PACK || 'cargo-logistics';
process.env.DEMO_PACK = DEMO_PACK;
process.env.DEMO_MULTI_CONTEXT = 'false';

const DEMO_PASSWORD = process.env.NEXT_PUBLIC_DEMO_PASSWORD || process.env.STAFF_PASSWORD || 'Demo@2026!';

/**
 * Demo login(s) to guarantee after every rebuild (create-if-missing).
 * NOTE: real operator accounts (e.g. @raventechgroup.com) are provisioned on the
 * live platform only — they must NOT be seeded into local/demo databases.
 */
const OPERATOR_USERS = [
  { email: 'admin@imara.co.ke', name: 'Amina Njeri', role: 'admin', staffUserType: 'director' },
];

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL not found in .env.local. Aborting.');
  process.exit(1);
}

function runStep(label, command, { fatal }) {
  console.log(`\n──────── ${label} ────────`);
  try {
    execSync(command, { cwd: root, stdio: 'inherit', env: process.env });
    return true;
  } catch (err) {
    if (fatal) {
      console.error(`\nFATAL: step "${label}" failed. Aborting.`);
      throw err;
    }
    console.warn(`\n⚠️  Non-fatal: "${label}" failed — continuing. (${err.message})`);
    return false;
  }
}

async function main() {
  const { PrismaClient } = await import('@prisma/client');
  const bcrypt = (await import('bcryptjs')).default;

  // ---- 2. Reset schema + wipe all data (db push, not migrate) ----
  runStep(
    'Reset schema + wipe all data (prisma db push --force-reset)',
    'npx prisma db push --force-reset --accept-data-loss --skip-generate',
    { fatal: true },
  );

  // ---- 3. Seed the flagship pack ----
  process.env.ACCOUNTS_SEED_USER_EMAIL =
    process.env.ACCOUNTS_SEED_USER_EMAIL ||
    process.env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL ||
    'admin@imara.co.ke';

  console.log(`\nSeeding flagship demo pack: ${DEMO_PACK} (single company, KE + UG)`);
  runStep('Core seed (departments, employees, payroll, leave, attendance, careers)', 'npx tsx prisma/seed-demo.ts', { fatal: true });

  const enrichment = [
    ['Onboarding templates', 'npx tsx prisma/seed-onboarding-templates.ts'],
    ['Biometric devices + punches', 'node prisma/seed-biometric-hikvision.js'],
    ['Disciplinary + grievance', 'node prisma/seed-disciplinary-grievance.js'],
    ['Accounts module (billing)', 'node prisma/seed-accounts-module.js'],
    ['Procurement demo', 'npx tsx scripts/seed-procurement-demo.ts'],
    ['Internal staff leave', 'node prisma/seed-staff-leave.js'],
    ['Job descriptions + scorecards', 'npx tsx scripts/seed-demo-job-descriptions.ts'],
    ['Performance review cycle', 'npx tsx scripts/seed-performance-cycle.ts'],
    ['Sales demo', 'npx tsx prisma/seed-sales-demo.ts'],
    ['ESS sample', 'npx tsx prisma/seed-ess-demo.ts'],
  ];
  const results = [];
  for (const [label, cmd] of enrichment) results.push([label, runStep(label, cmd, { fatal: false })]);

  // Verified email-domain → org mapping (required for staff login to resolve the tenant).
  results.push([
    'Auth email domains',
    runStep('Verified auth email domains (login resolution)', 'node scripts/seed-demo-email-domains.mjs', { fatal: false }),
  ]);

  // ---- 4. Ensure operator logins (create-if-missing) ----
  const prisma = new PrismaClient();
  try {
    const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
    for (const u of OPERATOR_USERS) {
      const existing = await prisma.user.findUnique({ where: { email: u.email } });
      if (existing) {
        console.log(`   · ${u.email} already present (kept as-is)`);
        continue;
      }
      await prisma.user.create({
        data: {
          email: u.email,
          name: u.name,
          passwordHash: hash,
          role: u.role,
          staffUserType: u.staffUserType,
          isActive: true,
        },
      });
      console.log(`   + created ${u.email} (${u.role}) — password: ${DEMO_PASSWORD}`);
    }

    // ---- Summary ----
    const [users, clients, depts, emps] = await Promise.all([
      prisma.user.count(),
      prisma.outsourcingClient.count(),
      prisma.department.count(),
      prisma.employee.count(),
    ]);
    console.log('\n════════ REBUILD COMPLETE ════════');
    console.log(`Users: ${users}  |  Companies (clients): ${clients}  |  Departments: ${depts}  |  Employees: ${emps}`);
    console.log('\nEnrichment steps:');
    for (const [label, ok] of results) console.log(`   ${ok ? 'OK ' : 'SKIP'} ${label}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
