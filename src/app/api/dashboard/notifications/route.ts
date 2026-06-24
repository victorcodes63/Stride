import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { reportApiError } from '@/lib/monitoring';
import { whereExcludeSeedStaffNotifications } from '@/lib/staff-notification-seed-filter';
import { delegateWorkflowRun, runWorkflowEscalationSweep } from '@/lib/notifications';
import { logAuditEvent } from '@/lib/audit-events';

export const dynamic = 'force-dynamic';

/** GET — recent notifications for the signed-in staff user. */
export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limit = Math.min(50, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '30', 10)));
  const includeHistory = request.nextUrl.searchParams.get('includeHistory') === 'true';

  try {
    const [notifications, unreadCount] = await Promise.all([
      prisma.staffNotification.findMany({
        where: { userId: user.id, ...whereExcludeSeedStaffNotifications() },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          title: true,
          body: true,
          readAt: true,
          href: true,
          contractId: true,
          event: true,
          priority: true,
          createdAt: true,
        },
      }),
      prisma.staffNotification.count({
        where: { userId: user.id, readAt: null, ...whereExcludeSeedStaffNotifications() },
      }),
    ]);

    const response: Record<string, unknown> = {
      notifications: notifications.map((n) => ({
        id: n.id,
        title: n.title,
        body: n.body,
        href: n.href,
        contractId: n.contractId,
        event: n.event,
        priority: n.priority,
        unread: n.readAt === null,
        createdAt: n.createdAt.toISOString(),
      })),
      unreadCount,
    };
    if (includeHistory) {
      const history = await prisma.notificationDelivery.findMany({
        where: { recipientUserId: user.id },
        orderBy: { createdAt: 'desc' },
        take: limit,
        select: {
          id: true,
          event: true,
          channel: true,
          status: true,
          provider: true,
          error: true,
          createdAt: true,
          deliveredAt: true,
          triggerType: true,
        },
      });
      response.deliveryHistory = history.map((h) => ({
        ...h,
        createdAt: h.createdAt.toISOString(),
        deliveredAt: h.deliveredAt?.toISOString() ?? null,
      }));
    }
    return NextResponse.json(response);
  } catch (error) {
    await reportApiError({
      route: 'GET /api/dashboard/notifications',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load notifications.' }, { status: 500 });
  }
}

/** PATCH — body: { markAllRead?: boolean; ids?: string[] } */
export async function PATCH(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: {
    markAllRead?: boolean;
    ids?: string[];
    action?: 'delegate_workflow' | 'run_escalation_sweep';
    workflowRunId?: string;
    toUserId?: string;
    reason?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const now = new Date();

  try {
    if (body.action === 'run_escalation_sweep') {
      if (user.role !== 'admin' && user.staffUserType !== 'business_manager') {
        return NextResponse.json({ error: 'Only admins and business managers can run escalation sweeps.' }, { status: 403 });
      }
      const result = await runWorkflowEscalationSweep();
      await logAuditEvent({
        actor: { userId: user.id, email: user.email, name: user.name },
        action: 'workflow.escalation_sweep',
        entityType: 'WorkflowRun',
        route: 'PATCH /api/dashboard/notifications',
        metadata: result,
      });
      return NextResponse.json({ ok: true, ...result });
    }
    if (body.action === 'delegate_workflow') {
      if (!body.workflowRunId || !body.toUserId) {
        return NextResponse.json({ error: 'workflowRunId and toUserId are required.' }, { status: 400 });
      }
      const delegated = await delegateWorkflowRun({
        workflowRunId: body.workflowRunId,
        fromUserId: user.id,
        toUserId: body.toUserId,
        reason: body.reason ?? null,
        actor: { userId: user.id, email: user.email, name: user.name },
      });
      return NextResponse.json({ ok: true, workflow: delegated });
    }
    if (body.markAllRead) {
      await prisma.staffNotification.updateMany({
        where: { userId: user.id, readAt: null, ...whereExcludeSeedStaffNotifications() },
        data: { readAt: now },
      });
      return NextResponse.json({ ok: true });
    }

    const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === 'string') : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });
    }

    await prisma.staffNotification.updateMany({
      where: { userId: user.id, id: { in: ids } },
      data: { readAt: now },
    });
    return NextResponse.json({ ok: true, updated: ids.length });
  } catch (error) {
    await reportApiError({
      route: 'PATCH /api/dashboard/notifications',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to update notifications.' }, { status: 500 });
  }
}
