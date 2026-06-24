-- Accounts / finance dashboard module

-- CreateEnum
CREATE TYPE "AccountsClientType" AS ENUM ('outsourcing', 'recruitment', 'custom');

-- CreateEnum
CREATE TYPE "ContractReminderKind" AS ENUM ('two_months', 'one_month', 'fourteen_days', 'seven_days', 'expiry_day', 'expired_weekly');

-- CreateEnum
CREATE TYPE "AccountsInvoiceStatus" AS ENUM ('unpaid', 'partial', 'paid');

-- CreateEnum
CREATE TYPE "AccountsVendorBillStatus" AS ENUM ('unpaid', 'partial', 'paid');

-- CreateTable
CREATE TABLE "AccountsClient" (
    "id" TEXT NOT NULL,
    "type" "AccountsClientType" NOT NULL,
    "outsourcingClientId" TEXT,
    "recruitmentClientId" TEXT,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "nextInvoiceNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountsClient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountsStaffAccess" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountsClientId" TEXT,
    "canManageContracts" BOOLEAN NOT NULL DEFAULT false,
    "canManageInvoices" BOOLEAN NOT NULL DEFAULT false,
    "canManagePayments" BOOLEAN NOT NULL DEFAULT false,
    "canManageVendors" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountsStaffAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountsContract" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "title" TEXT,
    "reference" TEXT,
    "startDate" DATE,
    "endDate" DATE NOT NULL,
    "remindersDisabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountsContract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractManager" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,

    CONSTRAINT "ContractManager_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContractReminderSent" (
    "id" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "kind" "ContractReminderKind" NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractReminderSent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountsInvoice" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "contractId" TEXT,
    "invoiceNumber" INTEGER NOT NULL,
    "issueDate" DATE NOT NULL,
    "dueDate" DATE,
    "taxDate" DATE,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "vatRateBps" INTEGER NOT NULL DEFAULT 1600,
    "status" "AccountsInvoiceStatus" NOT NULL DEFAULT 'unpaid',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountsInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountsInvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "description" TEXT,
    "amountExVat" DECIMAL(14,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountsInvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountsClientPayment" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "receivedAt" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reference" TEXT,
    "method" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountsClientPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountsInvoicePaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "AccountsInvoicePaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountsVendor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountsVendor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountsVendorBill" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "billRef" TEXT,
    "issueDate" DATE NOT NULL,
    "dueDate" DATE,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "vatRateBps" INTEGER NOT NULL DEFAULT 1600,
    "status" "AccountsVendorBillStatus" NOT NULL DEFAULT 'unpaid',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountsVendorBill_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountsVendorBillLine" (
    "id" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "item" TEXT NOT NULL,
    "description" TEXT,
    "amountExVat" DECIMAL(14,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountsVendorBillLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountsVendorPayment" (
    "id" TEXT NOT NULL,
    "vendorId" TEXT NOT NULL,
    "paidAt" DATE NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reference" TEXT,
    "method" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountsVendorPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountsVendorPaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "billId" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "AccountsVendorPaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffNotification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "href" TEXT,
    "contractId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchedulerLock" (
    "key" TEXT NOT NULL,
    "lastRunAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SchedulerLock_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountsClient_outsourcingClientId_key" ON "AccountsClient"("outsourcingClientId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountsClient_recruitmentClientId_key" ON "AccountsClient"("recruitmentClientId");

-- CreateIndex
CREATE INDEX "AccountsClient_type_idx" ON "AccountsClient"("type");

-- CreateIndex
CREATE INDEX "AccountsClient_name_idx" ON "AccountsClient"("name");

-- AddForeignKey
ALTER TABLE "AccountsClient" ADD CONSTRAINT "AccountsClient_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountsClient" ADD CONSTRAINT "AccountsClient_recruitmentClientId_fkey" FOREIGN KEY ("recruitmentClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "AccountsStaffAccess_userId_idx" ON "AccountsStaffAccess"("userId");

-- CreateIndex
CREATE INDEX "AccountsStaffAccess_accountsClientId_idx" ON "AccountsStaffAccess"("accountsClientId");

-- CreateIndex
CREATE UNIQUE INDEX "AccountsStaffAccess_userId_accountsClientId_key" ON "AccountsStaffAccess"("userId", "accountsClientId");

-- AddForeignKey
ALTER TABLE "AccountsStaffAccess" ADD CONSTRAINT "AccountsStaffAccess_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountsStaffAccess" ADD CONSTRAINT "AccountsStaffAccess_accountsClientId_fkey" FOREIGN KEY ("accountsClientId") REFERENCES "AccountsClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "AccountsContract_clientId_idx" ON "AccountsContract"("clientId");

-- CreateIndex
CREATE INDEX "AccountsContract_endDate_idx" ON "AccountsContract"("endDate");

-- AddForeignKey
ALTER TABLE "AccountsContract" ADD CONSTRAINT "AccountsContract_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "AccountsClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "ContractManager_userId_idx" ON "ContractManager"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ContractManager_contractId_userId_key" ON "ContractManager"("contractId", "userId");

-- AddForeignKey
ALTER TABLE "ContractManager" ADD CONSTRAINT "ContractManager_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "AccountsContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContractManager" ADD CONSTRAINT "ContractManager_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "ContractReminderSent_contractId_kind_sentAt_idx" ON "ContractReminderSent"("contractId", "kind", "sentAt");

-- AddForeignKey
ALTER TABLE "ContractReminderSent" ADD CONSTRAINT "ContractReminderSent_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "AccountsContract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "AccountsInvoice_clientId_idx" ON "AccountsInvoice"("clientId");

-- CreateIndex
CREATE INDEX "AccountsInvoice_issueDate_idx" ON "AccountsInvoice"("issueDate");

-- CreateIndex
CREATE INDEX "AccountsInvoice_status_idx" ON "AccountsInvoice"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AccountsInvoice_clientId_invoiceNumber_key" ON "AccountsInvoice"("clientId", "invoiceNumber");

-- AddForeignKey
ALTER TABLE "AccountsInvoice" ADD CONSTRAINT "AccountsInvoice_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "AccountsClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountsInvoice" ADD CONSTRAINT "AccountsInvoice_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "AccountsContract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "AccountsInvoiceLine_invoiceId_idx" ON "AccountsInvoiceLine"("invoiceId");

-- AddForeignKey
ALTER TABLE "AccountsInvoiceLine" ADD CONSTRAINT "AccountsInvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "AccountsInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "AccountsClientPayment_clientId_idx" ON "AccountsClientPayment"("clientId");

-- CreateIndex
CREATE INDEX "AccountsClientPayment_receivedAt_idx" ON "AccountsClientPayment"("receivedAt");

-- AddForeignKey
ALTER TABLE "AccountsClientPayment" ADD CONSTRAINT "AccountsClientPayment_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "AccountsClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "AccountsInvoicePaymentAllocation_paymentId_idx" ON "AccountsInvoicePaymentAllocation"("paymentId");

-- CreateIndex
CREATE INDEX "AccountsInvoicePaymentAllocation_invoiceId_idx" ON "AccountsInvoicePaymentAllocation"("invoiceId");

-- AddForeignKey
ALTER TABLE "AccountsInvoicePaymentAllocation" ADD CONSTRAINT "AccountsInvoicePaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "AccountsClientPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountsInvoicePaymentAllocation" ADD CONSTRAINT "AccountsInvoicePaymentAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "AccountsInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "AccountsVendor_name_idx" ON "AccountsVendor"("name");

-- CreateIndex
CREATE INDEX "AccountsVendorBill_vendorId_idx" ON "AccountsVendorBill"("vendorId");

-- CreateIndex
CREATE INDEX "AccountsVendorBill_issueDate_idx" ON "AccountsVendorBill"("issueDate");

-- AddForeignKey
ALTER TABLE "AccountsVendorBill" ADD CONSTRAINT "AccountsVendorBill_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "AccountsVendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "AccountsVendorBillLine_billId_idx" ON "AccountsVendorBillLine"("billId");

-- AddForeignKey
ALTER TABLE "AccountsVendorBillLine" ADD CONSTRAINT "AccountsVendorBillLine_billId_fkey" FOREIGN KEY ("billId") REFERENCES "AccountsVendorBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "AccountsVendorPayment_vendorId_idx" ON "AccountsVendorPayment"("vendorId");

-- CreateIndex
CREATE INDEX "AccountsVendorPayment_paidAt_idx" ON "AccountsVendorPayment"("paidAt");

-- AddForeignKey
ALTER TABLE "AccountsVendorPayment" ADD CONSTRAINT "AccountsVendorPayment_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "AccountsVendor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "AccountsVendorPaymentAllocation_paymentId_idx" ON "AccountsVendorPaymentAllocation"("paymentId");

-- CreateIndex
CREATE INDEX "AccountsVendorPaymentAllocation_billId_idx" ON "AccountsVendorPaymentAllocation"("billId");

-- AddForeignKey
ALTER TABLE "AccountsVendorPaymentAllocation" ADD CONSTRAINT "AccountsVendorPaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "AccountsVendorPayment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountsVendorPaymentAllocation" ADD CONSTRAINT "AccountsVendorPaymentAllocation_billId_fkey" FOREIGN KEY ("billId") REFERENCES "AccountsVendorBill"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "StaffNotification_userId_createdAt_idx" ON "StaffNotification"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "StaffNotification_readAt_idx" ON "StaffNotification"("readAt");

-- AddForeignKey
ALTER TABLE "StaffNotification" ADD CONSTRAINT "StaffNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
