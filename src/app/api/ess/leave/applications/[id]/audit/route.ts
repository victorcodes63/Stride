import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEssUser } from '@/lib/ess-api-auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const { id } = await params;
  const leave = await prisma.leaveApplication.findUnique({
    where: { id },
    include: { employee: { select: { managerEmployeeId: true } } },
  });
  if (!leave) return NextResponse.json({ error: 'Leave application not found.' }, { status: 404 });

  const canView =
    (user.employeeId && leave.employeeId === user.employeeId) ||
    user.role === 'hr' ||
    (user.role === 'manager' && user.employeeId && leave.employee.managerEmployeeId === user.employeeId);
  if (!canView) return NextResponse.json({ error: 'Forbidden.' }, { status: 403 });

  const { searchParams } = request.nextUrl;
  const actionFilter = searchParams.get('action');
  const q = (searchParams.get('q') || '').trim().toLowerCase();
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const pageSize = Math.min(50, Math.max(1, Number(searchParams.get('pageSize') || 10)));

  const whereAction =
    actionFilter === 'requested' || actionFilter === 'approved' || actionFilter === 'rejected'
      ? `ess.leave.${actionFilter}`
      : undefined;

  const whereBase = {
    entityType: 'LeaveApplication' as const,
    entityId: id,
    action: whereAction ? whereAction : ({ startsWith: 'ess.leave.' } as const),
  };

  const total = await prisma.auditEvent.count({ where: whereBase });
  const events = await prisma.auditEvent.findMany({
    where: {
      ...whereBase,
    },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      action: true,
      actorEmail: true,
      metadata: true,
      createdAt: true,
    },
  });

  const filtered = events.filter((event) => {
    if (!q) return true;
    const note = typeof (event.metadata as { note?: unknown } | null)?.note === 'string'
      ? (((event.metadata as { note?: string } | null)?.note) ?? '')
      : '';
    return (
      (event.actorEmail || '').toLowerCase().includes(q) ||
      event.action.toLowerCase().includes(q) ||
      note.toLowerCase().includes(q)
    );
  });

  return NextResponse.json({
    items: filtered.map((event) => ({
      id: event.id,
      action: event.action,
      actorEmail: event.actorEmail,
      metadata: event.metadata,
      createdAt: event.createdAt.toISOString(),
    })),
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  });
}
