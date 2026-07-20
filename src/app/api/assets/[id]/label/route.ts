import { NextRequest, NextResponse } from 'next/server';
import { canAccessAssets, forbiddenResponse } from '@/lib/demo-route-access';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { withTenant } from '@/lib/tenant-api';
import { generateAssetQrToken } from '@/lib/assets-api';
import { assetCategoryLabel } from '@/lib/asset-categories';

export const dynamic = 'force-dynamic';

type RouteContext = { params: Promise<{ id: string }> };

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Printable asset label containing the asset tag, name, and a QR code encoding
 * the stable qrToken. Rendered as a self-contained, auto-printing HTML document.
 */
export async function GET(request: NextRequest, context: RouteContext) {
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
      tx.companyAsset.findFirst({
        where: {
          id,
          outsourcingClientId: workspaceClientId,
          client: { organizationId: ctx.organizationId },
        },
        select: {
          id: true,
          assetTag: true,
          name: true,
          category: true,
          serialNumber: true,
          qrToken: true,
        },
      }),
    );
    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    let qrToken = asset.qrToken;
    if (!qrToken) {
      qrToken = generateAssetQrToken();
      await ctx.run((tx) => tx.companyAsset.update({ where: { id }, data: { qrToken } }));
    }

    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&data=${encodeURIComponent(
      qrToken,
    )}`;

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Asset label — ${escapeHtml(asset.assetTag)}</title>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif; color: #0f172a; background: #f1f5f9; padding: 24px; }
  .label { width: 320px; margin: 0 auto; background: #fff; border: 1px solid #cbd5e1; border-radius: 12px; padding: 20px; box-shadow: 0 6px 24px rgba(15,23,42,0.08); }
  .row { display: flex; gap: 16px; align-items: center; }
  .qr { width: 120px; height: 120px; flex-shrink: 0; border: 1px solid #e2e8f0; border-radius: 8px; }
  .tag { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 20px; font-weight: 700; letter-spacing: 0.02em; }
  .name { font-size: 14px; font-weight: 600; margin-top: 2px; }
  .muted { font-size: 12px; color: #64748b; margin-top: 2px; }
  .token { margin-top: 14px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 11px; color: #475569; text-align: center; word-break: break-all; border-top: 1px dashed #e2e8f0; padding-top: 10px; }
  .actions { text-align: center; margin-top: 20px; }
  button { font: inherit; padding: 8px 16px; border-radius: 8px; border: 1px solid #cbd5e1; background: #0f172a; color: #fff; cursor: pointer; }
  @media print { body { background: #fff; padding: 0; } .label { border: none; box-shadow: none; } .actions { display: none; } }
</style>
</head>
<body>
  <div class="label">
    <div class="row">
      <img class="qr" src="${qrSrc}" alt="QR code" />
      <div>
        <div class="tag">${escapeHtml(asset.assetTag)}</div>
        <div class="name">${escapeHtml(asset.name)}</div>
        <div class="muted">${escapeHtml(assetCategoryLabel(asset.category))}</div>
        ${asset.serialNumber ? `<div class="muted">S/N ${escapeHtml(asset.serialNumber)}</div>` : ''}
      </div>
    </div>
    <div class="token">${escapeHtml(qrToken)}</div>
  </div>
  <div class="actions"><button onclick="window.print()">Print label</button></div>
  <script>window.addEventListener('load', function () { setTimeout(function () { window.print(); }, 300); });</script>
</body>
</html>`;

    return new NextResponse(html, {
      status: 200,
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  });
}
