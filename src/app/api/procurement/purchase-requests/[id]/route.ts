import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { reportApiError } from '@/lib/monitoring';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { getEffectiveModulesFromRequest, requireModule } from '@/lib/module-access';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const moduleBlock = requireModule('procurement', getEffectiveModulesFromRequest(request));
  if (moduleBlock) return moduleBlock;

  const { id } = await params;

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const row = await prisma.purchaseRequest.findFirst({
      where: { id, outsourcingClientId: clientId },
      include: {
        lines: { orderBy: { sortOrder: 'asc' } },
        vendor: { select: { id: true, name: true } },
        requestedBy: { select: { id: true, name: true, email: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
    });

    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    return NextResponse.json({
      request: {
        id: row.id,
        requestNumber: row.requestNumber,
        title: row.title,
        department: row.department,
        justification: row.justification,
        currency: row.currency,
        totalAmount: Number(row.totalAmount),
        status: row.status,
        vendor: row.vendor,
        requestedBy: row.requestedBy,
        reviewedBy: row.reviewedBy,
        submittedAt: row.submittedAt?.toISOString() ?? null,
        reviewedAt: row.reviewedAt?.toISOString() ?? null,
        rejectionReason: row.rejectionReason,
        createdAt: row.createdAt.toISOString(),
        lines: row.lines.map((line) => ({
          id: line.id,
          item: line.item,
          description: line.description,
          quantity: Number(line.quantity),
          unitPrice: Number(line.unitPrice),
          lineTotal: Math.round(Number(line.quantity) * Number(line.unitPrice) * 100) / 100,
        })),
      },
    });
  } catch (error) {
    await reportApiError({
      route: `GET /api/procurement/purchase-requests/${id}`,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load purchase request.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const moduleBlock = requireModule('procurement', getEffectiveModulesFromRequest(request));
  if (moduleBlock) return moduleBlock;

  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const row = await prisma.purchaseRequest.findFirst({
      where: { id, outsourcingClientId: clientId },
    });
    if (!row) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const action = typeof body.action === 'string' ? body.action : '';

    if (action === 'submit') {
      if (row.status !== 'draft') {
        return NextResponse.json({ error: 'Can only submit draft requests.' }, { status: 400 });
      }
      await prisma.purchaseRequest.update({
        where: { id },
        data: { status: 'submitted', submittedAt: new Date() },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'approve') {
      if (row.status !== 'submitted') {
        return NextResponse.json({ error: 'Can only approve submitted requests.' }, { status: 400 });
      }
      await prisma.purchaseRequest.update({
        where: { id },
        data: {
          status: 'approved',
          reviewedAt: new Date(),
          reviewedByUserId: user.id,
        },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'reject') {
      if (row.status !== 'submitted') {
        return NextResponse.json({ error: 'Can only reject submitted requests.' }, { status: 400 });
      }
      const reason = typeof body.reason === 'string' ? body.reason.trim() || null : null;
      await prisma.purchaseRequest.update({
        where: { id },
        data: {
          status: 'rejected',
          reviewedAt: new Date(),
          reviewedByUserId: user.id,
          rejectionReason: reason,
        },
      });
      return NextResponse.json({ ok: true });
    }

    if (action === 'cancel') {
      if (row.status !== 'draft' && row.status !== 'submitted') {
        return NextResponse.json({ error: 'Can only cancel draft or submitted requests.' }, { status: 400 });
      }
      await prisma.purchaseRequest.update({
        where: { id },
        data: { status: 'cancelled' },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 });
  } catch (error) {
    await reportApiError({
      route: `PATCH /api/procurement/purchase-requests/${id}`,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to update purchase request.' }, { status: 500 });
  }
}
