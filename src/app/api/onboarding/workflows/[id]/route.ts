import { NextRequest, NextResponse } from 'next/server';
import { WorkflowStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { logAuditEvent } from '@/lib/audit-events';
import { refreshWorkflowTaskSLAs } from '@/lib/onboarding-workflows';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  await refreshWorkflowTaskSLAs(id);
  const workflow = await prisma.onboardingWorkflow.findUnique({
    where: { id },
    include: {
      employee: { include: { department: true } },
      template: true,
      tasks: { orderBy: { order: 'asc' } },
    },
  });
  if (!workflow) return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);
  if (workflow.employee.outsourcingClientId !== workspaceClientId) {
    return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
  }
  return NextResponse.json(workflow);
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (user.role !== 'admin' && user.staffUserType !== 'operations' && user.staffUserType !== 'business_manager') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const { id } = await params;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const status = body?.status as WorkflowStatus | undefined;
  if (!status) return NextResponse.json({ error: 'status is required' }, { status: 400 });

  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);
  const existing = await prisma.onboardingWorkflow.findUnique({
    where: { id },
    select: { id: true, employee: { select: { outsourcingClientId: true } } },
  });
  if (!existing || existing.employee.outsourcingClientId !== workspaceClientId) {
    return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
  }

  const workflow = await prisma.onboardingWorkflow.update({
    where: { id },
    data: {
      status,
      completedAt: status === WorkflowStatus.COMPLETED ? new Date() : null,
    },
  });
  await logAuditEvent({
    actor: { userId: user.id, email: user.email, name: user.name },
    action: 'onboarding.workflow.updated',
    entityType: 'OnboardingWorkflow',
    entityId: workflow.id,
    route: 'PUT /api/onboarding/workflows/[id]',
    metadata: { status: workflow.status },
  });
  return NextResponse.json(workflow);
}
