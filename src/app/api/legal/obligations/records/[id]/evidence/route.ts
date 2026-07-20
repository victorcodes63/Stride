import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';
import { reportApiError } from '@/lib/monitoring';
import { DocumentUploadError } from '@/lib/document-upload';
import { uploadObligationEvidence } from '@/lib/legal/obligation-evidence-upload';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    try {
      const existing = await ctx.run((tx) =>
        tx.legalObligation.findFirst({
          where: { ...ctx.where(), id },
          select: { id: true },
        }),
      );
      if (!existing) {
        return NextResponse.json({ error: 'Compliance obligation not found.' }, { status: 404 });
      }

      let form: FormData;
      try {
        form = await request.formData();
      } catch {
        return NextResponse.json({ error: 'Expected multipart form data.' }, { status: 400 });
      }
      const file = form.get('file');
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'A PDF file is required.' }, { status: 400 });
      }

      let uploaded;
      try {
        uploaded = await uploadObligationEvidence(file);
      } catch (err) {
        if (err instanceof DocumentUploadError) {
          return NextResponse.json({ error: err.message }, { status: err.status });
        }
        throw err;
      }

      const updated = await ctx.run(async (tx) => {
        const row = await tx.legalObligation.update({
          where: { id },
          data: { evidencePath: uploaded.path, evidenceFileName: uploaded.fileName },
          select: { id: true, evidencePath: true, evidenceFileName: true },
        });
        await tx.legalObligationEvent.create({
          data: {
            organizationId: ctx.organizationId,
            obligationId: id,
            actorUserId: ctx.staff.id,
            type: 'evidence_uploaded',
            note: uploaded.fileName,
          },
        });
        return row;
      });

      await ctx.audit({
        action: 'legal_obligation.evidence_uploaded',
        entityType: 'LegalObligation',
        entityId: id,
        route: 'POST /api/legal/obligations/records/[id]/evidence',
        metadata: { fileName: uploaded.fileName },
      });

      return NextResponse.json({
        ok: true,
        evidencePath: updated.evidencePath,
        evidenceFileName: updated.evidenceFileName,
      });
    } catch (error) {
      await reportApiError({
        route: 'POST /api/legal/obligations/records/[id]/evidence',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to upload evidence.' }, { status: 500 });
    }
  });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    try {
      const existing = await ctx.run((tx) =>
        tx.legalObligation.findFirst({
          where: { ...ctx.where(), id },
          select: { id: true, evidencePath: true, evidenceFileName: true },
        }),
      );
      if (!existing) {
        return NextResponse.json({ error: 'Compliance obligation not found.' }, { status: 404 });
      }
      if (!existing.evidencePath && !existing.evidenceFileName) {
        return NextResponse.json({ ok: true, evidencePath: null, evidenceFileName: null });
      }

      await ctx.run(async (tx) => {
        await tx.legalObligation.update({
          where: { id },
          data: { evidencePath: null, evidenceFileName: null },
        });
        await tx.legalObligationEvent.create({
          data: {
            organizationId: ctx.organizationId,
            obligationId: id,
            actorUserId: ctx.staff.id,
            type: 'evidence_removed',
            note: existing.evidenceFileName,
          },
        });
      });

      await ctx.audit({
        action: 'legal_obligation.evidence_removed',
        entityType: 'LegalObligation',
        entityId: id,
        route: 'DELETE /api/legal/obligations/records/[id]/evidence',
      });

      return NextResponse.json({ ok: true, evidencePath: null, evidenceFileName: null });
    } catch (error) {
      await reportApiError({
        route: 'DELETE /api/legal/obligations/records/[id]/evidence',
        message: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json({ error: 'Failed to remove evidence.' }, { status: 500 });
    }
  });
}
