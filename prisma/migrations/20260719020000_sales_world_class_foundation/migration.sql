-- CreateEnum
CREATE TYPE "SalesLeadRating" AS ENUM ('hot', 'warm', 'cold');

-- CreateEnum
CREATE TYPE "SalesTaskStatus" AS ENUM ('open', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "SalesQuoteStatus" AS ENUM ('draft', 'sent', 'accepted', 'rejected', 'expired');

-- AlterTable
ALTER TABLE "SalesDeal" ADD COLUMN     "lastActivityAt" TIMESTAMP(3),
ADD COLUMN     "stageEnteredAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "SalesDealLineItem" ADD COLUMN     "productId" TEXT;

-- AlterTable
ALTER TABLE "SalesLead" ADD COLUMN     "estimatedValue" DECIMAL(14,2),
ADD COLUMN     "lastActivityAt" TIMESTAMP(3),
ADD COLUMN     "rating" "SalesLeadRating" NOT NULL DEFAULT 'cold',
ADD COLUMN     "score" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "SalesProduct" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sku" TEXT,
    "category" TEXT,
    "description" TEXT,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "defaultTermMonths" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesTask" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "type" "SalesDealActivityType" NOT NULL DEFAULT 'task',
    "status" "SalesTaskStatus" NOT NULL DEFAULT 'open',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "assigneeEmployeeId" TEXT,
    "dealId" TEXT,
    "leadId" TEXT,
    "contactId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesQuote" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "quoteNumber" INTEGER NOT NULL,
    "dealId" TEXT,
    "accountsClientId" TEXT,
    "title" TEXT NOT NULL,
    "status" "SalesQuoteStatus" NOT NULL DEFAULT 'draft',
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "issueDate" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" DATE,
    "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxRateBps" INTEGER NOT NULL DEFAULT 1600,
    "notes" TEXT,
    "terms" TEXT,
    "sentAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SalesQuoteLineItem" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "quoteId" TEXT NOT NULL,
    "productId" TEXT,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(14,2) NOT NULL,
    "discountPct" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "termMonths" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesQuoteLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesProduct_organizationId_active_idx" ON "SalesProduct"("organizationId", "active");

-- CreateIndex
CREATE INDEX "SalesProduct_organizationId_name_idx" ON "SalesProduct"("organizationId", "name");

-- CreateIndex
CREATE INDEX "SalesTask_organizationId_status_dueDate_idx" ON "SalesTask"("organizationId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "SalesTask_organizationId_assigneeEmployeeId_status_idx" ON "SalesTask"("organizationId", "assigneeEmployeeId", "status");

-- CreateIndex
CREATE INDEX "SalesTask_organizationId_dealId_idx" ON "SalesTask"("organizationId", "dealId");

-- CreateIndex
CREATE INDEX "SalesTask_organizationId_leadId_idx" ON "SalesTask"("organizationId", "leadId");

-- CreateIndex
CREATE INDEX "SalesQuote_organizationId_status_idx" ON "SalesQuote"("organizationId", "status");

-- CreateIndex
CREATE INDEX "SalesQuote_organizationId_dealId_idx" ON "SalesQuote"("organizationId", "dealId");

-- CreateIndex
CREATE INDEX "SalesQuote_organizationId_accountsClientId_idx" ON "SalesQuote"("organizationId", "accountsClientId");

-- CreateIndex
CREATE UNIQUE INDEX "SalesQuote_organizationId_quoteNumber_key" ON "SalesQuote"("organizationId", "quoteNumber");

-- CreateIndex
CREATE INDEX "SalesQuoteLineItem_organizationId_quoteId_idx" ON "SalesQuoteLineItem"("organizationId", "quoteId");

-- CreateIndex
CREATE INDEX "SalesLead_organizationId_rating_idx" ON "SalesLead"("organizationId", "rating");

-- AddForeignKey
ALTER TABLE "SalesDealLineItem" ADD CONSTRAINT "SalesDealLineItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "SalesProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTask" ADD CONSTRAINT "SalesTask_assigneeEmployeeId_fkey" FOREIGN KEY ("assigneeEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTask" ADD CONSTRAINT "SalesTask_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "SalesDeal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTask" ADD CONSTRAINT "SalesTask_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "SalesLead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTask" ADD CONSTRAINT "SalesTask_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "SalesContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesTask" ADD CONSTRAINT "SalesTask_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesQuote" ADD CONSTRAINT "SalesQuote_dealId_fkey" FOREIGN KEY ("dealId") REFERENCES "SalesDeal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesQuote" ADD CONSTRAINT "SalesQuote_accountsClientId_fkey" FOREIGN KEY ("accountsClientId") REFERENCES "AccountsClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesQuote" ADD CONSTRAINT "SalesQuote_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesQuoteLineItem" ADD CONSTRAINT "SalesQuoteLineItem_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "SalesQuote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesQuoteLineItem" ADD CONSTRAINT "SalesQuoteLineItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "SalesProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

