import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { forbiddenResponse, unauthorizedResponse } from '@/lib/demo-route-access';
import { canActOnApproval, canManageRequisitions, getAtsEntityJobWhere, parseApprovalAction } from '@/lib/ats-governance';
import { logAuditEvent } from '@/lib/audit-events';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (!canManageRequisitions(user)) return forbiddenResponse();

  const { id: jobId } = await params;
  const job = await prisma.job.findFirst({ where: { id: jobId, ...(getAtsEntityJobWhere(request) ?? {}) }, select: { id: true } });
  if (!job) return NextResponse.json({ error: 'Job not found.' }, { status: 404 });

  const approvals = await prisma.jobRequisitionApproval.findMany({
    where: { jobId },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json(approvals);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (!canManageRequisitions(user)) return forbiddenResponse();
  const { id: jobId } = await params;

  const job = await prisma.job.findFirst({ where: { id: jobId, ...(getAtsEntityJobWhere(request) ?? {}) }, select: { id: true } });
  if (!job) return NextResponse.json({ error: 'Job not found.' }, { status: 404 });

  const body = (await request.json().catch(() => null)) as { approverUserId?: string; notes?: string } | null;
  const approverUserId = body?.approverUserId?.trim();
  if (!approverUserId) return NextResponse.json({ error: 'approverUserId is required.' }, { status: 400 });

  const approval = await prisma.jobRequisitionApproval.create({
    data: {
      jobId,
      requestedByUserId: user.id,
      approverUserId,
      notes: body?.notes?.trim() || null,
    },
  });
  await logAuditEvent({
    actor: { userId: user.id, email: user.email, name: user.name },
    action: 'ats.requisition_approval.requested',
    entityType: 'Job',
    entityId: jobId,
    route: 'POST /api/jobs/[id]/requisition-approvals',
    metadata: { approvalId: approval.id, approverUserId },
  });
  return NextResponse.json(approval, { status: 201 });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  const { id: jobId } = await params;
  const body = (await request.json().catch(() => null)) as { approvalId?: string; action?: string; notes?: string } | null;
  const approvalId = body?.approvalId?.trim();
  const action = parseApprovalAction(body?.action);
  if (!approvalId || !action) return NextResponse.json({ error: 'approvalId and action are required.' }, { status: 400 });

  const existing = await prisma.jobRequisitionApproval.findFirst({ where: { id: approvalId, jobId } });
  if (!existing) return NextResponse.json({ error: 'Approval request not found.' }, { status: 404 });
  if (!canActOnApproval(user, existing.approverUserId)) return forbiddenResponse('Only the assigned approver or admin can act.');

  const updated = await prisma.jobRequisitionApproval.update({
    where: { id: approvalId },
    data: { status: action, actedAt: new Date(), notes: body?.notes?.trim() || existing.notes || null },
  });
  await logAuditEvent({
    actor: { userId: user.id, email: user.email, name: user.name },
    action: `ats.requisition_approval.${action}`,
    entityType: 'Job',
    entityId: jobId,
    route: 'PATCH /api/jobs/[id]/requisition-approvals',
    metadata: { approvalId },
  });
  return NextResponse.json(updated);
}
