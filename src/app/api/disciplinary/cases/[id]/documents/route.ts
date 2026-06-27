import { NextRequest, NextResponse } from 'next/server';
import { canAccessDisciplinaryRecords } from '@/lib/hr-access';
import { uploadEmployeeDocument } from '@/lib/document-upload';
import { forbiddenResponse } from '@/lib/demo-route-access';
import { withTenant } from '@/lib/tenant-api';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    if (!canAccessDisciplinaryRecords(ctx.staff)) {
      return forbiddenResponse('Disciplinary access required.');
    }

    const { id } = await params;
    const disciplinaryCase = await ctx.run((tx) =>
      tx.disciplinaryCase.findFirst({ where: ctx.where({ id }) }),
    );
    if (!disciplinaryCase) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

    const form = await request.formData();
    const file = form.get('file');
    const title = typeof form.get('title') === 'string' ? String(form.get('title')).trim() : '';
    if (!(file instanceof File)) return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

    const uploaded = await uploadEmployeeDocument(file);
    const doc = await ctx.run((tx) =>
      tx.disciplinaryDocument.create({
        data: {
          organizationId: ctx.organizationId,
          caseId: id,
          title,
          filePath: uploaded.path,
          fileName: uploaded.fileName,
          uploadedById: ctx.staff.id,
        },
      }),
    );

    await ctx.audit({
      action: 'disciplinary.document.upload',
      entityType: 'DisciplinaryDocument',
      entityId: doc.id,
      route: 'POST /api/disciplinary/cases/[id]/documents',
      metadata: { caseId: id, title },
    });

    return NextResponse.json(doc, { status: 201 });
  });
}
