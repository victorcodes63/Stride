/**
 * Seed Accounts module data for local / QA testing (clients, contracts, invoices,
 * payments, vendors, staff access).
 *
 * Idempotent per prefix: removes previous rows named like "[SEED_ACCOUNTS] …" then recreates.
 *
 * Run (from repo root, with DATABASE_URL set):
 *   npm run db:seed-accounts
 *
 * Optional env:
 *   ACCOUNTS_SEED_USER_EMAIL — contract manager + demo in-app alerts + global access (default: vchumo@example.com)
 *
 * Demo staff notifications mirror production contract-reminder wording and deep-link into the seeded contracts / invoice.
 */

const fs = require('fs');
const path = require('path');
const { PrismaClient, Prisma } = require('@prisma/client');

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
  } catch (_) {
    /* no .env.local */
  }
}

loadDatabaseUrlFromEnvLocal();

const prisma = new PrismaClient();
const { syncLinkedBillingClients } = require('./lib/sync-linked-billing-clients.js');

const PREFIX = '[SEED_ACCOUNTS]';
const dec = (s) => new Prisma.Decimal(s);

/** Calendar date at UTC noon (matches @db.Date). */
function utcDayFromToday(deltaDays) {
  const n = new Date();
  const t = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate() + deltaDays, 12, 0, 0);
  return new Date(t);
}

function ymd(d) {
  return d instanceof Date ? d.toISOString().slice(0, 10) : String(d).slice(0, 10);
}

