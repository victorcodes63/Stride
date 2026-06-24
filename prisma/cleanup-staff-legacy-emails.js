/**
 * Remap staff User emails from a legacy production domain to @example.com (see LEGACY_HOST below).
 * (same addresses as prisma/seed-demo.ts). If the @example.com row already exists,
 * merge foreign keys into it and delete the legacy row.
 *
 * Run: node prisma/cleanup-staff-legacy-emails.js
 * Requires DATABASE_URL (e.g. load .env.local in the shell first).
 */

const { PrismaClient } = require('@prisma/client');
const { reassignUserFkColumns } = require('./merge-user-refs.cjs');

const LEGACY_HOST = '3rdparkhospital.com';
const TARGET_DOMAIN = 'example.com';

const prisma = new PrismaClient();

function targetEmailFor(legacyEmail) {
  const lower = legacyEmail.trim().toLowerCase();
  const at = lower.indexOf('@');
  if (at === -1) return null;
  const local = lower.slice(0, at);
  const host = lower.slice(at + 1);
  if (host !== LEGACY_HOST) return null;
  return `${local}@${TARGET_DOMAIN}`;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const candidates = await prisma.user.findMany({
    where: { email: { contains: LEGACY_HOST, mode: 'insensitive' } },
  });

  let renamed = 0;
  let merged = 0;

  for (const dup of candidates) {
    const nextEmail = targetEmailFor(dup.email);
    if (!nextEmail) {
      console.warn(`Skipping unexpected email shape: ${dup.email}`);
      continue;
    }

    const keeper = await prisma.user.findUnique({ where: { email: nextEmail } });

    if (keeper && keeper.id !== dup.id) {
      await reassignUserFkColumns(prisma, keeper.id, dup.id);
      await prisma.user.delete({ where: { id: dup.id } });
      merged++;
      console.log(`Merged ${dup.email} → ${nextEmail} (removed duplicate user ${dup.name})`);
    } else if (!keeper) {
      await prisma.user.update({
        where: { id: dup.id },
        data: { email: nextEmail },
      });
      renamed++;
      console.log(`Updated ${dup.email} → ${nextEmail}`);
    }
  }

  console.log(`Done. ${renamed} email(s) renamed, ${merged} duplicate user(s) merged into existing @${TARGET_DOMAIN} accounts.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
