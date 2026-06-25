import { NextRequest, NextResponse } from 'next/server';
import type { ConstructionPlantStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { canAccessConstruction, forbiddenResponse } from '@/lib/demo-route-access';
import { reportApiError } from '@/lib/monitoring';
import { serializePlant } from '@/lib/construction/serialize';

const PLANT_STATUSES = new Set<ConstructionPlantStatus>([
  'on_site',
  'off_hire',
  'maintenance',
  'retired',
]);

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessConstruction(user)) {
    return forbiddenResponse('Construction access is restricted to operations and admin users.');
  }

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const plant = await prisma.constructionPlantAsset.findMany({
      where: { outsourcingClientId: clientId },
      include: { site: true },
      orderBy: { assetTag: 'asc' },
    });
    return NextResponse.json({ plant: plant.map(serializePlant) });
  } catch (error) {
    await reportApiError({
      route: 'GET /api/construction/plant',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to load plant assets.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessConstruction(user)) {
    return forbiddenResponse('Construction access is restricted to operations and admin users.');
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const siteId = typeof body.siteId === 'string' ? body.siteId : '';
  const assetTag = typeof body.assetTag === 'string' ? body.assetTag.trim().toUpperCase() : '';
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!siteId || !assetTag || !name) {
    return NextResponse.json({ error: 'siteId, assetTag, and name are required.' }, { status: 400 });
  }

  const status =
    typeof body.status === 'string' && PLANT_STATUSES.has(body.status as ConstructionPlantStatus)
      ? (body.status as ConstructionPlantStatus)
      : 'on_site';

  try {
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, undefined, request);
    const row = await prisma.constructionPlantAsset.create({
      data: {
        organizationId: user.currentOrgId,
        outsourcingClientId: clientId,
        siteId,
        assetTag,
        name,
        category: typeof body.category === 'string' ? body.category.trim() : null,
        status,
        dailyHireRate:
          typeof body.dailyHireRate === 'number'
            ? body.dailyHireRate
            : body.dailyHireRate
              ? Number(body.dailyHireRate)
              : null,
        onSiteSince:
          typeof body.onSiteSince === 'string' ? new Date(body.onSiteSince) : new Date(),
        companyAssetId: typeof body.companyAssetId === 'string' ? body.companyAssetId : null,
      },
      include: { site: true },
    });
    return NextResponse.json({ plant: serializePlant(row) }, { status: 201 });
  } catch (error) {
    await reportApiError({
      route: 'POST /api/construction/plant',
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: 'Failed to create plant asset.' }, { status: 500 });
  }
}
