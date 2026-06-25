import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { canAccessSacco, forbiddenResponse } from '@/lib/demo-route-access';
import { reportApiError } from '@/lib/monitoring';
import { postDividendRun } from '@/lib/sacco/dividends';
import { serializeDividendRun } from '@/lib/sacco/serialize';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessSacco(user)) {
    return forbiddenResponse('SACCO access is restricted to finance and admin users.');
  }

  const { id } = await context.params;

  try {
    const run = await prisma.saccoDividendRun.findUnique({
      where: { id },
      include: {
        lines: {
          include: { member: true },
          orderBy: { dividendAmount: 'desc' },
        },
        _count: { select: { lines: true } },
      },
    });
    if (!run) return NextResponse.json({ error: 'Dividend run not found.' }, { status: 404 });

    return NextResponse.json({
      run: serializeDividendRun(run),
      lines: run.lines.map((line) => ({
        id: line.id,
        memberNumber: line.member.memberNumber,
        memberName: `${line.member.firstName} ${line.member.lastName}`.trim(),
        sharesBalance: Number(line.sharesBalance),
        dividendAmount: Number(line.dividendAmount),
      })),
    });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/sacco/dividends/[id]',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load dividend run.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessSacco(user)) {
    return forbiddenResponse('SACCO access is restricted to finance and admin users.');
  }

  const { id } = await context.params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const action = typeof body.action === 'string' ? body.action.trim() : '';

  try {
    if (action === 'approve') {
      const run = await prisma.saccoDividendRun.update({
        where: { id },
        data: { status: 'approved', approvedAt: new Date() },
        include: { _count: { select: { lines: true } } },
      });
      return NextResponse.json({ run: serializeDividendRun(run) });
    }

    if (action === 'post') {
      const run = await postDividendRun(prisma, id, user.id);
      const full = await prisma.saccoDividendRun.findUniqueOrThrow({
        where: { id: run.id },
        include: { _count: { select: { lines: true } } },
      });
      return NextResponse.json({ run: serializeDividendRun(full) });
    }

    if (action === 'cancel') {
      const run = await prisma.saccoDividendRun.update({
        where: { id },
        data: { status: 'cancelled' },
        include: { _count: { select: { lines: true } } },
      });
      return NextResponse.json({ run: serializeDividendRun(run) });
    }

    return NextResponse.json({ error: 'Unknown action. Use approve, post, or cancel.' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update dividend run.';
    await reportApiError({
      route: 'PATCH /api/sacco/dividends/[id]',
      message,
    });
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
