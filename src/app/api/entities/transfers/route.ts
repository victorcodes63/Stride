import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { forbiddenResponse, unauthorizedResponse } from '@/lib/demo-route-access';
import { isKnownEntityId } from '@/lib/entity-request';
import { logAuditEvent } from '@/lib/audit-events';

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

export async function POST(request: NextRequest) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (user.role !== 'admin' && user.staffUserType !== 'business_manager') {
    return forbiddenResponse('Only admins and business managers can transfer employees between entities.');
  }
  if (!process.env.DATABASE_URL) {
    return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
  }

  const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!payload) return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });

  const employeeId = asString(payload.employeeId);
  const targetEntityCodeRaw = asString(payload.targetEntityCode)?.toLowerCase();
  const transferReason = asString(payload.transferReason);
  const effectiveAtRaw = asString(payload.effectiveAt);

  if (!employeeId || !targetEntityCodeRaw) {
    return NextResponse.json(
      { error: 'employeeId and targetEntityCode are required.' },
      { status: 400 },
    );
  }
  if (!isKnownEntityId(targetEntityCodeRaw)) {
    return NextResponse.json({ error: 'targetEntityCode must be one of: ke, ug.' }, { status: 400 });
  }
  const effectiveAt = effectiveAtRaw ? new Date(effectiveAtRaw) : new Date();
  if (Number.isNaN(effectiveAt.getTime())) {
    return NextResponse.json({ error: 'effectiveAt must be a valid ISO datetime.' }, { status: 400 });
  }

  const sourceEmployee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: {
      client: { select: { id: true, entityCode: true, name: true } },
      department: { select: { id: true, name: true } },
    },
  });
  if (!sourceEmployee) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });

  const sourceEntityCode = sourceEmployee.client.entityCode?.toLowerCase();
  if (!isKnownEntityId(sourceEntityCode)) {
    return NextResponse.json(
      { error: 'Source employee client is missing valid entityCode. Set entityCode first.' },
      { status: 409 },
    );
  }
  if (sourceEntityCode === targetEntityCodeRaw) {
    return NextResponse.json(
      { error: 'Employee is already assigned to the target entity.' },
      { status: 409 },
    );
  }

  const targetClient = await prisma.outsourcingClient.findFirst({
    where: { entityCode: targetEntityCodeRaw },
    select: { id: true, name: true, entityCode: true },
  });
  if (!targetClient) {
    return NextResponse.json(
      { error: `No outsourcing client configured for entity "${targetEntityCodeRaw}".` },
      { status: 404 },
    );
  }

  const transfer = await prisma.$transaction(async (tx) => {
    const updatedEmployee = await tx.employee.update({
      where: { id: sourceEmployee.id },
      data: {
        outsourcingClientId: targetClient.id,
        departmentId: null,
        employmentStatus: 'active',
        employmentEndedAt: null,
        employmentStatusEffectiveFrom: effectiveAt,
        employmentStatusEffectiveTo: null,
      },
      select: { id: true, outsourcingClientId: true, employmentStatus: true },
    });

    const transferRow = await tx.employeeEntityTransfer.create({
      data: {
        employeeId: sourceEmployee.id,
        sourceEmployeeId: sourceEmployee.id,
        sourceClientId: sourceEmployee.outsourcingClientId,
        sourceEntityCode,
        targetClientId: targetClient.id,
        targetEntityCode: targetEntityCodeRaw,
        effectiveAt,
        transferReason,
        initiatedByUserId: user.id,
        previousDepartmentId: sourceEmployee.departmentId,
        previousJobTitle: sourceEmployee.jobTitle,
        previousEmploymentStatus: sourceEmployee.employmentStatus,
        metadata: {
          sourceClientName: sourceEmployee.client.name,
          targetClientName: targetClient.name,
          reversibleByProcess: true,
        },
      },
      select: { id: true, createdAt: true },
    });

    return { updatedEmployee, transferRow };
  });

  await logAuditEvent({
    actor: { userId: user.id, email: user.email, name: user.name },
    action: 'entity.transfer.executed',
    entityType: 'EmployeeEntityTransfer',
    entityId: transfer.transferRow.id,
    route: 'POST /api/entities/transfers',
    metadata: {
      employeeId: sourceEmployee.id,
      sourceClientId: sourceEmployee.outsourcingClientId,
      sourceEntityCode,
      targetClientId: targetClient.id,
      targetEntityCode: targetEntityCodeRaw,
      effectiveAt: effectiveAt.toISOString(),
      reversibleByProcess: true,
    },
  });

  return NextResponse.json(
    {
      transferId: transfer.transferRow.id,
      employeeId: sourceEmployee.id,
      sourceEntityCode,
      targetEntityCode: targetEntityCodeRaw,
      targetClientId: targetClient.id,
      effectiveAt: effectiveAt.toISOString(),
      createdAt: transfer.transferRow.createdAt.toISOString(),
    },
    { status: 201 },
  );
}
