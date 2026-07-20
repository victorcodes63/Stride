import { NextRequest, NextResponse } from 'next/server';
import {
  canAccessAssets,
  forbiddenResponse,
} from '@/lib/demo-route-access';
import { assetEventInclude, assetEventToResponse } from '@/lib/asset-lifecycle';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  return withTenant(request, async (ctx) => {
    if (!canAccessAssets(ctx.staff)) {
      return forbiddenResponse('Asset manager access is restricted to HR and operations.');
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ events: [] });
    }

    const { id } = await context.params;
    const workspaceClientId = await ctx.run((tx) =>
      resolvePrimaryWorkspaceClientId(tx, null, request, ctx.organizationId),
    );

    const asset = await ctx.run((tx) =>
      tx.companyAsset.findFirst({
        where: {
          id,
          outsourcingClientId: workspaceClientId,
          client: { organizationId: ctx.organizationId },
        },
        select: { id: true },
      }),
    );
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    const events = await ctx.run((tx) =>
      tx.assetAssignmentEvent.findMany({
        where: {
          companyAssetId: id,
          organizationId: ctx.organizationId,
        },
        include: assetEventInclude,
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    );

    return NextResponse.json({ events: events.map(assetEventToResponse) });
  });
}
