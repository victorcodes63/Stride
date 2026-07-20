-- CreateEnum
CREATE TYPE "PurchaseApprovalStepStatus" AS ENUM ('pending', 'approved', 'rejected', 'skipped');

-- CreateEnum
CREATE TYPE "PurchaseOrderMatchStatus" AS ENUM ('not_matched', 'partially_matched', 'matched', 'exception');

-- AlterEnum
ALTER TYPE "GoodsReceiptStatus" ADD VALUE 'cancelled';

-- AlterTable
ALTER TABLE "GoodsReceiptLine" ADD COLUMN     "condition" TEXT,
ADD COLUMN     "rejectedQuantity" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "matchStatus" "PurchaseOrderMatchStatus" NOT NULL DEFAULT 'not_matched';

-- AlterTable
ALTER TABLE "PurchaseOrderLine" ADD COLUMN     "budgetLineItemId" TEXT,
ADD COLUMN     "purchaseRequestLineId" TEXT,
ADD COLUMN     "receivedQuantity" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "PurchaseRequestLine" ADD COLUMN     "budgetLineItemId" TEXT;

-- CreateTable
CREATE TABLE "ProcurementSequence" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "nextValue" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcurementSequence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseRequestApprovalStep" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "purchaseRequestId" TEXT NOT NULL,
    "stepOrder" INTEGER NOT NULL,
    "approverUserId" TEXT,
    "approverRole" TEXT,
    "status" "PurchaseApprovalStepStatus" NOT NULL DEFAULT 'pending',
    "actedByUserId" TEXT,
    "actedAt" TIMESTAMP(3),
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseRequestApprovalStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcurementApprovalPolicy" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "maxAmount" DECIMAL(14,2),
    "stepOrder" INTEGER NOT NULL DEFAULT 0,
    "approverRole" TEXT,
    "approverUserId" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcurementApprovalPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProcurementSequence_outsourcingClientId_idx" ON "ProcurementSequence"("outsourcingClientId");

-- CreateIndex
CREATE UNIQUE INDEX "ProcurementSequence_organizationId_outsourcingClientId_docT_key" ON "ProcurementSequence"("organizationId", "outsourcingClientId", "docType", "year");

-- CreateIndex
CREATE INDEX "PurchaseRequestApprovalStep_outsourcingClientId_idx" ON "PurchaseRequestApprovalStep"("outsourcingClientId");

-- CreateIndex
CREATE INDEX "PurchaseRequestApprovalStep_purchaseRequestId_status_idx" ON "PurchaseRequestApprovalStep"("purchaseRequestId", "status");

-- CreateIndex
CREATE INDEX "PurchaseRequestApprovalStep_approverUserId_status_idx" ON "PurchaseRequestApprovalStep"("approverUserId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseRequestApprovalStep_purchaseRequestId_stepOrder_key" ON "PurchaseRequestApprovalStep"("purchaseRequestId", "stepOrder");

-- CreateIndex
CREATE INDEX "ProcurementApprovalPolicy_outsourcingClientId_active_idx" ON "ProcurementApprovalPolicy"("outsourcingClientId", "active");

-- CreateIndex
CREATE INDEX "ProcurementApprovalPolicy_outsourcingClientId_minAmount_idx" ON "ProcurementApprovalPolicy"("outsourcingClientId", "minAmount");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_purchaseRequestLineId_idx" ON "PurchaseOrderLine"("purchaseRequestLineId");

-- CreateIndex
CREATE INDEX "PurchaseOrderLine_budgetLineItemId_idx" ON "PurchaseOrderLine"("budgetLineItemId");

-- CreateIndex
CREATE INDEX "PurchaseRequestLine_budgetLineItemId_idx" ON "PurchaseRequestLine"("budgetLineItemId");

-- AddForeignKey
ALTER TABLE "PurchaseRequestLine" ADD CONSTRAINT "PurchaseRequestLine_budgetLineItemId_fkey" FOREIGN KEY ("budgetLineItemId") REFERENCES "BudgetLineItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_purchaseRequestLineId_fkey" FOREIGN KEY ("purchaseRequestLineId") REFERENCES "PurchaseRequestLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderLine" ADD CONSTRAINT "PurchaseOrderLine_budgetLineItemId_fkey" FOREIGN KEY ("budgetLineItemId") REFERENCES "BudgetLineItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementSequence" ADD CONSTRAINT "ProcurementSequence_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestApprovalStep" ADD CONSTRAINT "PurchaseRequestApprovalStep_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestApprovalStep" ADD CONSTRAINT "PurchaseRequestApprovalStep_purchaseRequestId_fkey" FOREIGN KEY ("purchaseRequestId") REFERENCES "PurchaseRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestApprovalStep" ADD CONSTRAINT "PurchaseRequestApprovalStep_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseRequestApprovalStep" ADD CONSTRAINT "PurchaseRequestApprovalStep_actedByUserId_fkey" FOREIGN KEY ("actedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementApprovalPolicy" ADD CONSTRAINT "ProcurementApprovalPolicy_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcurementApprovalPolicy" ADD CONSTRAINT "ProcurementApprovalPolicy_approverUserId_fkey" FOREIGN KEY ("approverUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
