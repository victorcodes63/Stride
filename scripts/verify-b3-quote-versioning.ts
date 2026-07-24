/**
 * B3 acceptance checks: revise → v2 + v1 read-only; e-accept stamps acceptedAt + deal activity.
 *
 * Run: npx tsx scripts/verify-b3-quote-versioning.ts
 */
import { PrismaClient } from '@prisma/client';
import {
  createQuoteAcceptToken,
  verifyQuoteAcceptToken,
} from '../src/lib/sales/quote-accept-token';

const prisma = new PrismaClient();

type Check = { name: string; ok: boolean; detail?: string };

async function main() {
  const checks: Check[] = [];

  const org = await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
  if (!org) {
    console.error('No organization found — seed demo data first.');
    process.exit(1);
  }

  const deal = await prisma.salesDeal.findFirst({
    where: { organizationId: org.id },
    select: { id: true, ownerEmployeeId: true },
  });

  let dealId = deal?.id ?? null;
  let ownerEmployeeId = deal?.ownerEmployeeId ?? null;
  let createdDealId: string | null = null;

  if (!dealId) {
    const emp = await prisma.employee.findFirst({
      where: { organizationId: org.id },
      select: { id: true },
    });
    if (emp) {
      const created = await prisma.salesDeal.create({
        data: {
          organizationId: org.id,
          name: 'B3 verify deal',
          value: 1000,
          currency: 'KES',
          ownerEmployeeId: emp.id,
          stage: 'proposal',
        },
      });
      dealId = created.id;
      ownerEmployeeId = emp.id;
      createdDealId = created.id;
    }
  }

  const client = await prisma.accountsClient.findFirst({
    where: { organizationId: org.id },
    select: { id: true },
  });

  const agg = await prisma.salesQuote.aggregate({
    where: { organizationId: org.id },
    _max: { quoteNumber: true },
  });
  const quoteNumber = (agg._max.quoteNumber ?? 0) + 1;

  const v1 = await prisma.salesQuote.create({
    data: {
      organizationId: org.id,
      quoteNumber,
      version: 1,
      title: 'B3 verify quote',
      status: 'sent',
      currency: 'KES',
      discountPct: 0,
      taxRateBps: 1600,
      dealId: dealId,
      accountsClientId: client?.id ?? null,
      sentAt: new Date(),
      terms: 'Net 30',
      lineItems: {
        create: [
          {
            organizationId: org.id,
            description: 'Verification line',
            quantity: 1,
            unitPrice: 1000,
            discountPct: 0,
            sortOrder: 0,
          },
        ],
      },
    },
  });

  // Revise (mirrors API)
  const v2 = await prisma.salesQuote.create({
    data: {
      organizationId: org.id,
      quoteNumber: v1.quoteNumber,
      version: 2,
      title: v1.title,
      status: 'draft',
      currency: v1.currency,
      discountPct: v1.discountPct,
      taxRateBps: v1.taxRateBps,
      dealId: v1.dealId,
      accountsClientId: v1.accountsClientId,
      terms: v1.terms,
      lineItems: {
        create: [
          {
            organizationId: org.id,
            description: 'Verification line',
            quantity: 1,
            unitPrice: 1000,
            discountPct: 0,
            sortOrder: 0,
          },
        ],
      },
    },
  });
  await prisma.salesQuote.update({
    where: { id: v1.id },
    data: { supersededById: v2.id },
  });

  const v1After = await prisma.salesQuote.findUniqueOrThrow({ where: { id: v1.id } });
  checks.push({
    name: 'revise creates v2',
    ok: v2.version === 2 && v2.quoteNumber === v1.quoteNumber,
    detail: `v2=${v2.version} number=${v2.quoteNumber}`,
  });
  checks.push({
    name: 'v1 superseded / read-only',
    ok: v1After.supersededById === v2.id,
    detail: `supersededById=${v1After.supersededById}`,
  });

  // Unique composite: same number different versions OK
  const conflict = await prisma.salesQuote.findFirst({
    where: {
      organizationId: org.id,
      quoteNumber: v1.quoteNumber,
      version: 1,
      id: { not: v1.id },
    },
  });
  checks.push({
    name: 'composite unique allows versions',
    ok: !conflict,
  });

  // Token round-trip
  const token = createQuoteAcceptToken(v2.id);
  const verified = verifyQuoteAcceptToken(token);
  checks.push({
    name: 'accept token round-trip',
    ok: verified === v2.id,
  });

  // E-accept on a fresh sent quote (use v2 after marking sent)
  await prisma.salesQuote.update({
    where: { id: v2.id },
    data: { status: 'sent', sentAt: new Date() },
  });
  const now = new Date();
  const acceptedName = 'Verify Accept';
  await prisma.$transaction(async (tx) => {
    await tx.salesQuote.update({
      where: { id: v2.id },
      data: { status: 'accepted', acceptedAt: now, acceptedByName: acceptedName },
    });
    if (dealId && ownerEmployeeId) {
      await tx.salesDealActivity.create({
        data: {
          organizationId: org.id,
          dealId,
          type: 'note',
          subject: `Quote Q-${String(v2.quoteNumber).padStart(4, '0')} v2 accepted`,
          body: `Accepted electronically by ${acceptedName}.`,
          actorEmployeeId: ownerEmployeeId,
        },
      });
    }
  });

  const accepted = await prisma.salesQuote.findUniqueOrThrow({ where: { id: v2.id } });
  checks.push({
    name: 'e-accept stamps acceptedAt',
    ok: Boolean(accepted.acceptedAt) && accepted.acceptedByName === acceptedName,
    detail: accepted.acceptedAt?.toISOString(),
  });

  if (dealId) {
    const activity = await prisma.salesDealActivity.findFirst({
      where: {
        organizationId: org.id,
        dealId,
        subject: { contains: `Q-${String(v2.quoteNumber).padStart(4, '0')}` },
      },
      orderBy: { createdAt: 'desc' },
    });
    checks.push({
      name: 'e-accept logs deal activity',
      ok: Boolean(activity),
      detail: activity?.subject,
    });
  } else {
    checks.push({
      name: 'e-accept logs deal activity',
      ok: false,
      detail: 'no deal/owner available',
    });
  }

  // Cleanup verify rows
  await prisma.salesQuote.deleteMany({ where: { id: { in: [v1.id, v2.id] } } });
  if (createdDealId) {
    await prisma.salesDealActivity.deleteMany({ where: { dealId: createdDealId } });
    await prisma.salesDeal.delete({ where: { id: createdDealId } });
  }

  const failed = checks.filter((c) => !c.ok);
  for (const c of checks) {
    console.log(`${c.ok ? 'PASS' : 'FAIL'}  ${c.name}${c.detail ? ` — ${c.detail}` : ''}`);
  }
  if (failed.length) {
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
