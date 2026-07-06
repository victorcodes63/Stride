-- SPD-01 (RAV-274): composite org-scoped indexes from SPD-00 slow-query baseline.
-- Additive only — does not remove organizationId filters or weaken RLS.

CREATE INDEX IF NOT EXISTS "Employee_organizationId_employmentStatus_idx"
  ON "Employee" ("organizationId", "employmentStatus");

CREATE INDEX IF NOT EXISTS "Employee_organizationId_outsourcingClientId_idx"
  ON "Employee" ("organizationId", "outsourcingClientId");

CREATE INDEX IF NOT EXISTS "Grievance_organizationId_status_idx"
  ON "Grievance" ("organizationId", "status");

CREATE INDEX IF NOT EXISTS "DisciplinaryCase_organizationId_status_idx"
  ON "DisciplinaryCase" ("organizationId", "status");

CREATE INDEX IF NOT EXISTS "LeaveApplication_organizationId_status_idx"
  ON "LeaveApplication" ("organizationId", "status");

CREATE INDEX IF NOT EXISTS "StaffNotification_organizationId_userId_readAt_idx"
  ON "StaffNotification" ("organizationId", "userId", "readAt");

CREATE INDEX IF NOT EXISTS "OnboardingTask_organizationId_status_idx"
  ON "OnboardingTask" ("organizationId", "status");

CREATE INDEX IF NOT EXISTS "FleetVehicle_organizationId_status_idx"
  ON "FleetVehicle" ("organizationId", "status");

CREATE INDEX IF NOT EXISTS "Project_organizationId_status_idx"
  ON "Project" ("organizationId", "status");

CREATE INDEX IF NOT EXISTS "ProjectTask_organizationId_status_idx"
  ON "ProjectTask" ("organizationId", "status");

CREATE INDEX IF NOT EXISTS "EmployeeCredential_organizationId_status_expiryDate_idx"
  ON "EmployeeCredential" ("organizationId", "status", "expiryDate");
