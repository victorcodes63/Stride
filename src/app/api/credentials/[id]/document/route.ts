import { NextRequest, NextResponse } from 'next/server';
import { canAccessCredentials, forbiddenResponse } from '@/lib/demo-route-access';
import { DocumentUploadError, uploadEmployeeDocument } from '@/lib/document-upload';
import { withTenant } from '@/lib/tenant-api';
import { credentialInclude, toResponse } from '../../_shared';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    if (!canAccessCredentials(ctx.staff)) {
      return forbiddenResponse('Credentials access is restricted to HR and admins.');
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const { id } = await params;
    const credential = await ctx.run((tx) =>
      tx.employeeCredential.findFirst({ where: ctx.where({ id }), select: { id: true } }),
    );
    if (!credential) return NextResponse.json({ error: 'Credential not found' }, { status: 404 });

    let file: FormDataEntryValue | null;
    try {
      const form = await request.formData();
      file = form.get('file');
    } catch {
      return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing file (field: file)' }, { status: 400 });
    }

    try {
      const uploaded = await uploadEmployeeDocument(file);
      const updated = await ctx.run((tx) =>
        tx.employeeCredential.update({
          where: { id },
          data: { documentPath: uploaded.path },
          include: credentialInclude,
        }),
      );
      await ctx.audit({
        action: 'credential.document.upload',
        entityType: 'EmployeeCredential',
        entityId: id,
        route: 'POST /api/credentials/[id]/document',
        metadata: { fileName: uploaded.fileName, fileSize: uploaded.fileSize },
      });
      return NextResponse.json(toResponse(updated), { status: 201 });
    } catch (error) {
      if (error instanceof DocumentUploadError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }
      const err = error as { code?: string };
      if (err.code === 'P2025') return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
      console.error('[credential document POST]', error);
      return NextResponse.json({ error: 'Failed to upload document' }, { status: 500 });
    }
  });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    if (!canAccessCredentials(ctx.staff)) {
      return forbiddenResponse('Credentials access is restricted to HR and admins.');
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const { id } = await params;
    const credential = await ctx.run((tx) =>
      tx.employeeCredential.findFirst({ where: ctx.where({ id }), select: { id: true } }),
    );
    if (!credential) return NextResponse.json({ error: 'Credential not found' }, { status: 404 });

    const updated = await ctx.run((tx) =>
      tx.employeeCredential.update({
        where: { id },
        data: { documentPath: null },
        include: credentialInclude,
      }),
    );
    await ctx.audit({
      action: 'credential.document.remove',
      entityType: 'EmployeeCredential',
      entityId: id,
      route: 'DELETE /api/credentials/[id]/document',
      metadata: { employeeId: updated.employeeId },
    });
    return NextResponse.json(toResponse(updated));
  });
}
