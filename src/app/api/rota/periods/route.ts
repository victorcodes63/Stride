import { NextRequest, NextResponse } from 'next/server';
import { canWriteRota } from '@/lib/rota/api-auth';
import { RotaPeriodStatus } from '@prisma/client';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    const requestedClientId = request.nextUrl.searchParams.get('outsourcingClientId')?.trim();
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const list = await ctx.run(async (tx) => {
      const clientId = await resolvePrimaryWorkspaceClientId(
        tx,
        requestedClientId,
        request,
        ctx.organizationId,
      );
      return tx.rotaPeriod.findMany({
        where: ctx.where({ outsourcingClientId: clientId }),
        orderBy: { startDate: 'desc' },
        take: 100,
      });
    });
    return NextResponse.json(list);
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canWriteRota(ctx.staff)) {
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

    const result = await ctx.run(async (tx) => {
      const outsourcingClientId = await resolvePrimaryWorkspaceClientId(
        tx,
        requestedClientId,
        request,
        ctx.organizationId,
      );
      const client = await tx.outsourcingClient.findFirst({
        where: ctx.where({ id: outsourcingClientId }),
      });
      if (!client) return null;

      return tx.rotaPeriod.create({
        data: {
          organizationId: ctx.organizationId,
          outsourcingClientId,
          name,
          startDate,
          endDate,
          status,
        },
      });
    });

    if (!result) return NextResponse.json({ error: 'Primary workspace not found' }, { status: 404 });
    return NextResponse.json(result, { status: 201 });
  });
}
