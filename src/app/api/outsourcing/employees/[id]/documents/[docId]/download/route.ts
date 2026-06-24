import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import {
  canAccessEmployeeDocuments,
  forbiddenResponse,
  unauthorizedResponse,
} from '@/lib/demo-route-access';
import { logAuditEvent } from '@/lib/audit-events';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';

function canViewMedicalDocuments(role: string, staffUserType: string) {
  return role === 'admin' || staffUserType === 'business_manager';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (!canAccessEmployeeDocuments(user)) {
    return forbiddenResponse('Document access is restricted to HR and admins.');
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
    select: { id: true, employeeId: true, category: true, filePath: true, fileName: true },
  });
  if (!document || document.employeeId !== id) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }
  if (document.category === 'MEDICAL' && !canViewMedicalDocuments(user.role, user.staffUserType)) {
    return forbiddenResponse('Medical documents are restricted to HR and admins.');
  }

  await logAuditEvent({
    actor: { userId: user.id, email: user.email, name: user.name },
    action: 'employee.document.download',
    entityType: 'EmployeeDocument',
    entityId: docId,
    route: 'GET /api/outsourcing/employees/[id]/documents/[docId]/download',
    metadata: { employeeId: id, category: document.category, fileName: document.fileName },
  });

  return NextResponse.redirect(new URL(document.filePath, request.url));
}
