-- CreateEnum
CREATE TYPE "FacilitySiteType" AS ENUM ('office', 'warehouse', 'retail', 'site', 'other');

-- CreateEnum
CREATE TYPE "FacilitySiteStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "FacilityLeaseStatus" AS ENUM ('active', 'expiring_soon', 'expired', 'terminated');

-- CreateEnum
CREATE TYPE "FacilityTicketCategory" AS ENUM ('plumbing', 'electrical', 'hvac', 'structural', 'cleaning', 'other');

-- CreateEnum
CREATE TYPE "FacilityTicketPriority" AS ENUM ('low', 'medium', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "FacilityTicketStatus" AS ENUM ('open', 'in_progress', 'on_hold', 'resolved', 'closed');

-- CreateTable
CREATE TABLE "FacilitySite" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "siteCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "siteType" "FacilitySiteType" NOT NULL DEFAULT 'office',
    "status" "FacilitySiteStatus" NOT NULL DEFAULT 'active',
    "address" TEXT,
    "county" TEXT,
    "phone" TEXT,
    "managerUserId" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacilitySite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilityLease" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "siteId" TEXT NOT NULL,
    "reference" TEXT,
    "landlordName" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "monthlyRent" DECIMAL(14,2),
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "status" "FacilityLeaseStatus" NOT NULL DEFAULT 'active',
    "renewalNotes" TEXT,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacilityLease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FacilityMaintenanceTicket" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "siteId" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "FacilityTicketCategory" NOT NULL DEFAULT 'other',
    "priority" "FacilityTicketPriority" NOT NULL DEFAULT 'medium',
    "status" "FacilityTicketStatus" NOT NULL DEFAULT 'open',
    "reportedByUserId" TEXT,
    "assigneeUserId" TEXT,
    "dueDate" DATE,
    "resolvedAt" TIMESTAMP(3),
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FacilityMaintenanceTicket_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FacilitySite_outsourcingClientId_siteCode_key" ON "FacilitySite"("outsourcingClientId", "siteCode");

-- CreateIndex
CREATE INDEX "FacilitySite_outsourcingClientId_idx" ON "FacilitySite"("outsourcingClientId");

-- CreateIndex
CREATE INDEX "FacilitySite_status_idx" ON "FacilitySite"("status");

-- CreateIndex
CREATE INDEX "FacilitySite_managerUserId_idx" ON "FacilitySite"("managerUserId");

-- CreateIndex
CREATE INDEX "FacilityLease_siteId_idx" ON "FacilityLease"("siteId");

-- CreateIndex
CREATE INDEX "FacilityLease_status_idx" ON "FacilityLease"("status");

-- CreateIndex
CREATE INDEX "FacilityLease_endDate_idx" ON "FacilityLease"("endDate");

-- CreateIndex
CREATE UNIQUE INDEX "FacilityMaintenanceTicket_outsourcingClientId_ticketNumber_key" ON "FacilityMaintenanceTicket"("outsourcingClientId", "ticketNumber");

-- CreateIndex
CREATE INDEX "FacilityMaintenanceTicket_outsourcingClientId_idx" ON "FacilityMaintenanceTicket"("outsourcingClientId");

-- CreateIndex
CREATE INDEX "FacilityMaintenanceTicket_siteId_idx" ON "FacilityMaintenanceTicket"("siteId");

-- CreateIndex
CREATE INDEX "FacilityMaintenanceTicket_status_idx" ON "FacilityMaintenanceTicket"("status");

-- CreateIndex
CREATE INDEX "FacilityMaintenanceTicket_priority_idx" ON "FacilityMaintenanceTicket"("priority");

-- CreateIndex
CREATE INDEX "FacilityMaintenanceTicket_assigneeUserId_idx" ON "FacilityMaintenanceTicket"("assigneeUserId");

-- CreateIndex
CREATE INDEX "FacilityMaintenanceTicket_dueDate_idx" ON "FacilityMaintenanceTicket"("dueDate");

-- AddForeignKey
ALTER TABLE "FacilitySite" ADD CONSTRAINT "FacilitySite_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilitySite" ADD CONSTRAINT "FacilitySite_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilitySite" ADD CONSTRAINT "FacilitySite_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityLease" ADD CONSTRAINT "FacilityLease_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "FacilitySite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityLease" ADD CONSTRAINT "FacilityLease_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityMaintenanceTicket" ADD CONSTRAINT "FacilityMaintenanceTicket_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityMaintenanceTicket" ADD CONSTRAINT "FacilityMaintenanceTicket_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "FacilitySite"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityMaintenanceTicket" ADD CONSTRAINT "FacilityMaintenanceTicket_reportedByUserId_fkey" FOREIGN KEY ("reportedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityMaintenanceTicket" ADD CONSTRAINT "FacilityMaintenanceTicket_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FacilityMaintenanceTicket" ADD CONSTRAINT "FacilityMaintenanceTicket_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RLS
ALTER TABLE "FacilitySite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FacilityLease" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FacilityMaintenanceTicket" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "FacilitySite_tenant_isolation" ON "FacilitySite"
  USING ("organizationId" = current_setting('app.current_organization_id', true)::uuid);

CREATE POLICY "FacilityLease_tenant_isolation" ON "FacilityLease"
  USING ("organizationId" = current_setting('app.current_organization_id', true)::uuid);

CREATE POLICY "FacilityMaintenanceTicket_tenant_isolation" ON "FacilityMaintenanceTicket"
  USING ("organizationId" = current_setting('app.current_organization_id', true)::uuid);
