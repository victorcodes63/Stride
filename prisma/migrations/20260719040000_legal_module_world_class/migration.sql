-- CreateEnum
CREATE TYPE "LegalObligationPriority" AS ENUM ('low', 'medium', 'high', 'critical');

-- CreateEnum
CREATE TYPE "LegalObligationReminderKind" AS ENUM ('days_60', 'days_30', 'days_14', 'days_7', 'due_day', 'overdue_weekly');

-- CreateEnum
CREATE TYPE "LegalObligationEventType" AS ENUM ('created', 'updated', 'assigned', 'status_changed', 'completed', 'waived', 'reopened', 'evidence_uploaded', 'evidence_removed');

-- AlterTable
ALTER TABLE "LegalObligation"
    ADD COLUMN "priority" "LegalObligationPriority" NOT NULL DEFAULT 'medium',
    ADD COLUMN "reminderDays" INTEGER NOT NULL DEFAULT 30,
    ADD COLUMN "recurrenceMonths" INTEGER,
    ADD COLUMN "completedAt" TIMESTAMP(3),
    ADD COLUMN "waivedReason" TEXT;

-- CreateTable
CREATE TABLE "LegalObligationReminderSent" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "obligationId" TEXT NOT NULL,
    "kind" "LegalObligationReminderKind" NOT NULL,
    "sentOnYmd" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalObligationReminderSent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LegalObligationEvent" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "obligationId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "type" "LegalObligationEventType" NOT NULL,
    "fromStatus" "LegalObligationStatus",
    "toStatus" "LegalObligationStatus",
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalObligationEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LegalObligation_organizationId_priority_idx" ON "LegalObligation"("organizationId", "priority");

-- CreateIndex
CREATE INDEX "LegalObligation_ownerUserId_idx" ON "LegalObligation"("ownerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "LegalObligationReminderSent_obligationId_kind_sentOnYmd_key" ON "LegalObligationReminderSent"("obligationId", "kind", "sentOnYmd");

-- CreateIndex
CREATE INDEX "LegalObligationReminderSent_organizationId_kind_idx" ON "LegalObligationReminderSent"("organizationId", "kind");

-- CreateIndex
CREATE INDEX "LegalObligationReminderSent_sentOnYmd_idx" ON "LegalObligationReminderSent"("sentOnYmd");

-- CreateIndex
CREATE INDEX "LegalObligationEvent_obligationId_createdAt_idx" ON "LegalObligationEvent"("obligationId", "createdAt");

-- CreateIndex
CREATE INDEX "LegalObligationEvent_organizationId_createdAt_idx" ON "LegalObligationEvent"("organizationId", "createdAt");

-- AddForeignKey
ALTER TABLE "LegalObligationReminderSent" ADD CONSTRAINT "LegalObligationReminderSent_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "LegalObligation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalObligationEvent" ADD CONSTRAINT "LegalObligationEvent_obligationId_fkey" FOREIGN KEY ("obligationId") REFERENCES "LegalObligation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LegalObligationEvent" ADD CONSTRAINT "LegalObligationEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
