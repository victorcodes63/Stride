-- SALES-01 / PERF-06: Sales rep period metrics for auto-measured KPIs.

CREATE TABLE "SalesRepPeriodMetric" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "employeeId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "pipelineTarget" DECIMAL(14,2) NOT NULL,
    "pipelineClosed" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesRepPeriodMetric_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SalesRepPeriodMetric_organizationId_employeeId_periodStart_periodEnd_key" ON "SalesRepPeriodMetric"("organizationId", "employeeId", "periodStart", "periodEnd");
CREATE INDEX "SalesRepPeriodMetric_organizationId_periodEnd_idx" ON "SalesRepPeriodMetric"("organizationId", "periodEnd");

ALTER TABLE "SalesRepPeriodMetric" ADD CONSTRAINT "SalesRepPeriodMetric_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SalesRepPeriodMetric" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SalesRepPeriodMetric" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "SalesRepPeriodMetric_tenant_rw" ON "SalesRepPeriodMetric";
CREATE POLICY "SalesRepPeriodMetric_tenant_rw" ON "SalesRepPeriodMetric" FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "SalesRepPeriodMetric_insert_bootstrap" ON "SalesRepPeriodMetric";
CREATE POLICY "SalesRepPeriodMetric_insert_bootstrap" ON "SalesRepPeriodMetric" FOR INSERT WITH CHECK (coalesce(current_setting('app.current_org', true), '') = '' OR "organizationId" = current_setting('app.current_org', true)::uuid);
