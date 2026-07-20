import { NextRequest, NextResponse } from 'next/server';
import type { EmployeeDocumentCategory } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { DocumentUploadError, uploadEmployeeDocument } from '@/lib/document-upload';
import { canUserActionTask } from '@/lib/onboarding-workflows';
import { canManageOnboarding } from '@/lib/hr-onboarding-access';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { withTenant } from '@/lib/tenant-api';

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

export async function POST(request: NextRequest, context: RouteContext) {
  const { id } = await context.params;
  return withTenant(request, async (ctx) => {
    const workspaceClientId = await resolvePrimaryWorkspaceClientId(
      prisma,
      null,
      request,
      ctx.organizationId,
    );

    const task = await ctx.run((tx) =>
      tx.onboardingTask.findFirst({
        where: ctx.where({ id }),
        include: {
          employee: { select: { id: true, outsourcingClientId: true } },
          workflow: {
            select: {
              id: true,
              employeeId: true,
              outsourcingClientId: true,
              employee: {
                select: { id: true, outsourcingClientId: true, firstName: true, lastName: true },
              },
            },
          },
        },
      }),
    );
    const scopeClientId =
      task?.workflow.employee?.outsourcingClientId ??
      task?.employee?.outsourcingClientId ??
      task?.workflow.outsourcingClientId ??
      null;
    if (!task || scopeClientId !== workspaceClientId) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    // Evidence is stored as an employee document, so the task must relate to one.
    const targetEmployeeId = task.workflow.employee?.id ?? task.employee?.id ?? null;
    if (!targetEmployeeId) {
      return NextResponse.json(
        { error: 'Evidence can only be attached to tasks linked to an employee.' },
        { status: 400 },
      );
    }

    const canAction = canUserActionTask(
      { assignedRole: task.assignedRole, assignedToId: task.assignedToId },
      ctx.staff,
    );
    if (!canAction && !canManageOnboarding(ctx.staff)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const form = await request.formData().catch(() => null);
    if (!form) return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
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

    const docCategory = inferDocumentCategory(task.title, task.category);
    const updated = await ctx.run(async (tx) => {
      const document = await tx.employeeDocument.create({
        data: {
          organizationId: ctx.organizationId,
          employeeId: targetEmployeeId,
          title: task.title,
          category: docCategory,
          filePath: uploaded.path,
          fileName: uploaded.fileName,
          fileSize: uploaded.fileSize,
          mimeType: uploaded.mimeType,
          uploadedBy: ctx.staff.id,
          notes: `Evidence for onboarding task ${task.id}`,
        },
      });

      return tx.onboardingTask.update({
        where: { id: task.id },
        data: { documentId: document.id },
        include: {
          document: { select: { id: true, fileName: true, title: true, filePath: true } },
          assignedTo: { select: { id: true, name: true, email: true } },
        },
      });
    });

    await ctx.audit({
      action: 'onboarding.task.attachment.uploaded',
      entityType: 'OnboardingTask',
      entityId: task.id,
      route: 'POST /api/onboarding/tasks/[id]/attachments',
      metadata: {
        documentId: updated.documentId,
        workflowId: task.workflowId,
        employeeId: targetEmployeeId,
      },
    });

    return NextResponse.json(updated, { status: 201 });
  });
}
