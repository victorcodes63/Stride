import { NextRequest, NextResponse } from 'next/server';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/lib/prisma';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import {
  allocateNextEmployeeNumber,
  deriveEmployeePrefixFromName,
} from '@/lib/outsourcing-employee-number';
import { normalizeEmployeeNationalId } from '@/lib/outsourcing-employee-national-id';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { canViewSalaryFields, unauthorizedResponse } from '@/lib/demo-route-access';
import { ensureEssUserForEmployee } from '@/lib/ess-provision';
import { logAuditEvent } from '@/lib/audit-events';
import { getHrUserIds, sendNotification } from '@/lib/notifications';
import { startWorkflowForEmployee } from '@/lib/onboarding-workflows';
import {
  assertEmployeeProfileCompleteness,
  normalizeEmployeeSearchPreset,
} from '@/lib/hr-core-employee';
import {
  checkSeatLimitForNewEmployee,
  countBillableEmployees,
  reportSeatUsageToControlPlane,
  seatLimitExceededPayload,
} from '@/lib/seat-limit';

export async function GET(request: NextRequest) {
  try {
    const user = await requireStaffUser(request);
    if (!user) return unauthorizedResponse();
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }
    const { searchParams } = new URL(request.url);
    const requestedClientId = searchParams.get('clientId') || undefined;
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, requestedClientId, request);
    const departmentId = searchParams.get('departmentId') || undefined;
    const jobTitle = searchParams.get('jobTitle') || undefined;
    const managerEmployeeId = searchParams.get('managerEmployeeId') || undefined;
    const costCenterCode = searchParams.get('costCenterCode') || undefined;
    const searchPreset = normalizeEmployeeSearchPreset(searchParams.get('preset'));

    const employees = await prisma.employee.findMany({
      where: {
        ...(clientId ? { outsourcingClientId: clientId } : {}),
        ...(departmentId ? { departmentId } : {}),
        ...(jobTitle?.trim() ? { jobTitle: { equals: jobTitle.trim(), mode: 'insensitive' } } : {}),
        ...(managerEmployeeId?.trim() ? { managerEmployeeId: managerEmployeeId.trim() } : {}),
        ...(costCenterCode?.trim()
          ? { costCenterCode: { equals: costCenterCode.trim(), mode: 'insensitive' } }
          : {}),
        ...(searchPreset === 'without_manager' ? { managerEmployeeId: null } : {}),
        ...(searchPreset === 'without_cost_centre' ? { costCenterCode: null } : {}),
        ...(searchPreset === 'on_probation' ? { employmentStatus: 'probation' } : {}),
        ...(searchPreset === 'suspended' ? { employmentStatus: 'suspended' } : {}),
        ...(searchPreset === 'incomplete_profile'
          ? {
              OR: [
                { idNumber: null },
                { kraPin: null },
                { nssfNumber: null },
                { nhifNumber: null },
                { dateOfJoining: null },
                { jobTitle: null },
                { departmentId: null },
                { costCenterCode: null },
              ],
            }
          : {}),
      },
      include: {
        client: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
      orderBy: [{ client: { name: 'asc' } }, { lastName: 'asc' }, { firstName: 'asc' }],
    });

    const list = employees.map((e) => ({
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
      baseSalary: canViewSalaryFields(user) && e.baseSalary != null ? Number(e.baseSalary) : null,
      employmentStatus: e.employmentStatus,
      employmentStatusEffectiveFrom: e.employmentStatusEffectiveFrom?.toISOString().slice(0, 10) ?? null,
      employmentStatusEffectiveTo: e.employmentStatusEffectiveTo?.toISOString().slice(0, 10) ?? null,
      managerEmployeeId: e.managerEmployeeId ?? null,
      managerName: null,
      clientId: e.outsourcingClientId,
      clientName: e.client.name,
      departmentId: e.departmentId,
      departmentName: e.department?.name ?? null,
      createdAt: e.createdAt.toISOString(),
      updatedAt: e.updatedAt.toISOString(),
    }));

    return NextResponse.json(list);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('outside active entity scope')) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    console.error('[outsourcing/employees]', e);
    return NextResponse.json(
      {
        error: 'Failed to load employees',
        ...(process.env.NODE_ENV === 'development' && { detail: msg }),
      },
      { status: 500 }
    );
  }
}

