-- CreateEnum
CREATE TYPE "ConfirmationStatus" AS ENUM ('pending', 'confirmed', 'declined', 'reschedule_requested');

-- AlterTable
ALTER TABLE "Interview" ADD COLUMN     "confirmationAt" TIMESTAMP(3),
ADD COLUMN     "confirmationNotes" TEXT,
ADD COLUMN     "confirmationStatus" "ConfirmationStatus" NOT NULL DEFAULT 'pending';

-- CreateIndex
CREATE INDEX "Insight_slug_idx" ON "Insight"("slug");

-- CreateIndex
CREATE INDEX "Job_slug_idx" ON "Job"("slug");
