import type { Prisma, PrismaClient } from '@prisma/client';

type Db = PrismaClient | Prisma.TransactionClient;

/** Shape of an approval policy row used by the resolver (kept minimal for testability). */
export type ApprovalPolicyInput = {
  stepOrder: number;
  minAmount: number;
  maxAmount: number | null;
  approverRole: string | null;
  approverUserId: string | null;
  active: boolean;
};

/** Ordered, ready-to-create approval step (no ids / timestamps). */
export type ApprovalStepPlan = {
  stepOrder: number;
  approverUserId: string | null;
  approverRole: string | null;
  status: 'pending';
};

/** Minimal PR shape needed to build approval steps. */
export type ApprovalRequestInput = {
  organizationId: string;
  outsourcingClientId: string;
  totalAmount: number;
};

/** Default role used when no approval policy is configured for the tenant. */
export const DEFAULT_APPROVER_ROLE = 'procurement_manager';

/**
 * Pure resolver: given the tenant's approval policies and a request amount, return the ordered
 * approval steps to create. Policies whose `[minAmount, maxAmount]` band contains the amount are
 * selected (maxAmount null = unbounded upper). Falls back to a single manager step when nothing
 * matches. Exported separately so it can be unit-tested without a database.
 */
export function resolveApprovalSteps(
  policies: ApprovalPolicyInput[],
  amount: number,
): ApprovalStepPlan[] {
  const matching = policies
    .filter((p) => p.active)
    .filter((p) => amount >= p.minAmount && (p.maxAmount == null || amount <= p.maxAmount))
    .sort((a, b) => a.stepOrder - b.stepOrder);

  if (matching.length === 0) {
    return [
      {
        stepOrder: 1,
        approverUserId: null,
        approverRole: DEFAULT_APPROVER_ROLE,
        status: 'pending',
      },
    ];
  }

  // Re-number sequentially (1..n) so the persisted stepOrder is always gap-free and unique.
  return matching.map((p, index) => ({
    stepOrder: index + 1,
    approverUserId: p.approverUserId,
    approverRole: p.approverRole,
    status: 'pending' as const,
  }));
}

/**
 * Read the tenant's `ProcurementApprovalPolicy` rows and compute the ordered approval steps for a
 * given purchase request amount. Returns the step plans (not persisted). Callers create the
 * `PurchaseRequestApprovalStep` rows themselves so they can attach ids/scope inside their own tx.
 */
export async function buildApprovalStepsForRequest(
  tx: Db,
  purchaseRequest: ApprovalRequestInput,
): Promise<ApprovalStepPlan[]> {
  const policies = await tx.procurementApprovalPolicy.findMany({
    where: {
      organizationId: purchaseRequest.organizationId,
      outsourcingClientId: purchaseRequest.outsourcingClientId,
      active: true,
    },
    select: {
      stepOrder: true,
      minAmount: true,
      maxAmount: true,
      approverRole: true,
      approverUserId: true,
      active: true,
    },
  });

  const normalized: ApprovalPolicyInput[] = policies.map((p) => ({
    stepOrder: p.stepOrder,
    minAmount: Number(p.minAmount),
    maxAmount: p.maxAmount == null ? null : Number(p.maxAmount),
    approverRole: p.approverRole,
    approverUserId: p.approverUserId,
    active: p.active,
  }));

  return resolveApprovalSteps(normalized, Number(purchaseRequest.totalAmount));
}
