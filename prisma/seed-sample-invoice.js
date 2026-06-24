/**
 * Create one sample Accounts invoice (multi-line, KES, 16% VAT note in DB).
 * VAT for display/reporting: round(sum(line amount ex-VAT) × 0.16, 2) — printed in console.
 *
 * Run: npm run db:seed-sample-invoice
 *
 * Optional env:
 *   SAMPLE_INVOICE_CLIENT_ID — use this AccountsClient id (must exist)
 * If unset: runs sync with recruitment/outsourcing, then picks the first linked billing profile
 * (outsourcing, then recruitment), else the first custom profile. No demo client is created.
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient, Prisma } = require('@prisma/client');
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
const dec = (s) => new Prisma.Decimal(s);

function utcDay(deltaDays) {
  const n = new Date();
  const t = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + deltaDays, 12, 0, 0);
  return new Date(t);
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const envClientId = process.env.SAMPLE_INVOICE_CLIENT_ID?.trim();
  let client;

  if (envClientId) {
    client = await prisma.accountsClient.findUnique({ where: { id: envClientId } });
    if (!client) {
      console.error(`No AccountsClient with id ${envClientId}`);
      process.exit(1);
    }
  } else {
    await syncLinkedBillingClients(prisma);
    client =
      (await prisma.accountsClient.findFirst({
        where: { type: 'outsourcing' },
        orderBy: { name: 'asc' },
      })) ||
      (await prisma.accountsClient.findFirst({
        where: { type: 'recruitment' },
        orderBy: { name: 'asc' },
      })) ||
      (await prisma.accountsClient.findFirst({
        where: { type: 'custom' },
        orderBy: { name: 'asc' },
      }));
    if (!client) {
      console.error(
        'No AccountsClient found. Add a recruitment employer, outsourcing client, or custom billing profile first (or set SAMPLE_INVOICE_CLIENT_ID).',
      );
      process.exit(1);
    }
    console.log('Using billing profile:', client.id, client.name, `(${client.type})`);
  }

  const invoiceNumber = client.nextInvoiceNumber;
  const issueDate = utcDay(0);
  const dueDate = utcDay(30);

  const lineSpecs = [
    { item: 'HR outsourcing — monthly retainer', amountExVat: '18750.00', sortOrder: 0 },
    { item: 'Payroll administration & statutory filings', amountExVat: '12400.00', sortOrder: 1 },
    { item: 'Disbursements (pass-through)', amountExVat: '3250.50', sortOrder: 2 },
  ];

  const subtotalExVat = lineSpecs.reduce((s, l) => s + parseFloat(l.amountExVat), 0);
  const vatRate = 0.16;
  const vatAmount = Math.round(subtotalExVat * vatRate * 100) / 100;
  const totalIncVat = Math.round((subtotalExVat + vatAmount) * 100) / 100;

  const invoice = await prisma.$transaction(async (tx) => {
    const inv = await tx.accountsInvoice.create({
      data: {
        clientId: client.id,
        invoiceNumber,
        issueDate,
        dueDate,
        taxDate: issueDate,
        currency: 'KES',
        vatRateBps: 1600,
        paymentBank: 'payroll_only',
        status: 'unpaid',
        notes: `Sample invoice (seed). Subtotal ex-VAT ${subtotalExVat.toFixed(2)} KES; VAT @16% (invoice-total method) ${vatAmount.toFixed(2)} KES; total ${totalIncVat.toFixed(2)} KES incl. VAT.`,
        lines: {
          create: lineSpecs.map((l) => ({
            item: l.item,
            amountExVat: dec(l.amountExVat),
            sortOrder: l.sortOrder,
          })),
        },
      },
      include: { lines: { orderBy: { sortOrder: 'asc' } } },
    });

    await tx.accountsClient.update({
      where: { id: client.id },
      data: { nextInvoiceNumber: invoiceNumber + 1 },
    });

    return inv;
  });

  console.log('\nSample invoice created');
  console.log('  AccountsClient:', client.name, `(${client.id})`);
  console.log('  Invoice id:', invoice.id);
  console.log('  Invoice number:', invoiceNumber, '(per client sequence)');
  console.log('  Issue / due:', issueDate.toISOString().slice(0, 10), '/', dueDate.toISOString().slice(0, 10));
  console.log('  Lines (ex-VAT):');
  for (const l of invoice.lines) {
    console.log('   -', l.item, String(l.amountExVat));
  }
  console.log('  Subtotal ex-VAT:', subtotalExVat.toFixed(2), invoice.currency);
  console.log('  VAT 16% (round on subtotal):', vatAmount.toFixed(2), invoice.currency);
  console.log('  Total incl. VAT:', totalIncVat.toFixed(2), invoice.currency);
  console.log('  Status:', invoice.status);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
