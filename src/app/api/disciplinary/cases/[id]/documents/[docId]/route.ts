import { NextRequest, NextResponse } from 'next/server';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { canAccessDisciplinaryRecords } from '@/lib/hr-access';
import { prisma } from '@/lib/prisma';
import { logAuditEvent } from '@/lib/audit-events';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessDisciplinaryRecords(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id, docId } = await params;
  const doc = await prisma.disciplinaryDocument.findUnique({ where: { id: docId } });
  if (!doc || doc.caseId !== id) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  await logAuditEvent({ actor: { userId: user.id, email: user.email, name: user.name }, action: 'disciplinary.document.download', entityType: 'DisciplinaryDocument', entityId: docId, route: 'GET /api/disciplinary/cases/[id]/documents/[docId]', metadata: { caseId: id } });
  return NextResponse.redirect(new URL(doc.filePath, request.url));
}
