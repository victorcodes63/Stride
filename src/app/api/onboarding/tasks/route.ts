import { NextRequest, NextResponse } from 'next/server';
import { OnboardingTaskStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { getRoleKeysForUser } from '@/lib/onboarding-workflows';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const url = new URL(request.url);
    const mineOnly = url.searchParams.get('mine') === 'true';
    const statuses = (url.searchParams.get('statuses') ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean) as OnboardingTaskStatus[];

    const roleKeys = getRoleKeysForUser(ctx.staff);
    const workspaceClientId = await resolvePrimaryWorkspaceClientId(
      prisma,
      null,
      request,
      ctx.organizationId,
    );

    const tasks = await ctx.run((tx) =>
      tx.onboardingTask.findMany({
        where: {
          ...ctx.where(),
          workflow: {
            employee: { outsourcingClientId: workspaceClientId },
          },
          ...(statuses.length > 0 ? { status: { in: statuses } } : {}),
          ...(mineOnly
            ? {
                OR: [{ assignedToId: ctx.staff.id }, { assignedRole: { in: roleKeys } }],
              }
            : {}),
        },
        include: {
          workflow: {
            include: { employee: { select: { id: true, firstName: true, lastName: true } } },
          },
        },
        orderBy: [{ dueDate: 'asc' }, { order: 'asc' }],
      }),
    );

    return NextResponse.json(tasks);
  });
}
