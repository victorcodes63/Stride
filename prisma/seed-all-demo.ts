/**
 * Full demo database seed orchestrator (run after `prisma migrate reset` or on an empty migrated DB).
 *
 * Order and module intent:
 * 1. seed-demo — outsourcing (KE/UG), departments & employees, careers jobs, demo applications,
 *    interviews & talent-pool candidates, public holidays,
 *    employee credentials, rota (templates + published period + assignments), attendance & summaries &
 *    exceptions, leave types/policies/balances/applications, payroll (approved + draft months),
 *    staff users + ESS sample, audit events.
 * 2. seed-onboarding-templates — default onboarding checklist templates (HR/IT steps).
 * 3. seed-biometric-hikvision — demo Hikvision-style devices + punch rows (M1 biometrics).
 * 4. seed-disciplinary-grievance — sample disciplinary cases + grievances (HR ER).
 * 5. seed-accounts-module — billing clients synced from recruitment/outsourcing, contracts,
 *    invoices, payments, vendors (requires a staff User; defaults to demo admin).
 * 6. seed-staff-leave — internal staff leave types + per-user balances (dashboard staff leave).
 *
 * Run: npm run db:seed-all-demo
 * After clean reset: npm run db:reset-demo
 */

import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function run(command: string) {
  console.log(`\n═══ ${command} ═══\n`);
  execSync(command, {
    stdio: 'inherit',
    cwd: root,
    env: {
      ...process.env,
      DEMO_PACK: process.env.DEMO_PACK ?? 'generic',
      ACCOUNTS_SEED_USER_EMAIL:
        process.env.ACCOUNTS_SEED_USER_EMAIL ?? process.env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL ?? 'demo@example.com',
    },
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Source .env.local or export it before seeding.');
  }

  run('npx tsx prisma/seed-demo.ts');
  run('npx tsx prisma/seed-onboarding-templates.ts');
  run('node prisma/seed-biometric-hikvision.js');
  run('node prisma/seed-disciplinary-grievance.js');
  run('node prisma/seed-accounts-module.js');
  run('node prisma/seed-staff-leave.js');

  console.log('\nAll demo module seeds finished.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
