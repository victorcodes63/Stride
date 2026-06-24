import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { canWriteRota } from '@/lib/rota/api-auth';
import { RotaPeriodStatus } from '@prisma/client';
import { sendNotification } from '@/lib/notifications';

type P = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, { params }: P) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  const p = await prisma.rotaPeriod.findUnique({
    where: { id },
    include: {
      _count: { select: { assignments: true } },
    },
  });
  if (!p) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(p);
}

export async function PATCH(request: NextRequest, { params }: P) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canWriteRota(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  const { id } = await params;
  const existing = await prisma.rotaPeriod.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const data: {
    name?: string | null;
    startDate?: Date;
    endDate?: Date;
    status?: RotaPeriodStatus;
  } = {};
  if (body.name !== undefined) data.name = body.name == null ? null : String(body.name).trim() || null;
  if (body.startDate != null) {
    const s = new Date(String(body.startDate));
    if (Number.isNaN(s.getTime())) return NextResponse.json({ error: 'Invalid startDate' }, { status: 400 });
    data.startDate = s;
  }
  if (body.endDate != null) {
    const s = new Date(String(body.endDate));
    if (Number.isNaN(s.getTime())) return NextResponse.json({ error: 'Invalid endDate' }, { status: 400 });
    data.endDate = s;
  }
  if (body.status === 'published' || body.status === 'draft') {
    data.status = body.status === 'published' ? RotaPeriodStatus.published : RotaPeriodStatus.draft;
  }

  if (data.startDate && data.endDate && data.endDate < data.startDate) {
    return NextResponse.json({ error: 'endDate before startDate' }, { status: 400 });
  }
  if (data.startDate && !data.endDate) {
    if (data.startDate > existing.endDate) {
      return NextResponse.json({ error: 'startDate after existing endDate' }, { status: 400 });
    }
  }
  if (data.endDate && !data.startDate) {
    if (data.endDate < existing.startDate) {
      return NextResponse.json({ error: 'endDate before existing startDate' }, { status: 400 });
    }
  }

  const p = await prisma.rotaPeriod.update({ where: { id }, data });
  try {
    if (existing.status !== 'published' && p.status === 'published') {
      const assignments = await prisma.shiftAssignment.findMany({
        where: { rotaPeriodId: p.id },
        select: { employee: { select: { essPortalUsers: { where: { isActive: true }, select: { id: true } } } } },
      });
      const essIds = [...new Set(assignments.flatMap((a) => a.employee.essPortalUsers.map((u) => u.id)))];
      if (essIds.length > 0) {
        await sendNotification({
          event: 'rota_published',
          recipientEssPortalUserIds: essIds,
          title: 'Rota published',
          body: `The ${p.name || 'current'} rota has been published. Check your upcoming shifts.`,
          href: '/ess/attendance',
          priority: 'info',
          channel: 'in_app',
          metadata: { rotaPeriodId: p.id },
        });
      }
    }
  } catch (err) {
    console.error('[notifications] Failed to send rota_published:', err);
  }
  return NextResponse.json(p);
}

export async function DELETE(request: NextRequest, { params }: P) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canWriteRota(user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }
  const { id } = await params;
  const existing = await prisma.rotaPeriod.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await prisma.rotaPeriod.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
