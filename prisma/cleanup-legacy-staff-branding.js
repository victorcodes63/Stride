/**
 * One-off: remove legacy vendor labels from staff User names, merge duplicate
 * user rows (same display name + role, different emails), and reassign foreign keys
 * so the duplicate row can be deleted.
 *
 * Run: node prisma/cleanup-legacy-staff-branding.js
 * Requires DATABASE_URL (load .env.local in shell if needed).
 */

const { PrismaClient } = require('@prisma/client');
const { reassignUserFkColumns } = require('./merge-user-refs.cjs');

const prisma = new PrismaClient();

async function renameLegacyBrandingInNames() {
  const legacy = await prisma.user.findMany({
    where: {
      OR: [
        { name: { contains: '3rd Park', mode: 'insensitive' } },
        { name: { contains: '3rdPark', mode: 'insensitive' } },
        { name: { contains: '3RD PARK', mode: 'insensitive' } },
      ],
    },
  });
  let n = 0;
  for (const u of legacy) {
    const next = u.name
      .replace(/\b3rd\s*Park\b/gi, 'Stabex')
      .replace(/3rdPark/gi, 'Stabex')
      .replace(/\s+/g, ' ')
      .trim();
    await prisma.user.update({
      where: { id: u.id },
      data: { name: next || 'HR Administrator' },
    });
    n++;
  }
  console.log(`Renamed ${n} user display name(s) (legacy vendor → Stabex).`);
}

async function mergeDuplicateUsersByNameAndRole() {
  const all = await prisma.user.findMany({ orderBy: { createdAt: 'asc' } });
  const groups = new Map();
  for (const u of all) {
    const key = `${u.name.trim().toLowerCase()}__${u.role}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(u);
  }

  let deleted = 0;
  let deactivated = 0;

  for (const [, arr] of groups) {
    if (arr.length < 2) continue;
    const keeper = arr[0];
    for (const dup of arr.slice(1)) {
      await reassignUserFkColumns(prisma, keeper.id, dup.id);
      try {
        await prisma.user.delete({ where: { id: dup.id } });
        deleted++;
        console.log(`Removed duplicate account ${dup.email} (kept ${keeper.email}, ${keeper.name}).`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        await prisma.user.update({
          where: { id: dup.id },
          data: {
            isActive: false,
            email: `archived.${dup.id.slice(0, 12)}@merged.invalid`,
            name: `${dup.name.replace(/\s*\(archived\)\s*$/i, '').trim()} (archived)`,
          },
        });
        deactivated++;
        console.warn(`Could not delete ${dup.email}; marked inactive. ${msg}`);
      }
    }
  }
  console.log(`Duplicate merge: ${deleted} user row(s) removed, ${deactivated} archived.`);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  await renameLegacyBrandingInNames();
  await mergeDuplicateUsersByNameAndRole();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
