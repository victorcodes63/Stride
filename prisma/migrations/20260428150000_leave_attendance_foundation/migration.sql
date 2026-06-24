-- Leave & Attendance foundation (phase 1)
-- Safe/idempotent additions; existing tables remain for backward compatibility.

DO $$ BEGIN
  CREATE TYPE "EmployeeEmploymentStatus" AS ENUM ('active', 'probation', 'on_leave', 'suspended', 'terminated');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AttendancePolicyMode" AS ENUM ('biometric_primary', 'hybrid_override', 'manual_primary');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LeaveAccrualMode" AS ENUM ('annual_grant', 'monthly_accrual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AttendanceEventSource" AS ENUM ('biometric', 'manual', 'rota');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AttendanceEventKind" AS ENUM ('check_in', 'check_out', 'break_start', 'break_end', 'override');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AttendanceSummaryStatus" AS ENUM ('draft', 'reconciled', 'approved');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AttendanceExceptionType" AS ENUM (
    'missing_check_in',
    'missing_check_out',
    'late_arrival',
    'early_departure',
    'mismatch_with_rota',
    'duplicate_events',
    'unapproved_manual_override'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AttendanceExceptionStatus" AS ENUM ('open', 'resolved', 'ignored');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LeaveBalanceLedgerEntryType" AS ENUM ('accrual', 'debit', 'carry_forward', 'adjustment');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LeaveApprovalState" AS ENUM ('pending', 'in_progress', 'approved', 'rejected', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "LeaveApprovalStepStatus" AS ENUM ('pending', 'approved', 'rejected', 'skipped');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Employee"
  ADD COLUMN IF NOT EXISTS "managerEmployeeId" TEXT,
  ADD COLUMN IF NOT EXISTS "employmentStatus" "EmployeeEmploymentStatus" NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS "employmentStatusEffectiveFrom" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "employmentStatusEffectiveTo" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "employmentEndedAt" TIMESTAMP(3);

DO $$ BEGIN
  ALTER TABLE "Employee"
    ADD CONSTRAINT "Employee_managerEmployeeId_fkey"
    FOREIGN KEY ("managerEmployeeId") REFERENCES "Employee"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "Employee_managerEmployeeId_idx" ON "Employee"("managerEmployeeId");
CREATE INDEX IF NOT EXISTS "Employee_employmentStatus_idx" ON "Employee"("employmentStatus");

CREATE TABLE IF NOT EXISTS "AttendancePolicy" (
  "id" TEXT NOT NULL,
  "outsourcingClientId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "mode" "AttendancePolicyMode" NOT NULL DEFAULT 'hybrid_override',
  "graceInMinutes" INTEGER NOT NULL DEFAULT 0,
  "graceOutMinutes" INTEGER NOT NULL DEFAULT 0,
  "minHalfDayMinutes" INTEGER NOT NULL DEFAULT 240,
  "fullDayMinutes" INTEGER NOT NULL DEFAULT 480,
  "requireManualApproval" BOOLEAN NOT NULL DEFAULT true,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttendancePolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AttendancePolicyAssignment" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "attendancePolicyId" TEXT NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "isPrimary" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttendancePolicyAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LeavePolicy" (
  "id" TEXT NOT NULL,
  "outsourcingClientId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeavePolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LeavePolicyRule" (
  "id" TEXT NOT NULL,
  "leavePolicyId" TEXT NOT NULL,
  "leaveTypeId" TEXT NOT NULL,
  "accrualMode" "LeaveAccrualMode" NOT NULL DEFAULT 'monthly_accrual',
  "annualEntitlement" INTEGER NOT NULL DEFAULT 0,
  "monthlyAccrualDays" DECIMAL(6,2) NOT NULL DEFAULT 0,
  "maxCarryForwardDays" INTEGER NOT NULL DEFAULT 0,
  "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeavePolicyRule_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LeavePolicyAssignment" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "leavePolicyId" TEXT NOT NULL,
  "effectiveFrom" DATE NOT NULL,
  "effectiveTo" DATE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeavePolicyAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AttendanceEvent" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "outsourcingClientId" TEXT NOT NULL,
  "observedAt" TIMESTAMP(3) NOT NULL,
  "workDate" DATE NOT NULL,
  "source" "AttendanceEventSource" NOT NULL,
  "kind" "AttendanceEventKind" NOT NULL,
  "biometricPunchId" TEXT,
  "shiftAssignmentId" TEXT,
  "createdByUserId" TEXT,
  "isApprovedOverride" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttendanceEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AttendanceDaySummary" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "outsourcingClientId" TEXT NOT NULL,
  "workDate" DATE NOT NULL,
  "attendancePolicyId" TEXT,
  "firstInAt" TIMESTAMP(3),
  "lastOutAt" TIMESTAMP(3),
  "minutesWorked" INTEGER NOT NULL DEFAULT 0,
  "lateMinutes" INTEGER NOT NULL DEFAULT 0,
  "undertimeMinutes" INTEGER NOT NULL DEFAULT 0,
  "overtimeMinutes" INTEGER NOT NULL DEFAULT 0,
  "status" "AttendanceSummaryStatus" NOT NULL DEFAULT 'draft',
  "sourceBreakdown" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttendanceDaySummary_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AttendanceException" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "attendanceDaySummaryId" TEXT,
  "workDate" DATE NOT NULL,
  "type" "AttendanceExceptionType" NOT NULL,
  "status" "AttendanceExceptionStatus" NOT NULL DEFAULT 'open',
  "description" TEXT NOT NULL,
  "resolvedByUserId" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolutionNotes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AttendanceException_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LeaveBalanceLedger" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "leaveTypeId" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "entryType" "LeaveBalanceLedgerEntryType" NOT NULL,
  "days" DECIMAL(8,2) NOT NULL,
  "sourceRef" TEXT,
  "notes" TEXT,
  "createdByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeaveBalanceLedger_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "StaffLeaveApplication"
  ADD COLUMN IF NOT EXISTS "approvalState" "LeaveApprovalState" NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS "currentStepOrder" INTEGER NOT NULL DEFAULT 1;

CREATE TABLE IF NOT EXISTS "LeaveApprovalStep" (
  "id" TEXT NOT NULL,
  "staffLeaveApplicationId" TEXT NOT NULL,
  "stepOrder" INTEGER NOT NULL,
  "approverUserId" TEXT NOT NULL,
  "status" "LeaveApprovalStepStatus" NOT NULL DEFAULT 'pending',
  "actedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LeaveApprovalStep_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LeaveApprovalAction" (
  "id" TEXT NOT NULL,
  "staffLeaveApplicationId" TEXT NOT NULL,
  "leaveApprovalStepId" TEXT,
  "actorUserId" TEXT NOT NULL,
  "action" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeaveApprovalAction_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "AttendancePolicy"
    ADD CONSTRAINT "AttendancePolicy_outsourcingClientId_fkey"
    FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AttendancePolicyAssignment"
    ADD CONSTRAINT "AttendancePolicyAssignment_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AttendancePolicyAssignment"
    ADD CONSTRAINT "AttendancePolicyAssignment_attendancePolicyId_fkey"
    FOREIGN KEY ("attendancePolicyId") REFERENCES "AttendancePolicy"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LeavePolicy"
    ADD CONSTRAINT "LeavePolicy_outsourcingClientId_fkey"
    FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LeavePolicyRule"
    ADD CONSTRAINT "LeavePolicyRule_leavePolicyId_fkey"
    FOREIGN KEY ("leavePolicyId") REFERENCES "LeavePolicy"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LeavePolicyRule"
    ADD CONSTRAINT "LeavePolicyRule_leaveTypeId_fkey"
    FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LeavePolicyAssignment"
    ADD CONSTRAINT "LeavePolicyAssignment_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LeavePolicyAssignment"
    ADD CONSTRAINT "LeavePolicyAssignment_leavePolicyId_fkey"
    FOREIGN KEY ("leavePolicyId") REFERENCES "LeavePolicy"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AttendanceEvent"
    ADD CONSTRAINT "AttendanceEvent_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AttendanceEvent"
    ADD CONSTRAINT "AttendanceEvent_outsourcingClientId_fkey"
    FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AttendanceEvent"
    ADD CONSTRAINT "AttendanceEvent_biometricPunchId_fkey"
    FOREIGN KEY ("biometricPunchId") REFERENCES "BiometricPunch"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AttendanceEvent"
    ADD CONSTRAINT "AttendanceEvent_shiftAssignmentId_fkey"
    FOREIGN KEY ("shiftAssignmentId") REFERENCES "ShiftAssignment"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AttendanceEvent"
    ADD CONSTRAINT "AttendanceEvent_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AttendanceDaySummary"
    ADD CONSTRAINT "AttendanceDaySummary_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AttendanceDaySummary"
    ADD CONSTRAINT "AttendanceDaySummary_outsourcingClientId_fkey"
    FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AttendanceDaySummary"
    ADD CONSTRAINT "AttendanceDaySummary_attendancePolicyId_fkey"
    FOREIGN KEY ("attendancePolicyId") REFERENCES "AttendancePolicy"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AttendanceException"
    ADD CONSTRAINT "AttendanceException_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AttendanceException"
    ADD CONSTRAINT "AttendanceException_attendanceDaySummaryId_fkey"
    FOREIGN KEY ("attendanceDaySummaryId") REFERENCES "AttendanceDaySummary"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "AttendanceException"
    ADD CONSTRAINT "AttendanceException_resolvedByUserId_fkey"
    FOREIGN KEY ("resolvedByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LeaveBalanceLedger"
    ADD CONSTRAINT "LeaveBalanceLedger_employeeId_fkey"
    FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LeaveBalanceLedger"
    ADD CONSTRAINT "LeaveBalanceLedger_leaveTypeId_fkey"
    FOREIGN KEY ("leaveTypeId") REFERENCES "LeaveType"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LeaveBalanceLedger"
    ADD CONSTRAINT "LeaveBalanceLedger_createdByUserId_fkey"
    FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LeaveApprovalStep"
    ADD CONSTRAINT "LeaveApprovalStep_staffLeaveApplicationId_fkey"
    FOREIGN KEY ("staffLeaveApplicationId") REFERENCES "StaffLeaveApplication"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LeaveApprovalStep"
    ADD CONSTRAINT "LeaveApprovalStep_approverUserId_fkey"
    FOREIGN KEY ("approverUserId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LeaveApprovalAction"
    ADD CONSTRAINT "LeaveApprovalAction_staffLeaveApplicationId_fkey"
    FOREIGN KEY ("staffLeaveApplicationId") REFERENCES "StaffLeaveApplication"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LeaveApprovalAction"
    ADD CONSTRAINT "LeaveApprovalAction_leaveApprovalStepId_fkey"
    FOREIGN KEY ("leaveApprovalStepId") REFERENCES "LeaveApprovalStep"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "LeaveApprovalAction"
    ADD CONSTRAINT "LeaveApprovalAction_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "User"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "AttendancePolicy_outsourcingClientId_isActive_idx"
  ON "AttendancePolicy"("outsourcingClientId", "isActive");
CREATE INDEX IF NOT EXISTS "AttendancePolicy_outsourcingClientId_isDefault_idx"
  ON "AttendancePolicy"("outsourcingClientId", "isDefault");
CREATE INDEX IF NOT EXISTS "AttendancePolicyAssignment_employeeId_effectiveFrom_idx"
  ON "AttendancePolicyAssignment"("employeeId", "effectiveFrom");
CREATE INDEX IF NOT EXISTS "AttendancePolicyAssignment_attendancePolicyId_effectiveFrom_idx"
  ON "AttendancePolicyAssignment"("attendancePolicyId", "effectiveFrom");
CREATE INDEX IF NOT EXISTS "LeavePolicy_outsourcingClientId_isDefault_idx"
  ON "LeavePolicy"("outsourcingClientId", "isDefault");
CREATE INDEX IF NOT EXISTS "LeavePolicy_outsourcingClientId_isActive_idx"
  ON "LeavePolicy"("outsourcingClientId", "isActive");
CREATE UNIQUE INDEX IF NOT EXISTS "LeavePolicyRule_leavePolicyId_leaveTypeId_key"
  ON "LeavePolicyRule"("leavePolicyId", "leaveTypeId");
CREATE INDEX IF NOT EXISTS "LeavePolicyRule_leaveTypeId_idx"
  ON "LeavePolicyRule"("leaveTypeId");
CREATE INDEX IF NOT EXISTS "LeavePolicyAssignment_employeeId_effectiveFrom_idx"
  ON "LeavePolicyAssignment"("employeeId", "effectiveFrom");
CREATE INDEX IF NOT EXISTS "LeavePolicyAssignment_leavePolicyId_effectiveFrom_idx"
  ON "LeavePolicyAssignment"("leavePolicyId", "effectiveFrom");
CREATE INDEX IF NOT EXISTS "AttendanceEvent_employeeId_workDate_idx"
  ON "AttendanceEvent"("employeeId", "workDate");
CREATE INDEX IF NOT EXISTS "AttendanceEvent_outsourcingClientId_workDate_idx"
  ON "AttendanceEvent"("outsourcingClientId", "workDate");
CREATE INDEX IF NOT EXISTS "AttendanceEvent_source_workDate_idx"
  ON "AttendanceEvent"("source", "workDate");
CREATE UNIQUE INDEX IF NOT EXISTS "AttendanceDaySummary_employeeId_workDate_key"
  ON "AttendanceDaySummary"("employeeId", "workDate");
CREATE INDEX IF NOT EXISTS "AttendanceDaySummary_outsourcingClientId_workDate_idx"
  ON "AttendanceDaySummary"("outsourcingClientId", "workDate");
CREATE INDEX IF NOT EXISTS "AttendanceDaySummary_status_idx"
  ON "AttendanceDaySummary"("status");
CREATE INDEX IF NOT EXISTS "AttendanceException_employeeId_workDate_idx"
  ON "AttendanceException"("employeeId", "workDate");
CREATE INDEX IF NOT EXISTS "AttendanceException_status_workDate_idx"
  ON "AttendanceException"("status", "workDate");
CREATE INDEX IF NOT EXISTS "LeaveBalanceLedger_employeeId_leaveTypeId_year_idx"
  ON "LeaveBalanceLedger"("employeeId", "leaveTypeId", "year");
CREATE INDEX IF NOT EXISTS "LeaveBalanceLedger_entryType_idx"
  ON "LeaveBalanceLedger"("entryType");
CREATE UNIQUE INDEX IF NOT EXISTS "LeaveApprovalStep_staffLeaveApplicationId_stepOrder_key"
  ON "LeaveApprovalStep"("staffLeaveApplicationId", "stepOrder");
CREATE INDEX IF NOT EXISTS "LeaveApprovalStep_approverUserId_status_idx"
  ON "LeaveApprovalStep"("approverUserId", "status");
CREATE INDEX IF NOT EXISTS "LeaveApprovalAction_staffLeaveApplicationId_createdAt_idx"
  ON "LeaveApprovalAction"("staffLeaveApplicationId", "createdAt");
CREATE INDEX IF NOT EXISTS "LeaveApprovalAction_actorUserId_idx"
  ON "LeaveApprovalAction"("actorUserId");

