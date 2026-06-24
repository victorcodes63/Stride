#!/usr/bin/env node
/**
 * Turn on every moduleAdminFlags toggle in saved company setup (all vertical contexts).
 * Run after enabling full-platform demo env — fixes nav for existing DB rows.
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const SETUP_PREFIX = 'admin.company.setup';

const ALL_ON = {
  core: true,
  leave: true,
  time: true,
  payroll: true,
  ats: true,
  performance: true,
  hse: true,
  accounts: true,
  disciplinary: true,
  reports: true,
  assets: true,
  ess: true,
  communications: true,
  training: true,
  documents: true,
};

async function main() {
  const rows = await prisma.systemSetting.findMany({
    where: { key: { startsWith: SETUP_PREFIX } },
  });
  if (rows.length === 0) {
    console.log('No company setup rows found — nothing to update.');
    return;
  }
  for (const row of rows) {
    const value =
      row.value && typeof row.value === 'object' && !Array.isArray(row.value)
        ? { ...row.value, moduleAdminFlags: ALL_ON }
        : { moduleAdminFlags: ALL_ON };
    await prisma.systemSetting.update({
      where: { key: row.key },
      data: { value },
    });
    console.log(`✓ ${row.key}`);
  }
  console.log(`Updated ${rows.length} company setup record(s).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
