import type { Prisma, PrismaClient } from '@prisma/client';
import type { TenantContext } from '@/lib/tenant-api';
import { resolvePrimaryWorkspaceClientId } from '@/lib/primary-workspace-client';

type Db = PrismaClient | Prisma.TransactionClient;

/** Only the tenant scope is needed from the context — kept narrow for testability. */
type BudgetCtx = Pick<TenantContext, 'organizationId'>;

export type BudgetAvailability = {
  budgetLineItemId: string;
  allocated: number;
  spent: number;
  committed: number;
  /** allocated − spent − committed (2dp). */
  available: number;
};

export type BudgetLineRequest = {
  budgetLineItemId?: string | null;
  amount: number;
};

export type BudgetBreach = {
  budgetLineItemId: string;
  requested: number;
  available: number;
};

export type BudgetCheckResult = {
  ok: boolean;
  breaches: BudgetBreach[];
};

export type BudgetCommitmentSource = 'purchase_request' | 'purchase_order';

export type ReserveCommitmentParams = {
  budgetLineItemId: string;
  sourceType: BudgetCommitmentSource;
  sourceId: string;
  sourceRef?: string | null;
  amount: number;
  createdByUserId?: string | null;
  /**
   * Tenant workspace scope for the commitment row. Optional — when omitted it is resolved via the
   * primary workspace client for the org (budgets themselves are org-scoped, but the commitment
   * ledger is org+workspace scoped like the rest of procurement).
   */
  outsourcingClientId?: string;
};

export type ReleaseCommitmentParams = {
  sourceType: BudgetCommitmentSource;
  sourceId: string;
};

function round2(n: number): number {
  return Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
}

/** Pure helper: available = allocated − spent − committed (2dp). Exported for unit testing. */
export function computeAvailable(allocated: number, spent: number, committed: number): number {
  return round2(allocated - spent - committed);
}

async function availabilityFor(
  tx: Db,
  organizationId: string,
  budgetLineItemId: string,
): Promise<BudgetAvailability> {
  const item = await tx.budgetLineItem.findFirst({
    where: { id: budgetLineItemId, organizationId },
    select: { allocatedAmount: true, spentAmount: true, committedAmount: true },
  });

  if (!item) {
    return { budgetLineItemId, allocated: 0, spent: 0, committed: 0, available: 0 };
  }

  const allocated = Number(item.allocatedAmount);
  const spent = Number(item.spentAmount);
  const committed = Number(item.committedAmount);
  return {
    budgetLineItemId,
    allocated,
    spent,
    committed,
    available: computeAvailable(allocated, spent, committed),
  };
}

/**
 * Return the live availability for a budget line item: allocated, spent, committed, and the
 * derived `available` (= allocated − spent − committed). Budgets are org-scoped in this schema, so
 * `outsourcingClientId` is accepted for contract symmetry but the lookup is by org + line id.
 */
export async function getBudgetAvailability(
  tx: Db,
  params: { organizationId: string; outsourcingClientId?: string; budgetLineItemId: string },
): Promise<BudgetAvailability> {
  return availabilityFor(tx, params.organizationId, params.budgetLineItemId);
}

/**
 * Check whether a set of request lines fits within remaining budget availability. Amounts are
 * aggregated per budget line item; lines without a `budgetLineItemId` are ignored. Returns
 * `ok: false` plus the offending lines when any budget would be exceeded — callers use this to
 * BLOCK approval (enforce-at-approval).
 */
export async function checkBudgetForRequest(
  tx: Db,
  ctx: BudgetCtx,
  lines: BudgetLineRequest[],
): Promise<BudgetCheckResult> {
  const totals = new Map<string, number>();
  for (const line of lines) {
    if (!line.budgetLineItemId) continue;
    const prev = totals.get(line.budgetLineItemId) ?? 0;
    totals.set(line.budgetLineItemId, round2(prev + Number(line.amount)));
  }

  const breaches: BudgetBreach[] = [];
  for (const [budgetLineItemId, requested] of totals) {
    const { available } = await availabilityFor(tx, ctx.organizationId, budgetLineItemId);
    if (requested > available) {
      breaches.push({ budgetLineItemId, requested, available });
    }
  }

  return { ok: breaches.length === 0, breaches };
}

