-- CreateEnum
CREATE TYPE "RfqStatus" AS ENUM ('draft', 'issued', 'evaluating', 'awarded', 'cancelled', 'closed');

-- CreateEnum
CREATE TYPE "RfqInvitationStatus" AS ENUM ('invited', 'responded', 'declined');

-- CreateEnum
CREATE TYPE "RfqQuoteStatus" AS ENUM ('draft', 'submitted', 'shortlisted', 'awarded', 'rejected');

-- CreateEnum
CREATE TYPE "ProcurementVendorStatus" AS ENUM ('prospective', 'onboarding', 'active', 'suspended', 'blacklisted');

-- CreateEnum
CREATE TYPE "BudgetCommitmentSourceType" AS ENUM ('purchase_request', 'purchase_order');

-- CreateEnum
CREATE TYPE "BudgetCommitmentStatus" AS ENUM ('active', 'released', 'consumed');

-- AlterTable
ALTER TABLE "Budget" ADD COLUMN     "committedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "BudgetLineItem" ADD COLUMN     "committedAmount" DECIMAL(14,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "rfqId" TEXT;

-- CreateTable
CREATE TABLE "Rfq" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "rfqNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "status" "RfqStatus" NOT NULL DEFAULT 'draft',
    "dueDate" DATE,
    "createdByUserId" TEXT NOT NULL,
    "awardedVendorId" TEXT,
    "awardedQuoteId" TEXT,
    "purchaseRequestId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rfq_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfqLine" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "rfqId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "description" TEXT,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "unit" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RfqLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfqInvitation" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "status" "RfqInvitationStatus" NOT NULL DEFAULT 'invited',
    "invitedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RfqInvitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfqQuote" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "rfqId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "quoteNumber" TEXT,
    "status" "RfqQuoteStatus" NOT NULL DEFAULT 'draft',
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "validUntil" DATE,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RfqQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RfqQuoteLine" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "quoteId" TEXT NOT NULL,
    "rfqLineId" TEXT,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "leadTimeDays" INTEGER,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RfqQuoteLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcurementVendorProfile" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "category" TEXT,
    "taxId" TEXT,
    "registrationNo" TEXT,
    "status" "ProcurementVendorStatus" NOT NULL DEFAULT 'prospective',
    "rating" DECIMAL(3,2),
    "leadTimeDays" INTEGER,
    "paymentTerms" TEXT,
    "bankName" TEXT,
    "bankAccount" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "onboardedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcurementVendorProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VendorScorecard" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "deliveryScore" DECIMAL(3,2),
    "qualityScore" DECIMAL(3,2),
    "priceScore" DECIMAL(3,2),
    "overallScore" DECIMAL(3,2),
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorScorecard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetCommitment" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "budgetLineItemId" TEXT NOT NULL,
    "sourceType" "BudgetCommitmentSourceType" NOT NULL,
    "sourceId" TEXT NOT NULL,
    "sourceRef" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "status" "BudgetCommitmentStatus" NOT NULL DEFAULT 'active',
    "createdByUserId" TEXT,
    "releasedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetCommitment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Rfq_rfqNumber_key" ON "Rfq"("rfqNumber");

-- CreateIndex
CREATE INDEX "Rfq_outsourcingClientId_idx" ON "Rfq"("outsourcingClientId");

-- CreateIndex
CREATE INDEX "Rfq_status_idx" ON "Rfq"("status");

-- CreateIndex
CREATE INDEX "Rfq_awardedVendorId_idx" ON "Rfq"("awardedVendorId");

-- CreateIndex
CREATE INDEX "Rfq_purchaseRequestId_idx" ON "Rfq"("purchaseRequestId");

-- CreateIndex
CREATE INDEX "RfqLine_rfqId_idx" ON "RfqLine"("rfqId");

-- CreateIndex
CREATE INDEX "RfqInvitation_outsourcingClientId_idx" ON "RfqInvitation"("outsourcingClientId");

-- CreateIndex
CREATE INDEX "RfqInvitation_vendorId_idx" ON "RfqInvitation"("vendorId");

-- CreateIndex
CREATE INDEX "RfqInvitation_status_idx" ON "RfqInvitation"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RfqInvitation_rfqId_vendorId_key" ON "RfqInvitation"("rfqId", "vendorId");

