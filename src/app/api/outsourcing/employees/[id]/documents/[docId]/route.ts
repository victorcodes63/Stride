import { NextRequest, NextResponse } from 'next/server';
import {
  canDeleteEmployeeDocuments,
  forbiddenResponse,
} from '@/lib/demo-route-access';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { withTenant } from '@/lib/tenant-api';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  return withTenant(request, async (ctx) => {
    if (!canDeleteEmployeeDocuments(ctx.staff)) {
      return forbiddenResponse('Only admins can delete employee documents.');
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const { id, docId } = await params;

    const document = await ctx.run(async (tx) => {
      const workspaceId = await resolvePrimaryWorkspaceClientId(tx, null, request, ctx.organizationId);
      const employee = await tx.employee.findFirst({
        where: ctx.where({ id, outsourcingClientId: workspaceId }),
        select: { id: true },
      });
      if (!employee) return null;

      const doc = await tx.employeeDocument.findFirst({
        where: ctx.where({ id: docId, employeeId: id }),
        select: { id: true, employeeId: true, title: true, category: true, fileName: true },
      });
      if (!doc) return null;

      await tx.employeeDocument.delete({ where: { id: docId } });
      return doc;
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    await ctx.audit({
      action: 'employee.document.delete',
      entityType: 'EmployeeDocument',
      entityId: docId,
      route: 'DELETE /api/outsourcing/employees/[id]/documents/[docId]',
      metadata: {
        employeeId: id,
        title: document.title,
        category: document.category,
        fileName: document.fileName,
      },
    });

    return NextResponse.json({ ok: true });
  });
}
