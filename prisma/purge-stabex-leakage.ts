/**
 * Remove leftover Stabex / petroleum-retail demo data from the database.
 *
 * Run: npm run db:purge-stabex
 * Requires DATABASE_URL (source .env.local first).
 */
import { PrismaClient, Prisma } from '@prisma/client';

const STABEX_EMAIL_FRAGMENT = 'stabexintl.com';
const STABEX_NAME_FRAGMENTS = ['stabex international', 'stabex kenya', 'stabex uganda'];

const prisma = new PrismaClient();

function containsStabex(value: unknown): boolean {
  if (value == null) return false;
  const text = JSON.stringify(value).toLowerCase();
  return text.includes('stabex') || text.includes('stabexintl.com');
}

async function purgeEssAndStaffUsers() {
  const ess = await prisma.essPortalUser.deleteMany({
    where: { email: { contains: STABEX_EMAIL_FRAGMENT, mode: 'insensitive' } },
  });
  const staff = await prisma.user.deleteMany({
    where: { email: { contains: STABEX_EMAIL_FRAGMENT, mode: 'insensitive' } },
  });
  if (ess.count || staff.count) {
    console.log(`→ Removed ${ess.count} ESS and ${staff.count} staff user(s) with @${STABEX_EMAIL_FRAGMENT}`);
  }
}

async function purgePetroleumRetailSettings() {
  const keys = await prisma.systemSetting.findMany({
    where: {
      OR: [
        { key: { contains: 'petroleum-retail' } },
        { key: { contains: 'stabex', mode: 'insensitive' } },
      ],
    },
    select: { key: true },
  });
  if (keys.length) {
    await prisma.systemSetting.deleteMany({
      where: { key: { in: keys.map((k) => k.key) } },
    });
    console.log(`→ Removed ${keys.length} petroleum-retail / Stabex settings key(s):`);
    for (const k of keys) console.log(`   · ${k.key}`);
  }
}

async function scrubSettingsJson() {
  const rows = await prisma.systemSetting.findMany();
  let updated = 0;
  for (const row of rows) {
    if (!containsStabex(row.value)) continue;
    const next = JSON.parse(
      JSON.stringify(row.value).replace(/stabex international/gi, 'Demo Corporation').replace(/stabex/gi, 'Demo'),
    );
    await prisma.systemSetting.update({
      where: { key: row.key },
      data: { value: next as Prisma.InputJsonValue },
    });
    updated++;
    console.log(`→ Scrubbed Stabex text in setting: ${row.key}`);
  }
  if (!updated) console.log('→ No Stabex strings found in remaining settings JSON.');
}

async function purgeStaleOutsourcingClients() {
  const stale = await prisma.outsourcingClient.findMany({
    where: {
      OR: [
        { entityCode: { contains: 'petroleum-retail' } },
        { name: { contains: 'stabex', mode: 'insensitive' } },
      ],
    },
    select: { id: true, name: true, entityCode: true },
  });
  if (!stale.length) return;

  await prisma.outsourcingClient.deleteMany({
    where: { id: { in: stale.map((c) => c.id) } },
  });
  console.log(`→ Removed ${stale.length} Stabex / petroleum-retail outsourcing client(s):`);
  for (const c of stale) console.log(`   · ${c.name} (${c.entityCode ?? 'no code'})`);
}

async function renameStabexOutsourcingClients() {
  const clients = await prisma.outsourcingClient.findMany({
    where: { name: { contains: 'stabex', mode: 'insensitive' } },
  });
  for (const client of clients) {
    const name = client.name.replace(/stabex international/gi, 'Demo Corporation').replace(/stabex/gi, 'Demo');
    await prisma.outsourcingClient.update({ where: { id: client.id }, data: { name } });
    console.log(`→ Renamed outsourcing client ${client.name} → ${name}`);
  }
}

async function purgeRecruitmentStabexClients() {
  const clients = await prisma.client.findMany({
    where: { name: { contains: 'stabex', mode: 'insensitive' } },
    select: { id: true, name: true },
  });
  if (!clients.length) return;
  for (const client of clients) {
    await prisma.client.update({
      where: { id: client.id },
      data: { name: client.name.replace(/stabex international/gi, 'Demo Corporation').replace(/stabex/gi, 'Demo') },
    });
    console.log(`→ Renamed recruitment client: ${client.name}`);
  }
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set.');
  }

  console.log('Purging Stabex / petroleum-retail leakage from database…\n');

  await purgeEssAndStaffUsers();
  await purgePetroleumRetailSettings();
  await purgeStaleOutsourcingClients();
  await renameStabexOutsourcingClients();
  await purgeRecruitmentStabexClients();
  await scrubSettingsJson();

  const remainingEss = await prisma.essPortalUser.findMany({
    where: { email: { contains: 'stabex', mode: 'insensitive' } },
    select: { email: true },
  });
  if (remainingEss.length) {
    console.warn('\nWarning: Stabex ESS users still present:', remainingEss.map((u) => u.email).join(', '));
  } else {
    console.log('\nDone. No @stabexintl.com accounts remain.');
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
