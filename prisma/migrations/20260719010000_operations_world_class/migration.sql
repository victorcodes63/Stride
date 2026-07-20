-- CreateEnum
CREATE TYPE "AssetMaintenanceType" AS ENUM ('preventive', 'corrective', 'inspection', 'calibration', 'repair', 'other');

-- CreateEnum
CREATE TYPE "AssetMaintenanceStatus" AS ENUM ('scheduled', 'in_progress', 'completed', 'cancelled');

-- AlterTable
ALTER TABLE "CompanyAsset" ADD COLUMN     "depreciationMethod" TEXT,
ADD COLUMN     "handoverNotes" TEXT,
ADD COLUMN     "handoverSignaturePath" TEXT,
ADD COLUMN     "lastMaintenanceAt" TIMESTAMP(3),
ADD COLUMN     "nextMaintenanceAt" DATE,
ADD COLUMN     "qrToken" TEXT,
ADD COLUMN     "salvageValue" DECIMAL(12,2),
ADD COLUMN     "usefulLifeMonths" INTEGER;

-- AlterTable
ALTER TABLE "Announcement" ADD COLUMN     "requireAcknowledgement" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "HseIncident" ADD COLUMN     "lostTimeDays" INTEGER,
ADD COLUMN     "lostTimeInjury" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reportableToAuthority" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rootCause" TEXT,
ADD COLUMN     "rootCauseCategory" TEXT,
ADD COLUMN     "witnessNames" TEXT;

-- CreateTable
CREATE TABLE "AssetMaintenance" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyAssetId" TEXT NOT NULL,
    "type" "AssetMaintenanceType" NOT NULL DEFAULT 'preventive',
    "status" "AssetMaintenanceStatus" NOT NULL DEFAULT 'scheduled',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "vendor" TEXT,
    "cost" DECIMAL(12,2),
    "scheduledFor" DATE,
    "completedAt" TIMESTAMP(3),
    "nextDueAt" DATE,
    "performedByUserId" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssetMaintenance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssetAttachment" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyAssetId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "contentType" TEXT,
    "fileSize" INTEGER,
    "kind" TEXT,
    "uploadedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementRead" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "announcementId" TEXT NOT NULL,
    "userId" TEXT,
    "employeeId" TEXT,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acknowledgedAt" TIMESTAMP(3),

    CONSTRAINT "AnnouncementRead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AnnouncementAttachment" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "announcementId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "contentType" TEXT,
    "fileSize" INTEGER,
    "uploadedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AnnouncementAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HseAttachment" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "incidentId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "contentType" TEXT,
    "fileSize" INTEGER,
    "kind" TEXT,
    "uploadedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "HseAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AssetMaintenance_companyAssetId_scheduledFor_idx" ON "AssetMaintenance"("companyAssetId", "scheduledFor");

-- CreateIndex
CREATE INDEX "AssetMaintenance_organizationId_status_idx" ON "AssetMaintenance"("organizationId", "status");

-- CreateIndex
CREATE INDEX "AssetMaintenance_nextDueAt_idx" ON "AssetMaintenance"("nextDueAt");

-- CreateIndex
CREATE INDEX "AssetAttachment_companyAssetId_createdAt_idx" ON "AssetAttachment"("companyAssetId", "createdAt");

-- CreateIndex
CREATE INDEX "AnnouncementRead_announcementId_idx" ON "AnnouncementRead"("announcementId");

-- CreateIndex
CREATE INDEX "AnnouncementRead_userId_idx" ON "AnnouncementRead"("userId");

-- CreateIndex
CREATE INDEX "AnnouncementRead_employeeId_idx" ON "AnnouncementRead"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "AnnouncementRead_announcementId_userId_key" ON "AnnouncementRead"("announcementId", "userId");

-- CreateIndex
CREATE INDEX "AnnouncementAttachment_announcementId_idx" ON "AnnouncementAttachment"("announcementId");

-- CreateIndex
CREATE INDEX "HseAttachment_incidentId_createdAt_idx" ON "HseAttachment"("incidentId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyAsset_qrToken_key" ON "CompanyAsset"("qrToken");

-- CreateIndex
CREATE INDEX "CompanyAsset_nextMaintenanceAt_idx" ON "CompanyAsset"("nextMaintenanceAt");

-- AddForeignKey
ALTER TABLE "AssetMaintenance" ADD CONSTRAINT "AssetMaintenance_companyAssetId_fkey" FOREIGN KEY ("companyAssetId") REFERENCES "CompanyAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AssetAttachment" ADD CONSTRAINT "AssetAttachment_companyAssetId_fkey" FOREIGN KEY ("companyAssetId") REFERENCES "CompanyAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementRead" ADD CONSTRAINT "AnnouncementRead_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AnnouncementAttachment" ADD CONSTRAINT "AnnouncementAttachment_announcementId_fkey" FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HseAttachment" ADD CONSTRAINT "HseAttachment_incidentId_fkey" FOREIGN KEY ("incidentId") REFERENCES "HseIncident"("id") ON DELETE CASCADE ON UPDATE CASCADE;

