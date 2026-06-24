import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { canWriteRota } from '@/lib/rota/api-auth';
import { RotaPeriodStatus } from '@prisma/client';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const requestedClientId = request.nextUrl.searchParams.get('outsourcingClientId')?.trim();
  const clientId = await resolvePrimaryWorkspaceClientId(prisma, requestedClientId, request);
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const list = await prisma.rotaPeriod.findMany({
    where: { outsourcingClientId: clientId },
    orderBy: { startDate: 'desc' },
    take: 100,
  });
  return NextResponse.json(list);
}

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canWriteRota(user)) {
    return NextResponse.json({ error: 'Viewers cannot create rota data' }, { status: 403 });
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const requestedClientId = String(body.outsourcingClientId || '').trim();
  const outsourcingClientId = await resolvePrimaryWorkspaceClientId(prisma, requestedClientId, request);
  const name = body.name != null ? String(body.name).trim() || null : null;
  const startDate = new Date(String(body.startDate || ''));
  const endDate = new Date(String(body.endDate || ''));
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return NextResponse.json(
      { error: 'startDate and endDate are required (dates as YYYY-MM-DD or ISO strings)' },
      { status: 400 },
    );
  }
  if (endDate < startDate) {
    return NextResponse.json({ error: 'endDate must be on or after startDate' }, { status: 400 });
  }

  let status: RotaPeriodStatus = RotaPeriodStatus.draft;
  if (body.status === 'published' || body.status === 'draft') {
    status = body.status === 'published' ? RotaPeriodStatus.published : RotaPeriodStatus.draft;
  }

  const client = await prisma.outsourcingClient.findUnique({ where: { id: outsourcingClientId } });
  if (!client) return NextResponse.json({ error: 'Primary workspace not found' }, { status: 404 });

  const p = await prisma.rotaPeriod.create({
    data: {
      outsourcingClientId,
      name,
      startDate,
      endDate,
      status,
    },
  });
  return NextResponse.json(p, { status: 201 });
}
