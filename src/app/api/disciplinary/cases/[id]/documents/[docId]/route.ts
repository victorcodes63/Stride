import { NextRequest, NextResponse } from 'next/server';
import { canAccessDisciplinaryRecords } from '@/lib/hr-access';
import { forbiddenResponse } from '@/lib/demo-route-access';
import { withTenant } from '@/lib/tenant-api';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  return withTenant(request, async (ctx) => {
    if (!canAccessDisciplinaryRecords(ctx.staff)) {
      return forbiddenResponse('Disciplinary access required.');
    }

    const { id, docId } = await params;
    const doc = await ctx.run((tx) =>
      tx.disciplinaryDocument.findFirst({
        where: ctx.where({ id: docId, caseId: id }),
      }),
    );
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await ctx.audit({
      action: 'disciplinary.document.download',
      entityType: 'DisciplinaryDocument',
      entityId: docId,
      route: 'GET /api/disciplinary/cases/[id]/documents/[docId]',
      metadata: { caseId: id },
    });

    return NextResponse.redirect(new URL(doc.filePath, request.url));
  });
}
