-- CreateTable (IF NOT EXISTS for idempotency)
CREATE TABLE IF NOT EXISTS "OutsourcingClient" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OutsourcingClient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS "OutsourcingClient_name_idx" ON "OutsourcingClient"("name");

-- Add new column if not exists (PostgreSQL 9.6+)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Department' AND column_name = 'outsourcingClientId') THEN
    ALTER TABLE "Department" ADD COLUMN "outsourcingClientId" TEXT;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'Employee' AND column_name = 'outsourcingClientId') THEN
    ALTER TABLE "Employee" ADD COLUMN "outsourcingClientId" TEXT;
  END IF;
END $$;

-- Drop old FKs and columns
ALTER TABLE "Department" DROP CONSTRAINT IF EXISTS "Department_clientId_fkey";
ALTER TABLE "Employee" DROP CONSTRAINT IF EXISTS "Employee_clientId_fkey";
ALTER TABLE "Department" DROP COLUMN IF EXISTS "clientId";
ALTER TABLE "Employee" DROP COLUMN IF EXISTS "clientId";

-- Set NOT NULL (safe if tables are empty)
ALTER TABLE "Department" ALTER COLUMN "outsourcingClientId" SET NOT NULL;
ALTER TABLE "Employee" ALTER COLUMN "outsourcingClientId" SET NOT NULL;

-- Add FKs (if not exist)
ALTER TABLE "Department" DROP CONSTRAINT IF EXISTS "Department_outsourcingClientId_fkey";
ALTER TABLE "Department" ADD CONSTRAINT "Department_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Employee" DROP CONSTRAINT IF EXISTS "Employee_outsourcingClientId_fkey";
ALTER TABLE "Employee" ADD CONSTRAINT "Employee_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
