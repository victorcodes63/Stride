-- Internal-staff department, cost-centre and optional salary basis for leave grouping/liability.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "department" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "costCenterCode" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "costCenterName" TEXT;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "monthlySalary" DECIMAL(12,2);
