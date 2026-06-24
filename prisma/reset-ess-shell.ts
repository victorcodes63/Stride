/**
 * Wipe all HRIS data; optionally keep ESS portal logins.
 *
 * Also clears uploaded branding on disk and applies blank-shell env profile.
 *
 * Run:
 *   npm run db:reset-ess-shell              # keep ESS users
 *   npm run db:reset-ess-shell -- --purge-ess   # empty DB (no users at all)
 */
import { execSync } from 'node:child_process';
import { readdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PrismaClient } from '@prisma/client';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const prisma = new PrismaClient();
const purgeEss = process.argv.includes('--purge-ess');

type EssBackup = {
  email: string;
  name: string;
  passwordHash: string;
  role: 'employee' | 'manager' | 'hr';
  isActive: boolean;
  mustResetPassword: boolean;
  notes: string | null;
};

async function backupEssUsers(): Promise<EssBackup[]> {
  if (purgeEss) return [];
  const rows = await prisma.essPortalUser.findMany({
    where: {
      email: { not: { contains: 'stabexintl.com', mode: 'insensitive' } },
    },
    select: {
      email: true,
      name: true,
      passwordHash: true,
      role: true,
      isActive: true,
      mustResetPassword: true,
      notes: true,
    },
    orderBy: { email: 'asc' },
  });
  return rows;
}

async function restoreEssUsers(backups: EssBackup[]) {
  if (backups.length === 0) {
    console.log('No ESS users restored.');
    return;
  }
  for (const row of backups) {
    await prisma.essPortalUser.upsert({
      where: { email: row.email },
      update: {
        name: row.name,
        passwordHash: row.passwordHash,
        role: row.role,
        isActive: row.isActive,
        mustResetPassword: row.mustResetPassword,
        notes: row.notes,
        employeeId: null,
        createdByUserId: null,
      },
      create: {
        email: row.email,
        name: row.name,
        passwordHash: row.passwordHash,
        role: row.role,
        isActive: row.isActive,
        mustResetPassword: row.mustResetPassword,
        notes: row.notes,
      },
    });
  }
  console.log(`→ Restored ${backups.length} ESS portal user(s).`);
  for (const row of backups) {
    console.log(`   · ${row.email} (${row.role})`);
  }
}

async function cleanUploadedBranding() {
  const dir = path.join(root, 'public', 'uploads', 'branding');
  try {
    const files = await readdir(dir);
    let removed = 0;
    for (const file of files) {
      await unlink(path.join(dir, file));
      removed++;
    }
    if (removed > 0) console.log(`→ Removed ${removed} uploaded branding file(s) from disk.`);
  } catch {
    // directory may not exist
  }
}

async function applyBlankShellEnv() {
  execSync('node scripts/apply-demo-context.mjs blank-shell', {
    cwd: root,
    stdio: 'inherit',
  });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set. Source .env.local first.');
  }

  if (!purgeEss) {
    console.log('Backing up ESS portal users…');
    const essBackups = await backupEssUsers();
    console.log(`  Found ${essBackups.length} ESS user(s).`);

    const staffCount = await prisma.user.count();
    if (staffCount > 0) {
      console.log(`  Will remove ${staffCount} staff dashboard user(s).`);
    }

    await prisma.$disconnect();

    console.log('\nResetting database (migrations only, no seed)…\n');
    execSync('npx prisma migrate reset --force --skip-seed', {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
    });

    const prisma2 = new PrismaClient();
    try {
      await restoreEssUsers(essBackups);
    } finally {
      await prisma2.$disconnect();
    }
  } else {
    console.log('Purging entire database including ESS users…\n');
    await prisma.$disconnect();
    execSync('npx prisma migrate reset --force --skip-seed', {
      cwd: root,
      stdio: 'inherit',
      env: process.env,
    });
  }

  await cleanUploadedBranding();
  console.log('\nApplying blank-shell environment profile…');
  await applyBlankShellEnv();

  console.log('\nDone.');
  console.log('  Database:', purgeEss ? 'completely empty' : 'ESS portal logins only');
  console.log('  Branding: neutral env + no uploaded assets (Stabex login image disabled)');
  console.log('  Next: add a staff admin (seed:production), then Company setup in the dashboard.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
