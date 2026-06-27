import { NextRequest, NextResponse } from 'next/server';
import { forbiddenResponse } from '@/lib/demo-route-access';
import { canActOnApproval, canManageRequisitions, parseApprovalAction } from '@/lib/ats-governance';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    if (!canManageRequisitions(ctx.staff)) return forbiddenResponse();

    const { id: jobId } = await params;
    const job = await ctx.run((tx) =>
      tx.job.findFirst({ where: ctx.where({ id: jobId }), select: { id: true } }),
    );
    if (!job) return NextResponse.json({ error: 'Job not found.' }, { status: 404 });

    const approvals = await ctx.run((tx) =>
      tx.jobRequisitionApproval.findMany({
        where: ctx.where({ jobId }),
        orderBy: { createdAt: 'asc' },
      }),
    );
    return NextResponse.json(approvals);
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    if (!canManageRequisitions(ctx.staff)) return forbiddenResponse();
    const { id: jobId } = await params;

    const job = await ctx.run((tx) =>
      tx.job.findFirst({ where: ctx.where({ id: jobId }), select: { id: true } }),
    );
    if (!job) return NextResponse.json({ error: 'Job not found.' }, { status: 404 });

    const body = (await request.json().catch(() => null)) as { approverUserId?: string; notes?: string } | null;
    const approverUserId = body?.approverUserId?.trim();
    if (!approverUserId) return NextResponse.json({ error: 'approverUserId is required.' }, { status: 400 });

    const approval = await ctx.run((tx) =>
      tx.jobRequisitionApproval.create({
        data: {
          organizationId: ctx.organizationId,
          jobId,
          requestedByUserId: ctx.staff.id,
          approverUserId,
          notes: body?.notes?.trim() || null,
        },
      }),
    );
    await ctx.audit({
      action: 'ats.requisition_approval.requested',
      entityType: 'Job',
      entityId: jobId,
      route: 'POST /api/jobs/[id]/requisition-approvals',
      metadata: { approvalId: approval.id, approverUserId },
    });
    return NextResponse.json(approval, { status: 201 });
  });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    const { id: jobId } = await params;
    const body = (await request.json().catch(() => null)) as { approvalId?: string; action?: string; notes?: string } | null;
    const approvalId = body?.approvalId?.trim();
    const action = parseApprovalAction(body?.action);
    if (!approvalId || !action) return NextResponse.json({ error: 'approvalId and action are required.' }, { status: 400 });

    const existing = await ctx.run((tx) =>
      tx.jobRequisitionApproval.findFirst({ where: ctx.where({ id: approvalId, jobId }) }),
    );
    if (!existing) return NextResponse.json({ error: 'Approval request not found.' }, { status: 404 });
    if (!canActOnApproval(ctx.staff, existing.approverUserId)) {
      return forbiddenResponse('Only the assigned approver or admin can act.');
    }

    const updated = await ctx.run((tx) =>
      tx.jobRequisitionApproval.update({
        where: { id: approvalId },
        data: { status: action, actedAt: new Date(), notes: body?.notes?.trim() || existing.notes || null },
      }),
    );
    await ctx.audit({
      action: `ats.requisition_approval.${action}`,
      entityType: 'Job',
      entityId: jobId,
      route: 'PATCH /api/jobs/[id]/requisition-approvals',
      metadata: { approvalId },
    });
    return NextResponse.json(updated);
  });
}
