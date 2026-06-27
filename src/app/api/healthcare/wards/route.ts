import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { canAccessHealthcare, forbiddenResponse } from '@/lib/demo-route-access';
import { reportApiError } from '@/lib/monitoring';
import { serializeWard } from '@/lib/healthcare/serialize';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessHealthcare(ctx.staff)) {
      return forbiddenResponse('Healthcare access is restricted to operations and admin users.');
    }

    try {
      const wards = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(
          tx,
          undefined,
          request,
          ctx.organizationId,
        );
        return tx.healthcareWard.findMany({
          where: { ...ctx.where(), outsourcingClientId: clientId },
          orderBy: { code: 'asc' },
        });
      });
      return NextResponse.json({ wards: wards.map(serializeWard) });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/healthcare/wards',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load wards.' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessHealthcare(ctx.staff)) {
      return forbiddenResponse('Healthcare access is restricted to operations and admin users.');
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!code || !name) {
      return NextResponse.json({ error: 'code and name are required.' }, { status: 400 });
    }

    const requiredCredentials = Array.isArray(body.requiredCredentials)
      ? body.requiredCredentials.filter((v) => typeof v === 'string')
      : ['medical_license'];

    const minRestHours =
      typeof body.minRestHours === 'number' ? body.minRestHours : Number(body.minRestHours) || 11;

    try {
      const ward = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(
          tx,
          undefined,
          request,
          ctx.organizationId,
        );
        return tx.healthcareWard.create({
          data: {
            organizationId: ctx.organizationId,
            outsourcingClientId: clientId,
            code,
            name,
            requiredCredentials,
            minRestHours,
          },
        });
      });
      return NextResponse.json({ ward: serializeWard(ward) }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/healthcare/wards',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create ward.' }, { status: 500 });
    }
  });
}
