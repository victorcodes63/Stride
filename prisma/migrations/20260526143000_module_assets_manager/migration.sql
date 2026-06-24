-- Asset manager module: company assets registry and employee assignments.

CREATE TYPE "AssetCategory" AS ENUM (
  'it_equipment',
  'furniture',
  'vehicle',
  'mobile_device',
  'tools',
  'uniform_ppe',
  'other'
);

CREATE TYPE "AssetStatus" AS ENUM (
  'available',
  'assigned',
  'maintenance',
  'retired',
  'lost'
);

CREATE TABLE "CompanyAsset" (
  "id" TEXT NOT NULL,
  "outsourcingClientId" TEXT NOT NULL,
  "assetTag" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" "AssetCategory" NOT NULL DEFAULT 'it_equipment',
  "status" "AssetStatus" NOT NULL DEFAULT 'available',
  "serialNumber" TEXT,
  "manufacturer" TEXT,
  "model" TEXT,
  "purchaseDate" DATE,
  "purchaseCost" DECIMAL(12,2),
  "warrantyExpiry" DATE,
  "location" TEXT,
  "notes" TEXT,
  "assignedEmployeeId" TEXT,
  "assignedAt" TIMESTAMP(3),
  "assignedByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CompanyAsset_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompanyAsset_outsourcingClientId_assetTag_key" ON "CompanyAsset"("outsourcingClientId", "assetTag");
CREATE INDEX "CompanyAsset_outsourcingClientId_status_idx" ON "CompanyAsset"("outsourcingClientId", "status");
CREATE INDEX "CompanyAsset_assignedEmployeeId_idx" ON "CompanyAsset"("assignedEmployeeId");
CREATE INDEX "CompanyAsset_category_idx" ON "CompanyAsset"("category");

ALTER TABLE "CompanyAsset"
  ADD CONSTRAINT "CompanyAsset_outsourcingClientId_fkey"
  FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CompanyAsset"
  ADD CONSTRAINT "CompanyAsset_assignedEmployeeId_fkey"
  FOREIGN KEY ("assignedEmployeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CompanyAsset"
  ADD CONSTRAINT "CompanyAsset_assignedByUserId_fkey"
  FOREIGN KEY ("assignedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