-- CreateIndex
CREATE INDEX "RfqQuote_outsourcingClientId_idx" ON "RfqQuote"("outsourcingClientId");

-- CreateIndex
CREATE INDEX "RfqQuote_rfqId_idx" ON "RfqQuote"("rfqId");

-- CreateIndex
CREATE INDEX "RfqQuote_vendorId_idx" ON "RfqQuote"("vendorId");

-- CreateIndex
CREATE INDEX "RfqQuote_status_idx" ON "RfqQuote"("status");

-- CreateIndex
CREATE INDEX "RfqQuoteLine_quoteId_idx" ON "RfqQuoteLine"("quoteId");

-- CreateIndex
CREATE INDEX "RfqQuoteLine_rfqLineId_idx" ON "RfqQuoteLine"("rfqLineId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcurementVendorProfile_vendorId_key" ON "ProcurementVendorProfile"("vendorId");

-- CreateIndex
CREATE INDEX "ProcurementVendorProfile_outsourcingClientId_status_idx" ON "ProcurementVendorProfile"("outsourcingClientId", "status");

-- CreateIndex
CREATE INDEX "ProcurementVendorProfile_category_idx" ON "ProcurementVendorProfile"("category");

-- CreateIndex
CREATE INDEX "VendorScorecard_outsourcingClientId_idx" ON "VendorScorecard"("outsourcingClientId");

-- CreateIndex
CREATE INDEX "VendorScorecard_vendorId_periodEnd_idx" ON "VendorScorecard"("vendorId", "periodEnd" DESC);

-- CreateIndex
CREATE INDEX "BudgetCommitment_outsourcingClientId_idx" ON "BudgetCommitment"("outsourcingClientId");

-- CreateIndex
CREATE INDEX "BudgetCommitment_budgetLineItemId_idx" ON "BudgetCommitment"("budgetLineItemId");

-- CreateIndex
CREATE INDEX "BudgetCommitment_sourceType_sourceId_idx" ON "BudgetCommitment"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "BudgetCommitment_status_idx" ON "BudgetCommitment"("status");

-- CreateIndex
CREATE INDEX "PurchaseOrder_rfqId_idx" ON "PurchaseOrder"("rfqId");

-- AddForeignKey
ALTER TABLE "PurchaseOrder" ADD CONSTRAINT "PurchaseOrder_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_awardedVendorId_fkey" FOREIGN KEY ("awardedVendorId") REFERENCES "AccountsVendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Rfq" ADD CONSTRAINT "Rfq_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "PurchaseRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqLine" ADD CONSTRAINT "RfqLine_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqInvitation" ADD CONSTRAINT "RfqInvitation_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqInvitation" ADD CONSTRAINT "RfqInvitation_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqInvitation" ADD CONSTRAINT "RfqInvitation_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "AccountsVendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqQuote" ADD CONSTRAINT "RfqQuote_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqQuote" ADD CONSTRAINT "RfqQuote_rfqId_fkey" FOREIGN KEY ("rfqId") REFERENCES "Rfq"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqQuote" ADD CONSTRAINT "RfqQuote_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "AccountsVendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqQuoteLine" ADD CONSTRAINT "RfqQuoteLine_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "RfqQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RfqQuoteLine" ADD CONSTRAINT "RfqQuoteLine_rfqLineId_fkey" FOREIGN KEY ("rfqLineId") REFERENCES "RfqLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementVendorProfile" ADD CONSTRAINT "ProcurementVendorProfile_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementVendorProfile" ADD CONSTRAINT "ProcurementVendorProfile_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "AccountsVendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorScorecard" ADD CONSTRAINT "VendorScorecard_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorScorecard" ADD CONSTRAINT "VendorScorecard_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "AccountsVendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VendorScorecard" ADD CONSTRAINT "VendorScorecard_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetCommitment" ADD CONSTRAINT "BudgetCommitment_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetCommitment" ADD CONSTRAINT "BudgetCommitment_budgetLineItemId_fkey" FOREIGN KEY ("budgetLineItemId") REFERENCES "BudgetLineItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetCommitment" ADD CONSTRAINT "BudgetCommitment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

