-- FMCG Sales OTC spine (P0–P3): credit, UOM, teams, orders, inventory, RTM, trade, EDI

-- ========== P0: AccountsClient credit / tier ==========
ALTER TABLE "AccountsClient" ADD COLUMN IF NOT EXISTS "creditLimit" DECIMAL(14,2);
ALTER TABLE "AccountsClient" ADD COLUMN IF NOT EXISTS "creditHold" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "AccountsClient" ADD COLUMN IF NOT EXISTS "accountTier" TEXT;
ALTER TABLE "AccountsClient" ADD COLUMN IF NOT EXISTS "channelType" TEXT;
ALTER TABLE "AccountsClient" ADD COLUMN IF NOT EXISTS "parentClientId" TEXT;
ALTER TABLE "AccountsClient" ADD COLUMN IF NOT EXISTS "outletCode" TEXT;
ALTER TABLE "AccountsClient" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "AccountsClient" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

DO $$ BEGIN
  ALTER TABLE "AccountsClient" ADD CONSTRAINT "AccountsClient_parentClientId_fkey"
    FOREIGN KEY ("parentClientId") REFERENCES "AccountsClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "AccountsClient_organizationId_channelType_idx" ON "AccountsClient"("organizationId", "channelType");
CREATE INDEX IF NOT EXISTS "AccountsClient_organizationId_parentClientId_idx" ON "AccountsClient"("organizationId", "parentClientId");

-- ========== P0: Product UOM ==========
ALTER TABLE "SalesProduct" ADD COLUMN IF NOT EXISTS "baseUom" TEXT NOT NULL DEFAULT 'each';

CREATE TABLE IF NOT EXISTS "SalesProductUom" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "productId" TEXT NOT NULL,
    "uom" TEXT NOT NULL,
    "toBaseFactor" DECIMAL(14,6) NOT NULL DEFAULT 1,
    "isDefaultOrderUom" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesProductUom_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SalesProductUom_productId_uom_key" ON "SalesProductUom"("productId", "uom");
CREATE INDEX IF NOT EXISTS "SalesProductUom_organizationId_productId_idx" ON "SalesProductUom"("organizationId", "productId");

DO $$ BEGIN
  ALTER TABLE "SalesProductUom" ADD CONSTRAINT "SalesProductUom_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "SalesProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "SalesPriceBook" ADD COLUMN IF NOT EXISTS "accountsClientId" TEXT;
DO $$ BEGIN
  ALTER TABLE "SalesPriceBook" ADD CONSTRAINT "SalesPriceBook_accountsClientId_fkey"
    FOREIGN KEY ("accountsClientId") REFERENCES "AccountsClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "SalesPriceBook_organizationId_accountsClientId_idx" ON "SalesPriceBook"("organizationId", "accountsClientId");

ALTER TABLE "SalesPriceBookEntry" ADD COLUMN IF NOT EXISTS "uom" TEXT;

-- ========== P0: Sales teams ==========
CREATE TABLE IF NOT EXISTS "SalesTeam" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesTeam_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SalesTeam_organizationId_idx" ON "SalesTeam"("organizationId");

CREATE TABLE IF NOT EXISTS "SalesTeamMember" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "teamId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesTeamMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SalesTeamMember_teamId_employeeId_key" ON "SalesTeamMember"("teamId", "employeeId");
CREATE INDEX IF NOT EXISTS "SalesTeamMember_organizationId_employeeId_idx" ON "SalesTeamMember"("organizationId", "employeeId");
DO $$ BEGIN
  ALTER TABLE "SalesTeamMember" ADD CONSTRAINT "SalesTeamMember_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "SalesTeam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SalesTeamMember" ADD CONSTRAINT "SalesTeamMember_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "SalesTarget" ADD COLUMN IF NOT EXISTS "teamId" TEXT;
