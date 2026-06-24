import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import {
  canDeleteEmployeeDocuments,
  forbiddenResponse,
  unauthorizedResponse,
} from '@/lib/demo-route-access';
import { logAuditEvent } from '@/lib/audit-events';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (!canDeleteEmployeeDocuments(user)) {
    return forbiddenResponse('Only admins can delete employee documents.');
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  const { id, docId } = await params;
  const workspaceId = await resolvePrimaryWorkspaceClientId(prisma, null, request);
  const employee = await prisma.employee.findUnique({
    where: { id },
    select: { id: true, outsourcingClientId: true },
  });
  if (!employee || employee.outsourcingClientId !== workspaceId) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }
  const document = await prisma.employeeDocument.findUnique({
    where: { id: docId },
    select: { id: true, employeeId: true, title: true, category: true, fileName: true },
  });
  if (!document || document.employeeId !== id) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  await prisma.employeeDocument.delete({ where: { id: docId } });
  await logAuditEvent({
    actor: { userId: user.id, email: user.email, name: user.name },
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
}
