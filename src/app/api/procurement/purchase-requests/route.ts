import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

function lineTotal(quantity: number, unitPrice: number) {
  return Math.round(quantity * unitPrice * 100) / 100;
}

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('procurement', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    try {
      const requests = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const status = request.nextUrl.searchParams.get('status')?.trim() || undefined;

        return tx.purchaseRequest.findMany({
          where: {
            ...ctx.where(),
            outsourcingClientId: clientId,
            ...(status ? { status: status as never } : {}),
          },
          include: {
            vendor: { select: { id: true, name: true } },
            requestedBy: { select: { id: true, name: true } },
            _count: { select: { lines: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 200,
        });
      });

      return NextResponse.json({
        requests: requests.map((r) => ({
          id: r.id,
          requestNumber: r.requestNumber,
          title: r.title,
          department: r.department,
          justification: r.justification,
          currency: r.currency,
          totalAmount: Number(r.totalAmount),
          status: r.status,
          lineCount: r._count.lines,
          vendor: r.vendor ? { id: r.vendor.id, name: r.vendor.name } : null,
          requestedBy: r.requestedBy,
          submittedAt: r.submittedAt?.toISOString() ?? null,
          reviewedAt: r.reviewedAt?.toISOString() ?? null,
          createdAt: r.createdAt.toISOString(),
        })),
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/procurement/purchase-requests',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load purchase requests.' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const moduleBlock = requireModule('procurement', getEffectiveModulesFromRequest(request));
    if (moduleBlock) return moduleBlock;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const title = typeof body.title === 'string' ? body.title.trim() : '';
    const justification = typeof body.justification === 'string' ? body.justification.trim() : '';
    const department = typeof body.department === 'string' ? body.department.trim() || null : null;
    const currency = typeof body.currency === 'string' && body.currency.trim() ? body.currency.trim() : 'KES';
    const vendorId = typeof body.vendorId === 'string' && body.vendorId.trim() ? body.vendorId.trim() : null;
    const items = body.items;

    if (!title || !justification) {
      return NextResponse.json({ error: 'Title and justification are required.' }, { status: 400 });
    }
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one line item is required.' }, { status: 400 });
    }

    const parsedLines = items.map((item: Record<string, unknown>, index: number) => {
      const lineItem = typeof item.item === 'string' ? item.item.trim() : '';
      const quantity = Number(item.quantity) || 0;
      const unitPrice = Number(item.unitPrice) || 0;
      if (!lineItem || quantity <= 0 || unitPrice <= 0) return null;
      return {
        item: lineItem,
        description: typeof item.description === 'string' ? item.description.trim() || null : null,
        quantity,
        unitPrice,
        sortOrder: index,
      };
    });

    const validLines = parsedLines.filter(Boolean) as {
      item: string;
      description: string | null;
      quantity: number;
      unitPrice: number;
      sortOrder: number;
    }[];

    if (validLines.length === 0) {
      return NextResponse.json({ error: 'Each line needs an item, quantity, and unit price.' }, { status: 400 });
    }

    try {
      const created = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);

        if (vendorId) {
          const vendor = await tx.accountsVendor.findFirst({
            where: ctx.where({ id: vendorId }),
            select: { id: true },
          });
          if (!vendor) return { error: 'vendor' as const };
        }

        const count = await tx.purchaseRequest.count({
          where: { ...ctx.where(), outsourcingClientId: clientId },
        });
        const requestNumber = `PR-${String(count + 1).padStart(4, '0')}`;
        const totalAmount = validLines.reduce((sum, line) => sum + lineTotal(line.quantity, line.unitPrice), 0);

        return tx.purchaseRequest.create({
          data: {
            organizationId: ctx.organizationId,
            outsourcingClientId: clientId,
            requestNumber,
            title,
            department,
            justification,
            currency,
            totalAmount,
            status: 'draft',
            vendorId,
            requestedByUserId: ctx.staff.id,
            lines: {
              create: validLines.map((line) => ({
                ...line,
                organizationId: ctx.organizationId,
              })),
            },
          },
          select: { id: true, requestNumber: true },
        });
      });

      if ('error' in created && created.error === 'vendor') {
        return NextResponse.json({ error: 'Vendor not found.' }, { status: 400 });
      }

      return NextResponse.json(created, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/procurement/purchase-requests',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create purchase request.' }, { status: 500 });
    }
  });
}
