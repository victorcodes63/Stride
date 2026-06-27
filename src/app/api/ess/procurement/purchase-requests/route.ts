import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { withEssTenant } from '@/lib/ess-tenant-api';

function lineTotal(quantity: number, unitPrice: number) {
  return Math.round(quantity * unitPrice * 100) / 100;
}

async function resolveRequesterUserId(
  tx: Prisma.TransactionClient,
  essEmail: string,
  employeeEmail: string | null | undefined,
) {
  const email = employeeEmail?.trim() || essEmail;
  const user = await tx.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true },
  });
  return user?.id ?? null;
}

export async function GET(request: NextRequest) {
  return withEssTenant(request, async (ctx) => {
    const moduleBlock = requireModule('procurement', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    if (!ctx.essUser.employeeId) return NextResponse.json({ requests: [] });

    const requests = await ctx.run(async (tx) => {
      const employee = await tx.employee.findFirst({
        where: ctx.where({ id: ctx.essUser.employeeId! }),
        select: { email: true },
      });
      const requesterUserId = await resolveRequesterUserId(tx, ctx.essUser.email, employee?.email);
      if (!requesterUserId) return [];

      return tx.purchaseRequest.findMany({
        where: ctx.where({ requestedByUserId: requesterUserId }),
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
          id: true,
          requestNumber: true,
          title: true,
          status: true,
          totalAmount: true,
          currency: true,
          submittedAt: true,
          createdAt: true,
        },
      });
    });

    await ctx.audit({
      action: 'ess.procurement.list',
      entityType: 'PurchaseRequest',
      route: 'GET /api/ess/procurement/purchase-requests',
      metadata: { employeeId: ctx.essUser.employeeId },
    });

    return NextResponse.json({
      requests: requests.map((r) => ({
        ...r,
        totalAmount: Number(r.totalAmount),
        submittedAt: r.submittedAt?.toISOString() ?? null,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  });
}

export async function POST(request: NextRequest) {
  return withEssTenant(request, async (ctx) => {
    const moduleBlock = requireModule('procurement', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    if (!ctx.essUser.employeeId) {
      return NextResponse.json({ error: 'No linked employee profile' }, { status: 400 });
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const justification = typeof body.justification === 'string' ? body.justification.trim() : '';
    const item = typeof body.item === 'string' ? body.item.trim() : '';
    const quantity = Number(body.quantity) || 0;
    const unitPrice = Number(body.unitPrice) || 0;
    const submit = body.submit === true;

    if (!title || !justification || !item || quantity <= 0 || unitPrice <= 0) {
      return NextResponse.json(
        { error: 'Title, justification, item, quantity, and unit price are required.' },
        { status: 400 },
      );
    }

    const result = await ctx.run(async (tx) => {
      const employee = await tx.employee.findFirst({
        where: ctx.where({ id: ctx.essUser.employeeId! }),
        include: { department: { select: { name: true } } },
      });
      if (!employee) return { kind: 'no_employee' as const };

      const requesterUserId = await resolveRequesterUserId(tx, ctx.essUser.email, employee.email);
      if (!requesterUserId) return { kind: 'no_user' as const };

      const totalAmount = lineTotal(quantity, unitPrice);
      const count = await tx.purchaseRequest.count({
        where: ctx.where({ outsourcingClientId: employee.outsourcingClientId }),
      });
      const requestNumber = `PR-${String(count + 1).padStart(4, '0')}`;

      const created = await tx.purchaseRequest.create({
        data: {
          organizationId: employee.organizationId,
          outsourcingClientId: employee.outsourcingClientId,
          requestNumber,
          title,
          department: employee.department?.name ?? null,
          justification,
          totalAmount,
          status: submit ? 'submitted' : 'draft',
          submittedAt: submit ? new Date() : null,
          requestedByUserId: requesterUserId,
          lines: {
            create: {
              organizationId: employee.organizationId,
              item,
              quantity,
              unitPrice,
              sortOrder: 0,
            },
          },
        },
        select: { id: true, requestNumber: true, status: true },
      });

      return { kind: 'created' as const, created };
    });

    if (result.kind === 'no_employee') {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }
    if (result.kind === 'no_user') {
      return NextResponse.json(
        { error: 'Your account is not linked to a staff user for procurement. Contact HR.' },
        { status: 400 },
      );
    }

    const { created } = result;

    await ctx.audit({
      action: submit ? 'ess.procurement.submitted' : 'ess.procurement.created',
      entityType: 'PurchaseRequest',
      entityId: created.id,
      route: 'POST /api/ess/procurement/purchase-requests',
      metadata: { employeeId: ctx.essUser.employeeId, requestNumber: created.requestNumber },
    });

    return NextResponse.json(created, { status: 201 });
  });
}
