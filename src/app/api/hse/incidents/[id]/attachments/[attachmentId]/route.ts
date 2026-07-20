import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attachmentId: string }> },
) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  return withTenant(request, async (ctx) => {
    const { id, attachmentId } = await params;

    try {
      const deleted = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const incident = await tx.hseIncident.findFirst({
          where: { ...ctx.where(), id, outsourcingClientId: clientId },
          select: { id: true },
        });
        if (!incident) return null;

        const attachment = await tx.hseAttachment.findFirst({
          where: { ...ctx.where(), id: attachmentId, incidentId: id },
          select: { id: true },
        });
        if (!attachment) return null;

        await tx.hseAttachment.delete({ where: { id: attachmentId } });
        return attachment;
      });
      if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      return NextResponse.json({ ok: true });
    } catch (error) {
      await reportApiError({
        route: 'DELETE /api/hse/incidents/[id]/attachments/[attachmentId]',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to delete attachment.' }, { status: 500 });
    }
  });
}
