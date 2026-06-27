import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { canAccessDisciplinaryRecords } from '@/lib/hr-access';
import { generateOutcomeLetterPdf, generateShowCauseLetterPdf, generateWarningLetterPdf } from '@/lib/disciplinary-letters';
import { getJurisdictionPolicy } from '@/lib/east-africa-hr-policy';
import { forbiddenResponse } from '@/lib/demo-route-access';
import { withTenant } from '@/lib/tenant-api';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    if (!canAccessDisciplinaryRecords(ctx.staff)) {
      return forbiddenResponse('Disciplinary access required.');
    }

    const { id } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const letterType = typeof body.letterType === 'string' ? body.letterType : '';
    const actionId = typeof body.actionId === 'string' ? body.actionId : null;

    const disciplinaryCase = await ctx.run((tx) =>
      tx.disciplinaryCase.findFirst({
        where: ctx.where({ id }),
        include: { employee: true, actions: { orderBy: { actionDate: 'asc' } } },
      }),
    );
    if (!disciplinaryCase) return NextResponse.json({ error: 'Case not found' }, { status: 404 });

    const date = new Date().toISOString().slice(0, 10);
    const base = {
      employeeName: `${disciplinaryCase.employee.firstName} ${disciplinaryCase.employee.lastName}`,
      employeeNumber: disciplinaryCase.employee.employeeNumber,
      department: disciplinaryCase.employee.jobTitle,
      subject: disciplinaryCase.subject,
      incidentDescription: disciplinaryCase.description,
      incidentDate: disciplinaryCase.incidentDate.toISOString().slice(0, 10),
      hrManagerName: ctx.staff.name,
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
        : letterType === 'SUSPENSION' || letterType === 'TERMINATION'
          ? await generateOutcomeLetterPdf(letterType, base)
          : await generateWarningLetterPdf((letterType || 'WRITTEN_WARNING') as 'VERBAL_WARNING' | 'WRITTEN_WARNING' | 'FINAL_WARNING', base);

    const fileName = `${disciplinaryCase.caseNumber}-${letterType || 'LETTER'}-${Date.now()}.pdf`;
    const dir = path.join(process.cwd(), 'public', 'uploads', 'documents');
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, fileName), pdfBuffer);
    const filePath = `/uploads/documents/${fileName}`;

    const doc = await ctx.run((tx) =>
      tx.disciplinaryDocument.create({
        data: {
          organizationId: ctx.organizationId,
          caseId: id,
          title: `${letterType.replaceAll('_', ' ') || 'Warning'} letter`,
          filePath,
          fileName,
          uploadedById: ctx.staff.id,
        },
      }),
    );

    if (actionId) {
      await ctx.run((tx) =>
        tx.disciplinaryAction.update({ where: { id: actionId }, data: { letterGenerated: true } }).catch(() => null),
      );
    }

    await ctx.audit({
      action: 'disciplinary.letter.generated',
      entityType: 'DisciplinaryCase',
      entityId: id,
      route: 'POST /api/disciplinary/cases/[id]/generate-letter',
      metadata: { letterType, documentId: doc.id },
    });

    if (letterType === 'SHOW_CAUSE_LETTER') {
      const due = new Date();
      due.setUTCDate(due.getUTCDate() + policy.defaultShowCauseDays);
      await ctx.run((tx) =>
        tx.disciplinaryCase
          .update({
            where: { id },
            data: { showCauseResponseDueAt: due, status: 'AWAITING_RESPONSE' },
          })
          .catch(() => null),
      );
    }

    return NextResponse.json(doc, { status: 201 });
  });
}
