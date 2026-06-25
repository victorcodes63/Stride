import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { canAccessEnergy, forbiddenResponse } from '@/lib/demo-route-access';
import { reportApiError } from '@/lib/monitoring';
import { serializeSite } from '@/lib/energy/serialize';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessEnergy(user)) {
    return forbiddenResponse('Energy access is restricted to operations and admin users.');
  }

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const sites = await prisma.energySite.findMany({
      where: { outsourcingClientId: clientId },
      orderBy: { code: 'asc' },
    });
    return NextResponse.json({ sites: sites.map(serializeSite) });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/energy/sites',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load sites.' }, { status: 500 });
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

  const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!code || !name) {
    return NextResponse.json({ error: 'code and name are required.' }, { status: 400 });
  }

  const region = typeof body.region === 'string' ? body.region.trim() : null;
  const operatingEntityLabel =
    typeof body.operatingEntityLabel === 'string' ? body.operatingEntityLabel.trim() : null;

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const site = await prisma.energySite.create({
      data: {
        organizationId: user.currentOrgId,
        outsourcingClientId: clientId,
        code,
        name,
        region,
        operatingEntityLabel,
      },
    });
    return NextResponse.json({ site: serializeSite(site) }, { status: 201 });
  } catch (error) {
    await reportApiError({
      route: 'POST /api/energy/sites',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to create site.' }, { status: 500 });
  }
}
