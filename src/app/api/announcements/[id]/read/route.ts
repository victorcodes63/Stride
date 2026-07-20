import { NextRequest, NextResponse } from 'next/server';
import { reportApiError } from '@/lib/monitoring';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

/**
 * Records that the current user has read (and optionally acknowledged) an
 * announcement. Idempotent — repeated calls upsert the same read row.
 * POST body `{ acknowledge?: boolean }` sets acknowledgedAt when true.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    const { id } = await params;

    let body: { acknowledge?: boolean } = {};
    try {
      const raw = await request.text();
      if (raw) body = JSON.parse(raw);
    } catch {
      body = {};
    }

    try {
      const announcement = await ctx.run((tx) =>
        tx.announcement.findFirst({ where: ctx.where({ id }), select: { id: true } }),
      );
      if (!announcement) {
        return NextResponse.json({ error: 'Announcement not found.' }, { status: 404 });
      }

      const acknowledge = body.acknowledge === true;
      const now = new Date();

      const read = await ctx.run((tx) =>
        tx.announcementRead.upsert({
          where: {
            announcementId_userId: { announcementId: announcement.id, userId: ctx.staff.id },
          },
          create: {
            organizationId: ctx.organizationId,
            announcementId: announcement.id,
            userId: ctx.staff.id,
            readAt: now,
            acknowledgedAt: acknowledge ? now : null,
          },
          update: acknowledge ? { acknowledgedAt: now } : {},
        }),
      );

      return NextResponse.json({
        id: read.id,
        readAt: read.readAt.toISOString(),
        acknowledgedAt: read.acknowledgedAt?.toISOString() ?? null,
      });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/announcements/[id]/read',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to record read.' }, { status: 500 });
    }
  });
}

/** Records an acknowledgement for the current user (implies read). */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    const { id } = await params;

    try {
      const announcement = await ctx.run((tx) =>
        tx.announcement.findFirst({ where: ctx.where({ id }), select: { id: true } }),
      );
      if (!announcement) {
        return NextResponse.json({ error: 'Announcement not found.' }, { status: 404 });
      }

      const now = new Date();
      const read = await ctx.run((tx) =>
        tx.announcementRead.upsert({
          where: {
            announcementId_userId: { announcementId: announcement.id, userId: ctx.staff.id },
          },
          create: {
            organizationId: ctx.organizationId,
            announcementId: announcement.id,
            userId: ctx.staff.id,
            readAt: now,
            acknowledgedAt: now,
          },
          update: { acknowledgedAt: now },
        }),
      );

      return NextResponse.json({
        id: read.id,
        readAt: read.readAt.toISOString(),
        acknowledgedAt: read.acknowledgedAt?.toISOString() ?? null,
      });
    } catch (error) {
      await reportApiError({
        route: 'PATCH /api/announcements/[id]/read',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to record acknowledgement.' }, { status: 500 });
    }
  });
}
