import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminActor } from '@/lib/admin-security';

export async function GET(request: NextRequest) {
  const { error } = await requireAdminActor(request);
  if (error) return error;

  const limitParam = Number(request.nextUrl.searchParams.get('limit') || '100');
  const limit = Number.isFinite(limitParam) ? Math.min(Math.max(limitParam, 1), 500) : 100;
  const action = request.nextUrl.searchParams.get('action')?.trim() || null;
  const entityType = request.nextUrl.searchParams.get('entityType')?.trim() || null;
  const actorUserId = request.nextUrl.searchParams.get('actorUserId')?.trim() || null;
  const fromParam = request.nextUrl.searchParams.get('from')?.trim() || null;
  const toParam = request.nextUrl.searchParams.get('to')?.trim() || null;
  const from = fromParam ? new Date(`${fromParam}T00:00:00.000Z`) : null;
  const to = toParam ? new Date(`${toParam}T23:59:59.999Z`) : null;
  const createdAt =
    from || to
      ? {
          ...(from && !Number.isNaN(from.getTime()) ? { gte: from } : {}),
          ...(to && !Number.isNaN(to.getTime()) ? { lte: to } : {}),
        }
      : undefined;

  try {
    if (!process.env.DATABASE_URL) return NextResponse.json([]);
    const rows = await prisma.auditEvent.findMany({
      where: {
        ...(action ? { action } : {}),
        ...(entityType ? { entityType } : {}),
        ...(actorUserId ? { actorUserId } : {}),
        ...(createdAt ? { createdAt } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        actor: {
          select: { name: true, email: true },
        },
      },
    });

    return NextResponse.json(
      rows.map((row) => ({
        id: row.id,
        actorUserId: row.actorUserId,
        actorNameOrEmail: row.actor?.name || row.actor?.email || row.actorEmail || 'System',
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        route: row.route,
        metadata: row.metadata,
        createdAt: row.createdAt.toISOString(),
      })),
    );
  } catch (e) {
    console.error('GET /api/admin/audit-log error:', e);
    return NextResponse.json({ error: 'Failed to load audit log.' }, { status: 500 });
  }
}
