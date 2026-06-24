import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { reportApiError } from '@/lib/monitoring';
import { isDemoMode } from '@/lib/deployment-config';
import { resolveEntityIdOrDefault } from '@/lib/entity-request';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const status = request.nextUrl.searchParams.get('status')?.trim() || undefined;
    const entityScope = isDemoMode() ? await resolveEntityIdOrDefault(request) : null;
    const announcements = await prisma.announcement.findMany({
      where: {
        ...(status ? { status: status as any } : {}),
        ...(entityScope
          ? { targetRoles: { path: ['demoEntityCode'], equals: entityScope } }
          : {}),
      },
      orderBy: [{ isPinned: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
      take: 100,
    });

    return NextResponse.json({
      announcements: announcements.map((a) => ({
        id: a.id,
        title: a.title,
        body: a.body,
        status: a.status,
        priority: a.priority,
        authorUserId: a.authorUserId,
        publishedAt: a.publishedAt?.toISOString() ?? null,
        expiresAt: a.expiresAt?.toISOString() ?? null,
        isPinned: a.isPinned,
        createdAt: a.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/announcements',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load announcements.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { title, body: content, priority, isPinned, expiresAt, status, targetDepartments, targetRoles } = body;
  if (!title?.trim() || !content?.trim()) {
    return NextResponse.json({ error: 'Title and body are required.' }, { status: 400 });
  }

  try {
    const publishNow = status === 'published';
    const announcement = await prisma.announcement.create({
      data: {
        title: title.trim(),
        body: content.trim(),
        priority: priority || 'normal',
        isPinned: isPinned ?? false,
        status: status || 'draft',
        authorUserId: user.id,
        publishedAt: publishNow ? new Date() : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        targetDepartments: targetDepartments || null,
        targetRoles: targetRoles || null,
      },
    });

    return NextResponse.json({ id: announcement.id }, { status: 201 });
  } catch (error) {
    await reportApiError({
      route: 'POST /api/announcements',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to create announcement.' }, { status: 500 });
  }
}
