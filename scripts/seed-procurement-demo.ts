/**
 * SwiftFreight / demo — procurement purchase requests, LPOs, and AP-linked vendor bill.
 * Run: npx tsx scripts/seed-procurement-demo.ts
 */
import { Prisma, PrismaClient } from '@prisma/client';

import { createLpoFromPurchaseRequest } from '../src/lib/procurement/lpo';

const prisma = new PrismaClient();
const TAG = '[SFE-PROC]';

function dec(value: string | number) {
  return new Prisma.Decimal(value);
}

function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

async function resolveOrg() {
  const shared = await prisma.organization.findUnique({ where: { slug: 'demo-multi-vertical' } });
  if (shared) return shared;

  const packId = process.env.DEMO_PACK?.trim();
  if (packId) {
    const bySlug = await prisma.organization.findUnique({ where: { slug: `demo-${packId}` } });
    if (bySlug) return bySlug;
  }
  return prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
}

async function main() {
  const org = await resolveOrg();
  if (!org) {
    console.error('No Organization — run demo seed first.');
    process.exit(1);
  }

  const client = await prisma.outsourcingClient.findFirst({
    where: { organizationId: org.id },
    orderBy: { createdAt: 'asc' },
  });
  if (!client) {
    console.error('No outsourcing client — run seed-demo first.');
    process.exit(1);
  }

  const requester =
    (await prisma.user.findFirst({
      where: { email: process.env.NEXT_PUBLIC_DEMO_ADMIN_EMAIL ?? 'admin@imara.co.ke' },
    })) ??
    (await prisma.user.findFirst({ where: { role: 'admin', isActive: true } }));
  const approver =
    (await prisma.user.findFirst({
      where: { email: process.env.NEXT_PUBLIC_DEMO_HR_EMAIL ?? undefined },
    })) ?? requester;

  if (!requester) {
    console.error('No staff user for procurement seed.');
    process.exit(1);
  }

  const existingPrs = await prisma.purchaseRequest.findMany({
    where: { organizationId: org.id, requestNumber: { startsWith: 'SFE-PR-' } },
    select: { id: true },
  });
  if (existingPrs.length > 0) {
    const ids = existingPrs.map((r) => r.id);
    await prisma.purchaseOrder.deleteMany({
      where: { purchaseRequestId: { in: ids } },
    });
    await prisma.purchaseRequestLine.deleteMany({ where: { requestId: { in: ids } } });
    await prisma.purchaseRequest.deleteMany({ where: { id: { in: ids } } });
  }

  await prisma.accountsVendorBill.deleteMany({
    where: { organizationId: org.id, notes: { contains: TAG } },
  });
  await prisma.accountsVendor.deleteMany({
    where: { organizationId: org.id, name: { contains: TAG } },
  });

  const vendor = await prisma.accountsVendor.create({
    data: {
      organizationId: org.id,
      name: `${TAG} East Africa Fleet Supplies Ltd`,
      contactName: 'James Kariuki',
      contactEmail: 'orders@eafleet.co.ke',
      contactPhone: '+254 722 880001',
      currency: 'KES',
      notes: `${TAG} Tyres, lubricants, and fleet consumables for corridor operations.`,
    },
  });

  const submitted = await prisma.purchaseRequest.create({
    data: {
      organizationId: org.id,
      outsourcingClientId: client.id,
      requestNumber: 'SFE-PR-0001',
      title: 'Fleet tyres — Mombasa corridor articulated units',
      department: 'Fleet & Drivers',
      justification:
        'Replace worn steer and drive tyres on three long-haul rigs ahead of peak season. NTSA inspection due within 30 days.',
      currency: 'KES',
      totalAmount: dec('186000'),
      status: 'submitted',
      vendorId: vendor.id,
      requestedByUserId: requester.id,
      submittedAt: daysAgo(2),
      lines: {
        create: [
          {
            organizationId: org.id,
            item: 'Steer tyre 315/80R22.5',
            description: 'Premium highway — qty 6',
            quantity: dec('6'),
            unitPrice: dec('18500'),
            sortOrder: 0,
          },
          {
            organizationId: org.id,
            item: 'Drive tyre 315/80R22.5',
            description: 'Premium highway — qty 6',
            quantity: dec('6'),
            unitPrice: dec('12500'),
            sortOrder: 1,
          },
        ],
      },
    },
  });

  const approvedWarehouse = await prisma.purchaseRequest.create({
    data: {
      organizationId: org.id,
      outsourcingClientId: client.id,
      requestNumber: 'SFE-PR-0002',
      title: 'Warehouse racking bolts & safety signage — Industrial Area',
      department: 'Warehouse',
      justification:
        'Restock bay fixings and replace faded HSE signage after Q2 internal audit findings.',
      currency: 'KES',
      totalAmount: dec('42800'),
      status: 'approved',
      vendorId: vendor.id,
      requestedByUserId: requester.id,
      submittedAt: daysAgo(8),
      reviewedAt: daysAgo(6),
      reviewedByUserId: approver?.id ?? requester.id,
      lines: {
        create: [
          {
            organizationId: org.id,
            item: 'Heavy-duty racking bolt kit',
            quantity: dec('4'),
            unitPrice: dec('7200'),
            sortOrder: 0,
          },
          {
            organizationId: org.id,
            item: 'HSE warehouse signage pack',
            quantity: dec('1'),
            unitPrice: dec('14000'),
            sortOrder: 1,
          },
        ],
      },
    },
  });

  const lpo = await createLpoFromPurchaseRequest(prisma, {
    organizationId: org.id,
    purchaseRequestId: approvedWarehouse.id,
    outsourcingClientId: client.id,
  });

  await prisma.purchaseOrder.update({
    where: { id: lpo.id },
    data: {
      status: 'issued',
      issuedAt: daysAgo(5),
      issuedByUserId: approver?.id ?? requester.id,
    },
  });

  await prisma.purchaseRequest.create({
    data: {
      organizationId: org.id,
      outsourcingClientId: client.id,
      requestNumber: 'SFE-PR-0003',
      title: 'Lubricants & workshop consumables — Q3 fleet maintenance',
      department: 'Fleet & Drivers',
      justification:
        'Quarterly lube top-up and filters for Nairobi workshop supporting corridor fleet turnaround.',
      currency: 'KES',
      totalAmount: dec('94500'),
      status: 'approved',
      vendorId: vendor.id,
      requestedByUserId: requester.id,
      submittedAt: daysAgo(4),
      reviewedAt: daysAgo(3),
      reviewedByUserId: approver?.id ?? requester.id,
      lines: {
        create: [
          {
            organizationId: org.id,
            item: 'Engine oil 15W-40 (200L drum)',
            quantity: dec('2'),
            unitPrice: dec('28000'),
            sortOrder: 0,
          },
          {
            organizationId: org.id,
            item: 'Oil filter assortment — heavy duty',
            quantity: dec('1'),
            unitPrice: dec('38500'),
            sortOrder: 1,
          },
        ],
      },
    },
  });

  const vendorBill = await prisma.accountsVendorBill.create({
    data: {
      organizationId: org.id,
      vendorId: vendor.id,
      billRef: 'SFE-BILL-WAREHOUSE-01',
      issueDate: daysAgo(4),
      dueDate: daysAgo(-18),
      status: 'unpaid',
      notes: `${TAG} Warehouse racking & signage — linked to ${lpo.lpoNumber}`,
      lines: {
        create: [
          {
            organizationId: org.id,
            item: 'Warehouse racking bolts & HSE signage',
            amountExVat: dec('42800'),
            sortOrder: 0,
          },
        ],
      },
    },
  });

  console.log(
    `Procurement demo for ${org.slug}: vendor ${vendor.name}, ` +
      `PRs pending=${submitted.requestNumber}, LPO=${lpo.lpoNumber}, vendor bill=${vendorBill.billRef}.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
