import { NextRequest, NextResponse } from 'next/server';
import { forbiddenResponse } from '@/lib/demo-route-access';
import { canActOnApproval, canManageOfferApprovals, parseApprovalAction } from '@/lib/ats-governance';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    if (!canManageOfferApprovals(ctx.staff)) return forbiddenResponse();
    const { id: applicationId } = await params;

    const app = await ctx.run((tx) =>
      tx.application.findFirst({
        where: ctx.where({ id: applicationId }),
        select: { id: true },
      }),
    );
    if (!app) return NextResponse.json({ error: 'Application not found.' }, { status: 404 });

    const approvals = await ctx.run((tx) =>
      tx.jobOfferApproval.findMany({
        where: ctx.where({ applicationId }),
        orderBy: { createdAt: 'asc' },
      }),
    );
    return NextResponse.json(approvals);
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    if (!canManageOfferApprovals(ctx.staff)) return forbiddenResponse();
    const { id: applicationId } = await params;

    const app = await ctx.run((tx) =>
      tx.application.findFirst({
        where: ctx.where({ id: applicationId }),
        select: { id: true },
      }),
    );
    if (!app) return NextResponse.json({ error: 'Application not found.' }, { status: 404 });

    const body = (await request.json().catch(() => null)) as {
      approverUserId?: string;
      notes?: string;
      proposedGrossSalary?: number;
      currency?: string;
      startDate?: string;
    } | null;
    const approverUserId = body?.approverUserId?.trim();
    if (!approverUserId) return NextResponse.json({ error: 'approverUserId is required.' }, { status: 400 });

    const approval = await ctx.run((tx) =>
      tx.jobOfferApproval.create({
        data: {
          organizationId: ctx.organizationId,
          applicationId,
          requestedByUserId: ctx.staff.id,
          approverUserId,
          notes: body?.notes?.trim() || null,
          proposedGrossSalary: body?.proposedGrossSalary != null ? Number(body.proposedGrossSalary) : null,
          currency: body?.currency?.trim() || 'KES',
          startDate: body?.startDate ? new Date(body.startDate) : null,
        },
      }),
    );
    await ctx.audit({
      action: 'ats.offer_approval.requested',
      entityType: 'Application',
      entityId: applicationId,
      route: 'POST /api/applications/[id]/offer-approvals',
      metadata: { offerApprovalId: approval.id, approverUserId },
    });
    return NextResponse.json(approval, { status: 201 });
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id: applicationId } = await params;

    const body = (await request.json().catch(() => null)) as {
      approvalId?: string;
      action?: string;
      notes?: string;
    } | null;
    const approvalId = body?.approvalId?.trim();
    const action = parseApprovalAction(body?.action);
    if (!approvalId || !action) return NextResponse.json({ error: 'approvalId and action are required.' }, { status: 400 });

    const existing = await ctx.run((tx) =>
      tx.jobOfferApproval.findFirst({ where: ctx.where({ id: approvalId, applicationId }) }),
    );
    if (!existing) return NextResponse.json({ error: 'Offer approval not found.' }, { status: 404 });
    if (!canActOnApproval(ctx.staff, existing.approverUserId)) {
      return forbiddenResponse('Only assigned approver or admin can act.');
    }

    const updated = await ctx.run((tx) =>
      tx.jobOfferApproval.update({
        where: { id: approvalId },
        data: { status: action, actedAt: new Date(), notes: body?.notes?.trim() || existing.notes || null },
      }),
    );
    await ctx.audit({
      action: `ats.offer_approval.${action}`,
      entityType: 'Application',
      entityId: applicationId,
      route: 'PATCH /api/applications/[id]/offer-approvals',
      metadata: { approvalId: updated.id },
    });
    return NextResponse.json(updated);
  });
}
