import { NextRequest, NextResponse } from 'next/server';
import { WorkflowStatus, WorkflowType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { startWorkflowForEmployee } from '@/lib/onboarding-workflows';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(request.url);
  const status = url.searchParams.get('status') as WorkflowStatus | null;
  const type = url.searchParams.get('type') as WorkflowType | null;
  const employeeId = url.searchParams.get('employeeId');
  const search = url.searchParams.get('search')?.trim();
  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);

  const workflows = await prisma.onboardingWorkflow.findMany({
    where: {
      employee: { outsourcingClientId: workspaceClientId },
      ...(status ? { status } : {}),
      ...(type ? { type } : {}),
      ...(employeeId ? { employeeId } : {}),
      ...(search
        ? {
            employee: {
              OR: [
                { firstName: { contains: search, mode: 'insensitive' } },
                { lastName: { contains: search, mode: 'insensitive' } },
              ],
            },
          }
        : {}),
    },
    include: {
      employee: { include: { department: { select: { name: true } } } },
      tasks: { select: { id: true, status: true, isRequired: true, dueDate: true } },
    },
    orderBy: { startedAt: 'desc' },
  });
  return NextResponse.json(workflows);
}

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const employeeId = typeof body?.employeeId === 'string' ? body.employeeId : null;
  const type = (typeof body?.type === 'string' ? body.type : 'ONBOARDING') as WorkflowType;
  if (!employeeId) return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });

  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);
  const empInScope = await prisma.employee.findFirst({
    where: { id: employeeId, outsourcingClientId: workspaceClientId },
    select: { id: true },
  });
  if (!empInScope) return NextResponse.json({ error: 'Employee not found for this entity' }, { status: 404 });

  const result = await startWorkflowForEmployee({ employeeId, type });
  if (!result) return NextResponse.json({ error: 'Unable to start workflow' }, { status: 404 });
  return NextResponse.json(result.workflow, { status: result.created ? 201 : 200 });
}
