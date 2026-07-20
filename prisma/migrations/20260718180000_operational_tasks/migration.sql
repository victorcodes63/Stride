-- Extend WorkflowType so tasks can live outside onboarding/offboarding
ALTER TYPE "WorkflowType" ADD VALUE IF NOT EXISTS 'OPERATIONAL';

-- CreateEnum TaskPriority
DO $$ BEGIN
  CREATE TYPE "TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum TaskRecurrence
DO $$ BEGIN
  CREATE TYPE "TaskRecurrence" AS ENUM ('NONE', 'DAILY', 'WEEKLY', 'MONTHLY');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- AlterTable OnboardingWorkflow: operational buckets have no employee/template
ALTER TABLE "OnboardingWorkflow" ALTER COLUMN "employeeId" DROP NOT NULL;
ALTER TABLE "OnboardingWorkflow" ALTER COLUMN "templateId" DROP NOT NULL;
ALTER TABLE "OnboardingWorkflow" ADD COLUMN IF NOT EXISTS "outsourcingClientId" TEXT;
ALTER TABLE "OnboardingWorkflow" ADD COLUMN IF NOT EXISTS "title" TEXT;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OnboardingWorkflow_organizationId_type_status_idx"
  ON "OnboardingWorkflow"("organizationId", "type", "status");
CREATE INDEX IF NOT EXISTS "OnboardingWorkflow_outsourcingClientId_idx"
  ON "OnboardingWorkflow"("outsourcingClientId");

-- AlterTable OnboardingTask: priority, recurrence, optional employee link
ALTER TABLE "OnboardingTask" ADD COLUMN IF NOT EXISTS "priority" "TaskPriority" NOT NULL DEFAULT 'MEDIUM';
ALTER TABLE "OnboardingTask" ADD COLUMN IF NOT EXISTS "recurrence" "TaskRecurrence" NOT NULL DEFAULT 'NONE';
ALTER TABLE "OnboardingTask" ADD COLUMN IF NOT EXISTS "recurrenceEndsAt" TIMESTAMP(3);
ALTER TABLE "OnboardingTask" ADD COLUMN IF NOT EXISTS "employeeId" TEXT;

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OnboardingTask_employeeId_fkey'
  ) THEN
    ALTER TABLE "OnboardingTask"
      ADD CONSTRAINT "OnboardingTask_employeeId_fkey"
      FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OnboardingTask_employeeId_idx" ON "OnboardingTask"("employeeId");
