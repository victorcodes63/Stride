import { NextRequest, NextResponse } from 'next/server';
import type { ConstructionSiteStatus } from '@prisma/client';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { canAccessConstruction, forbiddenResponse } from '@/lib/demo-route-access';
import { reportApiError } from '@/lib/monitoring';
import { serializeSite } from '@/lib/construction/serialize';
import { withTenant } from '@/lib/tenant-api';

const SITE_STATUSES = new Set<ConstructionSiteStatus>([
  'planning',
  'active',
  'suspended',
  'completed',
]);

export async function GET(request: NextRequest) {
  return withTenant(request, async (ctx) => {
    if (!canAccessConstruction(ctx.staff)) {
      return forbiddenResponse('Construction access is restricted to operations and admin users.');
    }

    try {
      const sites = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(
          tx,
          undefined,
          request,
          ctx.organizationId,
        );
        return tx.constructionSite.findMany({
          where: { ...ctx.where(), outsourcingClientId: clientId },
          include: {
            parentSite: { select: { code: true, name: true } },
            childSites: { select: { id: true, code: true, name: true } },
            project: { select: { projectCode: true, name: true } },
          },
          orderBy: { code: 'asc' },
        });
      });
      return NextResponse.json({ sites: sites.map(serializeSite) });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/construction/sites',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load sites.' }, { status: 500 });
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

    const code = typeof body.code === 'string' ? body.code.trim().toUpperCase() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!code || !name) {
      return NextResponse.json({ error: 'code and name are required.' }, { status: 400 });
    }

    const status =
      typeof body.status === 'string' && SITE_STATUSES.has(body.status as ConstructionSiteStatus)
        ? (body.status as ConstructionSiteStatus)
        : 'planning';

    try {
      const site = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(
          tx,
          undefined,
          request,
          ctx.organizationId,
        );
        return tx.constructionSite.create({
          data: {
            organizationId: ctx.organizationId,
            outsourcingClientId: clientId,
            code,
            name,
            status,
            location: typeof body.location === 'string' ? body.location.trim() : null,
            parentSiteId: typeof body.parentSiteId === 'string' ? body.parentSiteId : null,
            projectId: typeof body.projectId === 'string' ? body.projectId : null,
          },
          include: {
            parentSite: { select: { code: true, name: true } },
            childSites: { select: { id: true, code: true, name: true } },
            project: { select: { projectCode: true, name: true } },
          },
        });
      });
      return NextResponse.json({ site: serializeSite(site) }, { status: 201 });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/construction/sites',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to create site.' }, { status: 500 });
    }
  });
}
