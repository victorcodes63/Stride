/**
 * Shared product JSON mapping + create/update field parsing (B1 costPrice/unit).
 */

import type { Prisma } from '@prisma/client';
import { syncProductToDefaultPriceBook } from '@/lib/sales/default-price-book';

export type ProductRow = {
  id: string;
  name: string;
  sku: string | null;
  category: string | null;
  description: string | null;
  unitPrice: Prisma.Decimal | number;
  costPrice?: Prisma.Decimal | number | null;
  unit?: string | null;
  currency: string;
  isRecurring: boolean;
  defaultTermMonths: number | null;
  active: boolean;
  createdAt: Date;
  updatedAt: Date;
  _count?: { dealLineItems: number; quoteLineItems: number };
};

export function mapProductToJson(
  p: ProductRow,
  options?: { includeCost?: boolean },
) {
  const unitPrice = Number(p.unitPrice);
  const costPrice =
    p.costPrice != null && Number.isFinite(Number(p.costPrice)) ? Number(p.costPrice) : null;
  const base = {
    id: p.id,
    name: p.name,
    sku: p.sku,
    category: p.category,
    description: p.description,
    unitPrice,
    unit: p.unit ?? null,
    currency: p.currency,
    isRecurring: p.isRecurring,
    defaultTermMonths: p.defaultTermMonths,
    active: p.active,
    usageCount: p._count ? p._count.dealLineItems + p._count.quoteLineItems : undefined,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
  if (!options?.includeCost) return base;
  return {
    ...base,
    costPrice,
    margin: costPrice != null ? Math.round((unitPrice - costPrice) * 100) / 100 : null,
  };
}

export async function afterProductWrite(
  tx: Prisma.TransactionClient,
  organizationId: string,
  product: { id: string; unitPrice: Prisma.Decimal | number; currency?: string | null },
) {
  await syncProductToDefaultPriceBook(tx, organizationId, product);
}
