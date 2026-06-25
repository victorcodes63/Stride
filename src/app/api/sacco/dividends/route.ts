import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { canAccessSacco, forbiddenResponse } from '@/lib/demo-route-access';
import { reportApiError } from '@/lib/monitoring';
import { buildDividendAllocations } from '@/lib/sacco/dividends';
import { serializeDividendRun } from '@/lib/sacco/serialize';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessSacco(user)) {
    return forbiddenResponse('SACCO access is restricted to finance and admin users.');
  }

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const runs = await prisma.saccoDividendRun.findMany({
      where: { outsourcingClientId: clientId },
      include: { _count: { select: { lines: true } } },
      orderBy: { periodEnd: 'desc' },
      take: 50,
    });
    return NextResponse.json({ runs: runs.map(serializeDividendRun) });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/sacco/dividends',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load dividend runs.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessSacco(user)) {
    return forbiddenResponse('SACCO access is restricted to finance and admin users.');
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const label = typeof body.label === 'string' ? body.label.trim() : '';
  const periodStart = typeof body.periodStart === 'string' ? body.periodStart.trim() : '';
  const periodEnd = typeof body.periodEnd === 'string' ? body.periodEnd.trim() : '';
  const ratePercent = typeof body.ratePercent === 'number' ? body.ratePercent : Number(body.ratePercent);

  if (!label || !periodStart || !periodEnd || !Number.isFinite(ratePercent) || ratePercent <= 0) {
    return NextResponse.json(
      { error: 'label, periodStart, periodEnd, and positive ratePercent are required.' },
      { status: 400 },
    );
  }

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const allocations = await buildDividendAllocations(prisma, clientId, ratePercent);
    const totalAmount = allocations.reduce((sum, row) => sum + row.dividendAmount, 0);

    const run = await prisma.saccoDividendRun.create({
      data: {
        organizationId: user.currentOrgId,
        outsourcingClientId: clientId,
        label,
        periodStart: new Date(periodStart),
        periodEnd: new Date(periodEnd),
        ratePercent,
        totalAmount,
        createdByUserId: user.id,
        lines: {
          create: allocations.map((row) => ({
            organizationId: user.currentOrgId,
            memberId: row.memberId,
            sharesBalance: row.sharesBalance,
            dividendAmount: row.dividendAmount,
          })),
        },
      },
      include: { _count: { select: { lines: true } } },
    });

    return NextResponse.json({ run: serializeDividendRun(run) }, { status: 201 });
  } catch (error) {
    await reportApiError({
      route: 'POST /api/sacco/dividends',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to create dividend run.' }, { status: 500 });
  }
}
