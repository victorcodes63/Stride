-- Asset lifecycle: assignment history, handover acknowledgement
CREATE TYPE "AssetAssignmentEventType" AS ENUM (
  'created',
  'assigned',
  'returned',
  'transferred',
  'status_changed',
  'acknowledged'
);

ALTER TABLE "CompanyAsset" ADD COLUMN "handoverAcknowledgedAt" TIMESTAMP(3);

CREATE INDEX "CompanyAsset_warrantyExpiry_idx" ON "CompanyAsset"("warrantyExpiry");

CREATE TABLE "AssetAssignmentEvent" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "companyAssetId" TEXT NOT NULL,
    "eventType" "AssetAssignmentEventType" NOT NULL,
    "employeeId" TEXT,
    "fromEmployeeId" TEXT,
    "performedByUserId" TEXT,
    "fromStatus" "AssetStatus",
    "toStatus" "AssetStatus",
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssetAssignmentEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AssetAssignmentEvent_companyAssetId_createdAt_idx" ON "AssetAssignmentEvent"("companyAssetId", "createdAt");
CREATE INDEX "AssetAssignmentEvent_organizationId_createdAt_idx" ON "AssetAssignmentEvent"("organizationId", "createdAt");
CREATE INDEX "AssetAssignmentEvent_employeeId_idx" ON "AssetAssignmentEvent"("employeeId");

ALTER TABLE "AssetAssignmentEvent" ADD CONSTRAINT "AssetAssignmentEvent_companyAssetId_fkey" FOREIGN KEY ("companyAssetId") REFERENCES "CompanyAsset"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssetAssignmentEvent" ADD CONSTRAINT "AssetAssignmentEvent_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssetAssignmentEvent" ADD CONSTRAINT "AssetAssignmentEvent_fromEmployeeId_fkey" FOREIGN KEY ("fromEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssetAssignmentEvent" ADD CONSTRAINT "AssetAssignmentEvent_performedByUserId_fkey" FOREIGN KEY ("performedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
