import { NextRequest, NextResponse } from 'next/server';

import { canAccessDisciplinaryRecords } from '@/lib/hr-access';
import { uploadEmployeeDocument } from '@/lib/document-upload';
import { forbiddenResponse } from '@/lib/demo-route-access';
import { withTenant } from '@/lib/tenant-api';

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return withTenant(request, async (ctx) => {
    if (!canAccessDisciplinaryRecords(ctx.staff)) {
      return forbiddenResponse('Disciplinary access required.');
    }

    const grievance = await ctx.run((tx) => tx.grievance.findFirst({ where: ctx.where({ id }) }));
    if (!grievance) return NextResponse.json({ error: 'Grievance not found' }, { status: 404 });

    const form = await request.formData();
    const file = form.get('file');
    const title = typeof form.get('title') === 'string' ? String(form.get('title')).trim() : '';
    if (!(file instanceof File)) return NextResponse.json({ error: 'Missing file' }, { status: 400 });
    if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });

    const uploaded = await uploadEmployeeDocument(file);
    const doc = await ctx.run((tx) =>
      tx.grievanceDocument.create({
        data: {
          organizationId: ctx.organizationId,
          grievanceId: id,
          title,
          filePath: uploaded.path,
          fileName: uploaded.fileName,
          uploadedById: ctx.staff.id,
        },
      }),
    );

    await ctx.audit({
      action: 'grievance.document.upload',
      entityType: 'GrievanceDocument',
      entityId: doc.id,
      route: 'POST /api/grievances/[id]/documents',
      metadata: { grievanceId: id, title },
    });

    return NextResponse.json(doc, { status: 201 });
  });
}
