/**
 * B1 — Default "Standard" price book helpers.
 *
 * Idempotent: safe to re-run. Mirrors A3.2 ensureDefaultPipeline pattern.
 * Seeds each product's catalog unitPrice as minQty=1 entry on the default book.
 */

import type { Prisma } from '@prisma/client';

type Tx = Prisma.TransactionClient;

export const DEFAULT_PRICE_BOOK_NAME = 'Standard';

export type DefaultPriceBookBundle = {
  priceBookId: string;
  created: boolean;
};

/**
 * Ensure the org has one default "Standard" price book.
 * Idempotent: find by isDefault or name; create if missing; sync flags if drifted.
 */
export async function ensureDefaultPriceBook(
  tx: Tx,
  organizationId: string,
  options?: { currency?: string },
): Promise<DefaultPriceBookBundle> {
  const currency = options?.currency?.trim() || 'KES';

  let book = await tx.salesPriceBook.findFirst({
    where: {
      organizationId,
      archivedAt: null,
      OR: [{ isDefault: true }, { name: DEFAULT_PRICE_BOOK_NAME }],
    },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
  });

  let created = false;
  if (!book) {
    book = await tx.salesPriceBook.create({
      data: {
        organizationId,
        name: DEFAULT_PRICE_BOOK_NAME,
        isDefault: true,
        currency,
      },
    });
    created = true;
  } else if (!book.isDefault || book.name !== DEFAULT_PRICE_BOOK_NAME) {
    book = await tx.salesPriceBook.update({
      where: { id: book.id },
      data: {
        isDefault: true,
        ...(book.name !== DEFAULT_PRICE_BOOK_NAME ? { name: DEFAULT_PRICE_BOOK_NAME } : {}),
      },
    });
  }

  return { priceBookId: book.id, created };
}

/**
 * Upsert the minQty=1 entry for a product on the org's default price book
 * from the product's catalog unitPrice. Idempotent.
 */
export async function syncProductToDefaultPriceBook(
  tx: Tx,
  organizationId: string,
  product: { id: string; unitPrice: Prisma.Decimal | number; currency?: string | null },
): Promise<void> {
  const { priceBookId } = await ensureDefaultPriceBook(tx, organizationId, {
    currency: product.currency ?? undefined,
  });
  const unitPrice = Number(product.unitPrice);
  if (!Number.isFinite(unitPrice) || unitPrice < 0) return;

  const existing = await tx.salesPriceBookEntry.findFirst({
    where: { priceBookId, productId: product.id, minQty: 1 },
  });
  if (existing) {
    if (Number(existing.unitPrice) !== unitPrice) {
      await tx.salesPriceBookEntry.update({
        where: { id: existing.id },
        data: { unitPrice },
      });
    }
    return;
  }
  await tx.salesPriceBookEntry.create({
    data: {
      organizationId,
      priceBookId,
      productId: product.id,
      unitPrice,
      minQty: 1,
    },
  });
}

/**
 * Seed Standard book + minQty=1 entries for every product in the org.
 * Skips products that already have a minQty=1 entry on the default book.
 */
export async function backfillOrgDefaultPriceBook(
  tx: Tx,
  organizationId: string,
): Promise<{ bookCreated: boolean; entriesCreated: number; entriesAlreadySynced: number }> {
  const { priceBookId, created: bookCreated } = await ensureDefaultPriceBook(tx, organizationId);

  const products = await tx.salesProduct.findMany({
    where: { organizationId },
    select: { id: true, unitPrice: true, currency: true },
  });

  let entriesCreated = 0;
  let entriesAlreadySynced = 0;

  for (const product of products) {
    const existing = await tx.salesPriceBookEntry.findFirst({
      where: { priceBookId, productId: product.id, minQty: 1 },
      select: { id: true },
    });
    if (existing) {
      entriesAlreadySynced += 1;
      continue;
    }
    await tx.salesPriceBookEntry.create({
      data: {
        organizationId,
        priceBookId,
        productId: product.id,
        unitPrice: product.unitPrice,
        minQty: 1,
      },
    });
    entriesCreated += 1;
  }

  return { bookCreated, entriesCreated, entriesAlreadySynced };
}

