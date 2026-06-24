-- CreateEnum
CREATE TYPE "AccountCategory" AS ENUM ('asset', 'liability', 'equity', 'revenue', 'expense');

-- CreateEnum
CREATE TYPE "ExpenseClaimStatus" AS ENUM ('draft', 'submitted', 'approved', 'rejected', 'reimbursed', 'cancelled');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('travel', 'meals', 'accommodation', 'transport', 'office_supplies', 'communication', 'training', 'entertainment', 'medical', 'fuel', 'parking', 'utilities', 'subscriptions', 'other');

-- CreateEnum
CREATE TYPE "BudgetStatus" AS ENUM ('draft', 'active', 'closed', 'exceeded');

-- CreateEnum
CREATE TYPE "BudgetPeriodType" AS ENUM ('monthly', 'quarterly', 'annual');

-- CreateEnum
CREATE TYPE "PettyCashStatus" AS ENUM ('open', 'closed', 'reconciled');

-- CreateEnum
CREATE TYPE "PettyCashTransactionType" AS ENUM ('replenishment', 'disbursement', 'refund');

-- CreateEnum
CREATE TYPE "AnnouncementStatus" AS ENUM ('draft', 'published', 'archived');

-- CreateEnum
CREATE TYPE "AnnouncementPriority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "TrainingStatus" AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('enrolled', 'in_progress', 'completed', 'withdrawn', 'failed');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('draft', 'published', 'archived');

-- AlterTable
ALTER TABLE "AccountsCreditNote" ADD COLUMN     "paymentAccountId" TEXT;

-- AlterTable
ALTER TABLE "AccountsInvoice" ADD COLUMN     "paymentAccountId" TEXT;

-- AlterTable
ALTER TABLE "EmployeeCredential" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "NotificationPolicy" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "Payroll" ALTER COLUMN "ahl" DROP DEFAULT;

-- AlterTable
ALTER TABLE "RecruitmentSettings" ALTER COLUMN "id" SET DEFAULT 'default';

