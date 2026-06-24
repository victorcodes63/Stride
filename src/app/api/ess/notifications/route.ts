import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEssUser } from '@/lib/ess-api-auth';
import { whereExcludeSeedStaffNotifications } from '@/lib/staff-notification-seed-filter';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const limit = Math.min(50, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '30', 10)));
  const includeHistory = request.nextUrl.searchParams.get('includeHistory') === 'true';
  const [notifications, unreadCount] = await Promise.all([
    prisma.staffNotification.findMany({
      where: { essPortalUserId: user.id, ...whereExcludeSeedStaffNotifications() },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: {
        id: true,
        title: true,
        body: true,
        readAt: true,
        href: true,
        createdAt: true,
        event: true,
        priority: true,
      },
    }),
    prisma.staffNotification.count({
      where: { essPortalUserId: user.id, readAt: null, ...whereExcludeSeedStaffNotifications() },
    }),
  ]);

  const response: Record<string, unknown> = {
    notifications: notifications.map((n) => ({
      id: n.id,
      title: n.title,
      body: n.body,
      href: n.href,
      unread: n.readAt === null,
      event: n.event,
      priority: n.priority,
      createdAt: n.createdAt.toISOString(),
    })),
    unreadCount,
  };
  if (includeHistory) {
    const history = await prisma.notificationDelivery.findMany({
      where: { recipientEssPortalUserId: user.id },
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
}

export async function PATCH(request: NextRequest) {
  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { markAllRead?: boolean; ids?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const now = new Date();
  if (body.markAllRead) {
    await prisma.staffNotification.updateMany({
      where: { essPortalUserId: user.id, readAt: null, ...whereExcludeSeedStaffNotifications() },
      data: { readAt: now },
    });
    return NextResponse.json({ ok: true });
  }

  const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === 'string') : [];
  if (ids.length === 0) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });

  await prisma.staffNotification.updateMany({
    where: { essPortalUserId: user.id, id: { in: ids } },
    data: { readAt: now },
  });
  return NextResponse.json({ ok: true, updated: ids.length });
}
