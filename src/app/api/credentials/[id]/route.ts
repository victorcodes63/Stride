import { NextRequest, NextResponse } from 'next/server';
import { CredentialCategory, CredentialStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { canAccessCredentials, forbiddenResponse, unauthorizedResponse } from '@/lib/demo-route-access';
import { logAuditEvent } from '@/lib/audit-events';

const CATEGORIES = new Set<string>(Object.values(CredentialCategory));
const STATUSES = new Set<string>(Object.values(CredentialStatus));

function asOptionalString(value: unknown): string | null {
  return typeof value === 'string' ? value.trim() || null : null;
}

function asDate(value: unknown): Date | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function deriveStatus(
  status: CredentialStatus,
  expiryDate: Date | null,
  reminderDays: number
): CredentialStatus {
  if (status === 'suspended' || status === 'revoked') return status;
  if (!expiryDate) return status;
  const now = new Date();
  const days = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return 'expired';
  if (days <= reminderDays) return 'expiring_soon';
  return 'active';
}

function toResponse(record: {
  id: string;
  employeeId: string;
  category: CredentialCategory;
  credentialName: string;
  credentialNumber: string | null;
  issuingAuthority: string | null;
  issueDate: Date | null;
  expiryDate: Date | null;
  reminderDays: number;
  status: CredentialStatus;
  scopeOfPractice: string | null;
  notes: string | null;
  documentPath: string | null;
  verifiedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  employee: {
    firstName: string;
    lastName: string;
    employeeNumber: string | null;
    jobTitle: string | null;
    department: { name: string } | null;
  };
}) {
  return {
    id: record.id,
    employeeId: record.employeeId,
    employeeName: `${record.employee.firstName} ${record.employee.lastName}`.trim(),
    employeeNumber: record.employee.employeeNumber,
    jobTitle: record.employee.jobTitle,
    departmentName: record.employee.department?.name ?? null,
    category: record.category,
    credentialName: record.credentialName,
    credentialNumber: record.credentialNumber,
    issuingAuthority: record.issuingAuthority,
    issueDate: record.issueDate?.toISOString().slice(0, 10) ?? null,
    expiryDate: record.expiryDate?.toISOString().slice(0, 10) ?? null,
    reminderDays: record.reminderDays,
    status: record.status,
    effectiveStatus: deriveStatus(record.status, record.expiryDate, record.reminderDays),
    scopeOfPractice: record.scopeOfPractice,
    notes: record.notes,
    documentPath: record.documentPath,
    verifiedAt: record.verifiedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser(_request);
  if (!user) return unauthorizedResponse();
  if (!canAccessCredentials(user)) {
    return forbiddenResponse('Credentials access is restricted to HR and admins.');
  }
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  const { id } = await params;
  const record = await prisma.employeeCredential.findUnique({
    where: { id },
    include: {
      employee: {
        select: {
          firstName: true,
          lastName: true,
          employeeNumber: true,
          jobTitle: true,
          department: { select: { name: true } },
        },
      },
    },
  });
  if (!record) return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
  await logAuditEvent({
    actor: { userId: user.id, email: user.email, name: user.name },
    action: user.role === 'admin' ? 'credential.viewed' : 'credential.viewed_non_admin',
    entityType: 'EmployeeCredential',
    entityId: record.id,
    route: 'GET /api/credentials/[id]',
    metadata: { employeeId: record.employeeId, category: record.category, status: record.status },
  });
  return NextResponse.json(toResponse(record));
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (!canAccessCredentials(user)) {
    return forbiddenResponse('Credentials access is restricted to HR and admins.');
  }
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (body.credentialName !== undefined) {
    const name = asOptionalString(body.credentialName);
    if (!name) return NextResponse.json({ error: 'credentialName cannot be empty' }, { status: 400 });
    data.credentialName = name;
  }
  if (body.category !== undefined) {
    const category = asOptionalString(body.category);
    if (!category || !CATEGORIES.has(category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
    }
    data.category = category as CredentialCategory;
  }
  if (body.status !== undefined) {
    const status = asOptionalString(body.status);
    if (!status || !STATUSES.has(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }
    data.status = status as CredentialStatus;
  }
  if (body.employeeId !== undefined) {
    const employeeId = asOptionalString(body.employeeId);
    if (!employeeId) return NextResponse.json({ error: 'employeeId cannot be empty' }, { status: 400 });
    const employee = await prisma.employee.findUnique({ where: { id: employeeId }, select: { id: true } });
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    data.employeeId = employeeId;
  }
  if (body.reminderDays !== undefined) {
    const reminder = Number(body.reminderDays);
    if (!Number.isFinite(reminder) || reminder < 0 || reminder > 365) {
      return NextResponse.json({ error: 'reminderDays must be between 0 and 365' }, { status: 400 });
    }
    data.reminderDays = Math.floor(reminder);
  }

  if (body.credentialNumber !== undefined) data.credentialNumber = asOptionalString(body.credentialNumber);
  if (body.issuingAuthority !== undefined) data.issuingAuthority = asOptionalString(body.issuingAuthority);
  if (body.scopeOfPractice !== undefined) data.scopeOfPractice = asOptionalString(body.scopeOfPractice);
  if (body.notes !== undefined) data.notes = asOptionalString(body.notes);
  if (body.documentPath !== undefined) data.documentPath = asOptionalString(body.documentPath);
  if (body.issueDate !== undefined) data.issueDate = asDate(body.issueDate);
  if (body.expiryDate !== undefined) data.expiryDate = asDate(body.expiryDate);
  if (body.verifiedAt !== undefined) data.verifiedAt = asDate(body.verifiedAt);

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'No fields supplied to update' }, { status: 400 });
  }

  try {
    const updated = await prisma.employeeCredential.update({
      where: { id },
      data,
      include: {
        employee: {
          select: {
            firstName: true,
            lastName: true,
            employeeNumber: true,
            jobTitle: true,
            department: { select: { name: true } },
          },
        },
      },
    });
    await logAuditEvent({
      actor: { userId: user.id, email: user.email, name: user.name },
      action: 'credential.updated',
      entityType: 'EmployeeCredential',
      entityId: updated.id,
      route: 'PATCH /api/credentials/[id]',
      metadata: { changedFields: Object.keys(data), employeeId: updated.employeeId },
    });
    return NextResponse.json(toResponse(updated));
  } catch (error) {
    const err = error as { code?: string };
    if (err.code === 'P2025') return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
    return NextResponse.json({ error: 'Failed to update credential' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser(_request);
  if (!user) return unauthorizedResponse();
  if (!canAccessCredentials(user)) {
    return forbiddenResponse('Credentials access is restricted to HR and admins.');
  }
  if (!process.env.DATABASE_URL) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  const { id } = await params;
  try {
    const existing = await prisma.employeeCredential.findUnique({
      where: { id },
      select: { id: true, employeeId: true, category: true },
    });
    await prisma.employeeCredential.delete({ where: { id } });
    await logAuditEvent({
      actor: { userId: user.id, email: user.email, name: user.name },
      action: 'credential.deleted',
      entityType: 'EmployeeCredential',
      entityId: id,
      route: 'DELETE /api/credentials/[id]',
      metadata: {
        employeeId: existing?.employeeId ?? null,
        category: existing?.category ?? null,
      },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const err = error as { code?: string };
    if (err.code === 'P2025') return NextResponse.json({ error: 'Credential not found' }, { status: 404 });
    return NextResponse.json({ error: 'Failed to delete credential' }, { status: 500 });
  }
}
