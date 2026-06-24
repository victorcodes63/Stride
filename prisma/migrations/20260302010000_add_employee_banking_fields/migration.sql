-- AlterTable (idempotent)
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "employeeNumber" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "bankName" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "bankBranch" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "bankAccountNumber" TEXT;
