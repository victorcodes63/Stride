-- SALES-01/02/05: Sales Performance module — targets, pipeline, actuals, commission rules.

CREATE TYPE "SalesTargetPeriodType" AS ENUM ('month', 'quarter', 'year');
CREATE TYPE "SalesTargetStatus" AS ENUM ('draft', 'pending_approval', 'approved');
CREATE TYPE "SalesDealStage" AS ENUM ('lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost');
CREATE TYPE "SalesActualSource" AS ENUM ('manual', 'deal', 'finance_invoice');
CREATE TYPE "SalesCommissionRuleStatus" AS ENUM ('draft', 'active', 'archived');

CREATE TABLE "SalesTarget" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "employeeId" TEXT,
    "departmentId" TEXT,
    "periodType" "SalesTargetPeriodType" NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "product" TEXT,
    "region" TEXT,
    "segment" TEXT,
    "status" "SalesTargetStatus" NOT NULL DEFAULT 'draft',
    "parentTargetId" TEXT,
    "setByUserId" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesTarget_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SalesDeal" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "stage" "SalesDealStage" NOT NULL DEFAULT 'lead',
    "value" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "ownerEmployeeId" TEXT NOT NULL,
    "expectedCloseDate" DATE,
    "closedAt" TIMESTAMP(3),
    "accountsInvoiceId" TEXT,
    "accountsClientId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesDeal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SalesActual" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "employeeId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "source" "SalesActualSource" NOT NULL DEFAULT 'manual',
    "salesDealId" TEXT,
    "accountsInvoiceId" TEXT,
    "notes" TEXT,
    "recordedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesActual_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SalesCommissionRule" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "SalesCommissionRuleStatus" NOT NULL DEFAULT 'draft',
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesCommissionRule_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SalesTarget_organizationId_periodEnd_idx" ON "SalesTarget"("organizationId", "periodEnd");
CREATE INDEX "SalesTarget_organizationId_employeeId_idx" ON "SalesTarget"("organizationId", "employeeId");
CREATE INDEX "SalesTarget_organizationId_departmentId_idx" ON "SalesTarget"("organizationId", "departmentId");
CREATE INDEX "SalesTarget_organizationId_status_idx" ON "SalesTarget"("organizationId", "status");

CREATE INDEX "SalesDeal_organizationId_stage_idx" ON "SalesDeal"("organizationId", "stage");
CREATE INDEX "SalesDeal_organizationId_ownerEmployeeId_idx" ON "SalesDeal"("organizationId", "ownerEmployeeId");
CREATE INDEX "SalesDeal_organizationId_expectedCloseDate_idx" ON "SalesDeal"("organizationId", "expectedCloseDate");

CREATE INDEX "SalesActual_organizationId_employeeId_periodEnd_idx" ON "SalesActual"("organizationId", "employeeId", "periodEnd");
CREATE INDEX "SalesActual_organizationId_periodStart_periodEnd_idx" ON "SalesActual"("organizationId", "periodStart", "periodEnd");

CREATE INDEX "SalesCommissionRule_organizationId_status_idx" ON "SalesCommissionRule"("organizationId", "status");

ALTER TABLE "SalesTarget" ADD CONSTRAINT "SalesTarget_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesTarget" ADD CONSTRAINT "SalesTarget_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesTarget" ADD CONSTRAINT "SalesTarget_parentTargetId_fkey" FOREIGN KEY ("parentTargetId") REFERENCES "SalesTarget"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesTarget" ADD CONSTRAINT "SalesTarget_setByUserId_fkey" FOREIGN KEY ("setByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesTarget" ADD CONSTRAINT "SalesTarget_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SalesDeal" ADD CONSTRAINT "SalesDeal_ownerEmployeeId_fkey" FOREIGN KEY ("ownerEmployeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesDeal" ADD CONSTRAINT "SalesDeal_accountsInvoiceId_fkey" FOREIGN KEY ("accountsInvoiceId") REFERENCES "AccountsInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesDeal" ADD CONSTRAINT "SalesDeal_accountsClientId_fkey" FOREIGN KEY ("accountsClientId") REFERENCES "AccountsClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SalesActual" ADD CONSTRAINT "SalesActual_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SalesActual" ADD CONSTRAINT "SalesActual_salesDealId_fkey" FOREIGN KEY ("salesDealId") REFERENCES "SalesDeal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesActual" ADD CONSTRAINT "SalesActual_accountsInvoiceId_fkey" FOREIGN KEY ("accountsInvoiceId") REFERENCES "AccountsInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SalesActual" ADD CONSTRAINT "SalesActual_recordedByUserId_fkey" FOREIGN KEY ("recordedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS: org-scoped tenant isolation
ALTER TABLE "SalesTarget" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SalesTarget" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "SalesTarget_tenant_rw" ON "SalesTarget";
CREATE POLICY "SalesTarget_tenant_rw" ON "SalesTarget" FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "SalesTarget_insert_bootstrap" ON "SalesTarget";
CREATE POLICY "SalesTarget_insert_bootstrap" ON "SalesTarget" FOR INSERT WITH CHECK (coalesce(current_setting('app.current_org', true), '') = '' OR "organizationId" = current_setting('app.current_org', true)::uuid);

ALTER TABLE "SalesDeal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SalesDeal" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "SalesDeal_tenant_rw" ON "SalesDeal";
CREATE POLICY "SalesDeal_tenant_rw" ON "SalesDeal" FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "SalesDeal_insert_bootstrap" ON "SalesDeal";
CREATE POLICY "SalesDeal_insert_bootstrap" ON "SalesDeal" FOR INSERT WITH CHECK (coalesce(current_setting('app.current_org', true), '') = '' OR "organizationId" = current_setting('app.current_org', true)::uuid);

ALTER TABLE "SalesActual" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SalesActual" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "SalesActual_tenant_rw" ON "SalesActual";
CREATE POLICY "SalesActual_tenant_rw" ON "SalesActual" FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "SalesActual_insert_bootstrap" ON "SalesActual";
CREATE POLICY "SalesActual_insert_bootstrap" ON "SalesActual" FOR INSERT WITH CHECK (coalesce(current_setting('app.current_org', true), '') = '' OR "organizationId" = current_setting('app.current_org', true)::uuid);

ALTER TABLE "SalesCommissionRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SalesCommissionRule" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "SalesCommissionRule_tenant_rw" ON "SalesCommissionRule";
CREATE POLICY "SalesCommissionRule_tenant_rw" ON "SalesCommissionRule" FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "SalesCommissionRule_insert_bootstrap" ON "SalesCommissionRule";
CREATE POLICY "SalesCommissionRule_insert_bootstrap" ON "SalesCommissionRule" FOR INSERT WITH CHECK (coalesce(current_setting('app.current_org', true), '') = '' OR "organizationId" = current_setting('app.current_org', true)::uuid);
