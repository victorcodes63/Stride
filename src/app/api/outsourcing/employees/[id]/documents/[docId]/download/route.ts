import { NextRequest, NextResponse } from 'next/server';
import {
  canAccessEmployeeDocuments,
  forbiddenResponse,
} from '@/lib/demo-route-access';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { withTenant } from '@/lib/tenant-api';

function canViewMedicalDocuments(role: string, staffUserType: string) {
  return role === 'admin' || staffUserType === 'business_manager';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> },
) {
  return withTenant(request, async (ctx) => {
    if (!canAccessEmployeeDocuments(ctx.staff)) {
      return forbiddenResponse('Document access is restricted to HR and admins.');
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

      return tx.employeeDocument.findFirst({
        where: ctx.where({ id: docId, employeeId: id }),
        select: { id: true, employeeId: true, category: true, filePath: true, fileName: true },
      });
    });

    if (!document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }
    if (
      document.category === 'MEDICAL' &&
      !canViewMedicalDocuments(ctx.staff.role, ctx.staff.staffUserType)
    ) {
      return forbiddenResponse('Medical documents are restricted to HR and admins.');
    }

    await ctx.audit({
      action: 'employee.document.download',
      entityType: 'EmployeeDocument',
      entityId: docId,
      route: 'GET /api/outsourcing/employees/[id]/documents/[docId]/download',
      metadata: { employeeId: id, category: document.category, fileName: document.fileName },
    });

    return NextResponse.redirect(new URL(document.filePath, request.url));
  });
}
