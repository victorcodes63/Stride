/**
 * One-off / CI: link recruitment & outsourcing companies to billing profiles, drop demo rows.
 * Run: npm run db:sync-accounts-clients
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { syncLinkedBillingClients } = require('./lib/sync-linked-billing-clients.js');

function loadDatabaseUrlFromEnvLocal() {
  if (process.env.DATABASE_URL) return;
  try {
    const p = path.join(process.cwd(), '.env.local');
    const txt = fs.readFileSync(p, 'utf8');
    for (const line of txt.split('\n')) {
      const m = line.match(/^\s*DATABASE_URL\s*=\s*(.+)$/);
      if (!m) continue;
      let v = m[1].trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      process.env.DATABASE_URL = v;
      break;
    }
  } catch (_) {}
}

loadDatabaseUrlFromEnvLocal();
const prisma = new PrismaClient();

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }
  const r = await syncLinkedBillingClients(prisma);
  console.log(
    `sync-accounts-clients: removed ${r.deletedDemoCount} demo row(s); recruitment ${r.recruitmentSynced}, outsourcing ${r.outsourcingSynced}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
