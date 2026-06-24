import { NextRequest, NextResponse } from 'next/server';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/lib/prisma';
import { normalizeEmployeeNationalId } from '@/lib/outsourcing-employee-national-id';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { canViewSalaryFields, unauthorizedResponse } from '@/lib/demo-route-access';
import { logAuditEvent } from '@/lib/audit-events';
import { ensureEssUserForEmployee } from '@/lib/ess-provision';
import { diffSensitiveFields } from '@/lib/audit-helpers';
import { getHrUserIds, sendNotification } from '@/lib/notifications';
import { startWorkflowForEmployee } from '@/lib/onboarding-workflows';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import { assertEmployeeProfileCompleteness } from '@/lib/hr-core-employee';

function str(b: Record<string, unknown>, key: string): string | null {
  const v = b[key];
  return typeof v === 'string' ? v.trim() || null : null;
}
function date(b: Record<string, unknown>, key: string): Date | undefined {
  const v = str(b, key);
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function mapEmployeeToJson(
  e: {
  id: string;
  employeeNumber: string | null;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  jobTitle: string | null;
  kraPin: string | null;
  nssfNumber: string | null;
  nhifNumber: string | null;
  idNumber: string | null;
  dateOfJoining: Date | null;
  bankName: string | null;
  bankBranch: string | null;
  bankAccountNumber: string | null;
  costCenterCode: string | null;
  costCenterName: string | null;
  managerEmployeeId: string | null;
  employmentStatus: 'active' | 'probation' | 'on_leave' | 'suspended' | 'terminated';
  employmentStatusEffectiveFrom: Date | null;
  employmentStatusEffectiveTo: Date | null;
  employmentEndedAt: Date | null;
  baseSalary: unknown;
  outsourcingClientId: string;
  departmentId: string | null;
  createdAt: Date;
  updatedAt: Date;
  client: { id: string; name: string };
  department: { id: string; name: string } | null;
  },
  canViewSalary: boolean
) {
  return {
    id: e.id,
    employeeNumber: e.employeeNumber ?? null,
    firstName: e.firstName,
    lastName: e.lastName,
    email: e.email,
    phone: e.phone ?? null,
    jobTitle: e.jobTitle ?? null,
    kraPin: e.kraPin ?? null,
    nssfNumber: e.nssfNumber ?? null,
    nhifNumber: e.nhifNumber ?? null,
    idNumber: e.idNumber ?? null,
    dateOfJoining: e.dateOfJoining?.toISOString().slice(0, 10) ?? null,
    bankName: e.bankName ?? null,
    bankBranch: e.bankBranch ?? null,
    bankAccountNumber: e.bankAccountNumber ?? null,
    costCenterCode: e.costCenterCode ?? null,
    costCenterName: e.costCenterName ?? null,
    managerEmployeeId: e.managerEmployeeId ?? null,
    managerName: null,
    employmentStatus: e.employmentStatus,
    employmentStatusEffectiveFrom: e.employmentStatusEffectiveFrom?.toISOString().slice(0, 10) ?? null,
    employmentStatusEffectiveTo: e.employmentStatusEffectiveTo?.toISOString().slice(0, 10) ?? null,
    employmentEndedAt: e.employmentEndedAt?.toISOString().slice(0, 10) ?? null,
    baseSalary: canViewSalary && e.baseSalary != null ? Number(e.baseSalary as number) : null,
    clientId: e.outsourcingClientId,
    clientName: e.client.name,
    departmentId: e.departmentId,
    departmentName: e.department?.name ?? null,
    createdAt: e.createdAt.toISOString(),
    updatedAt: e.updatedAt.toISOString(),
  };
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireStaffUser(_request);
  if (!user) return unauthorizedResponse();
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Employee id required' }, { status: 400 });

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    const employee = await prisma.employee.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });
    if (!employee) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    const workspaceId = await resolvePrimaryWorkspaceClientId(prisma, null, _request);
    if (employee.outsourcingClientId !== workspaceId) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }
    await logAuditEvent({
      actor: { userId: user.id, email: user.email, name: user.name },
      action: canViewSalaryFields(user) ? 'employee.salary.view' : 'employee.profile.view',
      entityType: 'Employee',
      entityId: employee.id,
      route: 'GET /api/outsourcing/employees/[id]',
      metadata: { includesSalary: canViewSalaryFields(user) },
    });
    return NextResponse.json(mapEmployeeToJson(employee, canViewSalaryFields(user)));
  } catch (e) {
    console.error('[outsourcing/employees GET]', e);
    return NextResponse.json({ error: 'Failed to load employee' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Employee id required' }, { status: 400 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const firstName = b.firstName !== undefined ? str(b, 'firstName') : undefined;
  const lastName = b.lastName !== undefined ? str(b, 'lastName') : undefined;
  const email = b.email !== undefined ? str(b, 'email') : undefined;
  const phone = b.phone !== undefined ? str(b, 'phone') : undefined;
  const employeeNumber = b.employeeNumber !== undefined ? str(b, 'employeeNumber') : undefined;
  const jobTitle = b.jobTitle !== undefined ? str(b, 'jobTitle') : undefined;
  const kraPin = b.kraPin !== undefined ? str(b, 'kraPin') : undefined;
  const nssfNumber = b.nssfNumber !== undefined ? str(b, 'nssfNumber') : undefined;
  const nhifNumber = b.nhifNumber !== undefined ? str(b, 'nhifNumber') : undefined;
  const idNumber = b.idNumber !== undefined ? str(b, 'idNumber') : undefined;
  const dateOfJoining = b.dateOfJoining !== undefined ? date(b, 'dateOfJoining') : undefined;
  const bankName = b.bankName !== undefined ? str(b, 'bankName') : undefined;
  const bankBranch = b.bankBranch !== undefined ? str(b, 'bankBranch') : undefined;
  const bankAccountNumber = b.bankAccountNumber !== undefined ? str(b, 'bankAccountNumber') : undefined;
  const departmentId = b.departmentId !== undefined
    ? (typeof b.departmentId === 'string' && b.departmentId.trim() ? b.departmentId.trim() : null)
    : undefined;
  const managerEmployeeId =
    b.managerEmployeeId !== undefined
      ? (typeof b.managerEmployeeId === 'string' && b.managerEmployeeId.trim() ? b.managerEmployeeId.trim() : null)
      : undefined;
  const employmentStatus =
    b.employmentStatus !== undefined ? str(b, 'employmentStatus') : undefined;
  const costCenterCode = b.costCenterCode !== undefined ? str(b, 'costCenterCode') : undefined;
  const costCenterName = b.costCenterName !== undefined ? str(b, 'costCenterName') : undefined;
  const employmentStatusEffectiveFrom = b.employmentStatusEffectiveFrom !== undefined ? date(b, 'employmentStatusEffectiveFrom') : undefined;
  const employmentStatusEffectiveTo = b.employmentStatusEffectiveTo !== undefined ? date(b, 'employmentStatusEffectiveTo') : undefined;
  const employmentEndedAt = b.employmentEndedAt !== undefined ? date(b, 'employmentEndedAt') : undefined;
  const attendancePolicyId = b.attendancePolicyId !== undefined ? str(b, 'attendancePolicyId') : undefined;
  const leavePolicyId = b.leavePolicyId !== undefined ? str(b, 'leavePolicyId') : undefined;

  if (firstName !== undefined && !firstName) {
    return NextResponse.json({ error: 'First name is required.' }, { status: 400 });
  }
  if (lastName !== undefined && !lastName) {
    return NextResponse.json({ error: 'Last name is required.' }, { status: 400 });
  }
  if (email !== undefined && email && !/\S+@\S+\.\S+/.test(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  const data: Record<string, unknown> = {};
  if (employeeNumber !== undefined) data.employeeNumber = employeeNumber;
  if (firstName !== undefined) data.firstName = firstName;
  if (lastName !== undefined) data.lastName = lastName;
  if (email !== undefined) data.email = email ? email.toLowerCase() : null;
  if (phone !== undefined) data.phone = phone;
  if (jobTitle !== undefined) data.jobTitle = jobTitle;
  if (kraPin !== undefined) data.kraPin = kraPin;
  if (nssfNumber !== undefined) data.nssfNumber = nssfNumber;
  if (nhifNumber !== undefined) data.nhifNumber = nhifNumber;
  if (idNumber !== undefined) {
    data.idNumber = idNumber ? normalizeEmployeeNationalId(idNumber) : null;
  }
  if (dateOfJoining !== undefined) data.dateOfJoining = dateOfJoining;
  if (bankName !== undefined) data.bankName = bankName;
  if (bankBranch !== undefined) data.bankBranch = bankBranch;
  if (bankAccountNumber !== undefined) data.bankAccountNumber = bankAccountNumber;
  if (departmentId !== undefined) data.departmentId = departmentId;
  if (managerEmployeeId !== undefined) data.managerEmployeeId = managerEmployeeId;
  if (costCenterCode !== undefined) data.costCenterCode = costCenterCode;
  if (costCenterName !== undefined) data.costCenterName = costCenterName;
  if (employmentStatus !== undefined) data.employmentStatus = employmentStatus;
  if (employmentStatusEffectiveFrom !== undefined) data.employmentStatusEffectiveFrom = employmentStatusEffectiveFrom;
  if (employmentStatusEffectiveTo !== undefined) data.employmentStatusEffectiveTo = employmentStatusEffectiveTo;
  if (employmentEndedAt !== undefined) data.employmentEndedAt = employmentEndedAt;
  if (b.baseSalary !== undefined) {
    const raw = b.baseSalary;
    if (raw === null || raw === '') data.baseSalary = null;
    else {
      const n = parseFloat(String(raw).replace(/,/g, ''));
      if (!Number.isNaN(n) && n >= 0) data.baseSalary = new Decimal(n);
    }
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Provide at least one field to update.' }, { status: 400 });
  }

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }

    const existing = await prisma.employee.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        kraPin: true,
        nssfNumber: true,
        nhifNumber: true,
        dateOfJoining: true,
        jobTitle: true,
        departmentId: true,
        costCenterCode: true,
        outsourcingClientId: true,
        employmentStatus: true,
        baseSalary: true,
        bankAccountNumber: true,
        idNumber: true,
      },
    });
    if (!existing) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    const workspaceId = await resolvePrimaryWorkspaceClientId(prisma, null, request);
    if (existing.outsourcingClientId !== workspaceId) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    if (email !== undefined && email) {
      const duplicate = await prisma.employee.findFirst({
        where: {
          outsourcingClientId: existing.outsourcingClientId,
          email: email.toLowerCase(),
          id: { not: id },
        },
      });
      if (duplicate) {
        return NextResponse.json({ error: 'Another employee in this client already has this email.' }, { status: 409 });
      }
    }

    const nextNationalId =
      idNumber !== undefined ? (idNumber ? normalizeEmployeeNationalId(idNumber) : null) : undefined;
    if (nextNationalId) {
      const idDup = await prisma.employee.findFirst({
        where: { idNumber: nextNationalId, id: { not: id } },
      });
      if (idDup) {
        return NextResponse.json(
          { error: 'Another employee already has this National ID.' },
          { status: 409 }
        );
      }
    }

    assertEmployeeProfileCompleteness({
      firstName: (data.firstName as string | undefined) ?? existing.firstName,
      lastName: (data.lastName as string | undefined) ?? existing.lastName,
      idNumber: (data.idNumber as string | null | undefined) ?? existing.idNumber,
      kraPin: (data.kraPin as string | null | undefined) ?? existing.kraPin,
      nssfNumber: (data.nssfNumber as string | null | undefined) ?? existing.nssfNumber,
      nhifNumber: (data.nhifNumber as string | null | undefined) ?? existing.nhifNumber,
      dateOfJoining: (data.dateOfJoining as Date | null | undefined) ?? existing.dateOfJoining,
      jobTitle: (data.jobTitle as string | null | undefined) ?? existing.jobTitle,
      departmentId: (data.departmentId as string | null | undefined) ?? existing.departmentId,
      costCenterCode: (data.costCenterCode as string | null | undefined) ?? existing.costCenterCode,
    });

    const employee = await prisma.employee.update({
      where: { id },
      data,
      include: {
        client: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });

    if (attendancePolicyId !== undefined && attendancePolicyId) {
      await prisma.attendancePolicyAssignment.create({
        data: {
          employeeId: id,
          attendancePolicyId,
          effectiveFrom: new Date(),
        },
      }).catch(() => null);
    }
    if (leavePolicyId !== undefined && leavePolicyId) {
      await prisma.leavePolicyAssignment.create({
        data: {
          employeeId: id,
          leavePolicyId,
          effectiveFrom: new Date(),
        },
      }).catch(() => null);
    }
    await ensureEssUserForEmployee({
      employeeId: employee.id,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
    }).catch(() => null);
    const sensitiveChanges = diffSensitiveFields(
      {
        baseSalary: existing.baseSalary?.toString() ?? null,
        bankAccountNumber: existing.bankAccountNumber,
        idNumber: existing.idNumber,
      },
      {
        baseSalary: employee.baseSalary?.toString() ?? null,
        bankAccountNumber: employee.bankAccountNumber,
        idNumber: employee.idNumber,
      },
      ['baseSalary', 'bankAccountNumber', 'idNumber']
    );
    await logAuditEvent({
      actor: { userId: user.id, email: user.email, name: user.name },
      action: 'employee.updated',
      entityType: 'Employee',
      entityId: employee.id,
      route: 'PATCH /api/outsourcing/employees/[id]',
      metadata: {
        changedFields: Object.keys(data),
        sensitiveChanges,
      },
    });
    try {
      if (employmentStatus === 'terminated' || employee.employmentStatus === 'terminated') {
        const hrUserIds = await getHrUserIds();
        await sendNotification({
          event: 'employee_terminated',
          recipientUserIds: hrUserIds,
          title: 'Employee offboarded',
          body: `${employee.firstName} ${employee.lastName} has been terminated/archived.`,
          href: '/dashboard/outsourcing/employees',
          priority: 'info',
          channel: 'in_app',
          metadata: { employeeId: employee.id },
        });
      }
    } catch (err) {
      console.error('[notifications] Failed to send employee_terminated:', err);
    }
    if (existing.employmentStatus !== 'terminated' && employee.employmentStatus === 'terminated') {
      await startWorkflowForEmployee({ employeeId: employee.id, type: 'OFFBOARDING' }).catch((error) =>
        console.error('[onboarding] Failed to auto-start offboarding:', error),
      );
    }
    return NextResponse.json(mapEmployeeToJson(employee, canViewSalaryFields(user)));
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('Employee profile is incomplete.')) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    const err = e as { code?: string; meta?: { target?: string[] } };
    if (err.code === 'P2025') return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    if (err.code === 'P2002' && err.meta?.target?.includes('idNumber')) {
      return NextResponse.json(
        { error: 'Another employee already has this National ID.' },
        { status: 409 }
      );
    }
    console.error('[outsourcing/employees PATCH]', e);
    return NextResponse.json({ error: 'Failed to update employee' }, { status: 500 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await requireStaffUser(_request);
  if (!user) return unauthorizedResponse();
  const { id } = await params;
  if (!id) return NextResponse.json({ error: 'Employee id required' }, { status: 400 });

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    const existing = await prisma.employee.findUnique({
      where: { id },
      select: { id: true, firstName: true, lastName: true, outsourcingClientId: true },
    });
    if (!existing) return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    const workspaceId = await resolvePrimaryWorkspaceClientId(prisma, null, _request);
    if (existing.outsourcingClientId !== workspaceId) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }
    await prisma.employee.delete({ where: { id } });
    await logAuditEvent({
      actor: { userId: user.id, email: user.email, name: user.name },
      action: 'employee.deleted',
      entityType: 'Employee',
      entityId: id,
      route: 'DELETE /api/outsourcing/employees/[id]',
      metadata: { employeeName: existing ? `${existing.firstName} ${existing.lastName}` : null },
    });
    try {
      const hrUserIds = await getHrUserIds();
      await sendNotification({
        event: 'employee_terminated',
        recipientUserIds: hrUserIds,
        title: 'Employee offboarded',
        body: `${existing ? `${existing.firstName} ${existing.lastName}` : 'Employee'} has been terminated/archived.`,
        href: '/dashboard/outsourcing/employees',
        priority: 'info',
        channel: 'in_app',
        metadata: { employeeId: id },
      });
    } catch (err) {
      console.error('[notifications] Failed to send employee_terminated on delete:', err);
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    const err = e as { code?: string };
    if (err.code === 'P2025') return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    console.error('[outsourcing/employees DELETE]', e);
    return NextResponse.json({ error: 'Failed to delete employee' }, { status: 500 });
  }
}
