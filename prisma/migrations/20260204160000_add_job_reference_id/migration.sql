-- AlterTable
ALTER TABLE "Job" ADD COLUMN "referenceId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Job_referenceId_key" ON "Job"("referenceId");

-- CreateIndex
CREATE INDEX "Job_referenceId_idx" ON "Job"("referenceId");
