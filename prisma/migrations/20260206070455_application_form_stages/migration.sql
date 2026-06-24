-- AlterTable
ALTER TABLE "Application" ADD COLUMN     "formData" JSONB;

-- AlterTable
ALTER TABLE "Candidate" ADD COLUMN     "homeCounty" TEXT,
ADD COLUMN     "nationality" TEXT;

-- CreateIndex
CREATE INDEX "Candidate_nationality_idx" ON "Candidate"("nationality");

-- CreateIndex
CREATE INDEX "Candidate_homeCounty_idx" ON "Candidate"("homeCounty");
