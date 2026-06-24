import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { canAccessDisciplinaryRecords } from '@/lib/hr-access';
import { logAuditEvent } from '@/lib/audit-events';
import { uploadEmployeeDocument } from '@/lib/document-upload';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessDisciplinaryRecords(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const disciplinaryCase = await prisma.disciplinaryCase.findUnique({ where: { id } });
  if (!disciplinaryCase) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
  const form = await request.formData();
  const file = form.get('file');
  const title = typeof form.get('title') === 'string' ? String(form.get('title')).trim() : '';
  if (!(file instanceof File)) return NextResponse.json({ error: 'Missing file' }, { status: 400 });
  if (!title) return NextResponse.json({ error: 'Title is required' }, { status: 400 });
  const uploaded = await uploadEmployeeDocument(file);
  const doc = await prisma.disciplinaryDocument.create({
    data: { caseId: id, title, filePath: uploaded.path, fileName: uploaded.fileName, uploadedById: user.id },
  });
  await logAuditEvent({ actor: { userId: user.id, email: user.email, name: user.name }, action: 'disciplinary.document.upload', entityType: 'DisciplinaryDocument', entityId: doc.id, route: 'POST /api/disciplinary/cases/[id]/documents', metadata: { caseId: id, title } });
  return NextResponse.json(doc, { status: 201 });
}
