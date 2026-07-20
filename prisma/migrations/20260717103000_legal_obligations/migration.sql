-- CreateEnum
CREATE TYPE "LegalObligationCategory" AS ENUM ('filing', 'permit', 'licence', 'board', 'regulator', 'insurance', 'other');

-- CreateEnum
CREATE TYPE "LegalObligationStatus" AS ENUM ('pending', 'completed', 'waived');

-- CreateTable
CREATE TABLE "LegalObligation" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "LegalObligationCategory" NOT NULL DEFAULT 'other',
    "dueDate" DATE NOT NULL,
    "status" "LegalObligationStatus" NOT NULL DEFAULT 'pending',
    "ownerUserId" TEXT,
    "regulator" TEXT,
    "evidencePath" TEXT,
    "evidenceFileName" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LegalObligation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LegalObligation_organizationId_dueDate_idx" ON "LegalObligation"("organizationId", "dueDate");

-- CreateIndex
CREATE INDEX "LegalObligation_organizationId_status_idx" ON "LegalObligation"("organizationId", "status");

-- AddForeignKey
ALTER TABLE "LegalObligation" ADD CONSTRAINT "LegalObligation_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