ALTER TABLE "SalesTarget" ADD COLUMN IF NOT EXISTS "territoryId" TEXT;
DO $$ BEGIN
  ALTER TABLE "SalesTarget" ADD CONSTRAINT "SalesTarget_teamId_fkey"
    FOREIGN KEY ("teamId") REFERENCES "SalesTeam"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ========== P0: Deal buying-role contacts ==========
CREATE TABLE IF NOT EXISTS "SalesDealContact" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "dealId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'other',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesDealContact_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SalesDealContact_dealId_contactId_role_key" ON "SalesDealContact"("dealId", "contactId", "role");
CREATE INDEX IF NOT EXISTS "SalesDealContact_organizationId_dealId_idx" ON "SalesDealContact"("organizationId", "dealId");
DO $$ BEGIN
  ALTER TABLE "SalesDealContact" ADD CONSTRAINT "SalesDealContact_dealId_fkey"
    FOREIGN KEY ("dealId") REFERENCES "SalesDeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SalesDealContact" ADD CONSTRAINT "SalesDealContact_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "SalesContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ========== P1: Sales orders ==========
CREATE TABLE IF NOT EXISTS "SalesOrder" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "orderNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "accountsClientId" TEXT NOT NULL,
    "dealId" TEXT,
    "quoteId" TEXT,
    "ownerEmployeeId" TEXT,
    "priceBookId" TEXT,
    "facilitySiteId" TEXT,
    "fleetOrderId" TEXT,
    "accountsInvoiceId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "notes" TEXT,
    "publicStatusToken" TEXT,
    "confirmedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "invoicedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesOrder_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SalesOrder_organizationId_orderNumber_key" ON "SalesOrder"("organizationId", "orderNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "SalesOrder_publicStatusToken_key" ON "SalesOrder"("publicStatusToken");
CREATE INDEX IF NOT EXISTS "SalesOrder_organizationId_status_idx" ON "SalesOrder"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "SalesOrder_organizationId_accountsClientId_idx" ON "SalesOrder"("organizationId", "accountsClientId");

