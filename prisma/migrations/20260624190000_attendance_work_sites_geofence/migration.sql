-- RAV-123: mobile geo clock-in + work-site geofences

ALTER TYPE "AttendanceEventSource" ADD VALUE IF NOT EXISTS 'mobile_geo';

ALTER TYPE "AttendanceExceptionType" ADD VALUE IF NOT EXISTS 'outside_geofence';

ALTER TABLE "AttendancePolicy"
  ADD COLUMN IF NOT EXISTS "mobileGeofenceEnabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "rejectOutsideGeofence" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "AttendanceWorkSite" (
  "id" TEXT NOT NULL,
  "organizationId" UUID NOT NULL,
  "outsourcingClientId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "latitude" DECIMAL(10,7) NOT NULL,
  "longitude" DECIMAL(10,7) NOT NULL,
  "radiusMeters" INTEGER NOT NULL DEFAULT 150,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendanceWorkSite_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "AttendanceWorkSite"
    ADD CONSTRAINT "AttendanceWorkSite_outsourcingClientId_fkey"
    FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "AttendanceWorkSite_outsourcingClientId_isActive_idx"
  ON "AttendanceWorkSite"("outsourcingClientId", "isActive");
CREATE INDEX IF NOT EXISTS "AttendanceWorkSite_organizationId_idx"
  ON "AttendanceWorkSite"("organizationId");

ALTER TABLE "AttendanceWorkSite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AttendanceWorkSite" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AttendanceWorkSite_tenant_rw" ON "AttendanceWorkSite";
CREATE POLICY "AttendanceWorkSite_tenant_rw" ON "AttendanceWorkSite"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_organization_id', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_organization_id', true)::uuid);

DROP POLICY IF EXISTS "AttendanceWorkSite_insert_bootstrap" ON "AttendanceWorkSite";
CREATE POLICY "AttendanceWorkSite_insert_bootstrap" ON "AttendanceWorkSite"
  FOR INSERT
  WITH CHECK (current_setting('app.current_organization_id', true) IS NULL OR current_setting('app.current_organization_id', true) = '');
