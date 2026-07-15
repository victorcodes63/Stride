-- Sales Phase 2: roles enum values, line items, leads, forecast snapshots, cargo weight.
-- Idempotent for db-push-baselined Neon (P3005) and re-runs.

ALTER TYPE "StaffUserType" ADD VALUE IF NOT EXISTS 'sales_rep';
ALTER TYPE "StaffUserType" ADD VALUE IF NOT EXISTS 'sales_manager';

ALTER TABLE "SalesDeal" ADD COLUMN IF NOT EXISTS "cargoWeightKg" INTEGER;

DO $$ BEGIN
  CREATE TYPE "SalesLeadStatus" AS ENUM ('new', 'qualified', 'disqualified', 'converted');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "SalesDealLineItem" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "dealId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "termMonths" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesDealLineItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SalesLead" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "source" TEXT,
    "status" "SalesLeadStatus" NOT NULL DEFAULT 'new',
    "ownerEmployeeId" TEXT,
    "notes" TEXT,
    "convertedDealId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesLead_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SalesForecastSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "takenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "commitAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "bestCaseAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "pipelineAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "closedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "teamTarget" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "SalesForecastSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SalesLead_convertedDealId_key" ON "SalesLead"("convertedDealId");
CREATE INDEX IF NOT EXISTS "SalesDealLineItem_organizationId_dealId_idx" ON "SalesDealLineItem"("organizationId", "dealId");
CREATE INDEX IF NOT EXISTS "SalesLead_organizationId_status_idx" ON "SalesLead"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "SalesLead_organizationId_ownerEmployeeId_idx" ON "SalesLead"("organizationId", "ownerEmployeeId");
CREATE INDEX IF NOT EXISTS "SalesForecastSnapshot_organizationId_takenAt_idx" ON "SalesForecastSnapshot"("organizationId", "takenAt" DESC);
CREATE INDEX IF NOT EXISTS "SalesForecastSnapshot_organizationId_periodStart_periodEnd_idx" ON "SalesForecastSnapshot"("organizationId", "periodStart", "periodEnd");

DO $$ BEGIN
  ALTER TABLE "SalesDealLineItem" ADD CONSTRAINT "SalesDealLineItem_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "SalesDeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SalesLead" ADD CONSTRAINT "SalesLead_ownerEmployeeId_fkey" FOREIGN KEY ("ownerEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "SalesLead" ADD CONSTRAINT "SalesLead_convertedDealId_fkey" FOREIGN KEY ("convertedDealId") REFERENCES "SalesDeal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "SalesDealLineItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SalesDealLineItem" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "SalesDealLineItem_tenant_rw" ON "SalesDealLineItem";
CREATE POLICY "SalesDealLineItem_tenant_rw" ON "SalesDealLineItem" FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "SalesDealLineItem_insert_bootstrap" ON "SalesDealLineItem";
CREATE POLICY "SalesDealLineItem_insert_bootstrap" ON "SalesDealLineItem" FOR INSERT WITH CHECK (coalesce(current_setting('app.current_org', true), '') = '' OR "organizationId" = current_setting('app.current_org', true)::uuid);

ALTER TABLE "SalesLead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SalesLead" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "SalesLead_tenant_rw" ON "SalesLead";
CREATE POLICY "SalesLead_tenant_rw" ON "SalesLead" FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "SalesLead_insert_bootstrap" ON "SalesLead";
CREATE POLICY "SalesLead_insert_bootstrap" ON "SalesLead" FOR INSERT WITH CHECK (coalesce(current_setting('app.current_org', true), '') = '' OR "organizationId" = current_setting('app.current_org', true)::uuid);

ALTER TABLE "SalesForecastSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SalesForecastSnapshot" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "SalesForecastSnapshot_tenant_rw" ON "SalesForecastSnapshot";
CREATE POLICY "SalesForecastSnapshot_tenant_rw" ON "SalesForecastSnapshot" FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "SalesForecastSnapshot_insert_bootstrap" ON "SalesForecastSnapshot";
CREATE POLICY "SalesForecastSnapshot_insert_bootstrap" ON "SalesForecastSnapshot" FOR INSERT WITH CHECK (coalesce(current_setting('app.current_org', true), '') = '' OR "organizationId" = current_setting('app.current_org', true)::uuid);
