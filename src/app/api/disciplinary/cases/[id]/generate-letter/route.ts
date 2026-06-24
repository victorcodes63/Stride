import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { canAccessDisciplinaryRecords } from '@/lib/hr-access';
import { generateShowCauseLetterPdf, generateWarningLetterPdf } from '@/lib/disciplinary-letters';
import { logAuditEvent } from '@/lib/audit-events';
import { getJurisdictionPolicy } from '@/lib/east-africa-hr-policy';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser(request);
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!canAccessDisciplinaryRecords(user)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const body = (await request.json()) as Record<string, unknown>;
  const letterType = typeof body.letterType === 'string' ? body.letterType : '';
  const actionId = typeof body.actionId === 'string' ? body.actionId : null;
  const disciplinaryCase = await prisma.disciplinaryCase.findUnique({
    where: { id },
    include: { employee: true, actions: { orderBy: { actionDate: 'asc' } } },
  });
  if (!disciplinaryCase) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

  const date = new Date().toISOString().slice(0, 10);
  const base = {
    employeeName: `${disciplinaryCase.employee.firstName} ${disciplinaryCase.employee.lastName}`,
    employeeNumber: disciplinaryCase.employee.employeeNumber,
    department: disciplinaryCase.employee.jobTitle,
    subject: disciplinaryCase.subject,
    incidentDescription: disciplinaryCase.description,
    incidentDate: disciplinaryCase.incidentDate.toISOString().slice(0, 10),
    hrManagerName: user.name,
    hrManagerTitle: 'HR Manager',
    date,
  };
  const policy = getJurisdictionPolicy(disciplinaryCase.laborJurisdiction);
  const pdfBuffer =
    letterType === 'SHOW_CAUSE_LETTER'
      ? await generateShowCauseLetterPdf({
          ...base,
          responseDays: policy.defaultShowCauseDays,
          jurisdictionCode: disciplinaryCase.laborJurisdiction,
        })
      : await generateWarningLetterPdf((letterType || 'WRITTEN_WARNING') as 'VERBAL_WARNING' | 'WRITTEN_WARNING' | 'FINAL_WARNING', base);

  const fileName = `${disciplinaryCase.caseNumber}-${letterType || 'LETTER'}-${Date.now()}.pdf`;
  const dir = path.join(process.cwd(), 'public', 'uploads', 'documents');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, fileName), pdfBuffer);
  const filePath = `/uploads/documents/${fileName}`;

  const doc = await prisma.disciplinaryDocument.create({
    data: { caseId: id, title: `${letterType.replaceAll('_', ' ') || 'Warning'} letter`, filePath, fileName, uploadedById: user.id },
  });
  if (actionId) {
    await prisma.disciplinaryAction.update({ where: { id: actionId }, data: { letterGenerated: true } }).catch(() => null);
  }
  await logAuditEvent({ actor: { userId: user.id, email: user.email, name: user.name }, action: 'disciplinary.letter.generated', entityType: 'DisciplinaryCase', entityId: id, route: 'POST /api/disciplinary/cases/[id]/generate-letter', metadata: { letterType, documentId: doc.id } });

  if (letterType === 'SHOW_CAUSE_LETTER') {
    const due = new Date();
    due.setUTCDate(due.getUTCDate() + policy.defaultShowCauseDays);
    await prisma.disciplinaryCase
      .update({
        where: { id },
        data: { showCauseResponseDueAt: due, status: 'AWAITING_RESPONSE' },
      })
      .catch(() => null);
  }

  return NextResponse.json(doc, { status: 201 });
}
