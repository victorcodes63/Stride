-- CreateEnum
CREATE TYPE "FleetMaintenanceType" AS ENUM ('service', 'repair', 'inspection', 'tyre', 'other');

-- CreateTable
CREATE TABLE "FleetFuelLog" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "driverId" TEXT,
    "tripId" TEXT,
    "fueledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "liters" DECIMAL(10,2) NOT NULL,
    "amountKes" DECIMAL(14,2) NOT NULL,
    "odometerKm" INTEGER,
    "station" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetFuelLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetMaintenanceLog" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "maintenanceType" "FleetMaintenanceType" NOT NULL DEFAULT 'service',
    "description" TEXT NOT NULL,
    "performedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "costKes" DECIMAL(14,2),
    "odometerKm" INTEGER,
    "vendor" TEXT,
    "notes" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetMaintenanceLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FleetFuelLog_outsourcingClientId_fueledAt_idx" ON "FleetFuelLog"("outsourcingClientId", "fueledAt");

-- CreateIndex
CREATE INDEX "FleetFuelLog_vehicleId_idx" ON "FleetFuelLog"("vehicleId");

-- CreateIndex
CREATE INDEX "FleetMaintenanceLog_outsourcingClientId_performedAt_idx" ON "FleetMaintenanceLog"("outsourcingClientId", "performedAt");

-- CreateIndex
CREATE INDEX "FleetMaintenanceLog_vehicleId_idx" ON "FleetMaintenanceLog"("vehicleId");

-- AddForeignKey
ALTER TABLE "FleetFuelLog" ADD CONSTRAINT "FleetFuelLog_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetFuelLog" ADD CONSTRAINT "FleetFuelLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "FleetVehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetFuelLog" ADD CONSTRAINT "FleetFuelLog_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "FleetDriver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetFuelLog" ADD CONSTRAINT "FleetFuelLog_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "FleetTrip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetMaintenanceLog" ADD CONSTRAINT "FleetMaintenanceLog_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetMaintenanceLog" ADD CONSTRAINT "FleetMaintenanceLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "FleetVehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS
ALTER TABLE "FleetFuelLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FleetFuelLog" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "FleetFuelLog_tenant_rw" ON "FleetFuelLog";
CREATE POLICY "FleetFuelLog_tenant_rw" ON "FleetFuelLog"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "FleetFuelLog_insert_bootstrap" ON "FleetFuelLog";
CREATE POLICY "FleetFuelLog_insert_bootstrap" ON "FleetFuelLog"
  FOR INSERT
  WITH CHECK (current_setting('app.current_org', true) IS NULL OR current_setting('app.current_org', true) = '');

ALTER TABLE "FleetMaintenanceLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FleetMaintenanceLog" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "FleetMaintenanceLog_tenant_rw" ON "FleetMaintenanceLog";
CREATE POLICY "FleetMaintenanceLog_tenant_rw" ON "FleetMaintenanceLog"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "FleetMaintenanceLog_insert_bootstrap" ON "FleetMaintenanceLog";
CREATE POLICY "FleetMaintenanceLog_insert_bootstrap" ON "FleetMaintenanceLog"
  FOR INSERT
  WITH CHECK (current_setting('app.current_org', true) IS NULL OR current_setting('app.current_org', true) = '');
