import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { reportApiError } from '@/lib/monitoring';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';

export const dynamic = 'force-dynamic';

function lineTotal(quantity: number, unitPrice: number) {
  return Math.round(quantity * unitPrice * 100) / 100;
}

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const moduleBlock = requireModule('procurement', getEffectiveModulesFromRequest(request));
  if (moduleBlock) return moduleBlock;

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const status = request.nextUrl.searchParams.get('status')?.trim() || undefined;

    const requests = await prisma.purchaseRequest.findMany({
      where: {
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
}

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

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
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);

    if (vendorId) {
      const vendor = await prisma.accountsVendor.findUnique({ where: { id: vendorId }, select: { id: true } });
      if (!vendor) {
        return NextResponse.json({ error: 'Vendor not found.' }, { status: 400 });
      }
    }

    const count = await prisma.purchaseRequest.count({ where: { outsourcingClientId: clientId } });
    const requestNumber = `PR-${String(count + 1).padStart(4, '0')}`;
    const totalAmount = validLines.reduce((sum, line) => sum + lineTotal(line.quantity, line.unitPrice), 0);

    const created = await prisma.purchaseRequest.create({
      data: {
        outsourcingClientId: clientId,
        requestNumber,
        title,
        department,
        justification,
        currency,
        totalAmount,
        status: 'draft',
        vendorId,
        requestedByUserId: user.id,
        lines: {
          create: validLines,
        },
      },
      select: { id: true, requestNumber: true },
    });

    return NextResponse.json({ id: created.id, requestNumber: created.requestNumber }, { status: 201 });
  } catch (error) {
    await reportApiError({
      route: 'POST /api/procurement/purchase-requests',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to create purchase request.' }, { status: 500 });
  }
}
