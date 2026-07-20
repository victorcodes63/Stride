-- Internal staff (tenant-own) Time & Attendance: rota, attendance, biometric.
-- Mirrors the outsourcing (Employee + OutsourcingClient) T&A models but scoped to
-- the tenant organization and keyed on internal staff Users (Staff*-prefix).
-- Idempotent: safe to run against db-push-baselined databases (P3005) via `prisma db execute`.
-- Reuses existing enums: RotaPeriodStatus, AttendancePolicyMode, AttendanceEventSource,
-- AttendanceEventKind, AttendanceSummaryStatus, AttendanceExceptionType,
-- AttendanceExceptionStatus, BiometricPunchSource, BiometricPunchDirection.

-- ---------------------------------------------------------------------------
-- Rota
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "StaffShiftTemplate" (
  "id" TEXT NOT NULL,
  "organizationId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "startMinutes" INTEGER NOT NULL,
  "endMinutes" INTEGER NOT NULL,
  "breakMinutes" INTEGER NOT NULL DEFAULT 0,
  "color" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffShiftTemplate_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "StaffShiftTemplate_organizationId_isActive_idx" ON "StaffShiftTemplate"("organizationId", "isActive");

CREATE TABLE IF NOT EXISTS "StaffRotaPeriod" (
  "id" TEXT NOT NULL,
  "organizationId" UUID NOT NULL,
  "name" TEXT,
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "status" "RotaPeriodStatus" NOT NULL DEFAULT 'draft',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffRotaPeriod_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "StaffRotaPeriod_organizationId_startDate_idx" ON "StaffRotaPeriod"("organizationId", "startDate");
CREATE INDEX IF NOT EXISTS "StaffRotaPeriod_endDate_idx" ON "StaffRotaPeriod"("endDate");

CREATE TABLE IF NOT EXISTS "StaffShiftAssignment" (
  "id" TEXT NOT NULL,
  "organizationId" UUID NOT NULL,
  "staffRotaPeriodId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "staffShiftTemplateId" TEXT,
  "workDate" DATE NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "endsAt" TIMESTAMP(3) NOT NULL,
  "breakMinutes" INTEGER NOT NULL DEFAULT 0,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffShiftAssignment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "StaffShiftAssignment_staffRotaPeriodId_idx" ON "StaffShiftAssignment"("staffRotaPeriodId");
CREATE INDEX IF NOT EXISTS "StaffShiftAssignment_userId_workDate_idx" ON "StaffShiftAssignment"("userId", "workDate");
CREATE INDEX IF NOT EXISTS "StaffShiftAssignment_userId_startsAt_idx" ON "StaffShiftAssignment"("userId", "startsAt");

-- ---------------------------------------------------------------------------
-- Attendance
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "StaffAttendancePolicy" (
  "id" TEXT NOT NULL,
  "organizationId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "mode" "AttendancePolicyMode" NOT NULL DEFAULT 'hybrid_override',
  "graceInMinutes" INTEGER NOT NULL DEFAULT 0,
  "graceOutMinutes" INTEGER NOT NULL DEFAULT 0,
  "minHalfDayMinutes" INTEGER NOT NULL DEFAULT 240,
  "fullDayMinutes" INTEGER NOT NULL DEFAULT 480,
  "requireManualApproval" BOOLEAN NOT NULL DEFAULT true,
  "mobileGeofenceEnabled" BOOLEAN NOT NULL DEFAULT false,
  "rejectOutsideGeofence" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffAttendancePolicy_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "StaffAttendancePolicy_organizationId_isActive_idx" ON "StaffAttendancePolicy"("organizationId", "isActive");
CREATE INDEX IF NOT EXISTS "StaffAttendancePolicy_organizationId_isDefault_idx" ON "StaffAttendancePolicy"("organizationId", "isDefault");

CREATE TABLE IF NOT EXISTS "StaffAttendancePolicyAssignment" (
  "id" TEXT NOT NULL,
  "organizationId" UUID NOT NULL,
  "userId" TEXT NOT NULL,
  "staffAttendancePolicyId" TEXT NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "isPrimary" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffAttendancePolicyAssignment_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "StaffAttendancePolicyAssignment_userId_effectiveFrom_idx" ON "StaffAttendancePolicyAssignment"("userId", "effectiveFrom");
CREATE INDEX IF NOT EXISTS "StaffAttendancePolicyAssignment_staffAttendancePolicyId_effectiveFrom_idx" ON "StaffAttendancePolicyAssignment"("staffAttendancePolicyId", "effectiveFrom");

CREATE TABLE IF NOT EXISTS "StaffAttendanceWorkSite" (
  "id" TEXT NOT NULL,
  "organizationId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "code" TEXT,
  "latitude" DECIMAL(10,7) NOT NULL,
  "longitude" DECIMAL(10,7) NOT NULL,
  "radiusMeters" INTEGER NOT NULL DEFAULT 150,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffAttendanceWorkSite_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "StaffAttendanceWorkSite_organizationId_isActive_idx" ON "StaffAttendanceWorkSite"("organizationId", "isActive");

CREATE TABLE IF NOT EXISTS "StaffBiometricDevice" (
  "id" TEXT NOT NULL,
  "organizationId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "adapterKind" TEXT NOT NULL,
  "config" JSONB,
  "lastPollAt" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffBiometricDevice_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "StaffBiometricDevice_organizationId_idx" ON "StaffBiometricDevice"("organizationId");
CREATE INDEX IF NOT EXISTS "StaffBiometricDevice_isActive_idx" ON "StaffBiometricDevice"("isActive");
CREATE INDEX IF NOT EXISTS "StaffBiometricDevice_lastPollAt_idx" ON "StaffBiometricDevice"("lastPollAt");

CREATE TABLE IF NOT EXISTS "StaffBiometricPunch" (
  "id" TEXT NOT NULL,
  "organizationId" UUID NOT NULL,
  "staffBiometricDeviceId" TEXT NOT NULL,
  "externalEventId" TEXT NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL,
  "rawSubjectId" TEXT NOT NULL,
  "userId" TEXT,
  "rawPayload" JSONB,
  "source" "BiometricPunchSource" NOT NULL,
  "direction" "BiometricPunchDirection" NOT NULL DEFAULT 'unknown',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StaffBiometricPunch_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StaffBiometricPunch_staffBiometricDeviceId_externalEventId_key" ON "StaffBiometricPunch"("staffBiometricDeviceId", "externalEventId");
CREATE INDEX IF NOT EXISTS "StaffBiometricPunch_staffBiometricDeviceId_observedAt_idx" ON "StaffBiometricPunch"("staffBiometricDeviceId", "observedAt");
CREATE INDEX IF NOT EXISTS "StaffBiometricPunch_userId_idx" ON "StaffBiometricPunch"("userId");

CREATE TABLE IF NOT EXISTS "StaffAttendanceEvent" (
  "id" TEXT NOT NULL,
  "organizationId" UUID NOT NULL,
  "userId" TEXT NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL,
  "workDate" DATE NOT NULL,
  "source" "AttendanceEventSource" NOT NULL,
  "kind" "AttendanceEventKind" NOT NULL,
  "staffBiometricPunchId" TEXT,
  "staffShiftAssignmentId" TEXT,
  "createdByUserId" TEXT,
  "isApprovedOverride" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StaffAttendanceEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "StaffAttendanceEvent_userId_workDate_idx" ON "StaffAttendanceEvent"("userId", "workDate");
CREATE INDEX IF NOT EXISTS "StaffAttendanceEvent_organizationId_workDate_idx" ON "StaffAttendanceEvent"("organizationId", "workDate");
CREATE INDEX IF NOT EXISTS "StaffAttendanceEvent_source_workDate_idx" ON "StaffAttendanceEvent"("source", "workDate");

CREATE TABLE IF NOT EXISTS "StaffAttendanceDaySummary" (
  "id" TEXT NOT NULL,
  "organizationId" UUID NOT NULL,
  "userId" TEXT NOT NULL,
  "workDate" DATE NOT NULL,
  "staffAttendancePolicyId" TEXT,
  "firstInAt" TIMESTAMP(3),
  "lastOutAt" TIMESTAMP(3),
  "minutesWorked" INTEGER NOT NULL DEFAULT 0,
  "lateMinutes" INTEGER NOT NULL DEFAULT 0,
  "undertimeMinutes" INTEGER NOT NULL DEFAULT 0,
  "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,
  "holidayOvertimeMinutes" INTEGER NOT NULL DEFAULT 0,
  "publicHolidayName" TEXT,
  "status" "AttendanceSummaryStatus" NOT NULL DEFAULT 'draft',
  "sourceBreakdown" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffAttendanceDaySummary_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "StaffAttendanceDaySummary_userId_workDate_key" ON "StaffAttendanceDaySummary"("userId", "workDate");
CREATE INDEX IF NOT EXISTS "StaffAttendanceDaySummary_organizationId_workDate_idx" ON "StaffAttendanceDaySummary"("organizationId", "workDate");
CREATE INDEX IF NOT EXISTS "StaffAttendanceDaySummary_status_idx" ON "StaffAttendanceDaySummary"("status");

CREATE TABLE IF NOT EXISTS "StaffAttendanceException" (
  "id" TEXT NOT NULL,
  "organizationId" UUID NOT NULL,
  "userId" TEXT NOT NULL,
  "staffAttendanceDaySummaryId" TEXT,
  "workDate" DATE NOT NULL,
  "type" "AttendanceExceptionType" NOT NULL,
  "status" "AttendanceExceptionStatus" NOT NULL DEFAULT 'open',
  "description" TEXT NOT NULL,
  "resolvedByUserId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolutionNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StaffAttendanceException_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "StaffAttendanceException_userId_workDate_idx" ON "StaffAttendanceException"("userId", "workDate");
CREATE INDEX IF NOT EXISTS "StaffAttendanceException_status_workDate_idx" ON "StaffAttendanceException"("status", "workDate");

-- ---------------------------------------------------------------------------
-- Foreign keys (guarded so re-runs are safe)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StaffShiftAssignment_staffRotaPeriodId_fkey') THEN
    ALTER TABLE "StaffShiftAssignment" ADD CONSTRAINT "StaffShiftAssignment_staffRotaPeriodId_fkey"
      FOREIGN KEY ("staffRotaPeriodId") REFERENCES "StaffRotaPeriod"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StaffShiftAssignment_userId_fkey') THEN
    ALTER TABLE "StaffShiftAssignment" ADD CONSTRAINT "StaffShiftAssignment_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StaffShiftAssignment_staffShiftTemplateId_fkey') THEN
    ALTER TABLE "StaffShiftAssignment" ADD CONSTRAINT "StaffShiftAssignment_staffShiftTemplateId_fkey"
      FOREIGN KEY ("staffShiftTemplateId") REFERENCES "StaffShiftTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StaffAttendancePolicyAssignment_userId_fkey') THEN
    ALTER TABLE "StaffAttendancePolicyAssignment" ADD CONSTRAINT "StaffAttendancePolicyAssignment_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StaffAttendancePolicyAssignment_staffAttendancePolicyId_fkey') THEN
    ALTER TABLE "StaffAttendancePolicyAssignment" ADD CONSTRAINT "StaffAttendancePolicyAssignment_staffAttendancePolicyId_fkey"
      FOREIGN KEY ("staffAttendancePolicyId") REFERENCES "StaffAttendancePolicy"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StaffBiometricPunch_staffBiometricDeviceId_fkey') THEN
    ALTER TABLE "StaffBiometricPunch" ADD CONSTRAINT "StaffBiometricPunch_staffBiometricDeviceId_fkey"
      FOREIGN KEY ("staffBiometricDeviceId") REFERENCES "StaffBiometricDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StaffBiometricPunch_userId_fkey') THEN
    ALTER TABLE "StaffBiometricPunch" ADD CONSTRAINT "StaffBiometricPunch_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StaffAttendanceEvent_userId_fkey') THEN
    ALTER TABLE "StaffAttendanceEvent" ADD CONSTRAINT "StaffAttendanceEvent_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StaffAttendanceEvent_staffBiometricPunchId_fkey') THEN
    ALTER TABLE "StaffAttendanceEvent" ADD CONSTRAINT "StaffAttendanceEvent_staffBiometricPunchId_fkey"
      FOREIGN KEY ("staffBiometricPunchId") REFERENCES "StaffBiometricPunch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StaffAttendanceEvent_staffShiftAssignmentId_fkey') THEN
    ALTER TABLE "StaffAttendanceEvent" ADD CONSTRAINT "StaffAttendanceEvent_staffShiftAssignmentId_fkey"
      FOREIGN KEY ("staffShiftAssignmentId") REFERENCES "StaffShiftAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StaffAttendanceEvent_createdByUserId_fkey') THEN
    ALTER TABLE "StaffAttendanceEvent" ADD CONSTRAINT "StaffAttendanceEvent_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StaffAttendanceDaySummary_userId_fkey') THEN
    ALTER TABLE "StaffAttendanceDaySummary" ADD CONSTRAINT "StaffAttendanceDaySummary_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StaffAttendanceDaySummary_staffAttendancePolicyId_fkey') THEN
    ALTER TABLE "StaffAttendanceDaySummary" ADD CONSTRAINT "StaffAttendanceDaySummary_staffAttendancePolicyId_fkey"
      FOREIGN KEY ("staffAttendancePolicyId") REFERENCES "StaffAttendancePolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StaffAttendanceException_userId_fkey') THEN
    ALTER TABLE "StaffAttendanceException" ADD CONSTRAINT "StaffAttendanceException_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StaffAttendanceException_staffAttendanceDaySummaryId_fkey') THEN
    ALTER TABLE "StaffAttendanceException" ADD CONSTRAINT "StaffAttendanceException_staffAttendanceDaySummaryId_fkey"
      FOREIGN KEY ("staffAttendanceDaySummaryId") REFERENCES "StaffAttendanceDaySummary"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StaffAttendanceException_resolvedByUserId_fkey') THEN
    ALTER TABLE "StaffAttendanceException" ADD CONSTRAINT "StaffAttendanceException_resolvedByUserId_fkey"
      FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
