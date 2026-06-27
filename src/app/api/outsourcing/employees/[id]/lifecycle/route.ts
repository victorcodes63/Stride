import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { Prisma as PrismaRuntime } from '@prisma/client';
import { forbiddenResponse } from '@/lib/demo-route-access';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';
import {
  EMPLOYEE_LIFECYCLE_EVENTS,
  type EmployeeLifecycleEventType,
} from '@/lib/hr-core-employee';
import { startWorkflowForEmployee } from '@/lib/onboarding-workflows';
import { withTenant } from '@/lib/tenant-api';

function asString(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function nextStatusForEvent(eventType: EmployeeLifecycleEventType) {
  switch (eventType) {
    case 'hire':
      return 'probation';
    case 'confirmation':
    case 'promotion':
    case 'transfer':
      return 'active';
    case 'suspension':
      return 'suspended';
    case 'separation':
      return 'terminated';
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    if (ctx.staff.role !== 'admin' && ctx.staff.staffUserType !== 'business_manager') {
      return forbiddenResponse('Only admins and business managers can perform employee lifecycle actions.');
    }
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'Database not configured.' }, { status: 503 });
    }

    const { id } = await params;
    const payload = (await request.json().catch(() => null)) as Record<string, unknown> | null;
    if (!payload) return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });

    const eventTypeRaw = asString(payload.eventType)?.toLowerCase() as EmployeeLifecycleEventType | undefined;
    if (!eventTypeRaw || !EMPLOYEE_LIFECYCLE_EVENTS.includes(eventTypeRaw)) {
      return NextResponse.json(
        { error: 'eventType is required and must be a supported lifecycle event.' },
        { status: 400 },
      );
    }

    const effectiveDateRaw = asString(payload.effectiveDate);
    const effectiveDate = effectiveDateRaw ? new Date(effectiveDateRaw) : new Date();
    if (Number.isNaN(effectiveDate.getTime())) {
      return NextResponse.json({ error: 'effectiveDate must be a valid date.' }, { status: 400 });
    }

    const toStatus = nextStatusForEvent(eventTypeRaw);
    const toJobTitle = asString(payload.toJobTitle);
    const toDepartmentId = asString(payload.toDepartmentId);
    const reason = asString(payload.reason);
    const notes = asString(payload.notes);

    const outcome = await ctx.run(async (tx) => {
      const workspaceId = await resolvePrimaryWorkspaceClientId(tx, null, request, ctx.organizationId);
      const employee = await tx.employee.findFirst({
        where: ctx.where({ id, outsourcingClientId: workspaceId }),
        select: {
          id: true,
          outsourcingClientId: true,
          jobTitle: true,
          departmentId: true,
          employmentStatus: true,
        },
      });
      if (!employee) return null;

      const updatedEmployee = await tx.employee.update({
        where: { id: employee.id },
        data: {
          employmentStatus: toStatus,
          employmentStatusEffectiveFrom: effectiveDate,
          employmentEndedAt: eventTypeRaw === 'separation' ? effectiveDate : null,
          ...(toJobTitle ? { jobTitle: toJobTitle } : {}),
          ...(toDepartmentId !== null ? { departmentId: toDepartmentId } : {}),
        },
        select: {
          id: true,
          employmentStatus: true,
          jobTitle: true,
          departmentId: true,
        },
      });

      const lifecycleEvent = await tx.employeeLifecycleEvent.create({
        data: {
          organizationId: ctx.organizationId,
          employeeId: employee.id,
          outsourcingClientId: employee.outsourcingClientId,
          eventType: eventTypeRaw,
          effectiveDate,
          reason,
          notes,
          fromJobTitle: employee.jobTitle,
          toJobTitle: updatedEmployee.jobTitle,
          fromDepartmentId: employee.departmentId,
          toDepartmentId: updatedEmployee.departmentId,
          fromEmploymentStatus: employee.employmentStatus,
          toEmploymentStatus: updatedEmployee.employmentStatus,
          actedByUserId: ctx.staff.id,
          metadata:
            payload.metadata == null
              ? PrismaRuntime.JsonNull
              : (payload.metadata as Prisma.InputJsonValue),
        },
      });

      return { employee, updatedEmployee, lifecycleEvent };
    });

    if (!outcome) return NextResponse.json({ error: 'Employee not found.' }, { status: 404 });

    await ctx.audit({
      action: 'employee.lifecycle.action',
      entityType: 'EmployeeLifecycleEvent',
      entityId: outcome.lifecycleEvent.id,
      route: 'POST /api/outsourcing/employees/[id]/lifecycle',
      metadata: {
        employeeId: outcome.employee.id,
        eventType: eventTypeRaw,
        fromStatus: outcome.employee.employmentStatus,
        toStatus: outcome.updatedEmployee.employmentStatus,
        effectiveDate: effectiveDate.toISOString().slice(0, 10),
        reason,
      },
    });

    if (eventTypeRaw === 'separation') {
      await startWorkflowForEmployee({ employeeId: outcome.employee.id, type: 'OFFBOARDING' }).catch(
        (error) =>
          console.error('[onboarding] Failed to auto-start offboarding from lifecycle separation:', error),
      );
    }

    return NextResponse.json(
      {
        id: outcome.lifecycleEvent.id,
        employeeId: outcome.employee.id,
        eventType: eventTypeRaw,
        effectiveDate: effectiveDate.toISOString().slice(0, 10),
        toStatus: outcome.updatedEmployee.employmentStatus,
      },
      { status: 201 },
    );
  });
}
