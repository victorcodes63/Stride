-- CreateEnum
CREATE TYPE "GovernanceMeetingStatus" AS ENUM ('scheduled', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "GovernanceResolutionStatus" AS ENUM ('draft', 'adopted', 'rejected', 'withdrawn');

-- CreateEnum
CREATE TYPE "GovernanceActionStatus" AS ENUM ('open', 'in_progress', 'done', 'cancelled');

-- CreateTable
CREATE TABLE "GovernanceMeeting" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "meetingCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "meetingDate" DATE NOT NULL,
    "location" TEXT,
    "minutesSummary" TEXT,
    "status" "GovernanceMeetingStatus" NOT NULL DEFAULT 'scheduled',
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernanceMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernanceResolution" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "meetingId" TEXT,
    "resolutionCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "GovernanceResolutionStatus" NOT NULL DEFAULT 'draft',
    "adoptedAt" DATE,
    "effectiveDate" DATE,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernanceResolution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GovernanceActionItem" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "meetingId" TEXT,
    "resolutionId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "GovernanceActionStatus" NOT NULL DEFAULT 'open',
    "assigneeUserId" TEXT,
    "dueDate" DATE,
    "completedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernanceActionItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GovernanceMeeting_outsourcingClientId_meetingCode_key" ON "GovernanceMeeting"("outsourcingClientId", "meetingCode");

-- CreateIndex
CREATE INDEX "GovernanceMeeting_outsourcingClientId_idx" ON "GovernanceMeeting"("outsourcingClientId");

-- CreateIndex
CREATE INDEX "GovernanceMeeting_meetingDate_idx" ON "GovernanceMeeting"("meetingDate");

-- CreateIndex
CREATE INDEX "GovernanceMeeting_status_idx" ON "GovernanceMeeting"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GovernanceResolution_outsourcingClientId_resolutionCode_key" ON "GovernanceResolution"("outsourcingClientId", "resolutionCode");

-- CreateIndex
CREATE INDEX "GovernanceResolution_outsourcingClientId_idx" ON "GovernanceResolution"("outsourcingClientId");

-- CreateIndex
CREATE INDEX "GovernanceResolution_meetingId_idx" ON "GovernanceResolution"("meetingId");

-- CreateIndex
CREATE INDEX "GovernanceResolution_status_idx" ON "GovernanceResolution"("status");

-- CreateIndex
CREATE INDEX "GovernanceActionItem_outsourcingClientId_idx" ON "GovernanceActionItem"("outsourcingClientId");

-- CreateIndex
CREATE INDEX "GovernanceActionItem_meetingId_idx" ON "GovernanceActionItem"("meetingId");

-- CreateIndex
CREATE INDEX "GovernanceActionItem_resolutionId_idx" ON "GovernanceActionItem"("resolutionId");

-- CreateIndex
CREATE INDEX "GovernanceActionItem_status_idx" ON "GovernanceActionItem"("status");

-- CreateIndex
CREATE INDEX "GovernanceActionItem_assigneeUserId_idx" ON "GovernanceActionItem"("assigneeUserId");

-- CreateIndex
CREATE INDEX "GovernanceActionItem_dueDate_idx" ON "GovernanceActionItem"("dueDate");

-- AddForeignKey
ALTER TABLE "GovernanceMeeting" ADD CONSTRAINT "GovernanceMeeting_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernanceMeeting" ADD CONSTRAINT "GovernanceMeeting_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernanceResolution" ADD CONSTRAINT "GovernanceResolution_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernanceResolution" ADD CONSTRAINT "GovernanceResolution_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "GovernanceMeeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernanceResolution" ADD CONSTRAINT "GovernanceResolution_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernanceActionItem" ADD CONSTRAINT "GovernanceActionItem_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernanceActionItem" ADD CONSTRAINT "GovernanceActionItem_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "GovernanceMeeting"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernanceActionItem" ADD CONSTRAINT "GovernanceActionItem_resolutionId_fkey" FOREIGN KEY ("resolutionId") REFERENCES "GovernanceResolution"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernanceActionItem" ADD CONSTRAINT "GovernanceActionItem_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GovernanceActionItem" ADD CONSTRAINT "GovernanceActionItem_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS
ALTER TABLE "GovernanceMeeting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GovernanceResolution" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GovernanceActionItem" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "GovernanceMeeting_tenant_isolation" ON "GovernanceMeeting"
  USING ("organizationId" = current_setting('app.current_organization_id', true)::uuid);

CREATE POLICY "GovernanceResolution_tenant_isolation" ON "GovernanceResolution"
  USING ("organizationId" = current_setting('app.current_organization_id', true)::uuid);

CREATE POLICY "GovernanceActionItem_tenant_isolation" ON "GovernanceActionItem"
  USING ("organizationId" = current_setting('app.current_organization_id', true)::uuid);
