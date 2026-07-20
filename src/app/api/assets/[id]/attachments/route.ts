import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { canAccessAssets, forbiddenResponse } from '@/lib/demo-route-access';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { withTenant } from '@/lib/tenant-api';
import {
  AssetAttachmentUploadError,
  uploadAssetAttachment,
} from '@/lib/asset-attachment-upload';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

const ATTACHMENT_KINDS = new Set(['photo', 'invoice', 'warranty', 'handover', 'other']);

function parseKind(value: unknown): string | undefined {
  return typeof value === 'string' && ATTACHMENT_KINDS.has(value) ? value : undefined;
}

async function loadAssetScope(
  tx: Prisma.TransactionClient,
  id: string,
  workspaceClientId: string,
  organizationId: string,
) {
  return tx.companyAsset.findFirst({
    where: {
      id,
      outsourcingClientId: workspaceClientId,
      client: { organizationId },
    },
    select: { id: true },
  });
}

function attachmentToResponse(record: {
  id: string;
  companyAssetId: string;
  fileName: string;
  fileUrl: string;
  contentType: string | null;
  fileSize: number | null;
  kind: string | null;
  createdAt: Date;
}) {
  return {
    id: record.id,
    companyAssetId: record.companyAssetId,
    fileName: record.fileName,
    fileUrl: record.fileUrl,
    contentType: record.contentType,
    fileSize: record.fileSize,
    kind: record.kind,
    createdAt: record.createdAt.toISOString(),
  };
}

export async function GET(request: NextRequest, context: RouteContext) {
  return withTenant(request, async (ctx) => {
    if (!canAccessAssets(ctx.staff)) {
      return forbiddenResponse('Asset manager access is restricted to HR and operations.');
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ items: [] });
    }

    const { id } = await context.params;
    const workspaceClientId = await ctx.run((tx) =>
      resolvePrimaryWorkspaceClientId(tx, null, request, ctx.organizationId),
    );
    const asset = await ctx.run((tx) =>
      loadAssetScope(tx, id, workspaceClientId, ctx.organizationId),
    );
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    const records = await ctx.run((tx) =>
      tx.assetAttachment.findMany({
        where: { companyAssetId: id, organizationId: ctx.organizationId },
        orderBy: { createdAt: 'desc' },
        take: 200,
      }),
    );

    return NextResponse.json({ items: records.map(attachmentToResponse) });
  });
}

export async function POST(request: NextRequest, context: RouteContext) {
  return withTenant(request, async (ctx) => {
    if (!canAccessAssets(ctx.staff)) {
      return forbiddenResponse('Asset manager access is restricted to HR and operations.');
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const { id } = await context.params;
    const workspaceClientId = await ctx.run((tx) =>
      resolvePrimaryWorkspaceClientId(tx, null, request, ctx.organizationId),
    );
    const asset = await ctx.run((tx) =>
      loadAssetScope(tx, id, workspaceClientId, ctx.organizationId),
    );
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });
    }

    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }
    const kind = parseKind(formData.get('kind'));

    let uploaded;
    try {
      uploaded = await uploadAssetAttachment(file);
    } catch (error) {
      if (error instanceof AssetAttachmentUploadError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      throw error;
    }

    const created = await ctx.run((tx) =>
      tx.assetAttachment.create({
        data: {
          organizationId: ctx.organizationId,
          companyAssetId: id,
          fileName: uploaded.fileName,
          fileUrl: uploaded.url,
          contentType: uploaded.mimeType,
          fileSize: uploaded.fileSize,
          kind,
          uploadedByUserId: ctx.staff.id,
        },
      }),
    );

    await ctx.audit({
      action: 'asset.attachment.created',
      entityType: 'AssetAttachment',
      entityId: created.id,
      route: 'POST /api/assets/[id]/attachments',
      metadata: { companyAssetId: id, kind: kind ?? null },
    });

    return NextResponse.json(attachmentToResponse(created), { status: 201 });
  });
}
