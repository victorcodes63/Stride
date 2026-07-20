import { NextRequest, NextResponse } from 'next/server';
import { canAccessAssets, forbiddenResponse } from '@/lib/demo-route-access';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string; attachmentId: string }> };

export async function DELETE(request: NextRequest, context: RouteContext) {
  return withTenant(request, async (ctx) => {
    if (!canAccessAssets(ctx.staff)) {
      return forbiddenResponse('Asset manager access is restricted to HR and operations.');
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const { id, attachmentId } = await context.params;
    const workspaceClientId = await ctx.run((tx) =>
      resolvePrimaryWorkspaceClientId(tx, null, request, ctx.organizationId),
    );

    const scope = await ctx.run(async (tx) => {
      const asset = await tx.companyAsset.findFirst({
        where: {
          id,
          outsourcingClientId: workspaceClientId,
          client: { organizationId: ctx.organizationId },
        },
        select: { id: true },
      });
      if (!asset) return { asset: null, attachment: null };
      const attachment = await tx.assetAttachment.findFirst({
        where: { id: attachmentId, companyAssetId: id, organizationId: ctx.organizationId },
        select: { id: true },
      });
      return { asset, attachment };
    });

    if (!scope.asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    if (!scope.attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 });
    }

    await ctx.run((tx) => tx.assetAttachment.delete({ where: { id: attachmentId } }));

    await ctx.audit({
      action: 'asset.attachment.deleted',
      entityType: 'AssetAttachment',
      entityId: attachmentId,
      route: 'DELETE /api/assets/[id]/attachments/[attachmentId]',
      metadata: { companyAssetId: id },
    });

    return NextResponse.json({ success: true });
  });
}
