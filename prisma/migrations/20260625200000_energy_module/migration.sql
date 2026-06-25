-- RAV-95: Energy vertical pack — sites, permit tracking, multi-entity HSE rollup hooks

CREATE TYPE "EnergyPermitStatus" AS ENUM ('active', 'expiring_soon', 'expired', 'revoked', 'pending');
CREATE TYPE "EnergyPermitType" AS ENUM ('environmental', 'operating', 'safety', 'transport', 'other');

CREATE TABLE "EnergySite" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "region" TEXT,
    "operatingEntityLabel" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnergySite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EnergyPermit" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "permitNumber" TEXT NOT NULL,
    "permitType" "EnergyPermitType" NOT NULL DEFAULT 'operating',
    "issuingAuthority" TEXT NOT NULL,
    "issuedAt" DATE NOT NULL,
    "expiresAt" DATE NOT NULL,
    "status" "EnergyPermitStatus" NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EnergyPermit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EnergySite_outsourcingClientId_code_key" ON "EnergySite"("outsourcingClientId", "code");
CREATE INDEX "EnergySite_outsourcingClientId_isActive_idx" ON "EnergySite"("outsourcingClientId", "isActive");

CREATE UNIQUE INDEX "EnergyPermit_outsourcingClientId_permitNumber_key" ON "EnergyPermit"("outsourcingClientId", "permitNumber");
CREATE INDEX "EnergyPermit_outsourcingClientId_expiresAt_idx" ON "EnergyPermit"("outsourcingClientId", "expiresAt");
CREATE INDEX "EnergyPermit_siteId_status_idx" ON "EnergyPermit"("siteId", "status");

ALTER TABLE "EnergySite" ADD CONSTRAINT "EnergySite_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EnergyPermit" ADD CONSTRAINT "EnergyPermit_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EnergyPermit" ADD CONSTRAINT "EnergyPermit_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "EnergySite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