async function wipe() {
  await prisma.staffNotification.deleteMany({ where: { title: { startsWith: PREFIX } } });
  await prisma.accountsVendor.deleteMany({ where: { name: { startsWith: PREFIX } } });
  await prisma.accountsClient.deleteMany({
    where: {
      OR: [{ name: { startsWith: PREFIX } }, { name: { startsWith: '[SEED_INVOICE]' } }],
    },
  });
  await prisma.schedulerLock.deleteMany({ where: { key: 'contract-reminders' } });
}

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set.');
    process.exit(1);
  }

  const seedEmail = (process.env.ACCOUNTS_SEED_USER_EMAIL || 'vchumo@example.com').toLowerCase();

  const user = await prisma.user.findUnique({ where: { email: seedEmail } });
  if (!user) {
    console.error(`No User with email ${seedEmail}. Run db:seed-staff or create the user first.`);
    process.exit(1);
  }

  await wipe();

  const syncResult = await syncLinkedBillingClients(prisma);
  console.log(
    `  Billing sync: removed ${syncResult.deletedDemoCount} demo row(s); linked recruitment ${syncResult.recruitmentSynced}, outsourcing ${syncResult.outsourcingSynced}.`,
  );

  const primary = await prisma.accountsClient.findFirst({
    orderBy: [{ type: 'asc' }, { name: 'asc' }],
  });

  if (!primary) {
    console.warn(
      '  No billing clients after sync. Add Recruitment clients and/or Outsourcing clients, then re-run or open Accounts → Clients. Setting staff access only.',
    );
    const globalAccess = await prisma.accountsStaffAccess.findFirst({
      where: { userId: user.id, accountsClientId: null },
    });
    const accessPayload = {
      canManageContracts: true,
      canManageInvoices: true,
      canManagePayments: true,
      canManageVendors: true,
    };
    if (globalAccess) {
      await prisma.accountsStaffAccess.update({ where: { id: globalAccess.id }, data: accessPayload });
    } else {
      await prisma.accountsStaffAccess.create({
        data: { userId: user.id, accountsClientId: null, ...accessPayload },
      });
    }
    console.log(`  User ${user.email}: global AccountsStaffAccess only (no demo data).`);
    return;
  }

  const globalAccess = await prisma.accountsStaffAccess.findFirst({
    where: { userId: user.id, accountsClientId: null },
  });
  const accessPayload = {
    canManageContracts: true,
    canManageInvoices: true,
    canManagePayments: true,
    canManageVendors: true,
  };
  if (globalAccess) {
    await prisma.accountsStaffAccess.update({ where: { id: globalAccess.id }, data: accessPayload });
  } else {
    await prisma.accountsStaffAccess.create({
      data: { userId: user.id, accountsClientId: null, ...accessPayload },
    });
  }

  await prisma.accountsStaffAccess.upsert({
    where: {
      userId_accountsClientId: { userId: user.id, accountsClientId: primary.id },
    },
    create: {
      userId: user.id,
      accountsClientId: primary.id,
      canManageContracts: true,
      canManageInvoices: false,
      canManagePayments: false,
      canManageVendors: false,
    },
    update: {
      canManageContracts: true,
      canManageInvoices: false,
      canManagePayments: false,
      canManageVendors: false,
    },
  });

  const startLastYear = utcDayFromToday(-400);
  const contractActive = await prisma.accountsContract.create({
    data: {
      clientId: primary.id,
      title: 'Active HR services retainer',
      reference: 'CNT-SEED-ACTIVE',
      startDate: startLastYear,
      endDate: utcDayFromToday(90),
      remindersDisabled: false,
      managers: { create: [{ userId: user.id }] },
    },
  });

  const contractExpired = await prisma.accountsContract.create({
    data: {
      clientId: primary.id,
      title: 'Expired staffing agreement',
      reference: 'CNT-SEED-EXPIRED',
      startDate: utcDayFromToday(-400),
      endDate: utcDayFromToday(-20),
      remindersDisabled: false,
      managers: { create: [{ userId: user.id }] },
    },
  });

  const contractQuiet = await prisma.accountsContract.create({
    data: {
      clientId: primary.id,
      title: 'Renewal pipeline (reminders off)',
      reference: 'CNT-SEED-QUIET',
      startDate: utcDayFromToday(-200),
      endDate: utcDayFromToday(45),
      remindersDisabled: true,
      managers: { create: [{ userId: user.id }] },
    },
  });

  await prisma.contractReminderSent.createMany({
    data: [
      { contractId: contractActive.id, kind: 'one_month' },
      { contractId: contractExpired.id, kind: 'expired_weekly', sentAt: utcDayFromToday(-10) },
    ],
  });

  const invUnpaid = await prisma.accountsInvoice.create({
    data: {
      clientId: primary.id,
      contractId: contractActive.id,
      invoiceNumber: 1,
      issueDate: utcDayFromToday(-5),
      dueDate: utcDayFromToday(25),
      paymentBank: 'consultancy_fees',
      vatRateBps: 1600,
      status: 'unpaid',
      notes: `${PREFIX} Invoice unpaid — VAT = round(sum(lines ex-VAT) * 0.16, 2). Here 35000 * 0.16 = 5600.`,
      lines: {
        create: [
          { item: 'Monthly retainer', amountExVat: dec('10000.00'), sortOrder: 0 },
          { item: 'Additional HR support', amountExVat: dec('25000.00'), sortOrder: 1 },
        ],
      },
    },
    include: { lines: true },
  });

  const invPartial = await prisma.accountsInvoice.create({
    data: {
      clientId: primary.id,
      contractId: contractActive.id,
      invoiceNumber: 2,
      issueDate: utcDayFromToday(-12),
      dueDate: utcDayFromToday(18),
      paymentBank: 'payroll_only',
      status: 'partial',
      notes: `${PREFIX} Partially paid`,
      lines: {
        create: [{ item: 'Placement fee', amountExVat: dec('50000.00'), sortOrder: 0 }],
      },
    },
  });

  const payment = await prisma.accountsClientPayment.create({
    data: {
      clientId: primary.id,
      receivedAt: utcDayFromToday(-3),
      amount: dec('30000.00'),
      reference: 'MPESA-SEED-001',
      method: 'M-Pesa',
      notes: `${PREFIX} partial payment`,
    },
  });

  await prisma.accountsInvoicePaymentAllocation.create({
    data: {
      paymentId: payment.id,
      invoiceId: invPartial.id,
      amount: dec('30000.00'),
    },
  });

  const vendor = await prisma.accountsVendor.create({
    data: {
      name: `${PREFIX} Stationery & IT Supplies`,
      contactName: 'Vendor AP',
      contactEmail: 'ap-vendor@example.test',
      currency: 'KES',
      notes: `${PREFIX} creditor demo`,
    },
  });

  const bill = await prisma.accountsVendorBill.create({
    data: {
      vendorId: vendor.id,
      billRef: 'BILL-SEED-01',
      issueDate: utcDayFromToday(-8),
      dueDate: utcDayFromToday(22),
      status: 'partial',
      notes: `${PREFIX} vendor bill`,
      lines: {
        create: [
          { item: 'Laptops (ex-VAT subtotal demo)', amountExVat: dec('120000.00'), sortOrder: 0 },
          { item: 'Office supplies', amountExVat: dec('15000.00'), sortOrder: 1 },
        ],
      },
    },
  });

  const vp = await prisma.accountsVendorPayment.create({
    data: {
      vendorId: vendor.id,
      paidAt: utcDayFromToday(-2),
      amount: dec('50000.00'),
      reference: 'EFT-SEED-V1',
      method: 'Bank',
    },
  });

  await prisma.accountsVendorPaymentAllocation.create({
    data: {
      paymentId: vp.id,
      billId: bill.id,
      amount: dec('50000.00'),
    },
  });

  const clientName = primary.name;
  await prisma.staffNotification.deleteMany({
    where: {
      userId: user.id,
      OR: [
        { title: `Contract reminder — ${clientName}` },
        { title: `Expired contract — ${clientName}` },
        { title: 'Invoice awaiting payment' },
      ],
    },
  });

  await prisma.staffNotification.createMany({
    data: [
      {
        userId: user.id,
        title: `Contract reminder — ${clientName}`,
        body: `Active HR services retainer for ${clientName} — 1 month before expiry (ends ${ymd(contractActive.endDate)}).`,
        href: `/dashboard/people/contracts/${contractActive.id}`,
        contractId: contractActive.id,
        event: 'contract_expiring',
        priority: 'info',
      },
      {
        userId: user.id,
        title: `Expired contract — ${clientName}`,
        body: `Expired staffing agreement (${clientName}) ended on ${ymd(contractExpired.endDate)}. Follow up with the client or turn off reminders on the contract.`,
        href: `/dashboard/people/contracts/${contractExpired.id}`,
        contractId: contractExpired.id,
        event: 'contract_expiring',
        priority: 'info',
        readAt: new Date(),
      },
      {
        userId: user.id,
        title: 'Invoice awaiting payment',
        body: `Invoice #${invUnpaid.invoiceNumber} for ${clientName} is still unpaid${
          invUnpaid.dueDate ? ` (due ${ymd(invUnpaid.dueDate)})` : ''
        }. Review allocations or contact the client.`,
        href: `/dashboard/accounts/invoices/${invUnpaid.id}`,
        contractId: null,
        event: null,
        priority: 'action_required',
      },
    ],
  });

  const subtotal =
    invUnpaid.lines.reduce((sum, ln) => sum + Number(ln.amountExVat), 0) || 0;
  const vat = Math.round(subtotal * 0.16 * 100) / 100;

  const clientCount = await prisma.accountsClient.count();

  console.log('Accounts module seed OK.');
  console.log(`  User: ${user.email} (global + scoped AccountsStaffAccess)`);
  console.log(
    `  Billing profiles: ${clientCount} total (synced recruitment ${syncResult.recruitmentSynced}, outsourcing ${syncResult.outsourcingSynced}); demo seed on ${primary.name} (${primary.type})`,
  );
  console.log(`  Contracts: active ${contractActive.id}, expired ${contractExpired.id}, quiet ${contractQuiet.id}`);
  console.log(
    `  Invoice #${invUnpaid.invoiceNumber} ex-VAT subtotal ${subtotal} KES → VAT @16% = ${vat} (invoice-total method)`,
  );
  console.log(`  Vendor / bill / payment: ${vendor.name}`);
  console.log(`  SchedulerLock "contract-reminders" cleared (cron can run again same day in dev).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
