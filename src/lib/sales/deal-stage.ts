import type { Prisma } from '@prisma/client';
import {
  defaultForecastForStage,
  defaultProbabilityForStage,
  type SalesDealStage,
} from '@/lib/sales/schema';

type Tx = Prisma.TransactionClient;

export type MoveDealStageInput = {
  organizationId: string;
  dealId: string;
  toStage: SalesDealStage;
  changedByUserId?: string | null;
  /** When set, keep custom probability; otherwise apply stage default. */
  probability?: number | null;
  lostReason?: string | null;
  competitor?: string | null;
};

/**
 * Updates deal stage, writes stage history, applies default probability/forecast
 * unless probability is explicitly provided.
 */
export async function moveDealStage(tx: Tx, input: MoveDealStageInput) {
  const existing = await tx.salesDeal.findFirst({
    where: { id: input.dealId, organizationId: input.organizationId },
  });
  if (!existing) return null;

  const fromStage = existing.stage as SalesDealStage;
  const toStage = input.toStage;
  if (fromStage === toStage) return existing;

  const probability =
    input.probability != null && Number.isFinite(input.probability)
      ? Math.min(100, Math.max(0, Math.round(input.probability)))
      : defaultProbabilityForStage(toStage);

  const updated = await tx.salesDeal.update({
    where: { id: existing.id },
    data: {
      stage: toStage,
      probability,
      forecastCategory: defaultForecastForStage(toStage),
      closedAt: toStage === 'won' || toStage === 'lost' ? existing.closedAt ?? new Date() : null,
      ...(toStage === 'lost'
        ? {
            lostReason: input.lostReason ?? existing.lostReason,
            competitor: input.competitor ?? existing.competitor,
          }
        : {}),
    },
  });

  await tx.salesDealStageHistory.create({
    data: {
      organizationId: input.organizationId,
      dealId: existing.id,
      fromStage,
      toStage,
      changedByUserId: input.changedByUserId ?? null,
    },
  });

  return updated;
}
