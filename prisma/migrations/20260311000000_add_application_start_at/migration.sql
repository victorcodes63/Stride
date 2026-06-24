-- AlterTable (idempotent if 20260217060000 already ran)
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "applicationStartAt" TIMESTAMP(3);
