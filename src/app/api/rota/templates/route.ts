import { NextRequest, NextResponse } from 'next/server';
import { canWriteRota } from '@/lib/rota/api-auth';
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
      return tx.shiftTemplate.findMany({
        where: ctx.where({ outsourcingClientId: clientId }),
        orderBy: { name: 'asc' },
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
    const name = String(body.name || '').trim();
    const startMinutes = parseInt(String(body.startMinutes), 10);
    const endMinutes = parseInt(String(body.endMinutes), 10);
    if (!name || !Number.isFinite(startMinutes) || !Number.isFinite(endMinutes)) {
      return NextResponse.json(
        { error: 'name, startMinutes, and endMinutes are required' },
        { status: 400 },
      );
    }
    if (startMinutes < 0 || startMinutes > 1440 || endMinutes < 0 || endMinutes > 1440) {
      return NextResponse.json(
        { error: 'startMinutes and endMinutes must be between 0 and 1440' },
        { status: 400 },
      );
    }
    const breakMinutes =
      body.breakMinutes != null ? Math.max(0, parseInt(String(body.breakMinutes), 10) || 0) : 0;
    const color = body.color != null ? String(body.color).trim() : null;
    const isActive = body.isActive === false ? false : true;

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

      return tx.shiftTemplate.create({
        data: {
          organizationId: ctx.organizationId,
          outsourcingClientId,
          name,
          startMinutes,
          endMinutes,
          breakMinutes,
          color: color || null,
          isActive,
        },
      });
    });

    if (!result) return NextResponse.json({ error: 'Primary workspace not found' }, { status: 404 });
    return NextResponse.json(result, { status: 201 });
  });
}
