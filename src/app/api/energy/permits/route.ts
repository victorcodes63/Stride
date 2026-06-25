import { NextRequest, NextResponse } from 'next/server';
import type { EnergyPermitType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { canAccessEnergy, forbiddenResponse } from '@/lib/demo-route-access';
import { reportApiError } from '@/lib/monitoring';
import { derivePermitStatus } from '@/lib/energy/permits';
import { serializePermit } from '@/lib/energy/serialize';

const PERMIT_TYPES = new Set<EnergyPermitType>([
  'environmental',
  'operating',
  'safety',
  'transport',
  'other',
]);

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessEnergy(user)) {
    return forbiddenResponse('Energy access is restricted to operations and admin users.');
  }

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const permits = await prisma.energyPermit.findMany({
      where: { outsourcingClientId: clientId },
      include: { site: true },
      orderBy: { expiresAt: 'asc' },
    });
    return NextResponse.json({ permits: permits.map(serializePermit) });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/energy/permits',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load permits.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessEnergy(user)) {
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
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const status = derivePermitStatus(new Date(expiresAt));
    const permit = await prisma.energyPermit.create({
      data: {
        organizationId: user.currentOrgId,
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
    return NextResponse.json({ permit: serializePermit(permit) }, { status: 201 });
  } catch (error) {
    await reportApiError({
      route: 'POST /api/energy/permits',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to create permit.' }, { status: 500 });
  }
}