/**
 * Reserve budget by creating an active `BudgetCommitment` and atomically incrementing the budget
 * line's `committedAmount`. Call inside the caller's transaction so the commitment and the rollup
 * commit together. Returns the created commitment.
 */
export async function reserveCommitment(
  tx: Db,
  ctx: BudgetCtx,
  params: ReserveCommitmentParams,
) {
  const outsourcingClientId =
    params.outsourcingClientId ??
    (await resolvePrimaryWorkspaceClientId(tx, null, null, ctx.organizationId));

  const amount = round2(Number(params.amount));

  const commitment = await tx.budgetCommitment.create({
    data: {
      organizationId: ctx.organizationId,
      outsourcingClientId,
      budgetLineItemId: params.budgetLineItemId,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      sourceRef: params.sourceRef ?? null,
      amount,
      status: 'active',
      createdByUserId: params.createdByUserId ?? null,
    },
  });

  await tx.budgetLineItem.update({
    where: { id: params.budgetLineItemId },
    data: { committedAmount: { increment: amount } },
  });

  return commitment;
}

function sumByLine(rows: { budgetLineItemId: string; amount: unknown }[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const row of rows) {
    const prev = totals.get(row.budgetLineItemId) ?? 0;
    totals.set(row.budgetLineItemId, round2(prev + Number(row.amount)));
  }
  return totals;
}

/**
 * Release active commitments for a source (e.g. on PR/PO cancel): flips them to `released` and
 * atomically decrements each affected budget line's `committedAmount`. Returns the count released.
 */
export async function releaseCommitment(
  tx: Db,
  ctx: BudgetCtx,
  params: ReleaseCommitmentParams,
): Promise<{ released: number }> {
  const active = await tx.budgetCommitment.findMany({
    where: {
      organizationId: ctx.organizationId,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      status: 'active',
    },
    select: { id: true, budgetLineItemId: true, amount: true },
  });

  if (active.length === 0) return { released: 0 };

  await tx.budgetCommitment.updateMany({
    where: { id: { in: active.map((c) => c.id) } },
    data: { status: 'released', releasedAt: new Date() },
  });

  for (const [budgetLineItemId, amount] of sumByLine(active)) {
    await tx.budgetLineItem.update({
      where: { id: budgetLineItemId },
      data: { committedAmount: { decrement: amount } },
    });
  }

  return { released: active.length };
}

/**
 * Consume active commitments for a source (e.g. when a PO is invoiced/received): flips them to
 * `consumed` and decrements `committedAmount`, because the amount is now (or will be) reflected in
 * `spentAmount`. NOTE: this helper does NOT touch `spentAmount` — increasing actual spend remains
 * the caller's / Finance's responsibility. Returns the count consumed.
 */
export async function consumeCommitment(
  tx: Db,
  ctx: BudgetCtx,
  params: ReleaseCommitmentParams,
): Promise<{ consumed: number }> {
  const active = await tx.budgetCommitment.findMany({
    where: {
      organizationId: ctx.organizationId,
      sourceType: params.sourceType,
      sourceId: params.sourceId,
      status: 'active',
    },
    select: { id: true, budgetLineItemId: true, amount: true },
  });

  if (active.length === 0) return { consumed: 0 };

  await tx.budgetCommitment.updateMany({
    where: { id: { in: active.map((c) => c.id) } },
    data: { status: 'consumed' },
  });

  for (const [budgetLineItemId, amount] of sumByLine(active)) {
    await tx.budgetLineItem.update({
      where: { id: budgetLineItemId },
      data: { committedAmount: { decrement: amount } },
    });
  }

  return { consumed: active.length };
}
