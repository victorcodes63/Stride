import { NextRequest, NextResponse } from 'next/server';
import type { EnergyPermitType } from '@prisma/client';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { canAccessEnergy, forbiddenResponse } from '@/lib/demo-route-access';
import { reportApiError } from '@/lib/monitoring';
import { derivePermitStatus } from '@/lib/energy/permits';
import { serializePermit } from '@/lib/energy/serialize';
import { withTenant } from '@/lib/tenant-api';

const PERMIT_TYPES = new Set<EnergyPermitType>([
  'environmental',
  'operating',
  'safety',
  'transport',
  'other',
]);

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessEnergy(ctx.staff)) {
      return forbiddenResponse('Energy access is restricted to operations and admin users.');
    }

    try {
      const permits = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(
          tx,
          undefined,
          request,
          ctx.organizationId,
        );
        return tx.energyPermit.findMany({
          where: { ...ctx.where(), outsourcingClientId: clientId },
          include: { site: true },
          orderBy: { expiresAt: 'asc' },
        });
      });
      return NextResponse.json({ permits: permits.map(serializePermit) });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/energy/permits',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load permits.' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessEnergy(ctx.staff)) {
      return forbiddenResponse('Energy access is restricted to operations and admin users.');
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const siteId = typeof body.siteId === 'string' ? body.siteId : '';
    const permitNumber = typeof body.permitNumber === 'string' ? body.permitNumber.trim() : '';
    const issuingAuthority =
      typeof body.issuingAuthority === 'string' ? body.issuingAuthority.trim() : '';
    const issuedAt = typeof body.issuedAt === 'string' ? body.issuedAt : '';
    const expiresAt = typeof body.expiresAt === 'string' ? body.expiresAt : '';

    if (!siteId || !permitNumber || !issuingAuthority || !issuedAt || !expiresAt) {
      return NextResponse.json({ error: 'siteId, permitNumber, issuingAuthority, issuedAt, and expiresAt are required.' }, { status: 400 });
    }

    const permitType =
      typeof body.permitType === 'string' && PERMIT_TYPES.has(body.permitType as EnergyPermitType)
        ? (body.permitType as EnergyPermitType)
        : 'operating';

    try {
      const permit = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(
          tx,
          undefined,
          request,
          ctx.organizationId,
        );
        const status = derivePermitStatus(new Date(expiresAt));
        return tx.energyPermit.create({
          data: {
            organizationId: ctx.organizationId,
            outsourcingClientId: clientId,
            siteId,
            permitNumber,
            permitType,
            issuingAuthority,
            issuedAt: new Date(issuedAt),
            expiresAt: new Date(expiresAt),
            status,
            notes: typeof body.notes === 'string' ? body.notes : null,
          },
          include: { site: true },
        });
      });
      return NextResponse.json({ permit: serializePermit(permit) }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/energy/permits',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create permit.' }, { status: 500 });
    }
  });
}
