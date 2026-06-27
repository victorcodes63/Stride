import { NextRequest, NextResponse } from 'next/server';
import type { ConstructionPlantStatus } from '@prisma/client';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { canAccessConstruction, forbiddenResponse } from '@/lib/demo-route-access';
import { reportApiError } from '@/lib/monitoring';
import { serializePlant } from '@/lib/construction/serialize';
import { withTenant } from '@/lib/tenant-api';

const PLANT_STATUSES = new Set<ConstructionPlantStatus>([
  'on_site',
  'off_hire',
  'maintenance',
  'retired',
]);

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessConstruction(ctx.staff)) {
      return forbiddenResponse('Construction access is restricted to operations and admin users.');
    }

    try {
      const plant = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(
          tx,
          undefined,
          request,
          ctx.organizationId,
        );
        return tx.constructionPlantAsset.findMany({
          where: { ...ctx.where(), outsourcingClientId: clientId },
          include: { site: true },
          orderBy: { assetTag: 'asc' },
        });
      });
      return NextResponse.json({ plant: plant.map(serializePlant) });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/construction/plant',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load plant assets.' }, { status: 500 });
    }
  });
}

export async function POST(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessConstruction(ctx.staff)) {
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
      const row = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(
          tx,
          undefined,
          request,
          ctx.organizationId,
        );
        return tx.constructionPlantAsset.create({
          data: {
            organizationId: ctx.organizationId,
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
      });
      return NextResponse.json({ plant: serializePlant(row) }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/construction/plant',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create plant asset.' }, { status: 500 });
    }
  });
}
