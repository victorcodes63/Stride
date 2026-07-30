import { NextRequest, NextResponse } from 'next/server';
import {
  SHARE_WINDOW_PRESETS,
  defaultAccessExpiresAt,
  listActiveSharesForViewer,
  listSharesOwnedBy,
  nairobiDateKey,
  parseNairobiDateKey,
  resolveShareWindow,
  type ShareDetailLevel,
  type ShareWindowPreset,
} from '@/lib/personal-calendar-share';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

function serializeShare(share: {
  id: string;
  ownerId: string;
  viewerId: string;
  windowStart: Date;
  windowEnd: Date;
  accessExpiresAt: Date;
  detailLevel: string;
  message: string | null;
  status: string;
  createdAt: Date;
  owner?: { id: string; name: string; email: string };
  viewer?: { id: string; name: string; email: string };
}) {
  return {
    id: share.id,
    ownerId: share.ownerId,
    viewerId: share.viewerId,
    windowStart: nairobiDateKey(share.windowStart),
    windowEnd: nairobiDateKey(share.windowEnd),
    accessExpiresAt: share.accessExpiresAt.toISOString(),
    detailLevel: share.detailLevel,
    message: share.message,
    status: share.status,
    createdAt: share.createdAt.toISOString(),
    owner: share.owner,
    viewer: share.viewer,
  };
}

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const [outgoing, incoming] = await Promise.all([
      listSharesOwnedBy(ctx.staff.id, ctx.organizationId),
      listActiveSharesForViewer(ctx.staff.id, ctx.organizationId),
    ]);
    return NextResponse.json({
      outgoing: outgoing.map(serializeShare),
      incoming: incoming.map(serializeShare),
    });
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const body = await request.json().catch(() => null);
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ error: 'Share details are required.' }, { status: 400 });
    }
    const value = body as Record<string, unknown>;
    const viewerIds = Array.isArray(value.viewerIds)
      ? [
          ...new Set(
            value.viewerIds.filter(
              (id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 64,
            ),
          ),
        ]
      : [];
    if (!viewerIds.length) {
      return NextResponse.json({ error: 'Select at least one colleague to share with.' }, { status: 400 });
    }
    if (viewerIds.includes(ctx.staff.id)) {
      return NextResponse.json({ error: 'You cannot share a calendar with yourself.' }, { status: 400 });
    }

    const presetRaw = typeof value.preset === 'string' ? value.preset : 'week';
    if (!SHARE_WINDOW_PRESETS.includes(presetRaw as ShareWindowPreset)) {
      return NextResponse.json({ error: 'Choose a valid share window.' }, { status: 400 });
    }
    const preset = presetRaw as ShareWindowPreset;
    const window = resolveShareWindow(
      preset,
      typeof value.windowStart === 'string' ? value.windowStart : null,
      typeof value.windowEnd === 'string' ? value.windowEnd : null,
    );
    if ('error' in window) return NextResponse.json({ error: window.error }, { status: 400 });

    let accessExpiresAt = defaultAccessExpiresAt(window.windowEndKey);
    if (typeof value.accessExpiresAt === 'string' && value.accessExpiresAt) {
      const customExpiry = parseNairobiDateKey(value.accessExpiresAt);
      if (!customExpiry) {
        return NextResponse.json({ error: 'Enter a valid access end date.' }, { status: 400 });
      }
      accessExpiresAt = defaultAccessExpiresAt(nairobiDateKey(customExpiry));
    }
    if (accessExpiresAt.getTime() <= Date.now()) {
      return NextResponse.json({ error: 'Access must expire in the future.' }, { status: 400 });
    }

    const detailLevel: ShareDetailLevel = value.detailLevel === 'busy' ? 'busy' : 'titles';
    const message =
      typeof value.message === 'string' ? value.message.trim().slice(0, 500) || null : null;

    const viewers = await ctx.run((tx) =>
      tx.user.findMany({
        where: {
          id: { in: viewerIds },
          isActive: true,
          organizationMemberships: { some: { organizationId: ctx.organizationId } },
        },
        select: { id: true, name: true, email: true },
      }),
    );
    if (!viewers.length) {
      return NextResponse.json({ error: 'No active colleagues matched your selection.' }, { status: 400 });
    }

    const created = await ctx.run(async (tx) => {
      const rows = [];
      for (const viewer of viewers) {
        rows.push(
          await tx.personalCalendarShare.create({
            data: {
              organizationId: ctx.organizationId,
              ownerId: ctx.staff.id,
              viewerId: viewer.id,
              windowStart: window.windowStart,
              windowEnd: window.windowEnd,
              accessExpiresAt,
              detailLevel,
              message,
            },
            include: {
              viewer: { select: { id: true, name: true, email: true } },
              owner: { select: { id: true, name: true, email: true } },
            },
          }),
        );
      }
      const href = `/dashboard/calendar?scope=personal&shared=${encodeURIComponent(ctx.staff.id)}`;
      const windowLabel = `${window.windowStartKey} → ${window.windowEndKey}`;
      await tx.staffNotification.createMany({
        data: viewers.map((viewer) => ({
          organizationId: ctx.organizationId,
          userId: viewer.id,
          title: 'Calendar shared with you',
          body: message
            ? `${ctx.staff.name} shared their personal calendar (${windowLabel}). ${message}`
            : `${ctx.staff.name} shared their personal calendar with you for ${windowLabel}.`,
          href,
          event: 'calendar.share',
          priority: 'info',
        })),
      });
      return rows;
    });

    return NextResponse.json({ shares: created.map(serializeShare) }, { status: 201 });
  });
}
