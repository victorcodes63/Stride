/**
 * Rename billing-linked clients that use retired demo brand names (Nyati, Stabex, Horizon)
 * to generic marketing-safe labels before screenshot capture.
 *
 * Usage:
 *   node scripts/sanitize-marketing-billing-clients.mjs
 *
 * Requires DATABASE_URL (loaded from .env.local when unset).
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function loadDatabaseUrl() {
  if (process.env.DATABASE_URL) return;
  const path = join(ROOT, '.env.local');
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq);
    if (key !== 'DATABASE_URL') continue;
    let val = trimmed.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    process.env.DATABASE_URL = val;
    return;
  }
  throw new Error('DATABASE_URL not set and not found in .env.local');
}

/** @type {Array<{ test: (name: string) => boolean; replace: Record<string, string> }>} */
const RULES = [
  {
    test: (name) => /nyati sacco/i.test(name),
    replace: {
      name: 'Heritage Members SACCO Ltd',
      contactName: 'Grace Mwikali',
      contactEmail: 'billing@heritage.imara.co.ke',
      contactPhone: '+254 712 345 601',
    },
  },
  {
    test: (name) => /horizon travels/i.test(name),
    replace: {
      name: 'Summit Travel Group',
      contactName: 'James Otieno',
      contactEmail: 'accounts@summittravel.demo',
      contactPhone: '+254 733 456 702',
    },
  },
  {
    test: (name) => /stabex international/i.test(name),
    replace: {
      name: 'Northline Petroleum Co.',
      contactName: 'Faith Njeri',
      contactEmail: 'finance@northline.demo',
      contactPhone: '+254 722 987 803',
    },
  },
  {
    test: (name) => /stabex kenya/i.test(name),
    replace: {
      name: 'Northline Kenya Ltd',
      contactName: 'Peter Kamau',
      contactEmail: 'kenya@northline.demo',
      contactPhone: '+254 711 222 804',
    },
  },
  {
    test: (name) => /stabex uganda/i.test(name),
    replace: {
      name: 'Northline Uganda Ltd',
      contactName: 'Sarah Nakato',
      contactEmail: 'uganda@northline.demo',
      contactPhone: '+256 700 333 905',
    },
  },
  {
    test: (name) => /stabex/i.test(name),
    replace: {
      name: 'Northline Petroleum Co.',
      contactName: 'Faith Njeri',
      contactEmail: 'finance@northline.demo',
      contactPhone: '+254 722 987 803',
    },
  },
];

function matchRule(name) {
  return RULES.find((rule) => rule.test(name));
}

async function renameTable(prisma, label, fetchRows, updateRow) {
  const rows = await fetchRows();
  let count = 0;
  for (const row of rows) {
    const rule = matchRule(row.name);
    if (!rule) continue;
    await updateRow(row.id, rule.replace);
    console.log(`  ${label}: "${row.name}" → "${rule.replace.name}"`);
    count += 1;
  }
  return count;
}

async function main() {
  loadDatabaseUrl();
  const prisma = new PrismaClient();

  console.log('Sanitizing billing-linked client names for marketing…');

  let total = 0;
  total += await renameTable(
    prisma,
    'OutsourcingClient',
    () => prisma.outsourcingClient.findMany({ select: { id: true, name: true } }),
    (id, data) => prisma.outsourcingClient.update({ where: { id }, data }),
  );
  total += await renameTable(
    prisma,
    'Client',
    () => prisma.client.findMany({ select: { id: true, name: true } }),
    (id, data) => prisma.client.update({ where: { id }, data }),
  );
  total += await renameTable(
    prisma,
    'AccountsClient',
    () => prisma.accountsClient.findMany({ select: { id: true, name: true } }),
    (id, data) => prisma.accountsClient.update({ where: { id }, data }),
  );

  const { syncLinkedBillingClients } = await import('../prisma/lib/sync-linked-billing-clients.js');
  const sync = await syncLinkedBillingClients(prisma);
  console.log(
    `→ Synced billing clients (${sync.outsourcingSynced} outsourcing, ${sync.recruitmentSynced} recruitment)`,
  );

  const setupRows = await prisma.systemSetting.findMany({
    where: { key: { startsWith: 'admin.company.setup' } },
  });
  const STRING_REPLACEMENTS = [
    ['Nyati SACCO Society Ltd', 'Heritage Members SACCO Ltd'],
    ['Nyati SACCO', 'Heritage Members SACCO'],
    ['nyati.imara.co.ke', 'heritage.imara.co.ke'],
    ['Stabex International', 'Northline Petroleum Co.'],
    ['Stabex Kenya Ltd', 'Northline Kenya Ltd'],
    ['Stabex Uganda Ltd', 'Northline Uganda Ltd'],
    ['stabexintl.com', 'northline.imara.co.ke'],
    ['Stabex', 'Northline'],
  ];
  function patchStrings(value) {
    if (typeof value === 'string') {
      let next = value;
      for (const [from, to] of STRING_REPLACEMENTS) next = next.split(from).join(to);
      return next;
    }
    if (Array.isArray(value)) return value.map(patchStrings);
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, patchStrings(v)]));
    }
    return value;
  }
  let setupPatched = 0;
  for (const row of setupRows) {
    const patched = patchStrings(row.value);
    if (JSON.stringify(patched) !== JSON.stringify(row.value)) {
      await prisma.systemSetting.update({ where: { key: row.key }, data: { value: patched } });
      console.log(`  Company setup: patched ${row.key}`);
      setupPatched += 1;
    }
  }

  execSync('npx tsx prisma/fix-operating-entities-multi.ts', { cwd: ROOT, stdio: 'inherit' });

  console.log(`Done. Renamed ${total} row(s); patched ${setupPatched} company setup record(s).`);
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
