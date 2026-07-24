/**
 * B4 smoke checks: quote→invoice totals; won automation idempotency helpers.
 * Run: npx tsx scripts/verify-b4-won-deal.ts
 */
import { PrismaClient } from '@prisma/client';
import {
  convertAcceptedQuoteToInvoice,
  createInvoiceFromWonDeal,
} from '../src/lib/sales-finance-bridge';
import { saveWonDealSettings } from '../src/lib/sales/won-deal-settings';
import { runWonDealAutomation } from '../src/lib/sales/won-deal-automation';
import { lineItemExtendedAmount } from '../src/lib/sales/access';

const prisma = new PrismaClient();
const round2 = (n: number) => Math.round(n * 100) / 100;

type Check = { name: string; ok: boolean; detail?: string };

async function main() {
  const checks: Check[] = [];
  const org = await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!org) throw new Error('No org');

  const staff = await prisma.user.findFirst({
    where: { organizationMemberships: { some: { organizationId: org.id } } },
    select: { id: true },
  });
  const emp = await prisma.employee.findFirst({
    where: { organizationId: org.id },
    select: { id: true },
  });
  const client = await prisma.accountsClient.findFirst({
    where: { organizationId: org.id },
    select: { id: true, outsourcingClientId: true },
  });
  if (!staff || !emp || !client) {
    console.error('Need staff, employee, and accounts client in seed data.');
    process.exit(1);
  }

  await prisma.$transaction(async (tx) => {
    await saveWonDealSettings(
      tx,
      org.id,
      {
        requireAcceptedQuote: false,
        autoCreateInvoice: true,
        autoCreateSalesActual: true,
        createDeliveryProject: Boolean(client.outsourcingClientId),
        offerFleetOrder: false,
      },
      staff.id,
    );

    const agg = await tx.salesQuote.aggregate({
      where: { organizationId: org.id },
      _max: { quoteNumber: true },
    });
    const quoteNumber = (agg._max.quoteNumber ?? 0) + 1;

    const deal = await tx.salesDeal.create({
      data: {
        organizationId: org.id,
        name: 'B4 verify deal',
        value: 1160,
        currency: 'KES',
        ownerEmployeeId: emp.id,
        accountsClientId: client.id,
        stage: 'negotiation',
      },
    });

    const quote = await tx.salesQuote.create({
      data: {
        organizationId: org.id,
        quoteNumber,
        title: 'B4 verify quote',
        status: 'accepted',
        currency: 'KES',
        discountPct: 0,
        taxRateBps: 1600,
        dealId: deal.id,
        accountsClientId: client.id,
        acceptedAt: new Date(),
        lineItems: {
          create: [
            {
              organizationId: org.id,
              description: 'Service line',
              quantity: 1,
              unitPrice: 1000,
              discountPct: 0,
              sortOrder: 0,
            },
          ],
        },
      },
      include: { lineItems: true },
    });

    const lineAmt = lineItemExtendedAmount({
      quantity: 1,
      unitPrice: 1000,
      discountPct: 0,
      isRecurring: false,
      termMonths: null,
    });
    const expectedVat = round2((lineAmt * 1600) / 10000);
    const expectedTotal = round2(lineAmt + expectedVat);

    const inv1 = await convertAcceptedQuoteToInvoice(tx, {
      organizationId: org.id,
      quoteId: quote.id,
    });
    const invoice = await tx.accountsInvoice.findUniqueOrThrow({
      where: { id: inv1.accountsInvoiceId },
      include: { lines: true },
    });
    const subEx = invoice.lines.reduce((s, l) => s + Number(l.amountExVat), 0);
    const vat = round2((subEx * invoice.vatRateBps) / 10000);
    const total = round2(subEx + vat);
    checks.push({
      name: 'quote→invoice totals match',
      ok: total === expectedTotal && invoice.vatRateBps === 1600,
      detail: `expected ${expectedTotal} got ${total}`,
    });

    const inv2 = await convertAcceptedQuoteToInvoice(tx, {
      organizationId: org.id,
      quoteId: quote.id,
    });
    checks.push({
      name: 'quote convert idempotent',
      ok: inv2.alreadyLinked === true && inv2.accountsInvoiceId === inv1.accountsInvoiceId,
    });

    await tx.salesDeal.update({
      where: { id: deal.id },
      data: { stage: 'won', closedAt: new Date(), accountsInvoiceId: inv1.accountsInvoiceId },
    });

    const auto1 = await runWonDealAutomation(tx, {
      organizationId: org.id,
      dealId: deal.id,
      staffUserId: staff.id,
      fleetLicensed: false,
    });
    const projects1 = await tx.project.count({
      where: { organizationId: org.id, sourceDealId: deal.id },
    });
    const actuals1 = await tx.salesActual.count({
      where: { organizationId: org.id, salesDealId: deal.id },
    });

    const auto2 = await runWonDealAutomation(tx, {
      organizationId: org.id,
      dealId: deal.id,
      staffUserId: staff.id,
      fleetLicensed: false,
    });
    const projects2 = await tx.project.count({
      where: { organizationId: org.id, sourceDealId: deal.id },
    });
    const actuals2 = await tx.salesActual.count({
      where: { organizationId: org.id, salesDealId: deal.id },
    });

    checks.push({
      name: 'won automation actual once',
      ok: actuals1 === 1 && actuals2 === 1,
      detail: `actuals ${actuals1}→${actuals2}`,
    });
    if (client.outsourcingClientId) {
      checks.push({
        name: 'won automation project once',
        ok: projects1 === 1 && projects2 === 1 && Boolean(auto1.projectId) && auto2.projectId === auto1.projectId,
        detail: `projects ${projects1}→${projects2}`,
      });
    } else {
      checks.push({
        name: 'won automation project skip notice',
        ok: auto1.notes.some((n) => n.includes('outsourcing profile')),
        detail: auto1.notes.join(' | '),
      });
    }

    const dealInv = await createInvoiceFromWonDeal(tx, {
      organizationId: org.id,
      dealId: deal.id,
      recordedByUserId: staff.id,
    });
    checks.push({
      name: 'deal invoice idempotent when linked',
      ok: dealInv.alreadyLinked === true,
    });

    // cleanup
    await tx.salesActual.deleteMany({ where: { salesDealId: deal.id } });
    await tx.project.deleteMany({ where: { sourceDealId: deal.id } });
    await tx.salesQuote.delete({ where: { id: quote.id } });
    await tx.salesDeal.delete({ where: { id: deal.id } });
    if (!inv1.alreadyLinked) {
      await tx.accountsInvoiceLine.deleteMany({ where: { invoiceId: inv1.accountsInvoiceId } });
      await tx.accountsInvoice.delete({ where: { id: inv1.accountsInvoiceId } }).catch(() => null);
    }
  });

  for (const c of checks) {
    console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
  }
  if (checks.some((c) => !c.ok)) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
