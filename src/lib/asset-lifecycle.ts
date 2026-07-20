import type {
  AssetAssignmentEventType,
  AssetStatus,
  Prisma,
} from '@prisma/client';

type EventInput = {
  organizationId: string;
  companyAssetId: string;
  eventType: AssetAssignmentEventType;
  employeeId?: string | null;
  fromEmployeeId?: string | null;
  performedByUserId?: string | null;
  fromStatus?: AssetStatus | null;
  toStatus?: AssetStatus | null;
  notes?: string | null;
};

export async function recordAssetAssignmentEvent(
  tx: Prisma.TransactionClient,
  input: EventInput,
) {
  return tx.assetAssignmentEvent.create({
    data: {
      organizationId: input.organizationId,
      companyAssetId: input.companyAssetId,
      eventType: input.eventType,
      employeeId: input.employeeId ?? undefined,
      fromEmployeeId: input.fromEmployeeId ?? undefined,
      performedByUserId: input.performedByUserId ?? undefined,
      fromStatus: input.fromStatus ?? undefined,
      toStatus: input.toStatus ?? undefined,
      notes: input.notes ?? undefined,
    },
  });
}

export const assetEventInclude = {
  employee: {
    select: {
      firstName: true,
      lastName: true,
      employeeNumber: true,
    },
  },
  fromEmployee: {
    select: {
      firstName: true,
      lastName: true,
      employeeNumber: true,
    },
  },
  performedByUser: { select: { name: true } },
} as const;

type AssetEventRecord = Prisma.AssetAssignmentEventGetPayload<{
  include: typeof assetEventInclude;
}>;

function employeeLabel(
  employee: { firstName: string; lastName: string; employeeNumber: string | null } | null,
) {
  if (!employee) return null;
  const name = `${employee.firstName} ${employee.lastName}`.trim();
  return employee.employeeNumber ? `${name} (${employee.employeeNumber})` : name;
}

export function assetEventToResponse(event: AssetEventRecord) {
  return {
    id: event.id,
    eventType: event.eventType,
    employeeId: event.employeeId,
    employeeLabel: employeeLabel(event.employee),
    fromEmployeeId: event.fromEmployeeId,
    fromEmployeeLabel: employeeLabel(event.fromEmployee),
    performedByUserName: event.performedByUser?.name ?? null,
    fromStatus: event.fromStatus,
    toStatus: event.toStatus,
    notes: event.notes,
    createdAt: event.createdAt.toISOString(),
  };
}
