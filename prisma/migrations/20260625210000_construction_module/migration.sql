-- RAV-96: Construction vertical pack — site hierarchy, plant assets, subcontractor AP

CREATE TYPE "ConstructionSiteStatus" AS ENUM ('planning', 'active', 'suspended', 'completed');
CREATE TYPE "ConstructionPlantStatus" AS ENUM ('on_site', 'off_hire', 'maintenance', 'retired');
CREATE TYPE "ConstructionSubcontractorStatus" AS ENUM ('active', 'on_hold', 'completed');

CREATE TABLE "ConstructionSite" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "projectId" TEXT,
    "parentSiteId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ConstructionSiteStatus" NOT NULL DEFAULT 'planning',
    "location" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConstructionSite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConstructionPlantAsset" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "companyAssetId" TEXT,
    "assetTag" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "status" "ConstructionPlantStatus" NOT NULL DEFAULT 'on_site',
    "dailyHireRate" DECIMAL(12,2),
    "onSiteSince" DATE,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConstructionPlantAsset_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ConstructionSubcontractor" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "siteId" TEXT,
    "name" TEXT NOT NULL,
    "trade" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "retentionPct" DECIMAL(5,2),
    "contractValue" DECIMAL(14,2),
    "amountInvoiced" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "amountPaid" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "ConstructionSubcontractorStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConstructionSubcontractor_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ConstructionSite_outsourcingClientId_code_key" ON "ConstructionSite"("outsourcingClientId", "code");
CREATE INDEX "ConstructionSite_outsourcingClientId_status_idx" ON "ConstructionSite"("outsourcingClientId", "status");
CREATE INDEX "ConstructionSite_parentSiteId_idx" ON "ConstructionSite"("parentSiteId");
CREATE INDEX "ConstructionSite_projectId_idx" ON "ConstructionSite"("projectId");

CREATE UNIQUE INDEX "ConstructionPlantAsset_outsourcingClientId_assetTag_key" ON "ConstructionPlantAsset"("outsourcingClientId", "assetTag");
CREATE INDEX "ConstructionPlantAsset_siteId_status_idx" ON "ConstructionPlantAsset"("siteId", "status");

CREATE INDEX "ConstructionSubcontractor_outsourcingClientId_status_idx" ON "ConstructionSubcontractor"("outsourcingClientId", "status");
CREATE INDEX "ConstructionSubcontractor_siteId_idx" ON "ConstructionSubcontractor"("siteId");

ALTER TABLE "ConstructionSite" ADD CONSTRAINT "ConstructionSite_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConstructionSite" ADD CONSTRAINT "ConstructionSite_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ConstructionSite" ADD CONSTRAINT "ConstructionSite_parentSiteId_fkey" FOREIGN KEY ("parentSiteId") REFERENCES "ConstructionSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConstructionPlantAsset" ADD CONSTRAINT "ConstructionPlantAsset_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConstructionPlantAsset" ADD CONSTRAINT "ConstructionPlantAsset_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "ConstructionSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConstructionPlantAsset" ADD CONSTRAINT "ConstructionPlantAsset_companyAssetId_fkey" FOREIGN KEY ("companyAssetId") REFERENCES "CompanyAsset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ConstructionSubcontractor" ADD CONSTRAINT "ConstructionSubcontractor_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ConstructionSubcontractor" ADD CONSTRAINT "ConstructionSubcontractor_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "ConstructionSite"("id") ON DELETE SET NULL ON UPDATE CASCADE;
