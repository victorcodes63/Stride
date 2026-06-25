import { logAuditEvent } from '@/lib/audit-events';

export type SensitiveAccessActor = {
  userId?: string | null;
  email?: string | null;
  name?: string | null;
};

/** Audit log for reads of payroll, bank, ID, or credential data. */
export async function logSensitiveFieldAccess(input: {
  actor: SensitiveAccessActor;
  fieldGroup: 'payslip' | 'bank_details' | 'national_id' | 'payroll_run' | 'employee_pii';
  entityType: string;
  entityId?: string | null;
  route: string;
  metadata?: Record<string, unknown>;
}) {
  await logAuditEvent({
    actor: {
      userId: input.actor.userId ?? null,
      email: input.actor.email ?? null,
      name: input.actor.name ?? null,
    },
    action: `sensitive.${input.fieldGroup}.access`,
    entityType: input.entityType,
    entityId: input.entityId ?? undefined,
    route: input.route,
    metadata: input.metadata,
  });
}
