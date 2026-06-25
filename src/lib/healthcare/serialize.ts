import type { HealthcareClinicalAssignment, HealthcareWard } from '@prisma/client';

export function serializeWard(ward: HealthcareWard) {
  const requiredCredentials = Array.isArray(ward.requiredCredentials)
    ? ward.requiredCredentials
    : [];

  return {
    id: ward.id,
    code: ward.code,
    name: ward.name,
    requiredCredentials,
    minRestHours: ward.minRestHours,
    isActive: ward.isActive,
  };
}

export function serializeClinicalAssignment(
  row: HealthcareClinicalAssignment & {
    ward?: HealthcareWard;
    employee?: { firstName: string; lastName: string; employeeNumber: string | null };
  },
) {
  return {
    id: row.id,
    wardId: row.wardId,
    wardCode: row.ward?.code ?? null,
    wardName: row.ward?.name ?? null,
    employeeId: row.employeeId,
    employeeName: row.employee
      ? `${row.employee.firstName} ${row.employee.lastName}`.trim()
      : null,
    employeeNumber: row.employee?.employeeNumber ?? null,
    clinicalRole: row.clinicalRole,
    workDate: row.workDate.toISOString().slice(0, 10),
    startsAt: row.startsAt.toISOString(),
    endsAt: row.endsAt.toISOString(),
    licenseOk: row.licenseOk,
    licenseWarnings: Array.isArray(row.licenseWarnings) ? row.licenseWarnings : [],
    shiftAssignmentId: row.shiftAssignmentId,
    notes: row.notes,
  };
}
