/**
 * B2 acceptance check — effective discount + send gate (no HTTP session required).
 * Run: npx tsx scripts/verify-b2-quote-approvals.ts
 */
import { PrismaClient } from '@prisma/client';
import {
  computeEffectiveDiscountPct,
  ensureApprovalPolicy,
  resolveApprovalRequirement,
} from '../src/lib/sales/quote-approval';

const prisma = new PrismaClient();

async function main() {
  let product = await prisma.salesProduct.findFirst({
    where: { active: true },
    orderBy: { createdAt: 'asc' },
  });

  const org =
    (product
      ? await prisma.organization.findFirst({ where: { id: product.organizationId } })
      : null) ??
    (await prisma.organization.findFirst({
      where: { id: 'deb12a92-35b2-4f8f-8905-04e17807b0b0' },
    })) ??
    (await prisma.organization.findFirst());
  if (!org) throw new Error('No organization — seed demo first.');

  if (!product) {
    product = await prisma.salesProduct.create({
      data: {
        organizationId: org.id,
        name: 'B2 Verify Product',
        unitPrice: 10000,
        currency: 'KES',
        active: true,
      },
    });
  }

  const user =
    (await prisma.user.findFirst({ where: { email: 'admin@imara.co.ke' } })) ??
    (await prisma.user.findFirst({ where: { role: 'admin' } }));
  if (!user) throw new Error('No admin user');

  const client = await prisma.accountsClient.findFirst({
    where: { organizationId: org.id },
  });

  const results: Array<{ name: string; pass: boolean; detail: string }> = [];

  await prisma.$transaction(async (tx) => {
    const { config } = await ensureApprovalPolicy(tx, org.id);

    // --- 3% header discount: should NOT require approval ---
    const low = await computeEffectiveDiscountPct(tx, org.id, 3, [
      {
        productId: product.id,
        quantity: 1,
        unitPrice: Number(product.unitPrice),
        discountPct: 0,
        isRecurring: false,
        termMonths: null,
      },
    ]);
    const lowReq = resolveApprovalRequirement(low.effectiveDiscountPct, config);
    results.push({
      name: '3% discount sends without approval',
      pass: !lowReq.requiresApproval && low.effectiveDiscountPct <= 5,
      detail: `effective=${low.effectiveDiscountPct}% requiresApproval=${lowReq.requiresApproval}`,
    });

    // --- 20% header discount: SHOULD require approval ---
    const high = await computeEffectiveDiscountPct(tx, org.id, 20, [
      {
        productId: product.id,
        quantity: 1,
        unitPrice: Number(product.unitPrice),
        discountPct: 0,
        isRecurring: false,
        termMonths: null,
      },
    ]);
    const highReq = resolveApprovalRequirement(high.effectiveDiscountPct, config);
    results.push({
      name: '20% discount requires approval',
      pass: highReq.requiresApproval && high.effectiveDiscountPct >= 15,
      detail: `effective=${high.effectiveDiscountPct}% requiresApproval=${highReq.requiresApproval} tier=${highReq.tier?.approver}`,
    });

    const maxQn = await tx.salesQuote.aggregate({
      where: { organizationId: org.id },
      _max: { quoteNumber: true },
    });
    const qn = (maxQn._max.quoteNumber ?? 0) + 1;

    const quote = await tx.salesQuote.create({
      data: {
        organizationId: org.id,
        quoteNumber: qn,
        title: 'B2 verify 20% discount',
        status: 'draft',
        currency: 'KES',
        discountPct: 20,
        taxRateBps: 1600,
        accountsClientId: client?.id ?? null,
        createdByUserId: user.id,
        lineItems: {
          create: [
            {
              organizationId: org.id,
              description: product.name,
              productId: product.id,
              quantity: 1,
              unitPrice: product.unitPrice,
              discountPct: 0,
              sortOrder: 0,
            },
          ],
        },
      },
    });

    const approval = await tx.salesQuoteApproval.create({
      data: {
        organizationId: org.id,
        quoteId: quote.id,
        requestedById: user.id,
        status: 'pending',
        effectiveDiscountPct: high.effectiveDiscountPct,
      },
    });
    await tx.salesQuote.update({
      where: { id: quote.id },
      data: { status: 'pending_approval' },
    });

    const inbox = await tx.salesQuoteApproval.findMany({
      where: { organizationId: org.id, status: 'pending', quoteId: quote.id },
    });
    results.push({
      name: '20% quote appears in pending inbox',
      pass: inbox.length === 1 && inbox[0].id === approval.id,
      detail: `inboxCount=${inbox.length}`,
    });

    await tx.salesQuoteApproval.update({
      where: { id: approval.id },
      data: {
        status: 'approved',
        reason: 'Verified in B2 checklist',
        approverId: user.id,
        actionedAt: new Date(),
      },
    });

    const approved = await tx.salesQuoteApproval.findFirst({
      where: { quoteId: quote.id, status: 'approved' },
    });
    results.push({
      name: 'Approving unblocks send (approved row exists)',
      pass: Boolean(approved),
      detail: `approvedId=${approved?.id ?? 'none'}`,
    });

    const canSend = highReq.requiresApproval && Boolean(approved);
    await tx.salesQuote.update({
      where: { id: quote.id },
      data: { status: 'sent', sentAt: new Date() },
    });
    const sent = await tx.salesQuote.findUnique({ where: { id: quote.id } });
    results.push({
      name: 'After approve, quote can move to sent',
      pass: canSend && sent?.status === 'sent',
      detail: `status=${sent?.status}`,
    });

    await tx.salesQuote.delete({ where: { id: quote.id } });
  });

  console.log('\nB2 acceptance checklist:\n');
  let allPass = true;
  for (const r of results) {
    console.log(`${r.pass ? 'PASS' : 'FAIL'} — ${r.name} (${r.detail})`);
    if (!r.pass) allPass = false;
  }
  if (!allPass) process.exitCode = 1;
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
