import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireEssUser } from '@/lib/ess-api-auth';
import { logAuditEvent } from '@/lib/audit-events';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const user = await requireEssUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!user.employeeId) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id, docId } = await params;

  const doc = await prisma.disciplinaryDocument.findUnique({ where: { id: docId } });
  if (!doc || doc.caseId !== id) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const c = await prisma.disciplinaryCase.findUnique({ where: { id }, select: { employeeId: true } });
  if (!c || c.employeeId !== user.employeeId) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await logAuditEvent({
    actor: { userId: null, email: user.email, name: user.name },
    action: 'ess.disciplinary.document.download',
    entityType: 'DisciplinaryDocument',
    entityId: docId,
    route: 'GET /api/ess/disciplinary/cases/[id]/documents/[docId]',
    metadata: { caseId: id },
  });

  const target = doc.filePath.startsWith('http') ? doc.filePath : new URL(doc.filePath, request.url).toString();
  return NextResponse.redirect(target);
}
