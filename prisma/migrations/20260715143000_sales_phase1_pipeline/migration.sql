-- Sales Phase 1: contacts, deal enrichment, activities, stage history.

CREATE TYPE "SalesForecastCategory" AS ENUM ('pipeline', 'best_case', 'commit', 'omitted');
CREATE TYPE "SalesDealActivityType" AS ENUM ('call', 'email', 'meeting', 'note', 'task');

CREATE TABLE "SalesContact" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "accountsClientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "isDecisionMaker" BOOLEAN NOT NULL DEFAULT false,
    "lastContactedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesContact_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SalesDealActivity" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "dealId" TEXT NOT NULL,
    "type" "SalesDealActivityType" NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT,
    "outcome" TEXT,
    "actorEmployeeId" TEXT NOT NULL,
    "contactId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesDealActivity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SalesDealStageHistory" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "dealId" TEXT NOT NULL,
    "fromStage" "SalesDealStage",
    "toStage" "SalesDealStage" NOT NULL,
    "changedByUserId" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesDealStageHistory_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "SalesDeal" ADD COLUMN "primaryContactId" TEXT;
ALTER TABLE "SalesDeal" ADD COLUMN "probability" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "SalesDeal" ADD COLUMN "forecastCategory" "SalesForecastCategory" NOT NULL DEFAULT 'pipeline';
ALTER TABLE "SalesDeal" ADD COLUMN "source" TEXT;
ALTER TABLE "SalesDeal" ADD COLUMN "nextStep" TEXT;
ALTER TABLE "SalesDeal" ADD COLUMN "nextStepDue" DATE;
ALTER TABLE "SalesDeal" ADD COLUMN "lostReason" TEXT;
ALTER TABLE "SalesDeal" ADD COLUMN "competitor" TEXT;

CREATE INDEX "SalesContact_organizationId_accountsClientId_idx" ON "SalesContact"("organizationId", "accountsClientId");
CREATE INDEX "SalesContact_organizationId_name_idx" ON "SalesContact"("organizationId", "name");

CREATE INDEX "SalesDealActivity_organizationId_dealId_createdAt_idx" ON "SalesDealActivity"("organizationId", "dealId", "createdAt" DESC);
CREATE INDEX "SalesDealActivity_organizationId_actorEmployeeId_idx" ON "SalesDealActivity"("organizationId", "actorEmployeeId");

CREATE INDEX "SalesDealStageHistory_organizationId_dealId_changedAt_idx" ON "SalesDealStageHistory"("organizationId", "dealId", "changedAt" DESC);
CREATE INDEX "SalesDealStageHistory_organizationId_changedAt_idx" ON "SalesDealStageHistory"("organizationId", "changedAt");

CREATE INDEX "SalesDeal_organizationId_accountsClientId_idx" ON "SalesDeal"("organizationId", "accountsClientId");
CREATE INDEX "SalesDeal_organizationId_forecastCategory_idx" ON "SalesDeal"("organizationId", "forecastCategory");

ALTER TABLE "SalesContact" ADD CONSTRAINT "SalesContact_accountsClientId_fkey" FOREIGN KEY ("accountsClientId") REFERENCES "AccountsClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SalesDeal" ADD CONSTRAINT "SalesDeal_primaryContactId_fkey" FOREIGN KEY ("primaryContactId") REFERENCES "SalesContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SalesDealActivity" ADD CONSTRAINT "SalesDealActivity_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "SalesDeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesDealActivity" ADD CONSTRAINT "SalesDealActivity_actorEmployeeId_fkey" FOREIGN KEY ("actorEmployeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesDealActivity" ADD CONSTRAINT "SalesDealActivity_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "SalesContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SalesDealStageHistory" ADD CONSTRAINT "SalesDealStageHistory_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "SalesDeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesDealStageHistory" ADD CONSTRAINT "SalesDealStageHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill probabilities from stage for existing deals
UPDATE "SalesDeal" SET "probability" = CASE "stage"
  WHEN 'lead' THEN 10
  WHEN 'qualified' THEN 25
  WHEN 'proposal' THEN 50
  WHEN 'negotiation' THEN 75
  WHEN 'won' THEN 100
  WHEN 'lost' THEN 0
  ELSE 10
END;

UPDATE "SalesDeal" SET "forecastCategory" = CASE "stage"
  WHEN 'won' THEN 'omitted'::"SalesForecastCategory"
  WHEN 'lost' THEN 'omitted'::"SalesForecastCategory"
  WHEN 'negotiation' THEN 'commit'::"SalesForecastCategory"
  WHEN 'proposal' THEN 'best_case'::"SalesForecastCategory"
  ELSE 'pipeline'::"SalesForecastCategory"
END;

-- RLS
ALTER TABLE "SalesContact" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SalesContact" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "SalesContact_tenant_rw" ON "SalesContact";
CREATE POLICY "SalesContact_tenant_rw" ON "SalesContact" FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "SalesContact_insert_bootstrap" ON "SalesContact";
CREATE POLICY "SalesContact_insert_bootstrap" ON "SalesContact" FOR INSERT WITH CHECK (coalesce(current_setting('app.current_org', true), '') = '' OR "organizationId" = current_setting('app.current_org', true)::uuid);

ALTER TABLE "SalesDealActivity" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SalesDealActivity" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "SalesDealActivity_tenant_rw" ON "SalesDealActivity";
CREATE POLICY "SalesDealActivity_tenant_rw" ON "SalesDealActivity" FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "SalesDealActivity_insert_bootstrap" ON "SalesDealActivity";
CREATE POLICY "SalesDealActivity_insert_bootstrap" ON "SalesDealActivity" FOR INSERT WITH CHECK (coalesce(current_setting('app.current_org', true), '') = '' OR "organizationId" = current_setting('app.current_org', true)::uuid);

ALTER TABLE "SalesDealStageHistory" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SalesDealStageHistory" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "SalesDealStageHistory_tenant_rw" ON "SalesDealStageHistory";
CREATE POLICY "SalesDealStageHistory_tenant_rw" ON "SalesDealStageHistory" FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "SalesDealStageHistory_insert_bootstrap" ON "SalesDealStageHistory";
CREATE POLICY "SalesDealStageHistory_insert_bootstrap" ON "SalesDealStageHistory" FOR INSERT WITH CHECK (coalesce(current_setting('app.current_org', true), '') = '' OR "organizationId" = current_setting('app.current_org', true)::uuid);
