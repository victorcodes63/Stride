import { NextRequest, NextResponse } from 'next/server';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { reportApiError } from '@/lib/monitoring';
import { serializeAttachment } from '@/lib/hse/serialize';
import { uploadIncidentEvidence, IncidentUploadError } from '@/lib/hse/incident-upload';
import { withTenant } from '@/lib/tenant-api';

export const dynamic = 'force-dynamic';

const ATTACHMENT_KINDS = new Set(['evidence', 'photo', 'report', 'other']);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ attachments: [] });
  }

  return withTenant(request, async (ctx) => {
    const { id } = await params;

    try {
      const attachments = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const incident = await tx.hseIncident.findFirst({
          where: { ...ctx.where(), id, outsourcingClientId: clientId },
          select: { id: true },
        });
        if (!incident) return null;

        return tx.hseAttachment.findMany({
          where: { ...ctx.where(), incidentId: id },
          orderBy: { createdAt: 'desc' },
        });
      });
      if (attachments === null) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      return NextResponse.json({ attachments: attachments.map(serializeAttachment) });
    } catch (error) {
      await reportApiError({
        route: 'GET /api/hse/incidents/[id]/attachments',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to load attachments.' }, { status: 500 });
    }
  });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  return withTenant(request, async (ctx) => {
    const { id } = await params;

    let form: FormData;
    try {
      form = await request.formData();
    } catch {
      return NextResponse.json({ error: 'Expected multipart form data.' }, { status: 400 });
    }

    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Evidence file is required.' }, { status: 400 });
    }
    const kindRaw = form.get('kind');
    const kind = typeof kindRaw === 'string' && ATTACHMENT_KINDS.has(kindRaw) ? kindRaw : 'evidence';

    try {
      const uploaded = await uploadIncidentEvidence(file);

      const created = await ctx.run(async (tx) => {
        const clientId = await resolvePrimaryWorkspaceClientId(tx, undefined, request, ctx.organizationId);
        const incident = await tx.hseIncident.findFirst({
          where: { ...ctx.where(), id, outsourcingClientId: clientId },
          select: { id: true },
        });
        if (!incident) return null;

        return tx.hseAttachment.create({
          data: {
            organizationId: ctx.organizationId,
            incidentId: id,
            fileName: uploaded.fileName,
            fileUrl: uploaded.url,
            contentType: uploaded.contentType,
            fileSize: uploaded.fileSize,
            kind,
            uploadedByUserId: ctx.staff.id,
          },
        });
      });
      if (!created) return NextResponse.json({ error: 'Incident not found.' }, { status: 404 });

      return NextResponse.json({ attachment: serializeAttachment(created) }, { status: 201 });
    } catch (error) {
      if (error instanceof IncidentUploadError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      await reportApiError({
        route: 'POST /api/hse/incidents/[id]/attachments',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to upload evidence.' }, { status: 500 });
    }
  });
}
