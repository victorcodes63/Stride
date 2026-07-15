-- AlterTable
ALTER TABLE "OnboardingTask" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3);

-- Clear orphan documentId values before adding FK
UPDATE "OnboardingTask" AS t
SET "documentId" = NULL
WHERE t."documentId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "EmployeeDocument" d WHERE d."id" = t."documentId");

-- AddForeignKey
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OnboardingTask_documentId_fkey'
  ) THEN
    ALTER TABLE "OnboardingTask"
      ADD CONSTRAINT "OnboardingTask_documentId_fkey"
      FOREIGN KEY ("documentId") REFERENCES "EmployeeDocument"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "OnboardingTask_documentId_idx" ON "OnboardingTask"("documentId");
