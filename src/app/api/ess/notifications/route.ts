import { NextRequest, NextResponse } from 'next/server';
import { withEssTenant } from '@/lib/ess-tenant-api';
import { whereExcludeSeedStaffNotifications } from '@/lib/staff-notification-seed-filter';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  return withEssTenant(request, async (ctx) => {
    const limit = Math.min(50, Math.max(1, parseInt(request.nextUrl.searchParams.get('limit') || '30', 10)));
    const includeHistory = request.nextUrl.searchParams.get('includeHistory') === 'true';
    const [notifications, unreadCount] = await ctx.run((tx) =>
      Promise.all([
        tx.staffNotification.findMany({
          where: ctx.where({
            essPortalUserId: ctx.essUser.id,
            ...whereExcludeSeedStaffNotifications(),
          }),
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
        tx.staffNotification.count({
          where: ctx.where({
            essPortalUserId: ctx.essUser.id,
            readAt: null,
            ...whereExcludeSeedStaffNotifications(),
          }),
        }),
      ]),
    );

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
      const history = await ctx.run((tx) =>
        tx.notificationDelivery.findMany({
          where: ctx.where({ recipientEssPortalUserId: ctx.essUser.id }),
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
        }),
      );
      response.deliveryHistory = history.map((h) => ({
        ...h,
        createdAt: h.createdAt.toISOString(),
        deliveredAt: h.deliveredAt?.toISOString() ?? null,
      }));
    }
    return NextResponse.json(response);
  });
}

export async function PATCH(request: NextRequest) {
  return withEssTenant(request, async (ctx) => {
    let body: { markAllRead?: boolean; ids?: string[] };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const now = new Date();
    if (body.markAllRead) {
      await ctx.run((tx) =>
        tx.staffNotification.updateMany({
          where: ctx.where({
            essPortalUserId: ctx.essUser.id,
            readAt: null,
            ...whereExcludeSeedStaffNotifications(),
          }),
          data: { readAt: now },
        }),
      );
      return NextResponse.json({ ok: true });
    }

    const ids = Array.isArray(body.ids) ? body.ids.filter((id): id is string => typeof id === 'string') : [];
    if (ids.length === 0) return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 });

    await ctx.run((tx) =>
      tx.staffNotification.updateMany({
        where: ctx.where({ essPortalUserId: ctx.essUser.id, id: { in: ids } }),
        data: { readAt: now },
      }),
    );
    return NextResponse.json({ ok: true, updated: ids.length });
  });
}
