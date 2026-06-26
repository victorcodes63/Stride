-- Fleet telematics & monitoring tables (geofences, positions, service, defects, alarms, evaluations, environmental, driving time)

-- CreateEnum
CREATE TYPE "FleetGeofenceType" AS ENUM ('depot', 'customer_site', 'corridor', 'restricted', 'custom');

-- CreateEnum
CREATE TYPE "FleetServicePlanStatus" AS ENUM ('scheduled', 'due', 'overdue', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "FleetDefectSeverity" AS ENUM ('minor', 'major', 'critical');

-- CreateEnum
CREATE TYPE "FleetDefectStatus" AS ENUM ('reported', 'acknowledged', 'in_repair', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "FleetAlarmSeverity" AS ENUM ('info', 'warning', 'critical');

-- CreateEnum
CREATE TYPE "FleetDriverEvaluationPeriod" AS ENUM ('trip', 'weekly', 'monthly', 'quarterly');

-- CreateTable
CREATE TABLE "FleetGeofence" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "geofenceType" "FleetGeofenceType" NOT NULL DEFAULT 'custom',
    "description" TEXT,
    "geometry" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "alertOnEntry" BOOLEAN NOT NULL DEFAULT true,
    "alertOnExit" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetGeofence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetVehiclePosition" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "tripId" TEXT,
    "latitude" DECIMAL(10,7) NOT NULL,
    "longitude" DECIMAL(10,7) NOT NULL,
    "speedKph" DECIMAL(6,2),
    "headingDeg" INTEGER,
    "altitudeM" DECIMAL(8,2),
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT DEFAULT 'telematics',

    CONSTRAINT "FleetVehiclePosition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetServicePlan" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "dueOdometerKm" INTEGER,
    "status" "FleetServicePlanStatus" NOT NULL DEFAULT 'scheduled',
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetServicePlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetDefectReport" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "tripId" TEXT,
    "reportedByDriverId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "severity" "FleetDefectSeverity" NOT NULL DEFAULT 'minor',
    "status" "FleetDefectStatus" NOT NULL DEFAULT 'reported',
    "reportedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetDefectReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetAlarmRule" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "condition" JSONB,
    "severity" "FleetAlarmSeverity" NOT NULL DEFAULT 'warning',
    "notifyEmail" TEXT,
    "notifySms" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetAlarmRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetDriverEvaluation" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "tripId" TEXT,
    "period" "FleetDriverEvaluationPeriod" NOT NULL DEFAULT 'trip',
    "scoreOverall" INTEGER NOT NULL,
    "scoreSafety" INTEGER,
    "scorePunctuality" INTEGER,
    "scoreFuelEfficiency" INTEGER,
    "scoreCustomer" INTEGER,
    "notes" TEXT,
    "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evaluatedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetDriverEvaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetEnvironmentalSnapshot" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "tripId" TEXT,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "distanceKm" DECIMAL(10,2) NOT NULL,
    "fuelLiters" DECIMAL(10,2),
    "co2KgEstimate" DECIMAL(10,2),
    "idleMinutes" INTEGER,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FleetEnvironmentalSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FleetDrivingTimeLog" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "tripId" TEXT,
    "sessionStart" TIMESTAMP(3) NOT NULL,
    "sessionEnd" TIMESTAMP(3),
    "drivingMinutes" INTEGER NOT NULL DEFAULT 0,
    "restMinutes" INTEGER NOT NULL DEFAULT 0,
    "exceedsLimit" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FleetDrivingTimeLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FleetGeofence_outsourcingClientId_isActive_idx" ON "FleetGeofence"("outsourcingClientId", "isActive");

-- CreateIndex
CREATE INDEX "FleetVehiclePosition_vehicleId_recordedAt_idx" ON "FleetVehiclePosition"("vehicleId", "recordedAt" DESC);

-- CreateIndex
CREATE INDEX "FleetVehiclePosition_tripId_idx" ON "FleetVehiclePosition"("tripId");

-- CreateIndex
CREATE INDEX "FleetServicePlan_outsourcingClientId_status_idx" ON "FleetServicePlan"("outsourcingClientId", "status");

-- CreateIndex
CREATE INDEX "FleetServicePlan_vehicleId_dueAt_idx" ON "FleetServicePlan"("vehicleId", "dueAt");

-- CreateIndex
CREATE INDEX "FleetDefectReport_outsourcingClientId_status_idx" ON "FleetDefectReport"("outsourcingClientId", "status");

-- CreateIndex
CREATE INDEX "FleetDefectReport_vehicleId_idx" ON "FleetDefectReport"("vehicleId");

-- CreateIndex
CREATE INDEX "FleetAlarmRule_outsourcingClientId_isActive_idx" ON "FleetAlarmRule"("outsourcingClientId", "isActive");

-- CreateIndex
CREATE INDEX "FleetDriverEvaluation_driverId_evaluatedAt_idx" ON "FleetDriverEvaluation"("driverId", "evaluatedAt" DESC);

-- CreateIndex
CREATE INDEX "FleetDriverEvaluation_outsourcingClientId_idx" ON "FleetDriverEvaluation"("outsourcingClientId");

-- CreateIndex
CREATE INDEX "FleetEnvironmentalSnapshot_outsourcingClientId_periodStart_idx" ON "FleetEnvironmentalSnapshot"("outsourcingClientId", "periodStart" DESC);

-- CreateIndex
CREATE INDEX "FleetDrivingTimeLog_driverId_sessionStart_idx" ON "FleetDrivingTimeLog"("driverId", "sessionStart" DESC);

-- CreateIndex
CREATE INDEX "FleetDrivingTimeLog_outsourcingClientId_idx" ON "FleetDrivingTimeLog"("outsourcingClientId");

-- AddForeignKey
ALTER TABLE "FleetGeofence" ADD CONSTRAINT "FleetGeofence_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetVehiclePosition" ADD CONSTRAINT "FleetVehiclePosition_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "FleetVehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetVehiclePosition" ADD CONSTRAINT "FleetVehiclePosition_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "FleetTrip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetServicePlan" ADD CONSTRAINT "FleetServicePlan_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetServicePlan" ADD CONSTRAINT "FleetServicePlan_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "FleetVehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetDefectReport" ADD CONSTRAINT "FleetDefectReport_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetDefectReport" ADD CONSTRAINT "FleetDefectReport_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "FleetVehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetDefectReport" ADD CONSTRAINT "FleetDefectReport_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "FleetTrip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetDefectReport" ADD CONSTRAINT "FleetDefectReport_reportedByDriverId_fkey" FOREIGN KEY ("reportedByDriverId") REFERENCES "FleetDriver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetAlarmRule" ADD CONSTRAINT "FleetAlarmRule_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetDriverEvaluation" ADD CONSTRAINT "FleetDriverEvaluation_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetDriverEvaluation" ADD CONSTRAINT "FleetDriverEvaluation_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "FleetDriver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetDriverEvaluation" ADD CONSTRAINT "FleetDriverEvaluation_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "FleetTrip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetDriverEvaluation" ADD CONSTRAINT "FleetDriverEvaluation_evaluatedByUserId_fkey" FOREIGN KEY ("evaluatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetEnvironmentalSnapshot" ADD CONSTRAINT "FleetEnvironmentalSnapshot_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetEnvironmentalSnapshot" ADD CONSTRAINT "FleetEnvironmentalSnapshot_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "FleetVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetEnvironmentalSnapshot" ADD CONSTRAINT "FleetEnvironmentalSnapshot_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "FleetTrip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetDrivingTimeLog" ADD CONSTRAINT "FleetDrivingTimeLog_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetDrivingTimeLog" ADD CONSTRAINT "FleetDrivingTimeLog_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "FleetDriver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetDrivingTimeLog" ADD CONSTRAINT "FleetDrivingTimeLog_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "FleetVehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FleetDrivingTimeLog" ADD CONSTRAINT "FleetDrivingTimeLog_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "FleetTrip"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS (fleet telematics tables)
ALTER TABLE "FleetGeofence" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FleetGeofence" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "FleetGeofence_tenant_rw" ON "FleetGeofence";
CREATE POLICY "FleetGeofence_tenant_rw" ON "FleetGeofence"
  FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "FleetGeofence_insert_bootstrap" ON "FleetGeofence";
CREATE POLICY "FleetGeofence_insert_bootstrap" ON "FleetGeofence"
  FOR INSERT WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "FleetVehiclePosition" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FleetVehiclePosition" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "FleetVehiclePosition_tenant_rw" ON "FleetVehiclePosition";
CREATE POLICY "FleetVehiclePosition_tenant_rw" ON "FleetVehiclePosition"
  FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "FleetVehiclePosition_insert_bootstrap" ON "FleetVehiclePosition";
CREATE POLICY "FleetVehiclePosition_insert_bootstrap" ON "FleetVehiclePosition"
  FOR INSERT WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "FleetServicePlan" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FleetServicePlan" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "FleetServicePlan_tenant_rw" ON "FleetServicePlan";
CREATE POLICY "FleetServicePlan_tenant_rw" ON "FleetServicePlan"
  FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "FleetServicePlan_insert_bootstrap" ON "FleetServicePlan";
CREATE POLICY "FleetServicePlan_insert_bootstrap" ON "FleetServicePlan"
  FOR INSERT WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "FleetDefectReport" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FleetDefectReport" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "FleetDefectReport_tenant_rw" ON "FleetDefectReport";
CREATE POLICY "FleetDefectReport_tenant_rw" ON "FleetDefectReport"
  FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "FleetDefectReport_insert_bootstrap" ON "FleetDefectReport";
CREATE POLICY "FleetDefectReport_insert_bootstrap" ON "FleetDefectReport"
  FOR INSERT WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "FleetAlarmRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FleetAlarmRule" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "FleetAlarmRule_tenant_rw" ON "FleetAlarmRule";
CREATE POLICY "FleetAlarmRule_tenant_rw" ON "FleetAlarmRule"
  FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "FleetAlarmRule_insert_bootstrap" ON "FleetAlarmRule";
CREATE POLICY "FleetAlarmRule_insert_bootstrap" ON "FleetAlarmRule"
  FOR INSERT WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "FleetDriverEvaluation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FleetDriverEvaluation" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "FleetDriverEvaluation_tenant_rw" ON "FleetDriverEvaluation";
CREATE POLICY "FleetDriverEvaluation_tenant_rw" ON "FleetDriverEvaluation"
  FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "FleetDriverEvaluation_insert_bootstrap" ON "FleetDriverEvaluation";
CREATE POLICY "FleetDriverEvaluation_insert_bootstrap" ON "FleetDriverEvaluation"
  FOR INSERT WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "FleetEnvironmentalSnapshot" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FleetEnvironmentalSnapshot" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "FleetEnvironmentalSnapshot_tenant_rw" ON "FleetEnvironmentalSnapshot";
CREATE POLICY "FleetEnvironmentalSnapshot_tenant_rw" ON "FleetEnvironmentalSnapshot"
  FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "FleetEnvironmentalSnapshot_insert_bootstrap" ON "FleetEnvironmentalSnapshot";
CREATE POLICY "FleetEnvironmentalSnapshot_insert_bootstrap" ON "FleetEnvironmentalSnapshot"
  FOR INSERT WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "FleetDrivingTimeLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FleetDrivingTimeLog" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "FleetDrivingTimeLog_tenant_rw" ON "FleetDrivingTimeLog";
CREATE POLICY "FleetDrivingTimeLog_tenant_rw" ON "FleetDrivingTimeLog"
  FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "FleetDrivingTimeLog_insert_bootstrap" ON "FleetDrivingTimeLog";
CREATE POLICY "FleetDrivingTimeLog_insert_bootstrap" ON "FleetDrivingTimeLog"
  FOR INSERT WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );
