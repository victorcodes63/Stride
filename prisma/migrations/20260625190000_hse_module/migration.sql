-- CreateEnum
CREATE TYPE "HseIncidentType" AS ENUM ('hazard', 'near_miss', 'injury', 'fire', 'equipment_failure', 'environmental', 'other');

-- CreateEnum
CREATE TYPE "HseIncidentSeverity" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "HseIncidentStatus" AS ENUM ('open', 'investigating', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "HseActionStatus" AS ENUM ('open', 'in_progress', 'completed', 'cancelled');

-- CreateTable
CREATE TABLE "HseIncident" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "incidentNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "incidentType" "HseIncidentType" NOT NULL DEFAULT 'other',
    "severity" "HseIncidentSeverity" NOT NULL DEFAULT 'medium',
    "status" "HseIncidentStatus" NOT NULL DEFAULT 'open',
    "location" TEXT,
    "siteName" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "immediateAction" TEXT,
    "injuredParty" TEXT,
    "reportedByUserId" TEXT,
    "reportedByEmployeeId" TEXT,
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HseIncident_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HseAction" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "incidentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigneeUserId" TEXT,
    "dueDate" DATE,
    "status" "HseActionStatus" NOT NULL DEFAULT 'open',
    "completedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HseAction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "HseIncident_outsourcingClientId_incidentNumber_key" ON "HseIncident"("outsourcingClientId", "incidentNumber");

-- CreateIndex
CREATE INDEX "HseIncident_outsourcingClientId_idx" ON "HseIncident"("outsourcingClientId");

-- CreateIndex
CREATE INDEX "HseIncident_status_idx" ON "HseIncident"("status");

-- CreateIndex
CREATE INDEX "HseIncident_severity_idx" ON "HseIncident"("severity");

-- CreateIndex
CREATE INDEX "HseIncident_occurredAt_idx" ON "HseIncident"("occurredAt");

-- CreateIndex
CREATE INDEX "HseIncident_reportedByEmployeeId_idx" ON "HseIncident"("reportedByEmployeeId");

-- CreateIndex
CREATE INDEX "HseAction_outsourcingClientId_idx" ON "HseAction"("outsourcingClientId");

-- CreateIndex
CREATE INDEX "HseAction_incidentId_idx" ON "HseAction"("incidentId");

-- CreateIndex
CREATE INDEX "HseAction_status_idx" ON "HseAction"("status");

-- CreateIndex
CREATE INDEX "HseAction_assigneeUserId_idx" ON "HseAction"("assigneeUserId");

-- CreateIndex
CREATE INDEX "HseAction_dueDate_idx" ON "HseAction"("dueDate");

-- AddForeignKey
ALTER TABLE "HseIncident" ADD CONSTRAINT "HseIncident_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HseIncident" ADD CONSTRAINT "HseIncident_reportedByUserId_fkey" FOREIGN KEY ("reportedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HseIncident" ADD CONSTRAINT "HseIncident_reportedByEmployeeId_fkey" FOREIGN KEY ("reportedByEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HseIncident" ADD CONSTRAINT "HseIncident_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HseAction" ADD CONSTRAINT "HseAction_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HseAction" ADD CONSTRAINT "HseAction_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "HseIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HseAction" ADD CONSTRAINT "HseAction_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HseAction" ADD CONSTRAINT "HseAction_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS
ALTER TABLE "HseIncident" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "HseAction" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "HseIncident_tenant_isolation" ON "HseIncident"
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

CREATE POLICY "HseIncident_bypass" ON "HseIncident"
  USING (current_setting('app.current_org', true) IS NULL OR current_setting('app.current_org', true) = '')
  WITH CHECK (current_setting('app.current_org', true) IS NULL OR current_setting('app.current_org', true) = '');

CREATE POLICY "HseAction_tenant_isolation" ON "HseAction"
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

CREATE POLICY "HseAction_bypass" ON "HseAction"
  USING (current_setting('app.current_org', true) IS NULL OR current_setting('app.current_org', true) = '')
  WITH CHECK (current_setting('app.current_org', true) IS NULL OR current_setting('app.current_org', true) = '');
