/**
 * Product UOM helpers — convert order qty in pack UOM to base stock units.
 */

import type { Prisma } from '@prisma/client';

export async function getProductUomFactor(
  tx: Prisma.TransactionClient,
  productId: string,
  uom: string,
): Promise<number> {
  const row = await tx.salesProductUom.findFirst({
    where: { productId, uom },
    select: { toBaseFactor: true },
  });
  if (row) return Number(row.toBaseFactor) || 1;
  const product = await tx.salesProduct.findFirst({
    where: { id: productId },
    select: { baseUom: true },
  });
  if (product && (uom === product.baseUom || uom === 'each')) return 1;
  return 1;
}

export async function qtyToBase(
  tx: Prisma.TransactionClient,
  productId: string | null | undefined,
  uom: string,
  qty: number,
): Promise<number> {
  if (!productId) return qty;
  const factor = await getProductUomFactor(tx, productId, uom);
  return qty * factor;
}

/** Ensure a product has at least a base UOM conversion row. */
export async function ensureBaseUomRow(
  tx: Prisma.TransactionClient,
  organizationId: string,
  product: { id: string; baseUom?: string | null; unit?: string | null },
) {
  const base = (product.baseUom || product.unit || 'each').trim() || 'each';
  await tx.salesProductUom.upsert({
    where: { productId_uom: { productId: product.id, uom: base } },
    create: {
      organizationId,
      productId: product.id,
      uom: base,
      toBaseFactor: 1,
      isDefaultOrderUom: true,
    },
    update: {},
  });
}
