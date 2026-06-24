import { NextRequest, NextResponse } from 'next/server';
import { OnboardingTaskStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { getRoleKeysForUser } from '@/lib/onboarding-workflows';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const url = new URL(request.url);
  const mineOnly = url.searchParams.get('mine') === 'true';
  const statuses = (url.searchParams.get('statuses') ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean) as OnboardingTaskStatus[];

  const roleKeys = getRoleKeysForUser(user);
  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);
  const tasks = await prisma.onboardingTask.findMany({
    where: {
      workflow: { employee: { outsourcingClientId: workspaceClientId } },
      ...(statuses.length > 0 ? { status: { in: statuses } } : {}),
      ...(mineOnly
        ? {
            OR: [{ assignedToId: user.id }, { assignedRole: { in: roleKeys } }],
          }
        : {}),
    },
    include: {
      workflow: {
        include: { employee: { select: { id: true, firstName: true, lastName: true } } },
      },
    },
    orderBy: [{ dueDate: 'asc' }, { order: 'asc' }],
  });
  return NextResponse.json(tasks);
}
