/**
 * B2 — Discount governance helpers.
 *
 * Effective discount = charged amount vs price-book list (header + line discounts /
 * overrides). Policy tiers decide whether send requires approval.
 */

import type { Prisma } from '@prisma/client';
import { resolvePriceBookUnitPrice } from '@/lib/sales/default-price-book';

type Tx = Prisma.TransactionClient;

export type ApprovalPolicyTier = Array<{
  maxDiscountPct: number;
  /** "none" | "manager" | "role:sales.admin" | … */
  approver: string;
}>;

/** Default ladder: ≤5% free, ≤15% manager, else sales.admin. Matches B2 accept criteria. */
export const DEFAULT_APPROVAL_POLICY_CONFIG: ApprovalPolicyTier = [
  { maxDiscountPct: 5, approver: 'none' },
  { maxDiscountPct: 15, approver: 'manager' },
  { maxDiscountPct: 100, approver: 'role:sales.admin' },
];

const round2 = (n: number) => Math.round(n * 100) / 100;

function lineMonths(isRecurring: boolean, termMonths: number | null): number {
  return isRecurring && termMonths && termMonths > 0 ? termMonths : 1;
}

export type QuoteLineForDiscount = {
  productId: string | null;
  quantity: number;
  unitPrice: number;
  discountPct: number;
  isRecurring: boolean;
  termMonths: number | null;
};

/**
 * Effective discount % vs price-book list totals.
 * Charged = line extended amounts after line discount, then header discount.
 */
export async function computeEffectiveDiscountPct(
  tx: Tx,
  organizationId: string,
  headerDiscountPct: number,
  lines: QuoteLineForDiscount[],
): Promise<{
  effectiveDiscountPct: number;
  listSubtotal: number;
  chargedAfterHeader: number;
}> {
  let listSubtotal = 0;
  let chargedSubtotal = 0;

  for (const li of lines) {
    const qty = Number.isFinite(li.quantity) && li.quantity > 0 ? li.quantity : 0;
    const months = lineMonths(li.isRecurring, li.termMonths);
    const lineDisc = Math.min(100, Math.max(0, Number(li.discountPct) || 0));
    const unit = Number(li.unitPrice) || 0;

    let listUnit = unit;
    if (li.productId) {
      const resolved = await resolvePriceBookUnitPrice(tx, organizationId, {
        productId: li.productId,
        quantity: qty || 1,
      });
      if (resolved) listUnit = resolved.unitPrice;
    }

    listSubtotal += qty * listUnit * months;
    chargedSubtotal += qty * unit * (1 - lineDisc / 100) * months;
  }

  listSubtotal = round2(listSubtotal);
  chargedSubtotal = round2(chargedSubtotal);
  const headerPct = Math.min(100, Math.max(0, headerDiscountPct));
  const chargedAfterHeader = round2(chargedSubtotal * (1 - headerPct / 100));

  if (listSubtotal <= 0) {
    return {
      effectiveDiscountPct: round2(headerPct),
      listSubtotal,
      chargedAfterHeader,
    };
  }

  const effectiveDiscountPct = round2(
    Math.max(0, Math.min(100, (1 - chargedAfterHeader / listSubtotal) * 100)),
  );
  return { effectiveDiscountPct, listSubtotal, chargedAfterHeader };
}

export function parsePolicyConfig(raw: unknown): ApprovalPolicyTier {
  if (!Array.isArray(raw) || raw.length === 0) return DEFAULT_APPROVAL_POLICY_CONFIG;
  const tiers: ApprovalPolicyTier = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const maxDiscountPct = Number((row as { maxDiscountPct?: unknown }).maxDiscountPct);
    const approver = String((row as { approver?: unknown }).approver ?? '').trim();
    if (!Number.isFinite(maxDiscountPct) || maxDiscountPct < 0 || !approver) continue;
    tiers.push({ maxDiscountPct, approver });
  }
  if (tiers.length === 0) return DEFAULT_APPROVAL_POLICY_CONFIG;
  return tiers.sort((a, b) => a.maxDiscountPct - b.maxDiscountPct);
}

/**
 * Find the first tier where effectiveDiscount ≤ maxDiscountPct.
 * Approval required when that tier's approver is not "none" (or no tier matches).
 */
export function resolveApprovalRequirement(
  effectiveDiscountPct: number,
  config: ApprovalPolicyTier,
): { requiresApproval: boolean; tier: ApprovalPolicyTier[number] | null } {
  const tiers = [...config].sort((a, b) => a.maxDiscountPct - b.maxDiscountPct);
  const tier = tiers.find((t) => effectiveDiscountPct <= t.maxDiscountPct) ?? null;
  if (!tier) {
    return { requiresApproval: true, tier: null };
  }
  const approver = tier.approver.trim().toLowerCase();
  if (approver === 'none') {
    return { requiresApproval: false, tier };
  }
  return { requiresApproval: true, tier };
}

/** Ensure one SalesApprovalPolicy per org (idempotent). */
export async function ensureApprovalPolicy(
  tx: Tx,
  organizationId: string,
): Promise<{ id: string; config: ApprovalPolicyTier; created: boolean }> {
  const existing = await tx.salesApprovalPolicy.findUnique({
    where: { organizationId },
  });
  if (existing) {
    return {
      id: existing.id,
      config: parsePolicyConfig(existing.config),
      created: false,
    };
  }
  const created = await tx.salesApprovalPolicy.create({
    data: {
      organizationId,
      config: DEFAULT_APPROVAL_POLICY_CONFIG as unknown as Prisma.InputJsonValue,
    },
  });
  return {
    id: created.id,
    config: DEFAULT_APPROVAL_POLICY_CONFIG,
    created: true,
  };
}

/**
 * Resolve who may approve a quote over threshold.
 *
 * TODO(Phase C): upgrade to team-leader resolution (deal owner's SalesTeam lead).
 * Until teams exist, any user holding sales.approve_quotes (or sales.admin / manager
 * staff type via hasSalesQuoteApproveAccess) may action the inbox.
 */
export function resolveQuoteApproverNote(): string {
  return 'v1: any holder of sales.approve_quotes; Phase C → team leader';
}

export async function backfillAllOrgsApprovalPolicies(
  tx: Tx,
): Promise<Array<{ organizationId: string; created: boolean }>> {
  const orgs = await tx.organization.findMany({ select: { id: true } });
  const results = [];
  for (const org of orgs) {
    const r = await ensureApprovalPolicy(tx, org.id);
    results.push({ organizationId: org.id, created: r.created });
  }
  return results;
}
