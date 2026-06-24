-- AlterTable (IF NOT EXISTS safe if column already added elsewhere)
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "applicationStartAt" TIMESTAMP(3);
