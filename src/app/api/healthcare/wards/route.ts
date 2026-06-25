import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { canAccessHealthcare, forbiddenResponse } from '@/lib/demo-route-access';
import { reportApiError } from '@/lib/monitoring';
import { serializeWard } from '@/lib/healthcare/serialize';

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessHealthcare(user)) {
    return forbiddenResponse('Healthcare access is restricted to operations and admin users.');
  }

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const wards = await prisma.healthcareWard.findMany({
      where: { outsourcingClientId: clientId },
      orderBy: { code: 'asc' },
    });
    return NextResponse.json({ wards: wards.map(serializeWard) });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/healthcare/wards',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load wards.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessHealthcare(user)) {
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
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const ward = await prisma.healthcareWard.create({
      data: {
        organizationId: user.currentOrgId,
        outsourcingClientId: clientId,
        code,
        name,
        requiredCredentials,
        minRestHours,
      },
    });
    return NextResponse.json({ ward: serializeWard(ward) }, { status: 201 });
  } catch (error) {
    await reportApiError({
      route: 'POST /api/healthcare/wards',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to create ward.' }, { status: 500 });
  }
}