function strField(b: Record<string, unknown>, key: string): string | null {
  const v = b[key];
  return typeof v === 'string' ? v.trim() || null : null;
}

/** Create a single employee (form or API). Requires clientId, firstName, lastName; email optional. */
export async function POST(request: NextRequest) {
  try {
    const user = await requireStaffUser(request);
    if (!user) return unauthorizedResponse();
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
    }
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const requestedClientId = strField(body, 'clientId');
    const firstName = strField(body, 'firstName') ?? '';
    const lastName = strField(body, 'lastName') ?? '';
    const emailRaw = strField(body, 'email');
    const clientId = await resolvePrimaryWorkspaceClientId(prisma, requestedClientId, request);

    const seatCheck = await checkSeatLimitForNewEmployee(clientId, request);
    if (!seatCheck.ok) {
      return NextResponse.json(seatLimitExceededPayload(seatCheck.check), { status: 403 });
    }

    if (!firstName || !lastName) {
      return NextResponse.json({ error: 'firstName and lastName are required.' }, { status: 400 });
    }
    if (emailRaw && !/\S+@\S+\.\S+/.test(emailRaw)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
    }
    const emailLower = emailRaw ? emailRaw.toLowerCase() : null;
    if (emailLower) {
      const dup = await prisma.employee.findFirst({
        where: { outsourcingClientId: clientId, email: emailLower },
      });
      if (dup) {
        return NextResponse.json(
          { error: 'An employee with this email already exists for this client.' },
          { status: 409 }
        );
      }
    }
    const client = await prisma.outsourcingClient.findUnique({
      where: { id: clientId },
      include: { departments: { select: { id: true } } },
    });
    const clientRecord = client as typeof client & { employeeNumberPrefix?: string | null };
    if (!client) {
      return NextResponse.json({ error: 'Client not found.' }, { status: 404 });
    }
    let employeeNumber = strField(body, 'employeeNumber');
    if (!employeeNumber?.trim()) {
      const prefix =
        clientRecord.employeeNumberPrefix?.trim() ||
        deriveEmployeePrefixFromName(client.name);
      employeeNumber = await allocateNextEmployeeNumber(prisma, clientId, prefix);
    }
    let departmentId: string | null = strField(body, 'departmentId');
    if (departmentId) {
      const ok = client.departments.some((d) => d.id === departmentId);
      if (!ok) departmentId = null;
    } else {
      departmentId = null;
    }
    const dateOfJoiningRaw = strField(body, 'dateOfJoining');
    const employmentStatus = (strField(body, 'employmentStatus') as
      | 'active'
      | 'probation'
      | 'on_leave'
      | 'suspended'
      | 'terminated'
      | null) ?? null;
    const managerEmployeeId = strField(body, 'managerEmployeeId');
    const costCenterCode = strField(body, 'costCenterCode');
    const costCenterName = strField(body, 'costCenterName');
    const attendancePolicyId = strField(body, 'attendancePolicyId');
    const leavePolicyId = strField(body, 'leavePolicyId');
    let dateOfJoining: Date | undefined;
    if (dateOfJoiningRaw) {
      const d = new Date(dateOfJoiningRaw);
      if (!Number.isNaN(d.getTime())) dateOfJoining = d;
    }
    const idNumberNorm = normalizeEmployeeNationalId(strField(body, 'idNumber'));
    if (idNumberNorm) {
      const idDup = await prisma.employee.findFirst({ where: { idNumber: idNumberNorm } });
      if (idDup) {
        return NextResponse.json(
          { error: 'An employee with this National ID already exists.' },
          { status: 409 }
        );
      }
    }
    assertEmployeeProfileCompleteness({
      firstName,
      lastName,
      idNumber: idNumberNorm,
      kraPin: strField(body, 'kraPin'),
      nssfNumber: strField(body, 'nssfNumber'),
      nhifNumber: strField(body, 'nhifNumber'),
      dateOfJoining: dateOfJoining ?? null,
      jobTitle: strField(body, 'jobTitle'),
      departmentId,
      costCenterCode,
    });
    const employee = await prisma.employee.create({
      data: {
        outsourcingClientId: clientId,
        departmentId: departmentId ?? undefined,
        employeeNumber,
        firstName,
        lastName,
        email: emailLower,
        phone: strField(body, 'phone') ?? undefined,
        idNumber: idNumberNorm ?? undefined,
        kraPin: strField(body, 'kraPin') ?? undefined,
        nssfNumber: strField(body, 'nssfNumber') ?? undefined,
        nhifNumber: strField(body, 'nhifNumber') ?? undefined,
        jobTitle: strField(body, 'jobTitle') ?? undefined,
        dateOfJoining: dateOfJoining ?? undefined,
        bankName: strField(body, 'bankName') ?? undefined,
        bankBranch: strField(body, 'bankBranch') ?? undefined,
        bankAccountNumber: strField(body, 'bankAccountNumber') ?? undefined,
        costCenterCode: costCenterCode ?? undefined,
        costCenterName: costCenterName ?? undefined,
        managerEmployeeId: managerEmployeeId ?? undefined,
        employmentStatus: employmentStatus ?? undefined,
        baseSalary:
          body.baseSalary != null && String(body.baseSalary).trim() !== ''
            ? new Decimal(Math.max(0, parseFloat(String(body.baseSalary).replace(/,/g, '')) || 0))
            : undefined,
      },
      include: {
        client: { select: { id: true, name: true } },
        department: { select: { id: true, name: true } },
      },
    });

    if (attendancePolicyId) {
      await prisma.attendancePolicyAssignment.create({
        data: {
          employeeId: employee.id,
          attendancePolicyId,
          effectiveFrom: new Date(),
        },
      }).catch(() => null);
    }
    if (leavePolicyId) {
      await prisma.leavePolicyAssignment.create({
        data: {
          employeeId: employee.id,
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
    await logAuditEvent({
      actor: { userId: user.id, email: user.email, name: user.name },
      action: 'employee.created',
      entityType: 'Employee',
      entityId: employee.id,
      route: 'POST /api/outsourcing/employees',
      metadata: { clientId: employee.outsourcingClientId, departmentId: employee.departmentId },
    });
    try {
      const hrUserIds = await getHrUserIds();
      await sendNotification({
        event: 'employee_created',
        recipientUserIds: hrUserIds,
        title: 'New employee',
        body: `${employee.firstName} ${employee.lastName} has been added as ${employee.jobTitle || 'staff'} in ${employee.department?.name || 'Unassigned'} department.`,
        href: `/dashboard/outsourcing/employees/${employee.id}`,
        priority: 'info',
        channel: 'in_app',
        metadata: { employeeId: employee.id },
      });
    } catch (err) {
      console.error('[notifications] Failed to send employee_created:', err);
    }
    await startWorkflowForEmployee({ employeeId: employee.id, type: 'ONBOARDING' }).catch((error) =>
      console.error('[onboarding] Failed to auto-start onboarding:', error),
    );

    const activeCount = await countBillableEmployees(clientId);
    void reportSeatUsageToControlPlane(activeCount);
    return NextResponse.json({
      id: employee.id,
      employeeNumber: employee.employeeNumber,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.email,
      clientId: employee.outsourcingClientId,
      clientName: employee.client.name,
      employmentStatus: employee.employmentStatus,
      managerEmployeeId: employee.managerEmployeeId,
      managerName: null,
      costCenterCode: employee.costCenterCode ?? null,
      costCenterName: employee.costCenterName ?? null,
      departmentId: employee.departmentId,
      departmentName: employee.department?.name ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes('outside active entity scope')) {
      return NextResponse.json({ error: msg }, { status: 403 });
    }
    const err = e as { code?: string; meta?: { target?: string[] } };
    if (err.code === 'P2002' && err.meta?.target?.includes('idNumber')) {
      return NextResponse.json(
        { error: 'An employee with this National ID already exists.' },
        { status: 409 }
      );
    }
    if (msg.includes('Unique constraint') && msg.includes('email')) {
      return NextResponse.json(
        { error: 'An employee with this email already exists.' },
        { status: 409 }
      );
    }
    if (msg.includes('Employee profile is incomplete.')) {
      return NextResponse.json({ error: msg }, { status: 400 });
    }
    console.error('[outsourcing/employees POST]', e);
    return NextResponse.json(
      { error: 'Failed to create employee', ...(process.env.NODE_ENV === 'development' && { detail: msg }) },
      { status: 500 }
    );
  }
}