DO $$ BEGIN
  ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_accountsClientId_fkey"
    FOREIGN KEY ("accountsClientId") REFERENCES "AccountsClient"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_dealId_fkey"
    FOREIGN KEY ("dealId") REFERENCES "SalesDeal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_quoteId_fkey"
    FOREIGN KEY ("quoteId") REFERENCES "SalesQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_ownerEmployeeId_fkey"
    FOREIGN KEY ("ownerEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_priceBookId_fkey"
    FOREIGN KEY ("priceBookId") REFERENCES "SalesPriceBook"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_facilitySiteId_fkey"
    FOREIGN KEY ("facilitySiteId") REFERENCES "FacilitySite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_fleetOrderId_fkey"
    FOREIGN KEY ("fleetOrderId") REFERENCES "FleetOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SalesOrder" ADD CONSTRAINT "SalesOrder_accountsInvoiceId_fkey"
    FOREIGN KEY ("accountsInvoiceId") REFERENCES "AccountsInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "FleetOrder" ADD COLUMN IF NOT EXISTS "salesOrderId" TEXT;
DO $$ BEGIN
  ALTER TABLE "FleetOrder" ADD CONSTRAINT "FleetOrder_salesOrderId_fkey"
    FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS "FleetOrder_salesOrderId_idx" ON "FleetOrder"("salesOrderId");

CREATE TABLE IF NOT EXISTS "SalesOrderLine" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "uom" TEXT NOT NULL DEFAULT 'each',
    "qtyOrdered" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "qtyReserved" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "qtyShipped" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "qtyInvoiced" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesOrderLine_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SalesOrderLine_organizationId_orderId_idx" ON "SalesOrderLine"("organizationId", "orderId");
DO $$ BEGIN
  ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SalesOrderLine" ADD CONSTRAINT "SalesOrderLine_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "SalesProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "SalesReturn" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "orderId" TEXT NOT NULL,
    "accountsCreditNoteId" TEXT,
    "reason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesReturn_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SalesReturn_organizationId_orderId_idx" ON "SalesReturn"("organizationId", "orderId");
DO $$ BEGIN
  ALTER TABLE "SalesReturn" ADD CONSTRAINT "SalesReturn_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "SalesOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "SalesReturnLine" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "returnId" TEXT NOT NULL,
    "orderLineId" TEXT NOT NULL,
    "qtyReturned" DECIMAL(14,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesReturnLine_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "SalesReturnLine" ADD CONSTRAINT "SalesReturnLine_returnId_fkey"
    FOREIGN KEY ("returnId") REFERENCES "SalesReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SalesReturnLine" ADD CONSTRAINT "SalesReturnLine_orderLineId_fkey"
    FOREIGN KEY ("orderLineId") REFERENCES "SalesOrderLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ========== P1: Inventory ==========
CREATE TABLE IF NOT EXISTS "InventoryStock" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "facilitySiteId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qtyOnHand" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "qtyReserved" DECIMAL(14,4) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryStock_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "InventoryStock_facilitySiteId_productId_key" ON "InventoryStock"("facilitySiteId", "productId");
CREATE INDEX IF NOT EXISTS "InventoryStock_organizationId_productId_idx" ON "InventoryStock"("organizationId", "productId");
DO $$ BEGIN
  ALTER TABLE "InventoryStock" ADD CONSTRAINT "InventoryStock_facilitySiteId_fkey"
    FOREIGN KEY ("facilitySiteId") REFERENCES "FacilitySite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "InventoryStock" ADD CONSTRAINT "InventoryStock_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "SalesProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "InventoryMovement" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "facilitySiteId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "qtyBase" DECIMAL(14,4) NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryMovement_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "InventoryMovement_organizationId_facilitySiteId_idx" ON "InventoryMovement"("organizationId", "facilitySiteId");
CREATE INDEX IF NOT EXISTS "InventoryMovement_organizationId_productId_idx" ON "InventoryMovement"("organizationId", "productId");

CREATE TABLE IF NOT EXISTS "InventoryReservation" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "facilitySiteId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "salesOrderLineId" TEXT NOT NULL,
    "qtyBase" DECIMAL(14,4) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "InventoryReservation_organizationId_status_idx" ON "InventoryReservation"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "InventoryReservation_salesOrderLineId_idx" ON "InventoryReservation"("salesOrderLineId");
DO $$ BEGIN
  ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_salesOrderLineId_fkey"
    FOREIGN KEY ("salesOrderLineId") REFERENCES "SalesOrderLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ========== P2: Territory / beat ==========
CREATE TABLE IF NOT EXISTS "SalesTerritory" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesTerritory_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SalesTerritory_organizationId_idx" ON "SalesTerritory"("organizationId");

DO $$ BEGIN
  ALTER TABLE "SalesTarget" ADD CONSTRAINT "SalesTarget_territoryId_fkey"
    FOREIGN KEY ("territoryId") REFERENCES "SalesTerritory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "SalesTerritoryMember" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "territoryId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesTerritoryMember_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SalesTerritoryMember_territoryId_employeeId_key" ON "SalesTerritoryMember"("territoryId", "employeeId");
DO $$ BEGIN
  ALTER TABLE "SalesTerritoryMember" ADD CONSTRAINT "SalesTerritoryMember_territoryId_fkey"
    FOREIGN KEY ("territoryId") REFERENCES "SalesTerritory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SalesTerritoryMember" ADD CONSTRAINT "SalesTerritoryMember_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "SalesBeat" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "territoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "weekday" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesBeat_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SalesBeat_organizationId_territoryId_idx" ON "SalesBeat"("organizationId", "territoryId");
DO $$ BEGIN
  ALTER TABLE "SalesBeat" ADD CONSTRAINT "SalesBeat_territoryId_fkey"
    FOREIGN KEY ("territoryId") REFERENCES "SalesTerritory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "SalesBeatOutlet" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "beatId" TEXT NOT NULL,
    "accountsClientId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "SalesBeatOutlet_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "SalesBeatOutlet_beatId_accountsClientId_key" ON "SalesBeatOutlet"("beatId", "accountsClientId");
DO $$ BEGIN
  ALTER TABLE "SalesBeatOutlet" ADD CONSTRAINT "SalesBeatOutlet_beatId_fkey"
    FOREIGN KEY ("beatId") REFERENCES "SalesBeat"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SalesBeatOutlet" ADD CONSTRAINT "SalesBeatOutlet_accountsClientId_fkey"
    FOREIGN KEY ("accountsClientId") REFERENCES "AccountsClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ========== P2: Trade promotions ==========
CREATE TABLE IF NOT EXISTS "SalesPromotion" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "mechanic" TEXT NOT NULL DEFAULT 'off_invoice',
    "fundingPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "startsOn" DATE NOT NULL,
    "endsOn" DATE NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesPromotion_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SalesPromotion_organizationId_active_idx" ON "SalesPromotion"("organizationId", "active");

CREATE TABLE IF NOT EXISTS "SalesTradeClaim" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "promotionId" TEXT NOT NULL,
    "accountsClientId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "settledCreditNoteId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesTradeClaim_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SalesTradeClaim_organizationId_status_idx" ON "SalesTradeClaim"("organizationId", "status");
DO $$ BEGIN
  ALTER TABLE "SalesTradeClaim" ADD CONSTRAINT "SalesTradeClaim_promotionId_fkey"
    FOREIGN KEY ("promotionId") REFERENCES "SalesPromotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SalesTradeClaim" ADD CONSTRAINT "SalesTradeClaim_accountsClientId_fkey"
    FOREIGN KEY ("accountsClientId") REFERENCES "AccountsClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ========== P2: Van loads ==========
CREATE TABLE IF NOT EXISTS "SalesVanLoad" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "facilitySiteId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "employeeId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesVanLoad_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SalesVanLoad_organizationId_status_idx" ON "SalesVanLoad"("organizationId", "status");

CREATE TABLE IF NOT EXISTS "SalesVanLoadLine" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "vanLoadId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qtyBase" DECIMAL(14,4) NOT NULL,
    "qtySold" DECIMAL(14,4) NOT NULL DEFAULT 0,
    CONSTRAINT "SalesVanLoadLine_pkey" PRIMARY KEY ("id")
);
DO $$ BEGIN
  ALTER TABLE "SalesVanLoadLine" ADD CONSTRAINT "SalesVanLoadLine_vanLoadId_fkey"
    FOREIGN KEY ("vanLoadId") REFERENCES "SalesVanLoad"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "SalesVanLoadLine" ADD CONSTRAINT "SalesVanLoadLine_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "SalesProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ========== P3: EDI ==========
CREATE TABLE IF NOT EXISTS "SalesEdiMessage" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "direction" TEXT NOT NULL,
    "messageType" TEXT NOT NULL DEFAULT 'po',
    "status" TEXT NOT NULL DEFAULT 'received',
    "payload" JSONB NOT NULL,
    "salesOrderId" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SalesEdiMessage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "SalesEdiMessage_organizationId_status_idx" ON "SalesEdiMessage"("organizationId", "status");
DO $$ BEGIN
  ALTER TABLE "SalesEdiMessage" ADD CONSTRAINT "SalesEdiMessage_salesOrderId_fkey"
    FOREIGN KEY ("salesOrderId") REFERENCES "SalesOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Backfill base UOM row for existing products (idempotent)
INSERT INTO "SalesProductUom" ("id", "organizationId", "productId", "uom", "toBaseFactor", "isDefaultOrderUom", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, p."organizationId", p."id", COALESCE(NULLIF(p."baseUom", ''), 'each'), 1, true, NOW(), NOW()
FROM "SalesProduct" p
WHERE NOT EXISTS (
  SELECT 1 FROM "SalesProductUom" u WHERE u."productId" = p."id" AND u."uom" = COALESCE(NULLIF(p."baseUom", ''), 'each')
);
