import type { Prisma, AssessmentProviderKey, AssessmentUsageType } from '@prisma/client';
import { withOrgContext } from '@/lib/org-context';

/** Record a metered assessment usage event (billing + quota enforcement). */
export async function recordUsage(
  organizationId: string,
  input: {
    type: AssessmentUsageType;
    provider?: AssessmentProviderKey | null;
    applicationId?: string | null;
    quantity?: number;
    unitCostCents?: number | null;
    currency?: string;
    metadata?: Record<string, unknown>;
    tx?: Prisma.TransactionClient;
  },
): Promise<void> {
  const data = {
    organizationId,
    type: input.type,
    provider: input.provider ?? null,
    applicationId: input.applicationId ?? null,
    quantity: input.quantity ?? 1,
    unitCostCents: input.unitCostCents ?? null,
    currency: input.currency ?? 'USD',
    metadata: (input.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
  };
  if (input.tx) {
    await input.tx.assessmentUsageEvent.create({ data });
    return;
  }
  await withOrgContext(organizationId, (tx) => tx.assessmentUsageEvent.create({ data }));
}

/** Monthly external-invite quota from env (0/unset = unlimited). */
function monthlyExternalLimit(): number {
  const raw = Number(process.env.ASSESSMENT_EXTERNAL_MONTHLY_LIMIT ?? 0);
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

export async function externalInviteQuotaReached(organizationId: string): Promise<boolean> {
  const limit = monthlyExternalLimit();
  if (limit === 0) return false;
  const start = new Date();
  start.setUTCDate(1);
  start.setUTCHours(0, 0, 0, 0);
  const used = await withOrgContext(organizationId, (tx) =>
    tx.assessmentUsageEvent.aggregate({
      where: { organizationId, type: 'external_invite', createdAt: { gte: start } },
      _sum: { quantity: true },
    }),
  );
  return (used._sum.quantity ?? 0) >= limit;
}

export type UsageSummary = {
  nativeAttempts: number;
  externalInvites: number;
  proctoringSnapshots: number;
  estimatedCostCents: number;
  byProvider: Array<{ provider: string; count: number }>;
};

export async function usageSummary(organizationId: string, sinceDays = 30): Promise<UsageSummary> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  return withOrgContext(organizationId, async (tx) => {
    const events = await tx.assessmentUsageEvent.findMany({
      where: { organizationId, createdAt: { gte: since } },
      select: { type: true, provider: true, quantity: true, unitCostCents: true },
    });
    const summary: UsageSummary = {
      nativeAttempts: 0,
      externalInvites: 0,
      proctoringSnapshots: 0,
      estimatedCostCents: 0,
      byProvider: [],
    };
    const providerCounts = new Map<string, number>();
    for (const e of events) {
      if (e.type === 'native_attempt') summary.nativeAttempts += e.quantity;
      else if (e.type === 'external_invite') summary.externalInvites += e.quantity;
      else if (e.type === 'proctoring_snapshot') summary.proctoringSnapshots += e.quantity;
      if (e.unitCostCents) summary.estimatedCostCents += e.unitCostCents * e.quantity;
      if (e.provider) providerCounts.set(e.provider, (providerCounts.get(e.provider) ?? 0) + e.quantity);
    }
    summary.byProvider = [...providerCounts.entries()].map(([provider, count]) => ({ provider, count }));
    return summary;
  });
}