-- AlterTable
ALTER TABLE "StatutoryReturn" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "StatutoryReturnItem" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "WorkflowRun" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateTable
CREATE TABLE "AccountsPaymentAccount" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "bank" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "bankCode" TEXT NOT NULL DEFAULT '',
    "branchCode" TEXT NOT NULL DEFAULT '',
    "swiftCode" TEXT NOT NULL DEFAULT '',
    "purposeNotes" TEXT,
    "isPayrollOnly" BOOLEAN NOT NULL DEFAULT false,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "legacyKind" "AccountsInvoicePaymentBank",
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountsPaymentAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChartOfAccount" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "AccountCategory" NOT NULL,
    "parentId" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChartOfAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GeneralLedgerEntry" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "transactionId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "reference" TEXT,
    "sourceType" TEXT,
    "sourceId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GeneralLedgerEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseClaim" (
    "id" TEXT NOT NULL,
    "claimNumber" TEXT NOT NULL,
    "employeeId" TEXT,
    "userId" TEXT,
    "claimantName" TEXT NOT NULL,
    "department" TEXT,
    "description" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "ExpenseClaimStatus" NOT NULL DEFAULT 'draft',
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" TEXT,
    "rejectionReason" TEXT,
    "reimbursedAt" TIMESTAMP(3),
    "paymentReference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExpenseClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseClaimItem" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "category" "ExpenseCategory" NOT NULL DEFAULT 'other',
    "description" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "receiptPath" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExpenseClaimItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Budget" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT,
    "category" TEXT,
    "fiscalYear" INTEGER NOT NULL,
    "periodType" "BudgetPeriodType" NOT NULL DEFAULT 'annual',
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "allocatedAmount" DECIMAL(14,2) NOT NULL,
    "spentAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "BudgetStatus" NOT NULL DEFAULT 'draft',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "approvedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Budget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BudgetLineItem" (
    "id" TEXT NOT NULL,
    "budgetId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "allocatedAmount" DECIMAL(14,2) NOT NULL,
    "spentAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BudgetLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PettyCashFund" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "floatAmount" DECIMAL(14,2) NOT NULL,
    "currentBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "PettyCashStatus" NOT NULL DEFAULT 'open',
    "custodianUserId" TEXT,
    "custodianName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PettyCashFund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PettyCashTransaction" (
    "id" TEXT NOT NULL,
    "fundId" TEXT NOT NULL,
    "type" "PettyCashTransactionType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "date" DATE NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "receiptPath" TEXT,
    "approvedByUserId" TEXT,
    "createdByUserId" TEXT,
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PettyCashTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Announcement" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" "AnnouncementStatus" NOT NULL DEFAULT 'draft',
    "priority" "AnnouncementPriority" NOT NULL DEFAULT 'normal',
    "authorUserId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "targetDepartments" JSONB,
    "targetRoles" JSONB,
    "attachmentPath" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingProgram" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "provider" TEXT,
    "location" TEXT,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "startDate" DATE,
    "endDate" DATE,
    "durationHours" INTEGER,
    "maxParticipants" INTEGER,
    "cost" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "status" "TrainingStatus" NOT NULL DEFAULT 'scheduled',
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingProgram_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingEnrollment" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "employeeId" TEXT,
    "userId" TEXT,
    "enrolleeName" TEXT NOT NULL,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'enrolled',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "score" DECIMAL(5,2),
    "certificatePath" TEXT,
    "feedback" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TrainingEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingMaterial" (
    "id" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "filePath" TEXT,
    "externalUrl" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrainingMaterial_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyDocument" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "version" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'published',
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "uploadedByUserId" TEXT NOT NULL,
    "department" TEXT,
    "tags" JSONB,
    "effectiveDate" DATE,
    "expiryDate" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AccountsPaymentAccount_legacyKind_key" ON "AccountsPaymentAccount"("legacyKind");

-- CreateIndex
CREATE INDEX "AccountsPaymentAccount_isActive_sortOrder_idx" ON "AccountsPaymentAccount"("isActive", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ChartOfAccount_code_key" ON "ChartOfAccount"("code");

-- CreateIndex
CREATE INDEX "ChartOfAccount_category_idx" ON "ChartOfAccount"("category");

-- CreateIndex
CREATE INDEX "ChartOfAccount_parentId_idx" ON "ChartOfAccount"("parentId");

-- CreateIndex
CREATE INDEX "ChartOfAccount_isActive_idx" ON "ChartOfAccount"("isActive");

-- CreateIndex
CREATE INDEX "GeneralLedgerEntry_accountId_date_idx" ON "GeneralLedgerEntry"("accountId", "date");

-- CreateIndex
CREATE INDEX "GeneralLedgerEntry_transactionId_idx" ON "GeneralLedgerEntry"("transactionId");

-- CreateIndex
CREATE INDEX "GeneralLedgerEntry_date_idx" ON "GeneralLedgerEntry"("date");

-- CreateIndex
CREATE INDEX "GeneralLedgerEntry_sourceType_sourceId_idx" ON "GeneralLedgerEntry"("sourceType", "sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseClaim_claimNumber_key" ON "ExpenseClaim"("claimNumber");

-- CreateIndex
CREATE INDEX "ExpenseClaim_status_idx" ON "ExpenseClaim"("status");

-- CreateIndex
CREATE INDEX "ExpenseClaim_employeeId_idx" ON "ExpenseClaim"("employeeId");

-- CreateIndex
CREATE INDEX "ExpenseClaim_userId_idx" ON "ExpenseClaim"("userId");

-- CreateIndex
CREATE INDEX "ExpenseClaim_submittedAt_idx" ON "ExpenseClaim"("submittedAt");

-- CreateIndex
CREATE INDEX "ExpenseClaimItem_claimId_idx" ON "ExpenseClaimItem"("claimId");

-- CreateIndex
CREATE INDEX "ExpenseClaimItem_date_idx" ON "ExpenseClaimItem"("date");

-- CreateIndex
CREATE INDEX "ExpenseClaimItem_category_idx" ON "ExpenseClaimItem"("category");

-- CreateIndex
CREATE INDEX "Budget_fiscalYear_status_idx" ON "Budget"("fiscalYear", "status");

-- CreateIndex
CREATE INDEX "Budget_department_idx" ON "Budget"("department");

-- CreateIndex
CREATE INDEX "Budget_startDate_endDate_idx" ON "Budget"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "BudgetLineItem_budgetId_idx" ON "BudgetLineItem"("budgetId");

-- CreateIndex
CREATE INDEX "PettyCashFund_status_idx" ON "PettyCashFund"("status");

-- CreateIndex
CREATE INDEX "PettyCashFund_custodianUserId_idx" ON "PettyCashFund"("custodianUserId");

-- CreateIndex
CREATE INDEX "PettyCashTransaction_fundId_date_idx" ON "PettyCashTransaction"("fundId", "date");

-- CreateIndex
CREATE INDEX "PettyCashTransaction_type_idx" ON "PettyCashTransaction"("type");

-- CreateIndex
CREATE INDEX "PettyCashTransaction_date_idx" ON "PettyCashTransaction"("date");

-- CreateIndex
CREATE INDEX "Announcement_status_publishedAt_idx" ON "Announcement"("status", "publishedAt");

-- CreateIndex
CREATE INDEX "Announcement_isPinned_publishedAt_idx" ON "Announcement"("isPinned", "publishedAt");

-- CreateIndex
CREATE INDEX "Announcement_authorUserId_idx" ON "Announcement"("authorUserId");

-- CreateIndex
CREATE INDEX "Announcement_expiresAt_idx" ON "Announcement"("expiresAt");

-- CreateIndex
CREATE INDEX "TrainingProgram_status_idx" ON "TrainingProgram"("status");

-- CreateIndex
CREATE INDEX "TrainingProgram_category_idx" ON "TrainingProgram"("category");

-- CreateIndex
CREATE INDEX "TrainingProgram_startDate_idx" ON "TrainingProgram"("startDate");

-- CreateIndex
CREATE INDEX "TrainingEnrollment_programId_idx" ON "TrainingEnrollment"("programId");

-- CreateIndex
CREATE INDEX "TrainingEnrollment_employeeId_idx" ON "TrainingEnrollment"("employeeId");

-- CreateIndex
CREATE INDEX "TrainingEnrollment_userId_idx" ON "TrainingEnrollment"("userId");

-- CreateIndex
CREATE INDEX "TrainingEnrollment_status_idx" ON "TrainingEnrollment"("status");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingEnrollment_programId_employeeId_key" ON "TrainingEnrollment"("programId", "employeeId");

-- CreateIndex
CREATE INDEX "TrainingMaterial_programId_sortOrder_idx" ON "TrainingMaterial"("programId", "sortOrder");

-- CreateIndex
CREATE INDEX "CompanyDocument_category_idx" ON "CompanyDocument"("category");

-- CreateIndex
CREATE INDEX "CompanyDocument_status_idx" ON "CompanyDocument"("status");

-- CreateIndex
CREATE INDEX "CompanyDocument_department_idx" ON "CompanyDocument"("department");

-- CreateIndex
CREATE INDEX "CompanyDocument_effectiveDate_idx" ON "CompanyDocument"("effectiveDate");

-- CreateIndex
CREATE INDEX "Department_outsourcingClientId_idx" ON "Department"("outsourcingClientId");

-- CreateIndex
CREATE INDEX "Employee_outsourcingClientId_idx" ON "Employee"("outsourcingClientId");

-- AddForeignKey
ALTER TABLE "AccountsInvoice" ADD CONSTRAINT "AccountsInvoice_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "AccountsPaymentAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountsCreditNote" ADD CONSTRAINT "AccountsCreditNote_paymentAccountId_fkey" FOREIGN KEY ("paymentAccountId") REFERENCES "AccountsPaymentAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChartOfAccount" ADD CONSTRAINT "ChartOfAccount_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ChartOfAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneralLedgerEntry" ADD CONSTRAINT "GeneralLedgerEntry_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "ChartOfAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseClaimItem" ADD CONSTRAINT "ExpenseClaimItem_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "ExpenseClaim"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLineItem" ADD CONSTRAINT "BudgetLineItem_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PettyCashTransaction" ADD CONSTRAINT "PettyCashTransaction_fundId_fkey" FOREIGN KEY ("fundId") REFERENCES "PettyCashFund"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingEnrollment" ADD CONSTRAINT "TrainingEnrollment_programId_fkey" FOREIGN KEY ("programId") REFERENCES "TrainingProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingMaterial" ADD CONSTRAINT "TrainingMaterial_programId_fkey" FOREIGN KEY ("programId") REFERENCES "TrainingProgram"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "EmployeeEntityTransfer_sourceEntityCode_targetEntityCode_create" RENAME TO "EmployeeEntityTransfer_sourceEntityCode_targetEntityCode_cr_idx";

-- RenameIndex
ALTER INDEX "EmployeeLifecycleEvent_outsourcingClientId_eventType_effectiveD" RENAME TO "EmployeeLifecycleEvent_outsourcingClientId_eventType_effect_idx";

