import { NextRequest, NextResponse } from 'next/server';
import { CredentialCategory, CredentialStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { canAccessCredentials, forbiddenResponse, unauthorizedResponse } from '@/lib/demo-route-access';
import { logAuditEvent } from '@/lib/audit-events';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';

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
  const ms = expiryDate.getTime() - now.getTime();
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
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
  const effectiveStatus = deriveStatus(record.status, record.expiryDate, record.reminderDays);
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
    effectiveStatus,
    scopeOfPractice: record.scopeOfPractice,
    notes: record.notes,
    documentPath: record.documentPath,
    verifiedAt: record.verifiedAt?.toISOString() ?? null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (!canAccessCredentials(user)) {
    return forbiddenResponse('Credentials access is restricted to HR and admins.');
  }
  if (!process.env.DATABASE_URL) return NextResponse.json([], { status: 200 });

  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);
  const employeeId = request.nextUrl.searchParams.get('employeeId') || undefined;
  const categoryRaw = request.nextUrl.searchParams.get('category');
  const statusRaw = request.nextUrl.searchParams.get('status');
  const expiringOnly = request.nextUrl.searchParams.get('expiring') === '1';

  const category =
    categoryRaw && CATEGORIES.has(categoryRaw) ? (categoryRaw as CredentialCategory) : undefined;
  const status =
    statusRaw && STATUSES.has(statusRaw) ? (statusRaw as CredentialStatus) : undefined;

  const records = await prisma.employeeCredential.findMany({
    where: {
      employee: { outsourcingClientId: workspaceClientId },
      ...(employeeId ? { employeeId } : {}),
      ...(category ? { category } : {}),
      ...(status ? { status } : {}),
    },
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
    orderBy: [{ expiryDate: 'asc' }, { createdAt: 'desc' }],
  });

  const mapped = records.map(toResponse);
  const filtered = expiringOnly
    ? mapped.filter((item) =>
        item.effectiveStatus === 'expiring_soon' || item.effectiveStatus === 'expired'
      )
    : mapped;
  await logAuditEvent({
    actor: { userId: user.id, email: user.email, name: user.name },
    action: 'credential.records.view',
    entityType: 'EmployeeCredential',
    route: 'GET /api/credentials',
    metadata: { employeeId: employeeId ?? null, category: category ?? null, status: status ?? null, count: filtered.length },
  });

  return NextResponse.json(filtered);
}

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (!canAccessCredentials(user)) {
    return forbiddenResponse('Credentials access is restricted to HR and admins.');
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const employeeId = asOptionalString(body.employeeId);
  const credentialName = asOptionalString(body.credentialName);
  const categoryRaw = asOptionalString(body.category);
  const statusRaw = asOptionalString(body.status);

  if (!employeeId) return NextResponse.json({ error: 'employeeId is required' }, { status: 400 });
  if (!credentialName) return NextResponse.json({ error: 'credentialName is required' }, { status: 400 });

  const category =
    categoryRaw && CATEGORIES.has(categoryRaw) ? (categoryRaw as CredentialCategory) : 'medical_license';
  const status =
    statusRaw && STATUSES.has(statusRaw) ? (statusRaw as CredentialStatus) : 'active';

  const reminderDaysRaw = Number(body.reminderDays);
  const reminderDays =
    Number.isFinite(reminderDaysRaw) && reminderDaysRaw >= 0 && reminderDaysRaw <= 365 ? Math.floor(reminderDaysRaw) : 30;

  const workspaceClientId = await resolvePrimaryWorkspaceClientId(prisma, null, request);
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    select: { id: true, outsourcingClientId: true },
  });
  if (!employee || employee.outsourcingClientId !== workspaceClientId) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  const created = await prisma.employeeCredential.create({
    data: {
      employeeId,
      category,
      credentialName,
      credentialNumber: asOptionalString(body.credentialNumber) ?? undefined,
      issuingAuthority: asOptionalString(body.issuingAuthority) ?? undefined,
      issueDate: asDate(body.issueDate) ?? undefined,
      expiryDate: asDate(body.expiryDate) ?? undefined,
      reminderDays,
      status,
      scopeOfPractice: asOptionalString(body.scopeOfPractice) ?? undefined,
      notes: asOptionalString(body.notes) ?? undefined,
      documentPath: asOptionalString(body.documentPath) ?? undefined,
      verifiedAt: asDate(body.verifiedAt) ?? undefined,
    },
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
    action: 'credential.created',
    entityType: 'EmployeeCredential',
    entityId: created.id,
    route: 'POST /api/credentials',
    metadata: { employeeId: created.employeeId, category: created.category, status: created.status },
  });

  return NextResponse.json(toResponse(created), { status: 201 });
}
