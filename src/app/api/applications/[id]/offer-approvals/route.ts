import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { forbiddenResponse, unauthorizedResponse } from '@/lib/demo-route-access';
import { canActOnApproval, canManageOfferApprovals, getAtsEntityJobWhere, parseApprovalAction } from '@/lib/ats-governance';
import { logAuditEvent } from '@/lib/audit-events';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (!canManageOfferApprovals(user)) return forbiddenResponse();
  const { id: applicationId } = await params;

  const app = await prisma.application.findFirst({
    where: { id: applicationId, job: { ...(getAtsEntityJobWhere(request) ?? {}) } },
    select: { id: true },
  });
  if (!app) return NextResponse.json({ error: 'Application not found.' }, { status: 404 });

  const approvals = await prisma.jobOfferApproval.findMany({
    where: { applicationId },
    orderBy: { createdAt: 'asc' },
  });
  return NextResponse.json(approvals);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (!canManageOfferApprovals(user)) return forbiddenResponse();
  const { id: applicationId } = await params;

  const app = await prisma.application.findFirst({
    where: { id: applicationId, job: { ...(getAtsEntityJobWhere(request) ?? {}) } },
    select: { id: true },
  });
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

  const approval = await prisma.jobOfferApproval.create({
    data: {
      applicationId,
      requestedByUserId: user.id,
      approverUserId,
      notes: body?.notes?.trim() || null,
      proposedGrossSalary: body?.proposedGrossSalary != null ? Number(body.proposedGrossSalary) : null,
      currency: body?.currency?.trim() || 'KES',
      startDate: body?.startDate ? new Date(body.startDate) : null,
    },
  });
  await logAuditEvent({
    actor: { userId: user.id, email: user.email, name: user.name },
    action: 'ats.offer_approval.requested',
    entityType: 'Application',
    entityId: applicationId,
    route: 'POST /api/applications/[id]/offer-approvals',
    metadata: { offerApprovalId: approval.id, approverUserId },
  });
  return NextResponse.json(approval, { status: 201 });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  const { id: applicationId } = await params;

  const body = (await request.json().catch(() => null)) as {
    approvalId?: string;
    action?: string;
    notes?: string;
  } | null;
  const approvalId = body?.approvalId?.trim();
  const action = parseApprovalAction(body?.action);
  if (!approvalId || !action) return NextResponse.json({ error: 'approvalId and action are required.' }, { status: 400 });

  const existing = await prisma.jobOfferApproval.findFirst({ where: { id: approvalId, applicationId } });
  if (!existing) return NextResponse.json({ error: 'Offer approval not found.' }, { status: 404 });
  if (!canActOnApproval(user, existing.approverUserId)) return forbiddenResponse('Only assigned approver or admin can act.');

  const updated = await prisma.jobOfferApproval.update({
    where: { id: approvalId },
    data: { status: action, actedAt: new Date(), notes: body?.notes?.trim() || existing.notes || null },
  });
  await logAuditEvent({
    actor: { userId: user.id, email: user.email, name: user.name },
    action: `ats.offer_approval.${action}`,
    entityType: 'Application',
    entityId: applicationId,
    route: 'PATCH /api/applications/[id]/offer-approvals',
    metadata: { approvalId: updated.id },
  });
  return NextResponse.json(updated);
}
