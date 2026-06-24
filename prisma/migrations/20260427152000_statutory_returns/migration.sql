-- Statutory filing workflow for monthly payroll compliance (Kenya)

CREATE TYPE "StatutoryReturnStatus" AS ENUM ('draft', 'review_ready', 'filed', 'paid', 'overdue');
CREATE TYPE "StatutoryObligationType" AS ENUM ('paye', 'nssf', 'shif', 'housing_levy');
CREATE TYPE "StatutoryItemStatus" AS ENUM ('pending', 'prepared', 'submitted', 'paid', 'overdue');

CREATE TABLE "StatutoryReturn" (
  "id" TEXT NOT NULL,
  "outsourcingClientId" TEXT NOT NULL,
  "month" INTEGER NOT NULL,
  "year" INTEGER NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'KES',
  "employeeCount" INTEGER NOT NULL DEFAULT 0,
  "payrollCount" INTEGER NOT NULL DEFAULT 0,
  "totalGrossPay" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalPaye" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalNssfEmployee" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalNssfEmployer" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalShif" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalAhlEmployee" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalAhlEmployer" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "totalOtherDeductions" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "status" "StatutoryReturnStatus" NOT NULL DEFAULT 'draft',
  "submittedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StatutoryReturn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "StatutoryReturnItem" (
  "id" TEXT NOT NULL,
  "statutoryReturnId" TEXT NOT NULL,
  "obligationType" "StatutoryObligationType" NOT NULL,
  "authority" TEXT NOT NULL,
  "employeeAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "employerAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "liabilityAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "dueDate" DATE NOT NULL,
  "status" "StatutoryItemStatus" NOT NULL DEFAULT 'pending',
  "referenceNumber" TEXT,
  "paymentReference" TEXT,
  "submittedAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "notes" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StatutoryReturnItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StatutoryReturn_outsourcingClientId_month_year_key"
  ON "StatutoryReturn"("outsourcingClientId", "month", "year");
CREATE INDEX "StatutoryReturn_year_month_idx" ON "StatutoryReturn"("year", "month");
CREATE INDEX "StatutoryReturn_status_idx" ON "StatutoryReturn"("status");

CREATE UNIQUE INDEX "StatutoryReturnItem_statutoryReturnId_obligationType_key"
  ON "StatutoryReturnItem"("statutoryReturnId", "obligationType");
CREATE INDEX "StatutoryReturnItem_dueDate_idx" ON "StatutoryReturnItem"("dueDate");
CREATE INDEX "StatutoryReturnItem_status_idx" ON "StatutoryReturnItem"("status");

ALTER TABLE "StatutoryReturn"
  ADD CONSTRAINT "StatutoryReturn_outsourcingClientId_fkey"
  FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "StatutoryReturnItem"
  ADD CONSTRAINT "StatutoryReturnItem_statutoryReturnId_fkey"
  FOREIGN KEY ("statutoryReturnId") REFERENCES "StatutoryReturn"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
