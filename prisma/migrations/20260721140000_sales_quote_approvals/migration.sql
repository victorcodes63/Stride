-- B2 — Discount governance & quote approvals (additive)

-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "SalesQuoteApprovalStatus" AS ENUM ('pending', 'approved', 'rejected');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- AlterEnum: pending_approval on SalesQuoteStatus
ALTER TYPE "SalesQuoteStatus" ADD VALUE IF NOT EXISTS 'pending_approval';

-- CreateTable
CREATE TABLE IF NOT EXISTS "SalesApprovalPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "config" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesApprovalPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SalesQuoteApproval" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "quoteId" TEXT NOT NULL,
    "requestedById" TEXT NOT NULL,
    "approverId" TEXT,
    "status" "SalesQuoteApprovalStatus" NOT NULL DEFAULT 'pending',
    "reason" TEXT,
    "effectiveDiscountPct" DECIMAL(5,2),
    "actionedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesQuoteApproval_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SalesApprovalPolicy_organizationId_key" ON "SalesApprovalPolicy"("organizationId");
CREATE INDEX IF NOT EXISTS "SalesApprovalPolicy_organizationId_idx" ON "SalesApprovalPolicy"("organizationId");
CREATE INDEX IF NOT EXISTS "SalesQuoteApproval_organizationId_quoteId_idx" ON "SalesQuoteApproval"("organizationId", "quoteId");
CREATE INDEX IF NOT EXISTS "SalesQuoteApproval_organizationId_status_idx" ON "SalesQuoteApproval"("organizationId", "status");

DO $$ BEGIN
  ALTER TABLE "SalesQuoteApproval" ADD CONSTRAINT "SalesQuoteApproval_quoteId_fkey"
    FOREIGN KEY ("quoteId") REFERENCES "SalesQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "SalesQuoteApproval" ADD CONSTRAINT "SalesQuoteApproval_requestedById_fkey"
    FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  ALTER TABLE "SalesQuoteApproval" ADD CONSTRAINT "SalesQuoteApproval_approverId_fkey"
    FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
