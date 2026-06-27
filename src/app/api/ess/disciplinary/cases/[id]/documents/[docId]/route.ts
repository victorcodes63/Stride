import { NextRequest, NextResponse } from 'next/server';
import { withEssTenant } from '@/lib/ess-tenant-api';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  return withEssTenant(request, async (ctx) => {
    if (!ctx.essUser.employeeId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    const { id, docId } = await params;

    const doc = await ctx.run(async (tx) => {
      const c = await tx.disciplinaryCase.findFirst({
        where: ctx.where({ id, employeeId: ctx.essUser.employeeId! }),
        select: { id: true },
      });
      if (!c) return null;

      return tx.disciplinaryDocument.findFirst({
        where: ctx.where({ id: docId, caseId: id }),
      });
    });
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await ctx.audit({
      action: 'ess.disciplinary.document.download',
      entityType: 'DisciplinaryDocument',
      entityId: docId,
      route: 'GET /api/ess/disciplinary/cases/[id]/documents/[docId]',
      metadata: { caseId: id },
    });

    const target = doc.filePath.startsWith('http') ? doc.filePath : new URL(doc.filePath, request.url).toString();
    return NextResponse.redirect(target);
  });
}
