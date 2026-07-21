-- B1 — Price books, product cost/unit, line priceOverridden
-- Data backfill (Standard book per org from product.unitPrice) mirrors A3.2:
-- run `npx tsx prisma/seed/sales-suite-b.ts` after migrate (idempotent).

ALTER TABLE "SalesProduct" ADD COLUMN IF NOT EXISTS "costPrice" DECIMAL(14,2);
ALTER TABLE "SalesProduct" ADD COLUMN IF NOT EXISTS "unit" TEXT;

ALTER TABLE "SalesDealLineItem" ADD COLUMN IF NOT EXISTS "priceOverridden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "SalesQuoteLineItem" ADD COLUMN IF NOT EXISTS "priceOverridden" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "SalesPriceBook" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesPriceBook_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SalesPriceBookEntry" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "priceBookId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "minQty" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesPriceBookEntry_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "SalesPriceBook_organizationId_idx" ON "SalesPriceBook"("organizationId");
CREATE INDEX IF NOT EXISTS "SalesPriceBook_organizationId_isDefault_idx" ON "SalesPriceBook"("organizationId", "isDefault");
CREATE UNIQUE INDEX IF NOT EXISTS "SalesPriceBookEntry_priceBookId_productId_minQty_key" ON "SalesPriceBookEntry"("priceBookId", "productId", "minQty");
CREATE INDEX IF NOT EXISTS "SalesPriceBookEntry_organizationId_productId_idx" ON "SalesPriceBookEntry"("organizationId", "productId");
CREATE INDEX IF NOT EXISTS "SalesPriceBookEntry_organizationId_priceBookId_idx" ON "SalesPriceBookEntry"("organizationId", "priceBookId");

DO $$ BEGIN
  ALTER TABLE "SalesPriceBookEntry" ADD CONSTRAINT "SalesPriceBookEntry_priceBookId_fkey"
    FOREIGN KEY ("priceBookId") REFERENCES "SalesPriceBook"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "SalesPriceBookEntry" ADD CONSTRAINT "SalesPriceBookEntry_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "SalesProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
