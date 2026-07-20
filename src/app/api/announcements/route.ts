import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { reportApiError } from '@/lib/monitoring';
import { isDemoMode } from '@/lib/deployment-config';
import { resolveEntityIdOrDefault } from '@/lib/entity-request';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

function parsePositiveInt(value: string | null, fallback: number, max?: number): number {
  const parsed = value ? parseInt(value, 10) : NaN;
  if (Number.isNaN(parsed) || parsed < 1) return fallback;
  return max ? Math.min(parsed, max) : parsed;
}

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ announcements: [], total: 0, page: 1, pageSize: DEFAULT_PAGE_SIZE });
    }
    try {
      const params = request.nextUrl.searchParams;
      const status = params.get('status')?.trim() || undefined;
      const search = params.get('search')?.trim() || params.get('q')?.trim() || undefined;
      const page = parsePositiveInt(params.get('page'), 1);
      const pageSize = parsePositiveInt(params.get('pageSize'), DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
      const entityScope = isDemoMode() ? await resolveEntityIdOrDefault(request) : null;

      const where: Prisma.AnnouncementWhereInput = {
        ...ctx.where(),
        ...(status ? { status: status as Prisma.AnnouncementWhereInput['status'] } : {}),
        ...(search
          ? {
              OR: [
                { title: { contains: search, mode: 'insensitive' } },
                { body: { contains: search, mode: 'insensitive' } },
              ],
            }
          : {}),
        ...(entityScope
          ? { targetRoles: { path: ['demoEntityCode'], equals: entityScope } }
          : {}),
      };

      const { rows, total } = await ctx.run(async (tx) => {
        const [rows, total] = await Promise.all([
          tx.announcement.findMany({
            where,
            orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
            skip: (page - 1) * pageSize,
            take: pageSize,
            include: { _count: { select: { reads: true, attachments: true } } },
          }),
          tx.announcement.count({ where }),
        ]);
        return { rows, total };
      });

      const ids = rows.map((r) => r.id);
      const ackCounts =
        ids.length > 0
          ? await ctx.run((tx) =>
              tx.announcementRead.groupBy({
                by: ['announcementId'],
                where: { ...ctx.where(), announcementId: { in: ids }, acknowledgedAt: { not: null } },
                _count: { _all: true },
              }),
            )
          : [];
      const ackByAnnouncement = new Map(ackCounts.map((a) => [a.announcementId, a._count._all]));

      return NextResponse.json({
        announcements: rows.map((a) => ({
          id: a.id,
          title: a.title,
          body: a.body,
          status: a.status,
          priority: a.priority,
          authorUserId: a.authorUserId,
          publishedAt: a.publishedAt?.toISOString() ?? null,
          expiresAt: a.expiresAt?.toISOString() ?? null,
          isPinned: a.isPinned,
          requireAcknowledgement: a.requireAcknowledgement,
          targetDepartments: a.targetDepartments ?? null,
          targetRoles: a.targetRoles ?? null,
          readCount: a._count.reads,
          ackCount: ackByAnnouncement.get(a.id) ?? 0,
          attachmentCount: a._count.attachments,
          createdAt: a.createdAt.toISOString(),
        })),
        total,
        page,
        pageSize,
      });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/announcements',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load announcements.' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    let body: {
      title?: string;
      body?: string;
      priority?: string;
      isPinned?: boolean;
      requireAcknowledgement?: boolean;
      expiresAt?: string | null;
      status?: string;
      targetDepartments?: unknown;
      targetRoles?: unknown;
    };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const {
      title,
      body: content,
      priority,
      isPinned,
      requireAcknowledgement,
      expiresAt,
      status,
      targetDepartments,
      targetRoles,
    } = body;
    if (!title?.trim() || !content?.trim()) {
      return NextResponse.json({ error: 'Title and body are required.' }, { status: 400 });
    }

    try {
      const publishNow = status === 'published';
      const announcement = await ctx.run((tx) =>
        tx.announcement.create({
          data: {
            organizationId: ctx.organizationId,
            title: title.trim(),
            body: content.trim(),
            priority: (priority as Prisma.AnnouncementCreateInput['priority']) || 'normal',
            isPinned: isPinned ?? false,
            requireAcknowledgement: requireAcknowledgement ?? false,
            status: (status as Prisma.AnnouncementCreateInput['status']) || 'draft',
            authorUserId: ctx.staff.id,
            publishedAt: publishNow ? new Date() : null,
            expiresAt: expiresAt ? new Date(expiresAt) : null,
            targetDepartments: (targetDepartments as Prisma.InputJsonValue) ?? undefined,
            targetRoles: (targetRoles as Prisma.InputJsonValue) ?? undefined,
          },
        }),
      );

      await ctx.audit({
        action: 'announcement.create',
        entityType: 'Announcement',
        entityId: announcement.id,
        route: 'POST /api/announcements',
        metadata: { status: announcement.status, priority: announcement.priority },
      });

      return NextResponse.json({ id: announcement.id }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/announcements',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create announcement.' }, { status: 500 });
    }
  });
}
