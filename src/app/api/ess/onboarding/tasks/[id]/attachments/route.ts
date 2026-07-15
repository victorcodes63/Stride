import { NextRequest, NextResponse } from 'next/server';
import type { EmployeeDocumentCategory, Prisma } from '@prisma/client';
import { DocumentUploadError, uploadEmployeeDocument } from '@/lib/document-upload';
import { withEssTenant } from '@/lib/ess-tenant-api';

type RouteContext = { params: Promise<{ id: string }> };

function inferDocumentCategory(title: string, category: string | null): EmployeeDocumentCategory {
  const text = `${title} ${category ?? ''}`.toLowerCase();
  if (text.includes('contract')) return 'CONTRACT';
  if (text.includes('id') || text.includes('national') || text.includes('passport')) return 'IDENTIFICATION';
  if (text.includes('cert') || text.includes('qualification') || text.includes('kra')) return 'QUALIFICATION';
  if (text.includes('medical')) return 'MEDICAL';
  if (text.includes('policy')) return 'POLICY_ACKNOWLEDGMENT';
  return 'OTHER';
}

async function resolveUploaderUserId(
  tx: Prisma.TransactionClient,
  organizationId: string,
  essEmail: string,
): Promise<string | null> {
  const byEmail = await tx.user.findFirst({
    where: { email: essEmail.toLowerCase(), isActive: true },
    select: { id: true },
  });
  if (byEmail) return byEmail.id;

  const hr = await tx.user.findFirst({
    where: {
      isActive: true,
      OR: [{ role: 'admin' }, { staffUserType: { in: ['operations', 'business_manager'] } }],
      organizationMemberships: { some: { organizationId, status: 'active' } },
    },
    select: { id: true },
  });
  return hr?.id ?? null;
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return withEssTenant(request, async (ctx) => {
    if (!ctx.employeeId) return NextResponse.json({ error: 'No employee profile.' }, { status: 400 });

    const task = await ctx.run((tx) =>
      tx.onboardingTask.findFirst({
        where: {
          id,
          ...ctx.where(),
          workflow: { employeeId: ctx.employeeId! },
        },
      }),
    );
    if (!task) return NextResponse.json({ error: 'Task not found.' }, { status: 404 });
    if (task.assignedRole !== 'employee') {
      return NextResponse.json({ error: 'You can only upload evidence for your own tasks.' }, { status: 403 });
    }

    const form = await request.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: 'Expected multipart form data.' }, { status: 400 });
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required.' }, { status: 400 });
    }

    let uploaded;
    try {
      uploaded = await uploadEmployeeDocument(file);
    } catch (err) {
      if (err instanceof DocumentUploadError) {
        return NextResponse.json({ error: err.message }, { status: err.status });
      }
      throw err;
    }

    let updated;
    try {
      updated = await ctx.run(async (tx) => {
        const uploaderId = await resolveUploaderUserId(tx, ctx.organizationId, ctx.essUser.email);
        if (!uploaderId) {
          return null;
        }

        const document = await tx.employeeDocument.create({
          data: {
            organizationId: ctx.organizationId,
            employeeId: ctx.employeeId!,
            title: task.title,
            category: inferDocumentCategory(task.title, task.category),
            filePath: uploaded.path,
            fileName: uploaded.fileName,
            fileSize: uploaded.fileSize,
            mimeType: uploaded.mimeType,
            uploadedBy: uploaderId,
            notes: `ESS self-upload for onboarding task ${task.id} by ${ctx.essUser.email}`,
          },
        });

        return tx.onboardingTask.update({
          where: { id: task.id },
          data: { documentId: document.id },
          include: {
            document: { select: { id: true, fileName: true, title: true } },
          },
        });
      });
    } catch (err) {
      console.error('[ess/onboarding] attachment upload failed:', err);
      return NextResponse.json({ error: 'Could not save upload.' }, { status: 500 });
    }

    if (!updated) {
      return NextResponse.json(
        { error: 'Upload could not be attributed. Contact HR.' },
        { status: 503 },
      );
    }

    await ctx.audit({
      action: 'ess.onboarding.task.attachment.uploaded',
      entityType: 'OnboardingTask',
      entityId: task.id,
      route: 'POST /api/ess/onboarding/tasks/[id]/attachments',
      metadata: {
        documentId: updated.documentId,
        workflowId: task.workflowId,
        essUserId: ctx.essUser.id,
      },
    });

    return NextResponse.json(
      {
        id: updated.id,
        documentId: updated.documentId,
        document: updated.document,
      },
      { status: 201 },
    );
  });
}
