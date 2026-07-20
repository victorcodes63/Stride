import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { reportApiError } from '@/lib/monitoring';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

const PRIORITIES = new Set(['low', 'normal', 'high', 'urgent']);
const STATUSES = new Set(['draft', 'published', 'archived']);

export async function GET(
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
        tx.announcement.findFirst({
          where: ctx.where({ id }),
          include: {
            attachments: { orderBy: { createdAt: 'desc' } },
            reads: { orderBy: { readAt: 'desc' } },
          },
        }),
      );

      if (!announcement) {
        return NextResponse.json({ error: 'Announcement not found.' }, { status: 404 });
      }

      const readerIds = Array.from(
        new Set(announcement.reads.map((r) => r.userId).filter((v): v is string => Boolean(v))),
      );
      const readers =
        readerIds.length > 0
          ? await ctx.run((tx) =>
              tx.user.findMany({
                where: { id: { in: readerIds } },
                select: { id: true, name: true, email: true },
              }),
            )
          : [];
      const readerById = new Map(readers.map((u) => [u.id, u]));

      const readCount = announcement.reads.length;
      const ackCount = announcement.reads.filter((r) => r.acknowledgedAt != null).length;

      return NextResponse.json({
        announcement: {
          id: announcement.id,
          title: announcement.title,
          body: announcement.body,
          status: announcement.status,
          priority: announcement.priority,
          authorUserId: announcement.authorUserId,
          publishedAt: announcement.publishedAt?.toISOString() ?? null,
          expiresAt: announcement.expiresAt?.toISOString() ?? null,
          isPinned: announcement.isPinned,
          requireAcknowledgement: announcement.requireAcknowledgement,
          targetDepartments: announcement.targetDepartments ?? null,
          targetRoles: announcement.targetRoles ?? null,
          createdAt: announcement.createdAt.toISOString(),
          updatedAt: announcement.updatedAt.toISOString(),
          attachments: announcement.attachments.map((att) => ({
            id: att.id,
            fileName: att.fileName,
            fileUrl: att.fileUrl,
            contentType: att.contentType,
            fileSize: att.fileSize,
            createdAt: att.createdAt.toISOString(),
          })),
        },
        engagement: {
          readCount,
          ackCount,
          reads: announcement.reads.map((r) => {
            const reader = r.userId ? readerById.get(r.userId) : undefined;
            return {
              id: r.id,
              userId: r.userId,
              employeeId: r.employeeId,
              name: reader?.name ?? null,
              email: reader?.email ?? null,
              readAt: r.readAt.toISOString(),
              acknowledgedAt: r.acknowledgedAt?.toISOString() ?? null,
            };
          }),
        },
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/announcements/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load announcement.' }, { status: 500 });
    }
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    const { id } = await params;
    let body: {
      title?: string;
      body?: string;
      priority?: string;
      status?: string;
      isPinned?: boolean;
      requireAcknowledgement?: boolean;
      expiresAt?: string | null;
      targetDepartments?: unknown;
      targetRoles?: unknown;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    try {
      const existing = await ctx.run((tx) =>
        tx.announcement.findFirst({ where: ctx.where({ id }) }),
      );
      if (!existing) {
        return NextResponse.json({ error: 'Announcement not found.' }, { status: 404 });
      }

      const data: Prisma.AnnouncementUpdateInput = {};

      if (body.title !== undefined) {
        if (!body.title.trim()) {
          return NextResponse.json({ error: 'Title cannot be empty.' }, { status: 400 });
        }
        data.title = body.title.trim();
      }
      if (body.body !== undefined) {
        if (!body.body.trim()) {
          return NextResponse.json({ error: 'Body cannot be empty.' }, { status: 400 });
        }
        data.body = body.body.trim();
      }
      if (body.priority !== undefined) {
        if (!PRIORITIES.has(body.priority)) {
          return NextResponse.json({ error: 'Invalid priority.' }, { status: 400 });
        }
        data.priority = body.priority as Prisma.AnnouncementUpdateInput['priority'];
      }
      if (body.isPinned !== undefined) data.isPinned = body.isPinned;
      if (body.requireAcknowledgement !== undefined) {
        data.requireAcknowledgement = body.requireAcknowledgement;
      }
      if (body.expiresAt !== undefined) {
        data.expiresAt = body.expiresAt ? new Date(body.expiresAt) : null;
      }
      if (body.targetDepartments !== undefined) {
        data.targetDepartments = (body.targetDepartments as Prisma.InputJsonValue) ?? undefined;
      }
      if (body.targetRoles !== undefined) {
        data.targetRoles = (body.targetRoles as Prisma.InputJsonValue) ?? undefined;
      }
      if (body.status !== undefined) {
        if (!STATUSES.has(body.status)) {
          return NextResponse.json({ error: 'Invalid status.' }, { status: 400 });
        }
        data.status = body.status as Prisma.AnnouncementUpdateInput['status'];
        // Set publishedAt the first time an announcement is published.
        if (body.status === 'published' && !existing.publishedAt) {
          data.publishedAt = new Date();
        }
      }

      const updated = await ctx.run((tx) =>
        tx.announcement.update({ where: { id: existing.id }, data }),
      );

      await ctx.audit({
        action: 'announcement.update',
        entityType: 'Announcement',
        entityId: updated.id,
        route: 'PATCH /api/announcements/[id]',
        metadata: { status: updated.status, priority: updated.priority, isPinned: updated.isPinned },
      });

      return NextResponse.json({ id: updated.id });
    } catch (error) {
      await reportApiError({
        route: 'PATCH /api/announcements/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to update announcement.' }, { status: 500 });
    }
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    const { id } = await params;
    try {
      const existing = await ctx.run((tx) =>
        tx.announcement.findFirst({ where: ctx.where({ id }) }),
      );
      if (!existing) {
        return NextResponse.json({ error: 'Announcement not found.' }, { status: 404 });
      }

      await ctx.run((tx) => tx.announcement.delete({ where: { id: existing.id } }));

      await ctx.audit({
        action: 'announcement.delete',
        entityType: 'Announcement',
        entityId: existing.id,
        route: 'DELETE /api/announcements/[id]',
        metadata: { title: existing.title },
      });

      return NextResponse.json({ ok: true });
    } catch (error) {
      await reportApiError({
        route: 'DELETE /api/announcements/[id]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to delete announcement.' }, { status: 500 });
    }
  });
}