export async function backfillAllOrgsDefaultPriceBooks(
  tx: Tx,
): Promise<
  Array<{
    organizationId: string;
    bookCreated: boolean;
    entriesCreated: number;
    entriesAlreadySynced: number;
  }>
> {
  const orgs = await tx.organization.findMany({ select: { id: true } });
  const results = [];
  for (const org of orgs) {
    const r = await backfillOrgDefaultPriceBook(tx, org.id);
    results.push({ organizationId: org.id, ...r });
  }
  return results;
}

/**
 * Resolve unit price from a price book: highest minQty ≤ quantity.
 * Falls back to org default book when priceBookId omitted.
 */
export async function resolvePriceBookUnitPrice(
  tx: Tx,
  organizationId: string,
  params: {
    productId: string;
    quantity: number;
    priceBookId?: string | null;
  },
): Promise<{ unitPrice: number; priceBookId: string; minQty: number } | null> {
  const qty = Number.isFinite(params.quantity) && params.quantity > 0 ? params.quantity : 1;

  let priceBookId = params.priceBookId?.trim() || null;
  if (priceBookId) {
    const book = await tx.salesPriceBook.findFirst({
      where: { id: priceBookId, organizationId, archivedAt: null },
      select: { id: true },
    });
    if (!book) return null;
  } else {
    const ensured = await ensureDefaultPriceBook(tx, organizationId);
    priceBookId = ensured.priceBookId;
  }

  const entries = await tx.salesPriceBookEntry.findMany({
    where: {
      organizationId,
      priceBookId,
      productId: params.productId,
      minQty: { lte: Math.floor(qty) },
    },
    orderBy: { minQty: 'desc' },
    take: 1,
  });

  const hit = entries[0];
  if (!hit) return null;
  return {
    unitPrice: Number(hit.unitPrice),
    priceBookId,
    minQty: hit.minQty,
  };
}

const PRICE_EPS = 0.005;

/**
 * Resolve line unitPrice + priceOverridden flag for deal/quote line creates.
 */
export async function resolveLineUnitPrice(
  tx: Tx,
  organizationId: string,
  params: {
    productId: string | null;
    quantity: number;
    priceBookId?: string | null;
    /** Explicit unit price from the client (may be override). */
    unitPrice?: number | null;
    /** Force override flag when client sets it. */
    priceOverridden?: boolean;
    /** Catalog fallback when no book entry (product.unitPrice). */
    catalogUnitPrice?: number | null;
  },
): Promise<{ unitPrice: number; priceOverridden: boolean; listPrice: number | null }> {
  let listPrice: number | null = null;
  if (params.productId) {
    const resolved = await resolvePriceBookUnitPrice(tx, organizationId, {
      productId: params.productId,
      quantity: params.quantity,
      priceBookId: params.priceBookId,
    });
    if (resolved) listPrice = resolved.unitPrice;
  }
  if (listPrice == null && params.catalogUnitPrice != null && Number.isFinite(params.catalogUnitPrice)) {
    listPrice = params.catalogUnitPrice;
  }

  const hasExplicit =
    params.unitPrice != null && Number.isFinite(params.unitPrice) && params.unitPrice >= 0;

  if (hasExplicit) {
    const unitPrice = params.unitPrice as number;
    const priceOverridden =
      params.priceOverridden === true ||
      (listPrice != null && Math.abs(unitPrice - listPrice) > PRICE_EPS);
    return { unitPrice, priceOverridden, listPrice };
  }

  const unitPrice = listPrice ?? 0;
  return { unitPrice, priceOverridden: false, listPrice };
}
