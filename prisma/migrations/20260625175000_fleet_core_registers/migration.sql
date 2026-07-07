-- Fleet core registers (vehicles, drivers, trips, orders) required before fuel/maintenance logs.

-- CreateEnum
CREATE TYPE "FleetVehicleOwnership" AS ENUM ('managed', 'outsourced');

-- CreateEnum
CREATE TYPE "FleetVehicleStatus" AS ENUM ('available', 'in_transit', 'maintenance', 'out_of_service');

-- CreateEnum
CREATE TYPE "FleetDriverStatus" AS ENUM ('available', 'on_trip', 'off_duty', 'suspended');

-- CreateEnum
CREATE TYPE "FleetOrderStatus" AS ENUM ('draft', 'validated', 'assigned', 'in_progress', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "FleetTripStatus" AS ENUM ('planned', 'allocated', 'compliance_check', 'loaded', 'in_transit', 'delivered', 'settled', 'invoiced', 'closed', 'exception');

-- CreateEnum
CREATE TYPE "FleetComplianceCheckType" AS ENUM ('driver_licence', 'vehicle_insurance', 'vehicle_inspection', 'cargo_documents', 'transport_permit_local', 'transport_permit_transit');

-- CreateEnum
CREATE TYPE "FleetComplianceResult" AS ENUM ('pending', 'passed', 'failed', 'waived');

-- CreateEnum
CREATE TYPE "FleetTripDocumentType" AS ENUM ('delivery_note', 'transport_permit', 'pod', 'other');

-- CreateEnum
CREATE TYPE "FleetSettlementType" AS ENUM ('driver', 'partner');

-- CreateEnum
CREATE TYPE "FleetSettlementStatus" AS ENUM ('pending', 'approved', 'paid');

-- CreateEnum
CREATE TYPE "FleetIncidentType" AS ENUM ('breakdown', 'accident', 'delay', 'dispute');

-- CreateEnum
CREATE TYPE "FleetIncidentSeverity" AS ENUM ('low', 'medium', 'high');

-- CreateEnum
CREATE TYPE "FleetIncidentStatus" AS ENUM ('open', 'investigating', 'resolved', 'closed');

-- CreateTable
CREATE TABLE "FleetVehicle" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "registration" TEXT NOT NULL,
    "label" TEXT,
    "vehicleType" TEXT,
    "capacityKg" INTEGER,
    "capacityCbm" DECIMAL(10,2),
    "ownership" "FleetVehicleOwnership" NOT NULL DEFAULT 'managed',
    "status" "FleetVehicleStatus" NOT NULL DEFAULT 'available',
    "depotLocation" TEXT,
    "odometerKm" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetVehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetDriver" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "employeeId" TEXT,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "licenceNumber" TEXT,
    "licenceClass" TEXT,
    "licenceExpiry" DATE,
    "status" "FleetDriverStatus" NOT NULL DEFAULT 'available',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetDriver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetTransportPartner" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "payoutDetails" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetTransportPartner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetCustomer" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "accountsClientId" TEXT,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "contactEmail" TEXT,
    "billingTerms" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetOrder" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "pickupLocation" TEXT NOT NULL,
    "deliveryLocation" TEXT NOT NULL,
    "cargoType" TEXT,
    "cargoWeightKg" INTEGER,
    "cargoVolumeCbm" DECIMAL(10,2),
    "truckRequirements" TEXT,
    "requestedPickupAt" TIMESTAMP(3),
    "deliveryDeadlineAt" TIMESTAMP(3),
    "status" "FleetOrderStatus" NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetTrip" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "tripNumber" TEXT NOT NULL,
    "orderId" TEXT,
    "customerId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "driverId" TEXT,
    "partnerId" TEXT,
    "status" "FleetTripStatus" NOT NULL DEFAULT 'planned',
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "cargoType" TEXT,
    "cargoWeightKg" INTEGER,
    "plannedDistanceKm" INTEGER,
    "actualDistanceKm" INTEGER,
    "plannedDeliveryAt" TIMESTAMP(3),
    "actualDeliveryAt" TIMESTAMP(3),
    "isOutsourced" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "clientInvoiceId" TEXT,

    CONSTRAINT "FleetTrip_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetTripEvent" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "tripId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FleetTripEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetTripComplianceCheck" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "tripId" TEXT NOT NULL,
    "checkType" "FleetComplianceCheckType" NOT NULL,
    "result" "FleetComplianceResult" NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "evidenceUrl" TEXT,
    "checkedByUserId" TEXT,
    "checkedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetTripComplianceCheck_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetTripDocument" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "tripId" TEXT NOT NULL,
    "docType" "FleetTripDocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "uploadedByUserId" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "verifiedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FleetTripDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetSettlement" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "settlementType" "FleetSettlementType" NOT NULL,
    "payeeName" TEXT NOT NULL,
    "amountKes" DECIMAL(14,2) NOT NULL,
    "status" "FleetSettlementStatus" NOT NULL DEFAULT 'pending',
    "podVerified" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetIncident" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "incidentType" "FleetIncidentType" NOT NULL,
    "severity" "FleetIncidentSeverity" NOT NULL DEFAULT 'medium',
    "status" "FleetIncidentStatus" NOT NULL DEFAULT 'open',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "resolution" TEXT,
    "ownerUserId" TEXT,
    "escalatedAt" TIMESTAMP(3),
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetIncident_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FleetVehicle_outsourcingClientId_status_idx" ON "FleetVehicle"("outsourcingClientId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FleetVehicle_outsourcingClientId_registration_key" ON "FleetVehicle"("outsourcingClientId", "registration");

-- CreateIndex
CREATE UNIQUE INDEX "FleetDriver_employeeId_key" ON "FleetDriver"("employeeId");

-- CreateIndex
CREATE INDEX "FleetDriver_outsourcingClientId_status_idx" ON "FleetDriver"("outsourcingClientId", "status");

-- CreateIndex
CREATE INDEX "FleetTransportPartner_outsourcingClientId_name_idx" ON "FleetTransportPartner"("outsourcingClientId", "name");

-- CreateIndex
CREATE INDEX "FleetCustomer_outsourcingClientId_name_idx" ON "FleetCustomer"("outsourcingClientId", "name");

-- CreateIndex
CREATE INDEX "FleetCustomer_accountsClientId_idx" ON "FleetCustomer"("accountsClientId");

-- CreateIndex
CREATE INDEX "FleetOrder_outsourcingClientId_status_idx" ON "FleetOrder"("outsourcingClientId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "FleetOrder_outsourcingClientId_orderNumber_key" ON "FleetOrder"("outsourcingClientId", "orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "FleetTrip_clientInvoiceId_key" ON "FleetTrip"("clientInvoiceId");

-- CreateIndex
CREATE INDEX "FleetTrip_outsourcingClientId_status_idx" ON "FleetTrip"("outsourcingClientId", "status");

-- CreateIndex
CREATE INDEX "FleetTrip_vehicleId_idx" ON "FleetTrip"("vehicleId");

-- CreateIndex
CREATE INDEX "FleetTrip_driverId_idx" ON "FleetTrip"("driverId");

-- CreateIndex
CREATE UNIQUE INDEX "FleetTrip_outsourcingClientId_tripNumber_key" ON "FleetTrip"("outsourcingClientId", "tripNumber");

-- CreateIndex
CREATE INDEX "FleetTripEvent_tripId_createdAt_idx" ON "FleetTripEvent"("tripId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "FleetTripComplianceCheck_tripId_idx" ON "FleetTripComplianceCheck"("tripId");

-- CreateIndex
CREATE UNIQUE INDEX "FleetTripComplianceCheck_tripId_checkType_key" ON "FleetTripComplianceCheck"("tripId", "checkType");

-- CreateIndex
CREATE INDEX "FleetTripDocument_tripId_createdAt_idx" ON "FleetTripDocument"("tripId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "FleetSettlement_tripId_key" ON "FleetSettlement"("tripId");

-- CreateIndex
CREATE INDEX "FleetSettlement_outsourcingClientId_status_idx" ON "FleetSettlement"("outsourcingClientId", "status");

-- CreateIndex
CREATE INDEX "FleetIncident_outsourcingClientId_status_idx" ON "FleetIncident"("outsourcingClientId", "status");

-- CreateIndex
CREATE INDEX "FleetIncident_tripId_idx" ON "FleetIncident"("tripId");

-- CreateIndex
CREATE INDEX "FleetIncident_ownerUserId_idx" ON "FleetIncident"("ownerUserId");

-- AddForeignKey
ALTER TABLE "FleetVehicle" ADD CONSTRAINT "FleetVehicle_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetDriver" ADD CONSTRAINT "FleetDriver_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetDriver" ADD CONSTRAINT "FleetDriver_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetTransportPartner" ADD CONSTRAINT "FleetTransportPartner_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetCustomer" ADD CONSTRAINT "FleetCustomer_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetCustomer" ADD CONSTRAINT "FleetCustomer_accountsClientId_fkey" FOREIGN KEY ("accountsClientId") REFERENCES "AccountsClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetOrder" ADD CONSTRAINT "FleetOrder_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetOrder" ADD CONSTRAINT "FleetOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "FleetCustomer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetTrip" ADD CONSTRAINT "FleetTrip_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetTrip" ADD CONSTRAINT "FleetTrip_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "FleetOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetTrip" ADD CONSTRAINT "FleetTrip_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "FleetCustomer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetTrip" ADD CONSTRAINT "FleetTrip_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "FleetVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetTrip" ADD CONSTRAINT "FleetTrip_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "FleetDriver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetTrip" ADD CONSTRAINT "FleetTrip_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "FleetTransportPartner"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetTrip" ADD CONSTRAINT "FleetTrip_clientInvoiceId_fkey" FOREIGN KEY ("clientInvoiceId") REFERENCES "AccountsInvoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetTripEvent" ADD CONSTRAINT "FleetTripEvent_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "FleetTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetTripComplianceCheck" ADD CONSTRAINT "FleetTripComplianceCheck_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "FleetTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetTripComplianceCheck" ADD CONSTRAINT "FleetTripComplianceCheck_checkedByUserId_fkey" FOREIGN KEY ("checkedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetTripDocument" ADD CONSTRAINT "FleetTripDocument_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "FleetTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetTripDocument" ADD CONSTRAINT "FleetTripDocument_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetTripDocument" ADD CONSTRAINT "FleetTripDocument_verifiedByUserId_fkey" FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetSettlement" ADD CONSTRAINT "FleetSettlement_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetSettlement" ADD CONSTRAINT "FleetSettlement_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "FleetTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetIncident" ADD CONSTRAINT "FleetIncident_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetIncident" ADD CONSTRAINT "FleetIncident_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "FleetTrip"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetIncident" ADD CONSTRAINT "FleetIncident_ownerUserId_fkey" FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS
ALTER TABLE "FleetVehicle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FleetVehicle" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "FleetVehicle_tenant_rw" ON "FleetVehicle";
CREATE POLICY "FleetVehicle_tenant_rw" ON "FleetVehicle"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "FleetVehicle_insert_bootstrap" ON "FleetVehicle";
CREATE POLICY "FleetVehicle_insert_bootstrap" ON "FleetVehicle"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "FleetDriver" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FleetDriver" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "FleetDriver_tenant_rw" ON "FleetDriver";
CREATE POLICY "FleetDriver_tenant_rw" ON "FleetDriver"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "FleetDriver_insert_bootstrap" ON "FleetDriver";
CREATE POLICY "FleetDriver_insert_bootstrap" ON "FleetDriver"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "FleetTransportPartner" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FleetTransportPartner" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "FleetTransportPartner_tenant_rw" ON "FleetTransportPartner";
CREATE POLICY "FleetTransportPartner_tenant_rw" ON "FleetTransportPartner"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "FleetTransportPartner_insert_bootstrap" ON "FleetTransportPartner";
CREATE POLICY "FleetTransportPartner_insert_bootstrap" ON "FleetTransportPartner"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "FleetCustomer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FleetCustomer" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "FleetCustomer_tenant_rw" ON "FleetCustomer";
CREATE POLICY "FleetCustomer_tenant_rw" ON "FleetCustomer"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "FleetCustomer_insert_bootstrap" ON "FleetCustomer";
CREATE POLICY "FleetCustomer_insert_bootstrap" ON "FleetCustomer"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "FleetOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FleetOrder" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "FleetOrder_tenant_rw" ON "FleetOrder";
CREATE POLICY "FleetOrder_tenant_rw" ON "FleetOrder"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "FleetOrder_insert_bootstrap" ON "FleetOrder";
CREATE POLICY "FleetOrder_insert_bootstrap" ON "FleetOrder"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "FleetTrip" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FleetTrip" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "FleetTrip_tenant_rw" ON "FleetTrip";
CREATE POLICY "FleetTrip_tenant_rw" ON "FleetTrip"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "FleetTrip_insert_bootstrap" ON "FleetTrip";
CREATE POLICY "FleetTrip_insert_bootstrap" ON "FleetTrip"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "FleetTripEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FleetTripEvent" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "FleetTripEvent_tenant_rw" ON "FleetTripEvent";
CREATE POLICY "FleetTripEvent_tenant_rw" ON "FleetTripEvent"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "FleetTripEvent_insert_bootstrap" ON "FleetTripEvent";
CREATE POLICY "FleetTripEvent_insert_bootstrap" ON "FleetTripEvent"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "FleetTripComplianceCheck" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FleetTripComplianceCheck" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "FleetTripComplianceCheck_tenant_rw" ON "FleetTripComplianceCheck";
CREATE POLICY "FleetTripComplianceCheck_tenant_rw" ON "FleetTripComplianceCheck"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "FleetTripComplianceCheck_insert_bootstrap" ON "FleetTripComplianceCheck";
CREATE POLICY "FleetTripComplianceCheck_insert_bootstrap" ON "FleetTripComplianceCheck"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "FleetTripDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FleetTripDocument" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "FleetTripDocument_tenant_rw" ON "FleetTripDocument";
CREATE POLICY "FleetTripDocument_tenant_rw" ON "FleetTripDocument"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "FleetTripDocument_insert_bootstrap" ON "FleetTripDocument";
CREATE POLICY "FleetTripDocument_insert_bootstrap" ON "FleetTripDocument"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "FleetSettlement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FleetSettlement" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "FleetSettlement_tenant_rw" ON "FleetSettlement";
CREATE POLICY "FleetSettlement_tenant_rw" ON "FleetSettlement"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "FleetSettlement_insert_bootstrap" ON "FleetSettlement";
CREATE POLICY "FleetSettlement_insert_bootstrap" ON "FleetSettlement"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "FleetIncident" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FleetIncident" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "FleetIncident_tenant_rw" ON "FleetIncident";
CREATE POLICY "FleetIncident_tenant_rw" ON "FleetIncident"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "FleetIncident_insert_bootstrap" ON "FleetIncident";
CREATE POLICY "FleetIncident_insert_bootstrap" ON "FleetIncident"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );
