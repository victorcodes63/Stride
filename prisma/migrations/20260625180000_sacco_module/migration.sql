-- RAV-93: SACCO vertical pack — members, BOSA/FOSA ledger, dividend runs

CREATE TYPE "SaccoMemberStatus" AS ENUM ('active', 'dormant', 'withdrawn', 'deceased');
CREATE TYPE "SaccoAccountType" AS ENUM ('shares', 'bosa', 'fosa');
CREATE TYPE "SaccoLedgerEntryType" AS ENUM ('contribution', 'withdrawal', 'transfer', 'dividend', 'interest', 'adjustment');
CREATE TYPE "SaccoDividendRunStatus" AS ENUM ('draft', 'approved', 'posted', 'cancelled');

CREATE TABLE "SaccoMember" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "memberNumber" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "nationalId" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "employeeId" TEXT,
    "joinedAt" DATE NOT NULL,
    "status" "SaccoMemberStatus" NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaccoMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SaccoAccount" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "memberId" TEXT NOT NULL,
    "accountType" "SaccoAccountType" NOT NULL,
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaccoAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SaccoLedgerEntry" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "accountId" TEXT NOT NULL,
    "entryType" "SaccoLedgerEntryType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "balanceAfter" DECIMAL(14,2) NOT NULL,
    "reference" TEXT,
    "description" TEXT,
    "entryDate" DATE NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaccoLedgerEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SaccoDividendRun" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "ratePercent" DECIMAL(8,4) NOT NULL,
    "status" "SaccoDividendRunStatus" NOT NULL DEFAULT 'draft',
    "totalAmount" DECIMAL(14,2),
    "approvedAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SaccoDividendRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SaccoDividendLine" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "runId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "sharesBalance" DECIMAL(14,2) NOT NULL,
    "dividendAmount" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaccoDividendLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "SaccoMember_employeeId_key" ON "SaccoMember"("employeeId");
CREATE UNIQUE INDEX "SaccoMember_outsourcingClientId_memberNumber_key" ON "SaccoMember"("outsourcingClientId", "memberNumber");
CREATE INDEX "SaccoMember_outsourcingClientId_status_idx" ON "SaccoMember"("outsourcingClientId", "status");
CREATE INDEX "SaccoMember_employeeId_idx" ON "SaccoMember"("employeeId");

CREATE UNIQUE INDEX "SaccoAccount_memberId_accountType_key" ON "SaccoAccount"("memberId", "accountType");
CREATE INDEX "SaccoAccount_memberId_idx" ON "SaccoAccount"("memberId");

CREATE INDEX "SaccoLedgerEntry_accountId_entryDate_idx" ON "SaccoLedgerEntry"("accountId", "entryDate");
CREATE INDEX "SaccoLedgerEntry_entryType_idx" ON "SaccoLedgerEntry"("entryType");

CREATE INDEX "SaccoDividendRun_outsourcingClientId_status_idx" ON "SaccoDividendRun"("outsourcingClientId", "status");
CREATE INDEX "SaccoDividendRun_periodEnd_idx" ON "SaccoDividendRun"("periodEnd");

CREATE UNIQUE INDEX "SaccoDividendLine_runId_memberId_key" ON "SaccoDividendLine"("runId", "memberId");
CREATE INDEX "SaccoDividendLine_memberId_idx" ON "SaccoDividendLine"("memberId");

ALTER TABLE "SaccoMember" ADD CONSTRAINT "SaccoMember_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaccoMember" ADD CONSTRAINT "SaccoMember_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SaccoAccount" ADD CONSTRAINT "SaccoAccount_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "SaccoMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SaccoLedgerEntry" ADD CONSTRAINT "SaccoLedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "SaccoAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaccoLedgerEntry" ADD CONSTRAINT "SaccoLedgerEntry_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SaccoDividendRun" ADD CONSTRAINT "SaccoDividendRun_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaccoDividendRun" ADD CONSTRAINT "SaccoDividendRun_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "SaccoDividendLine" ADD CONSTRAINT "SaccoDividendLine_runId_fkey" FOREIGN KEY ("runId") REFERENCES "SaccoDividendRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SaccoDividendLine" ADD CONSTRAINT "SaccoDividendLine_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "SaccoMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
