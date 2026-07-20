-- Department: richer entity for payroll/reporting (code, head, cost centre, description, active flag).
-- Idempotent: safe to run against db-push-baselined databases (P3005) via `prisma db execute`.

ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "code" TEXT;
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "headEmployeeId" TEXT;
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "costCenterCode" TEXT;
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "costCenterName" TEXT;
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

-- Head-of-department FK (nullable; unassign the head if that employee is deleted).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Department_headEmployeeId_fkey') THEN
    ALTER TABLE "Department"
      ADD CONSTRAINT "Department_headEmployeeId_fkey"
      FOREIGN KEY ("headEmployeeId") REFERENCES "Employee"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Department_headEmployeeId_idx" ON "Department"("headEmployeeId");

-- Unique code per client. Code is NULL for all existing rows, and Postgres treats NULLs as
-- distinct, so this is always safe to create.
CREATE UNIQUE INDEX IF NOT EXISTS "Department_outsourcingClientId_code_key"
  ON "Department"("outsourcingClientId", "code");

-- Unique name per client. Only create the constraint when the existing data has no exact
-- duplicate (case-sensitive) names within a client — otherwise skip and rely on the
-- application-layer case-insensitive guard so the deploy never fails on legacy data.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "Department"
    GROUP BY "outsourcingClientId", "name"
    HAVING COUNT(*) > 1
  ) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS "Department_outsourcingClientId_name_key"
      ON "Department"("outsourcingClientId", "name");
  END IF;
END $$;
