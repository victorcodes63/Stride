-- RAV-68: M-Pesa payroll disbursement batches + per-employee payment lines.

CREATE TYPE "PayrollDisbursementChannel" AS ENUM ('mpesa');
CREATE TYPE "PayrollDisbursementBatchStatus" AS ENUM ('draft', 'submitting', 'processing', 'completed', 'partial_failure', 'failed');
CREATE TYPE "PayrollDisbursementLineStatus" AS ENUM ('pending', 'submitted', 'processing', 'completed', 'failed', 'skipped');

CREATE TABLE "PayrollDisbursementBatch" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "channel" "PayrollDisbursementChannel" NOT NULL DEFAULT 'mpesa',
    "status" "PayrollDisbursementBatchStatus" NOT NULL DEFAULT 'draft',
    "providerRef" TEXT,
    "pollCount" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "initiatedByUserId" TEXT,
    "failureSummary" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollDisbursementBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PayrollDisbursementLine" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "batchId" TEXT NOT NULL,
    "payrollId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "phone" TEXT,
    "status" "PayrollDisbursementLineStatus" NOT NULL DEFAULT 'pending',
    "providerRef" TEXT,
    "failureReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayrollDisbursementLine_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PayrollDisbursementBatch_organizationId_outsourcingClientId_year_month_idx" ON "PayrollDisbursementBatch"("organizationId", "outsourcingClientId", "year", "month");
CREATE INDEX "PayrollDisbursementBatch_status_idx" ON "PayrollDisbursementBatch"("status");
CREATE INDEX "PayrollDisbursementLine_batchId_idx" ON "PayrollDisbursementLine"("batchId");
CREATE INDEX "PayrollDisbursementLine_employeeId_idx" ON "PayrollDisbursementLine"("employeeId");
CREATE INDEX "PayrollDisbursementLine_status_idx" ON "PayrollDisbursementLine"("status");
CREATE UNIQUE INDEX "PayrollDisbursementLine_batchId_payrollId_key" ON "PayrollDisbursementLine"("batchId", "payrollId");

ALTER TABLE "PayrollDisbursementBatch" ADD CONSTRAINT "PayrollDisbursementBatch_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollDisbursementBatch" ADD CONSTRAINT "PayrollDisbursementBatch_initiatedByUserId_fkey" FOREIGN KEY ("initiatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PayrollDisbursementLine" ADD CONSTRAINT "PayrollDisbursementLine_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "PayrollDisbursementBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollDisbursementLine" ADD CONSTRAINT "PayrollDisbursementLine_payrollId_fkey" FOREIGN KEY ("payrollId") REFERENCES "Payroll"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PayrollDisbursementLine" ADD CONSTRAINT "PayrollDisbursementLine_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PayrollDisbursementBatch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PayrollDisbursementBatch" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "PayrollDisbursementBatch_tenant_rw" ON "PayrollDisbursementBatch";
CREATE POLICY "PayrollDisbursementBatch_tenant_rw" ON "PayrollDisbursementBatch"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "PayrollDisbursementBatch_insert_bootstrap" ON "PayrollDisbursementBatch";
CREATE POLICY "PayrollDisbursementBatch_insert_bootstrap" ON "PayrollDisbursementBatch"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "PayrollDisbursementLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PayrollDisbursementLine" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "PayrollDisbursementLine_tenant_rw" ON "PayrollDisbursementLine";
CREATE POLICY "PayrollDisbursementLine_tenant_rw" ON "PayrollDisbursementLine"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "PayrollDisbursementLine_insert_bootstrap" ON "PayrollDisbursementLine";
CREATE POLICY "PayrollDisbursementLine_insert_bootstrap" ON "PayrollDisbursementLine"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );
