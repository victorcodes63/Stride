-- Module 1: HR Core & Employee Master (additive-only)
ALTER TABLE "Employee"
  ADD COLUMN "costCenterCode" TEXT,
  ADD COLUMN "costCenterName" TEXT;

CREATE INDEX "Employee_costCenterCode_idx" ON "Employee"("costCenterCode");

ALTER TABLE "EmployeeDocument"
  ADD COLUMN "documentNumber" TEXT,
  ADD COLUMN "issuedOn" DATE,
  ADD COLUMN "expiresOn" DATE,
  ADD COLUMN "isVerified" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "tags" JSONB;

CREATE INDEX "EmployeeDocument_expiresOn_idx" ON "EmployeeDocument"("expiresOn");
CREATE INDEX "EmployeeDocument_isVerified_idx" ON "EmployeeDocument"("isVerified");

CREATE TYPE "EmployeeLifecycleEventType" AS ENUM (
  'hire',
  'confirmation',
  'promotion',
  'transfer',
  'suspension',
  'separation'
);

CREATE TABLE "EmployeeLifecycleEvent" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "outsourcingClientId" TEXT NOT NULL,
  "eventType" "EmployeeLifecycleEventType" NOT NULL,
  "effectiveDate" DATE NOT NULL,
  "reason" TEXT,
  "notes" TEXT,
  "fromJobTitle" TEXT,
  "toJobTitle" TEXT,
  "fromDepartmentId" TEXT,
  "toDepartmentId" TEXT,
  "fromEmploymentStatus" "EmployeeEmploymentStatus",
  "toEmploymentStatus" "EmployeeEmploymentStatus",
  "actedByUserId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeLifecycleEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmployeeLifecycleEvent_employeeId_effectiveDate_idx"
  ON "EmployeeLifecycleEvent"("employeeId", "effectiveDate" DESC);
CREATE INDEX "EmployeeLifecycleEvent_outsourcingClientId_eventType_effectiveDate_idx"
  ON "EmployeeLifecycleEvent"("outsourcingClientId", "eventType", "effectiveDate" DESC);
CREATE INDEX "EmployeeLifecycleEvent_createdAt_idx"
  ON "EmployeeLifecycleEvent"("createdAt" DESC);

ALTER TABLE "EmployeeLifecycleEvent"
  ADD CONSTRAINT "EmployeeLifecycleEvent_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeLifecycleEvent"
  ADD CONSTRAINT "EmployeeLifecycleEvent_outsourcingClientId_fkey"
  FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeLifecycleEvent"
  ADD CONSTRAINT "EmployeeLifecycleEvent_actedByUserId_fkey"
  FOREIGN KEY ("actedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
