-- RAV-62: Tenancy schema + default org backfill (additive-only)

-- 1) Organization tables
CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'KE',
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Nairobi',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

CREATE TABLE "OrganizationMembership" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'staff',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "OrganizationMembership_organizationId_idx" ON "OrganizationMembership"("organizationId");
CREATE UNIQUE INDEX "OrganizationMembership_userId_organizationId_key" ON "OrganizationMembership"("userId", "organizationId");
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 2) Default organization (existing single-tenant data migrates here)
INSERT INTO "Organization" ("id", "name", "slug", "updatedAt")
VALUES ('00000000-0000-4000-8000-000000000001', 'Default Organization', 'default', CURRENT_TIMESTAMP);

-- 3) Nullable organizationId columns
ALTER TABLE "Client" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "RecruitmentSettings" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "RecruitmentClientPortalUser" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "OutsourcingClient" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "ShiftTemplate" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "RotaPeriod" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "ShiftAssignment" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "Department" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "EmployeeLifecycleEvent" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "EmployeeEntityTransfer" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "DisciplinaryCase" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "DisciplinaryAction" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "DisciplinaryDocument" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "Grievance" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "EmployeeDocument" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "OnboardingTemplate" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "OnboardingTemplateStep" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "OnboardingWorkflow" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "OnboardingTask" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "AttendancePolicy" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "AttendancePolicyAssignment" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "LeavePolicy" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "LeavePolicyRule" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "LeavePolicyAssignment" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "AttendanceEvent" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "AttendanceDaySummary" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "PublicHoliday" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "AttendanceException" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "LeaveBalanceLedger" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "CompanyAsset" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "EmployeeCredential" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "CredentialReminderSent" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "Payroll" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "StatutoryReturn" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "StatutoryReturnItem" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "LeaveType" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "LeaveBalance" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "LeaveApplication" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "BiometricDevice" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "BiometricPunch" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "Candidate" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "Application" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "ApplicationView" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "Interview" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "InterviewScheduleBreak" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "JobRequisitionApproval" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "InterviewScorecard" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "JobOfferApproval" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "ApplicationHireConversion" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "UserPermissionOverride" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "EssPortalUser" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "AuditEvent" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "SystemSetting" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "StaffLeaveType" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "StaffLeaveBalance" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "StaffLeaveApplication" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "LeaveApprovalStep" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "LeaveApprovalAction" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "AccountsClient" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "AccountsStaffAccess" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "AccountsContract" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "ContractManager" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "ContractReminderSent" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "AccountsPaymentAccount" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "AccountsInvoice" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "AccountsCreditNote" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "AccountsCreditNoteLine" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "AccountsInvoiceLine" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "AccountsClientPayment" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "AccountsInvoicePaymentAllocation" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "AccountsVendor" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "AccountsVendorBill" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "AccountsVendorBillLine" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "AccountsVendorPayment" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "AccountsVendorPaymentAllocation" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "StaffNotification" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "WorkflowRun" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "WorkflowEvent" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "NotificationPolicy" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "NotificationDelivery" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "ChartOfAccount" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "GeneralLedgerEntry" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "ExpenseClaim" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "ExpenseClaimItem" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "Budget" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "BudgetLineItem" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "PettyCashFund" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "PettyCashTransaction" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "Announcement" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "TrainingProgram" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "TrainingEnrollment" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "TrainingMaterial" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "CompanyDocument" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "Insight" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "FleetVehicle" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "FleetDriver" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "FleetTransportPartner" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "FleetCustomer" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "FleetOrder" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "FleetTrip" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "FleetTripEvent" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "FleetTripComplianceCheck" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "FleetTripDocument" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "FleetSettlement" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "FleetIncident" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "PurchaseRequest" ADD COLUMN IF NOT EXISTS "organizationId" UUID;
ALTER TABLE "PurchaseRequestLine" ADD COLUMN IF NOT EXISTS "organizationId" UUID;

-- 4) Backfill existing rows
UPDATE "Client" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "RecruitmentSettings" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "RecruitmentClientPortalUser" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "OutsourcingClient" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "ShiftTemplate" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "RotaPeriod" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "ShiftAssignment" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "Department" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "Employee" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "EmployeeLifecycleEvent" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "EmployeeEntityTransfer" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "DisciplinaryCase" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "DisciplinaryAction" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "DisciplinaryDocument" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "Grievance" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "EmployeeDocument" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "OnboardingTemplate" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "OnboardingTemplateStep" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "OnboardingWorkflow" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "OnboardingTask" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "AttendancePolicy" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "AttendancePolicyAssignment" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "LeavePolicy" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "LeavePolicyRule" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "LeavePolicyAssignment" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "AttendanceEvent" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "AttendanceDaySummary" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "PublicHoliday" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "AttendanceException" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "LeaveBalanceLedger" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "CompanyAsset" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "EmployeeCredential" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "CredentialReminderSent" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "Payroll" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "StatutoryReturn" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "StatutoryReturnItem" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "LeaveType" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "LeaveBalance" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "LeaveApplication" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "BiometricDevice" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "BiometricPunch" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "Attendance" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "Job" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "Candidate" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "Application" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "ApplicationView" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "Interview" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "InterviewScheduleBreak" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "JobRequisitionApproval" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "InterviewScorecard" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "JobOfferApproval" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "ApplicationHireConversion" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "UserPermissionOverride" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "EssPortalUser" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "AuditEvent" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "SystemSetting" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "StaffLeaveType" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "StaffLeaveBalance" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "StaffLeaveApplication" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "LeaveApprovalStep" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "LeaveApprovalAction" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "AccountsClient" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "AccountsStaffAccess" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "AccountsContract" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "ContractManager" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "ContractReminderSent" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "AccountsPaymentAccount" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "AccountsInvoice" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "AccountsCreditNote" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "AccountsCreditNoteLine" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "AccountsInvoiceLine" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "AccountsClientPayment" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "AccountsInvoicePaymentAllocation" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "AccountsVendor" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "AccountsVendorBill" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "AccountsVendorBillLine" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "AccountsVendorPayment" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "AccountsVendorPaymentAllocation" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "StaffNotification" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "WorkflowRun" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "WorkflowEvent" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "NotificationPolicy" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "NotificationDelivery" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "ChartOfAccount" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "GeneralLedgerEntry" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "ExpenseClaim" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "ExpenseClaimItem" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "Budget" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "BudgetLineItem" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "PettyCashFund" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "PettyCashTransaction" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "Announcement" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "TrainingProgram" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "TrainingEnrollment" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "TrainingMaterial" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "CompanyDocument" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "Insight" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "FleetVehicle" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "FleetDriver" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "FleetTransportPartner" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "FleetCustomer" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "FleetOrder" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "FleetTrip" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "FleetTripEvent" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "FleetTripComplianceCheck" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "FleetTripDocument" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "FleetSettlement" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "FleetIncident" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "PurchaseRequest" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;
UPDATE "PurchaseRequestLine" SET "organizationId" = '00000000-0000-4000-8000-000000000001' WHERE "organizationId" IS NULL;

-- 5) Enforce NOT NULL
ALTER TABLE "Client" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "RecruitmentSettings" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "RecruitmentClientPortalUser" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "OutsourcingClient" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ShiftTemplate" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "RotaPeriod" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ShiftAssignment" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Department" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Employee" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "EmployeeLifecycleEvent" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "EmployeeEntityTransfer" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "DisciplinaryCase" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "DisciplinaryAction" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "DisciplinaryDocument" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Grievance" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "EmployeeDocument" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "OnboardingTemplate" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "OnboardingTemplateStep" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "OnboardingWorkflow" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "OnboardingTask" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "AttendancePolicy" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "AttendancePolicyAssignment" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "LeavePolicy" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "LeavePolicyRule" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "LeavePolicyAssignment" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "AttendanceEvent" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "AttendanceDaySummary" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "PublicHoliday" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "AttendanceException" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "LeaveBalanceLedger" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "CompanyAsset" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "EmployeeCredential" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "CredentialReminderSent" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Payroll" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "StatutoryReturn" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "StatutoryReturnItem" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "LeaveType" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "LeaveBalance" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "LeaveApplication" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "BiometricDevice" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "BiometricPunch" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Attendance" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Job" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Candidate" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Application" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ApplicationView" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Interview" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "InterviewScheduleBreak" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "JobRequisitionApproval" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "InterviewScorecard" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "JobOfferApproval" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ApplicationHireConversion" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "UserPermissionOverride" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "EssPortalUser" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "AuditEvent" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "SystemSetting" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "StaffLeaveType" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "StaffLeaveBalance" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "StaffLeaveApplication" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "LeaveApprovalStep" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "LeaveApprovalAction" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "AccountsClient" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "AccountsStaffAccess" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "AccountsContract" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ContractManager" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ContractReminderSent" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "AccountsPaymentAccount" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "AccountsInvoice" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "AccountsCreditNote" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "AccountsCreditNoteLine" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "AccountsInvoiceLine" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "AccountsClientPayment" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "AccountsInvoicePaymentAllocation" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "AccountsVendor" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "AccountsVendorBill" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "AccountsVendorBillLine" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "AccountsVendorPayment" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "AccountsVendorPaymentAllocation" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "StaffNotification" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "WorkflowRun" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "WorkflowEvent" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "NotificationPolicy" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "NotificationDelivery" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ChartOfAccount" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "GeneralLedgerEntry" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ExpenseClaim" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "ExpenseClaimItem" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Budget" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "BudgetLineItem" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "PettyCashFund" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "PettyCashTransaction" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Announcement" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "TrainingProgram" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "TrainingEnrollment" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "TrainingMaterial" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "CompanyDocument" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "Insight" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "FleetVehicle" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "FleetDriver" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "FleetTransportPartner" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "FleetCustomer" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "FleetOrder" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "FleetTrip" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "FleetTripEvent" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "FleetTripComplianceCheck" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "FleetTripDocument" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "FleetSettlement" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "FleetIncident" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "PurchaseRequest" ALTER COLUMN "organizationId" SET NOT NULL;
ALTER TABLE "PurchaseRequestLine" ALTER COLUMN "organizationId" SET NOT NULL;

-- 6) Indexes on organizationId
CREATE INDEX IF NOT EXISTS "Client_organizationId_idx" ON "Client"("organizationId");
CREATE INDEX IF NOT EXISTS "RecruitmentSettings_organizationId_idx" ON "RecruitmentSettings"("organizationId");
CREATE INDEX IF NOT EXISTS "RecruitmentClientPortalUser_organizationId_idx" ON "RecruitmentClientPortalUser"("organizationId");
CREATE INDEX IF NOT EXISTS "OutsourcingClient_organizationId_idx" ON "OutsourcingClient"("organizationId");
CREATE INDEX IF NOT EXISTS "ShiftTemplate_organizationId_idx" ON "ShiftTemplate"("organizationId");
CREATE INDEX IF NOT EXISTS "RotaPeriod_organizationId_idx" ON "RotaPeriod"("organizationId");
CREATE INDEX IF NOT EXISTS "ShiftAssignment_organizationId_idx" ON "ShiftAssignment"("organizationId");
CREATE INDEX IF NOT EXISTS "Department_organizationId_idx" ON "Department"("organizationId");
CREATE INDEX IF NOT EXISTS "Employee_organizationId_idx" ON "Employee"("organizationId");
CREATE INDEX IF NOT EXISTS "EmployeeLifecycleEvent_organizationId_idx" ON "EmployeeLifecycleEvent"("organizationId");
CREATE INDEX IF NOT EXISTS "EmployeeEntityTransfer_organizationId_idx" ON "EmployeeEntityTransfer"("organizationId");
CREATE INDEX IF NOT EXISTS "DisciplinaryCase_organizationId_idx" ON "DisciplinaryCase"("organizationId");
CREATE INDEX IF NOT EXISTS "DisciplinaryAction_organizationId_idx" ON "DisciplinaryAction"("organizationId");
CREATE INDEX IF NOT EXISTS "DisciplinaryDocument_organizationId_idx" ON "DisciplinaryDocument"("organizationId");
CREATE INDEX IF NOT EXISTS "Grievance_organizationId_idx" ON "Grievance"("organizationId");
CREATE INDEX IF NOT EXISTS "EmployeeDocument_organizationId_idx" ON "EmployeeDocument"("organizationId");
CREATE INDEX IF NOT EXISTS "OnboardingTemplate_organizationId_idx" ON "OnboardingTemplate"("organizationId");
CREATE INDEX IF NOT EXISTS "OnboardingTemplateStep_organizationId_idx" ON "OnboardingTemplateStep"("organizationId");
CREATE INDEX IF NOT EXISTS "OnboardingWorkflow_organizationId_idx" ON "OnboardingWorkflow"("organizationId");
CREATE INDEX IF NOT EXISTS "OnboardingTask_organizationId_idx" ON "OnboardingTask"("organizationId");
CREATE INDEX IF NOT EXISTS "AttendancePolicy_organizationId_idx" ON "AttendancePolicy"("organizationId");
CREATE INDEX IF NOT EXISTS "AttendancePolicyAssignment_organizationId_idx" ON "AttendancePolicyAssignment"("organizationId");
CREATE INDEX IF NOT EXISTS "LeavePolicy_organizationId_idx" ON "LeavePolicy"("organizationId");
CREATE INDEX IF NOT EXISTS "LeavePolicyRule_organizationId_idx" ON "LeavePolicyRule"("organizationId");
CREATE INDEX IF NOT EXISTS "LeavePolicyAssignment_organizationId_idx" ON "LeavePolicyAssignment"("organizationId");
CREATE INDEX IF NOT EXISTS "AttendanceEvent_organizationId_idx" ON "AttendanceEvent"("organizationId");
CREATE INDEX IF NOT EXISTS "AttendanceDaySummary_organizationId_idx" ON "AttendanceDaySummary"("organizationId");
CREATE INDEX IF NOT EXISTS "PublicHoliday_organizationId_idx" ON "PublicHoliday"("organizationId");
CREATE INDEX IF NOT EXISTS "AttendanceException_organizationId_idx" ON "AttendanceException"("organizationId");
CREATE INDEX IF NOT EXISTS "LeaveBalanceLedger_organizationId_idx" ON "LeaveBalanceLedger"("organizationId");
CREATE INDEX IF NOT EXISTS "CompanyAsset_organizationId_idx" ON "CompanyAsset"("organizationId");
CREATE INDEX IF NOT EXISTS "EmployeeCredential_organizationId_idx" ON "EmployeeCredential"("organizationId");
CREATE INDEX IF NOT EXISTS "CredentialReminderSent_organizationId_idx" ON "CredentialReminderSent"("organizationId");
CREATE INDEX IF NOT EXISTS "Payroll_organizationId_idx" ON "Payroll"("organizationId");
CREATE INDEX IF NOT EXISTS "StatutoryReturn_organizationId_idx" ON "StatutoryReturn"("organizationId");
CREATE INDEX IF NOT EXISTS "StatutoryReturnItem_organizationId_idx" ON "StatutoryReturnItem"("organizationId");
CREATE INDEX IF NOT EXISTS "LeaveType_organizationId_idx" ON "LeaveType"("organizationId");
CREATE INDEX IF NOT EXISTS "LeaveBalance_organizationId_idx" ON "LeaveBalance"("organizationId");
CREATE INDEX IF NOT EXISTS "LeaveApplication_organizationId_idx" ON "LeaveApplication"("organizationId");
CREATE INDEX IF NOT EXISTS "BiometricDevice_organizationId_idx" ON "BiometricDevice"("organizationId");
CREATE INDEX IF NOT EXISTS "BiometricPunch_organizationId_idx" ON "BiometricPunch"("organizationId");
CREATE INDEX IF NOT EXISTS "Attendance_organizationId_idx" ON "Attendance"("organizationId");
CREATE INDEX IF NOT EXISTS "Job_organizationId_idx" ON "Job"("organizationId");
CREATE INDEX IF NOT EXISTS "Candidate_organizationId_idx" ON "Candidate"("organizationId");
CREATE INDEX IF NOT EXISTS "Application_organizationId_idx" ON "Application"("organizationId");
CREATE INDEX IF NOT EXISTS "ApplicationView_organizationId_idx" ON "ApplicationView"("organizationId");
CREATE INDEX IF NOT EXISTS "Interview_organizationId_idx" ON "Interview"("organizationId");
CREATE INDEX IF NOT EXISTS "InterviewScheduleBreak_organizationId_idx" ON "InterviewScheduleBreak"("organizationId");
CREATE INDEX IF NOT EXISTS "JobRequisitionApproval_organizationId_idx" ON "JobRequisitionApproval"("organizationId");
CREATE INDEX IF NOT EXISTS "InterviewScorecard_organizationId_idx" ON "InterviewScorecard"("organizationId");
CREATE INDEX IF NOT EXISTS "JobOfferApproval_organizationId_idx" ON "JobOfferApproval"("organizationId");
CREATE INDEX IF NOT EXISTS "ApplicationHireConversion_organizationId_idx" ON "ApplicationHireConversion"("organizationId");
CREATE INDEX IF NOT EXISTS "UserPermissionOverride_organizationId_idx" ON "UserPermissionOverride"("organizationId");
CREATE INDEX IF NOT EXISTS "EssPortalUser_organizationId_idx" ON "EssPortalUser"("organizationId");
CREATE INDEX IF NOT EXISTS "AuditEvent_organizationId_idx" ON "AuditEvent"("organizationId");
CREATE INDEX IF NOT EXISTS "SystemSetting_organizationId_idx" ON "SystemSetting"("organizationId");
CREATE INDEX IF NOT EXISTS "StaffLeaveType_organizationId_idx" ON "StaffLeaveType"("organizationId");
CREATE INDEX IF NOT EXISTS "StaffLeaveBalance_organizationId_idx" ON "StaffLeaveBalance"("organizationId");
CREATE INDEX IF NOT EXISTS "StaffLeaveApplication_organizationId_idx" ON "StaffLeaveApplication"("organizationId");
CREATE INDEX IF NOT EXISTS "LeaveApprovalStep_organizationId_idx" ON "LeaveApprovalStep"("organizationId");
CREATE INDEX IF NOT EXISTS "LeaveApprovalAction_organizationId_idx" ON "LeaveApprovalAction"("organizationId");
CREATE INDEX IF NOT EXISTS "AccountsClient_organizationId_idx" ON "AccountsClient"("organizationId");
CREATE INDEX IF NOT EXISTS "AccountsStaffAccess_organizationId_idx" ON "AccountsStaffAccess"("organizationId");
CREATE INDEX IF NOT EXISTS "AccountsContract_organizationId_idx" ON "AccountsContract"("organizationId");
CREATE INDEX IF NOT EXISTS "ContractManager_organizationId_idx" ON "ContractManager"("organizationId");
CREATE INDEX IF NOT EXISTS "ContractReminderSent_organizationId_idx" ON "ContractReminderSent"("organizationId");
CREATE INDEX IF NOT EXISTS "AccountsPaymentAccount_organizationId_idx" ON "AccountsPaymentAccount"("organizationId");
CREATE INDEX IF NOT EXISTS "AccountsInvoice_organizationId_idx" ON "AccountsInvoice"("organizationId");
CREATE INDEX IF NOT EXISTS "AccountsCreditNote_organizationId_idx" ON "AccountsCreditNote"("organizationId");
CREATE INDEX IF NOT EXISTS "AccountsCreditNoteLine_organizationId_idx" ON "AccountsCreditNoteLine"("organizationId");
CREATE INDEX IF NOT EXISTS "AccountsInvoiceLine_organizationId_idx" ON "AccountsInvoiceLine"("organizationId");
CREATE INDEX IF NOT EXISTS "AccountsClientPayment_organizationId_idx" ON "AccountsClientPayment"("organizationId");
CREATE INDEX IF NOT EXISTS "AccountsInvoicePaymentAllocation_organizationId_idx" ON "AccountsInvoicePaymentAllocation"("organizationId");
CREATE INDEX IF NOT EXISTS "AccountsVendor_organizationId_idx" ON "AccountsVendor"("organizationId");
CREATE INDEX IF NOT EXISTS "AccountsVendorBill_organizationId_idx" ON "AccountsVendorBill"("organizationId");
CREATE INDEX IF NOT EXISTS "AccountsVendorBillLine_organizationId_idx" ON "AccountsVendorBillLine"("organizationId");
CREATE INDEX IF NOT EXISTS "AccountsVendorPayment_organizationId_idx" ON "AccountsVendorPayment"("organizationId");
CREATE INDEX IF NOT EXISTS "AccountsVendorPaymentAllocation_organizationId_idx" ON "AccountsVendorPaymentAllocation"("organizationId");
CREATE INDEX IF NOT EXISTS "StaffNotification_organizationId_idx" ON "StaffNotification"("organizationId");
CREATE INDEX IF NOT EXISTS "WorkflowRun_organizationId_idx" ON "WorkflowRun"("organizationId");
CREATE INDEX IF NOT EXISTS "WorkflowEvent_organizationId_idx" ON "WorkflowEvent"("organizationId");
CREATE INDEX IF NOT EXISTS "NotificationPolicy_organizationId_idx" ON "NotificationPolicy"("organizationId");
CREATE INDEX IF NOT EXISTS "NotificationDelivery_organizationId_idx" ON "NotificationDelivery"("organizationId");
CREATE INDEX IF NOT EXISTS "ChartOfAccount_organizationId_idx" ON "ChartOfAccount"("organizationId");
CREATE INDEX IF NOT EXISTS "GeneralLedgerEntry_organizationId_idx" ON "GeneralLedgerEntry"("organizationId");
CREATE INDEX IF NOT EXISTS "ExpenseClaim_organizationId_idx" ON "ExpenseClaim"("organizationId");
CREATE INDEX IF NOT EXISTS "ExpenseClaimItem_organizationId_idx" ON "ExpenseClaimItem"("organizationId");
CREATE INDEX IF NOT EXISTS "Budget_organizationId_idx" ON "Budget"("organizationId");
CREATE INDEX IF NOT EXISTS "BudgetLineItem_organizationId_idx" ON "BudgetLineItem"("organizationId");
CREATE INDEX IF NOT EXISTS "PettyCashFund_organizationId_idx" ON "PettyCashFund"("organizationId");
CREATE INDEX IF NOT EXISTS "PettyCashTransaction_organizationId_idx" ON "PettyCashTransaction"("organizationId");
CREATE INDEX IF NOT EXISTS "Announcement_organizationId_idx" ON "Announcement"("organizationId");
CREATE INDEX IF NOT EXISTS "TrainingProgram_organizationId_idx" ON "TrainingProgram"("organizationId");
CREATE INDEX IF NOT EXISTS "TrainingEnrollment_organizationId_idx" ON "TrainingEnrollment"("organizationId");
CREATE INDEX IF NOT EXISTS "TrainingMaterial_organizationId_idx" ON "TrainingMaterial"("organizationId");
CREATE INDEX IF NOT EXISTS "CompanyDocument_organizationId_idx" ON "CompanyDocument"("organizationId");
CREATE INDEX IF NOT EXISTS "Insight_organizationId_idx" ON "Insight"("organizationId");
CREATE INDEX IF NOT EXISTS "FleetVehicle_organizationId_idx" ON "FleetVehicle"("organizationId");
CREATE INDEX IF NOT EXISTS "FleetDriver_organizationId_idx" ON "FleetDriver"("organizationId");
CREATE INDEX IF NOT EXISTS "FleetTransportPartner_organizationId_idx" ON "FleetTransportPartner"("organizationId");
CREATE INDEX IF NOT EXISTS "FleetCustomer_organizationId_idx" ON "FleetCustomer"("organizationId");
CREATE INDEX IF NOT EXISTS "FleetOrder_organizationId_idx" ON "FleetOrder"("organizationId");
CREATE INDEX IF NOT EXISTS "FleetTrip_organizationId_idx" ON "FleetTrip"("organizationId");
CREATE INDEX IF NOT EXISTS "FleetTripEvent_organizationId_idx" ON "FleetTripEvent"("organizationId");
CREATE INDEX IF NOT EXISTS "FleetTripComplianceCheck_organizationId_idx" ON "FleetTripComplianceCheck"("organizationId");
CREATE INDEX IF NOT EXISTS "FleetTripDocument_organizationId_idx" ON "FleetTripDocument"("organizationId");
CREATE INDEX IF NOT EXISTS "FleetSettlement_organizationId_idx" ON "FleetSettlement"("organizationId");
CREATE INDEX IF NOT EXISTS "FleetIncident_organizationId_idx" ON "FleetIncident"("organizationId");
CREATE INDEX IF NOT EXISTS "PurchaseRequest_organizationId_idx" ON "PurchaseRequest"("organizationId");
CREATE INDEX IF NOT EXISTS "PurchaseRequestLine_organizationId_idx" ON "PurchaseRequestLine"("organizationId");

-- 7) Memberships for existing staff users
INSERT INTO "OrganizationMembership" ("id", "userId", "organizationId", "role", "updatedAt")
SELECT gen_random_uuid(), u."id", '00000000-0000-4000-8000-000000000001', u."role", CURRENT_TIMESTAMP
FROM "User" u
WHERE NOT EXISTS (
  SELECT 1 FROM "OrganizationMembership" m
  WHERE m."userId" = u."id" AND m."organizationId" = '00000000-0000-4000-8000-000000000001'
);

-- 8) Row-Level Security
-- RAV-62: Row-Level Security policies (generated by scripts/generate-rls-sql.mjs)
-- Apply after organizationId columns exist: npm run db:rls

ALTER TABLE "Organization" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Organization_insert_bootstrap" ON "Organization";
CREATE POLICY "Organization_insert_bootstrap" ON "Organization"
  FOR INSERT
  WITH CHECK (coalesce(current_setting('app.current_org', true), '') = '');

DROP POLICY IF EXISTS "Organization_tenant_select" ON "Organization";
CREATE POLICY "Organization_tenant_select" ON "Organization"
  FOR SELECT
  USING (id = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "Organization_tenant_update" ON "Organization";
CREATE POLICY "Organization_tenant_update" ON "Organization"
  FOR UPDATE
  USING (id = current_setting('app.current_org', true)::uuid)
  WITH CHECK (id = current_setting('app.current_org', true)::uuid);

ALTER TABLE "Client" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Client" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Client_tenant_rw" ON "Client";
CREATE POLICY "Client_tenant_rw" ON "Client"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "Client_insert_bootstrap" ON "Client";
CREATE POLICY "Client_insert_bootstrap" ON "Client"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "RecruitmentSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RecruitmentSettings" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "RecruitmentSettings_tenant_rw" ON "RecruitmentSettings";
CREATE POLICY "RecruitmentSettings_tenant_rw" ON "RecruitmentSettings"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "RecruitmentSettings_insert_bootstrap" ON "RecruitmentSettings";
CREATE POLICY "RecruitmentSettings_insert_bootstrap" ON "RecruitmentSettings"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "RecruitmentClientPortalUser" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RecruitmentClientPortalUser" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "RecruitmentClientPortalUser_tenant_rw" ON "RecruitmentClientPortalUser";
CREATE POLICY "RecruitmentClientPortalUser_tenant_rw" ON "RecruitmentClientPortalUser"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "RecruitmentClientPortalUser_insert_bootstrap" ON "RecruitmentClientPortalUser";
CREATE POLICY "RecruitmentClientPortalUser_insert_bootstrap" ON "RecruitmentClientPortalUser"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "OutsourcingClient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OutsourcingClient" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "OutsourcingClient_tenant_rw" ON "OutsourcingClient";
CREATE POLICY "OutsourcingClient_tenant_rw" ON "OutsourcingClient"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "OutsourcingClient_insert_bootstrap" ON "OutsourcingClient";
CREATE POLICY "OutsourcingClient_insert_bootstrap" ON "OutsourcingClient"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "ShiftTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShiftTemplate" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ShiftTemplate_tenant_rw" ON "ShiftTemplate";
CREATE POLICY "ShiftTemplate_tenant_rw" ON "ShiftTemplate"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "ShiftTemplate_insert_bootstrap" ON "ShiftTemplate";
CREATE POLICY "ShiftTemplate_insert_bootstrap" ON "ShiftTemplate"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "RotaPeriod" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "RotaPeriod" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "RotaPeriod_tenant_rw" ON "RotaPeriod";
CREATE POLICY "RotaPeriod_tenant_rw" ON "RotaPeriod"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "RotaPeriod_insert_bootstrap" ON "RotaPeriod";
CREATE POLICY "RotaPeriod_insert_bootstrap" ON "RotaPeriod"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "ShiftAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ShiftAssignment" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ShiftAssignment_tenant_rw" ON "ShiftAssignment";
CREATE POLICY "ShiftAssignment_tenant_rw" ON "ShiftAssignment"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "ShiftAssignment_insert_bootstrap" ON "ShiftAssignment";
CREATE POLICY "ShiftAssignment_insert_bootstrap" ON "ShiftAssignment"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "Department" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Department" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Department_tenant_rw" ON "Department";
CREATE POLICY "Department_tenant_rw" ON "Department"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "Department_insert_bootstrap" ON "Department";
CREATE POLICY "Department_insert_bootstrap" ON "Department"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "Employee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Employee" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Employee_tenant_rw" ON "Employee";
CREATE POLICY "Employee_tenant_rw" ON "Employee"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "Employee_insert_bootstrap" ON "Employee";
CREATE POLICY "Employee_insert_bootstrap" ON "Employee"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "EmployeeLifecycleEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmployeeLifecycleEvent" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "EmployeeLifecycleEvent_tenant_rw" ON "EmployeeLifecycleEvent";
CREATE POLICY "EmployeeLifecycleEvent_tenant_rw" ON "EmployeeLifecycleEvent"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "EmployeeLifecycleEvent_insert_bootstrap" ON "EmployeeLifecycleEvent";
CREATE POLICY "EmployeeLifecycleEvent_insert_bootstrap" ON "EmployeeLifecycleEvent"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "EmployeeEntityTransfer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmployeeEntityTransfer" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "EmployeeEntityTransfer_tenant_rw" ON "EmployeeEntityTransfer";
CREATE POLICY "EmployeeEntityTransfer_tenant_rw" ON "EmployeeEntityTransfer"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "EmployeeEntityTransfer_insert_bootstrap" ON "EmployeeEntityTransfer";
CREATE POLICY "EmployeeEntityTransfer_insert_bootstrap" ON "EmployeeEntityTransfer"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "DisciplinaryCase" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DisciplinaryCase" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "DisciplinaryCase_tenant_rw" ON "DisciplinaryCase";
CREATE POLICY "DisciplinaryCase_tenant_rw" ON "DisciplinaryCase"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "DisciplinaryCase_insert_bootstrap" ON "DisciplinaryCase";
CREATE POLICY "DisciplinaryCase_insert_bootstrap" ON "DisciplinaryCase"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "DisciplinaryAction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DisciplinaryAction" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "DisciplinaryAction_tenant_rw" ON "DisciplinaryAction";
CREATE POLICY "DisciplinaryAction_tenant_rw" ON "DisciplinaryAction"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "DisciplinaryAction_insert_bootstrap" ON "DisciplinaryAction";
CREATE POLICY "DisciplinaryAction_insert_bootstrap" ON "DisciplinaryAction"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "DisciplinaryDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "DisciplinaryDocument" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "DisciplinaryDocument_tenant_rw" ON "DisciplinaryDocument";
CREATE POLICY "DisciplinaryDocument_tenant_rw" ON "DisciplinaryDocument"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "DisciplinaryDocument_insert_bootstrap" ON "DisciplinaryDocument";
CREATE POLICY "DisciplinaryDocument_insert_bootstrap" ON "DisciplinaryDocument"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "Grievance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Grievance" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Grievance_tenant_rw" ON "Grievance";
CREATE POLICY "Grievance_tenant_rw" ON "Grievance"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "Grievance_insert_bootstrap" ON "Grievance";
CREATE POLICY "Grievance_insert_bootstrap" ON "Grievance"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "EmployeeDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmployeeDocument" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "EmployeeDocument_tenant_rw" ON "EmployeeDocument";
CREATE POLICY "EmployeeDocument_tenant_rw" ON "EmployeeDocument"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "EmployeeDocument_insert_bootstrap" ON "EmployeeDocument";
CREATE POLICY "EmployeeDocument_insert_bootstrap" ON "EmployeeDocument"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "OnboardingTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OnboardingTemplate" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "OnboardingTemplate_tenant_rw" ON "OnboardingTemplate";
CREATE POLICY "OnboardingTemplate_tenant_rw" ON "OnboardingTemplate"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "OnboardingTemplate_insert_bootstrap" ON "OnboardingTemplate";
CREATE POLICY "OnboardingTemplate_insert_bootstrap" ON "OnboardingTemplate"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "OnboardingTemplateStep" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OnboardingTemplateStep" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "OnboardingTemplateStep_tenant_rw" ON "OnboardingTemplateStep";
CREATE POLICY "OnboardingTemplateStep_tenant_rw" ON "OnboardingTemplateStep"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "OnboardingTemplateStep_insert_bootstrap" ON "OnboardingTemplateStep";
CREATE POLICY "OnboardingTemplateStep_insert_bootstrap" ON "OnboardingTemplateStep"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "OnboardingWorkflow" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OnboardingWorkflow" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "OnboardingWorkflow_tenant_rw" ON "OnboardingWorkflow";
CREATE POLICY "OnboardingWorkflow_tenant_rw" ON "OnboardingWorkflow"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "OnboardingWorkflow_insert_bootstrap" ON "OnboardingWorkflow";
CREATE POLICY "OnboardingWorkflow_insert_bootstrap" ON "OnboardingWorkflow"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "OnboardingTask" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OnboardingTask" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "OnboardingTask_tenant_rw" ON "OnboardingTask";
CREATE POLICY "OnboardingTask_tenant_rw" ON "OnboardingTask"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "OnboardingTask_insert_bootstrap" ON "OnboardingTask";
CREATE POLICY "OnboardingTask_insert_bootstrap" ON "OnboardingTask"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "AttendancePolicy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AttendancePolicy" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AttendancePolicy_tenant_rw" ON "AttendancePolicy";
CREATE POLICY "AttendancePolicy_tenant_rw" ON "AttendancePolicy"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "AttendancePolicy_insert_bootstrap" ON "AttendancePolicy";
CREATE POLICY "AttendancePolicy_insert_bootstrap" ON "AttendancePolicy"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "AttendancePolicyAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AttendancePolicyAssignment" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AttendancePolicyAssignment_tenant_rw" ON "AttendancePolicyAssignment";
CREATE POLICY "AttendancePolicyAssignment_tenant_rw" ON "AttendancePolicyAssignment"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "AttendancePolicyAssignment_insert_bootstrap" ON "AttendancePolicyAssignment";
CREATE POLICY "AttendancePolicyAssignment_insert_bootstrap" ON "AttendancePolicyAssignment"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "LeavePolicy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeavePolicy" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "LeavePolicy_tenant_rw" ON "LeavePolicy";
CREATE POLICY "LeavePolicy_tenant_rw" ON "LeavePolicy"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "LeavePolicy_insert_bootstrap" ON "LeavePolicy";
CREATE POLICY "LeavePolicy_insert_bootstrap" ON "LeavePolicy"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "LeavePolicyRule" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeavePolicyRule" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "LeavePolicyRule_tenant_rw" ON "LeavePolicyRule";
CREATE POLICY "LeavePolicyRule_tenant_rw" ON "LeavePolicyRule"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "LeavePolicyRule_insert_bootstrap" ON "LeavePolicyRule";
CREATE POLICY "LeavePolicyRule_insert_bootstrap" ON "LeavePolicyRule"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "LeavePolicyAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeavePolicyAssignment" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "LeavePolicyAssignment_tenant_rw" ON "LeavePolicyAssignment";
CREATE POLICY "LeavePolicyAssignment_tenant_rw" ON "LeavePolicyAssignment"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "LeavePolicyAssignment_insert_bootstrap" ON "LeavePolicyAssignment";
CREATE POLICY "LeavePolicyAssignment_insert_bootstrap" ON "LeavePolicyAssignment"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "AttendanceEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AttendanceEvent" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AttendanceEvent_tenant_rw" ON "AttendanceEvent";
CREATE POLICY "AttendanceEvent_tenant_rw" ON "AttendanceEvent"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "AttendanceEvent_insert_bootstrap" ON "AttendanceEvent";
CREATE POLICY "AttendanceEvent_insert_bootstrap" ON "AttendanceEvent"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "AttendanceDaySummary" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AttendanceDaySummary" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AttendanceDaySummary_tenant_rw" ON "AttendanceDaySummary";
CREATE POLICY "AttendanceDaySummary_tenant_rw" ON "AttendanceDaySummary"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "AttendanceDaySummary_insert_bootstrap" ON "AttendanceDaySummary";
CREATE POLICY "AttendanceDaySummary_insert_bootstrap" ON "AttendanceDaySummary"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "PublicHoliday" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PublicHoliday" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "PublicHoliday_tenant_rw" ON "PublicHoliday";
CREATE POLICY "PublicHoliday_tenant_rw" ON "PublicHoliday"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "PublicHoliday_insert_bootstrap" ON "PublicHoliday";
CREATE POLICY "PublicHoliday_insert_bootstrap" ON "PublicHoliday"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "AttendanceException" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AttendanceException" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AttendanceException_tenant_rw" ON "AttendanceException";
CREATE POLICY "AttendanceException_tenant_rw" ON "AttendanceException"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "AttendanceException_insert_bootstrap" ON "AttendanceException";
CREATE POLICY "AttendanceException_insert_bootstrap" ON "AttendanceException"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "LeaveBalanceLedger" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaveBalanceLedger" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "LeaveBalanceLedger_tenant_rw" ON "LeaveBalanceLedger";
CREATE POLICY "LeaveBalanceLedger_tenant_rw" ON "LeaveBalanceLedger"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "LeaveBalanceLedger_insert_bootstrap" ON "LeaveBalanceLedger";
CREATE POLICY "LeaveBalanceLedger_insert_bootstrap" ON "LeaveBalanceLedger"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "CompanyAsset" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CompanyAsset" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "CompanyAsset_tenant_rw" ON "CompanyAsset";
CREATE POLICY "CompanyAsset_tenant_rw" ON "CompanyAsset"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "CompanyAsset_insert_bootstrap" ON "CompanyAsset";
CREATE POLICY "CompanyAsset_insert_bootstrap" ON "CompanyAsset"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "EmployeeCredential" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EmployeeCredential" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "EmployeeCredential_tenant_rw" ON "EmployeeCredential";
CREATE POLICY "EmployeeCredential_tenant_rw" ON "EmployeeCredential"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "EmployeeCredential_insert_bootstrap" ON "EmployeeCredential";
CREATE POLICY "EmployeeCredential_insert_bootstrap" ON "EmployeeCredential"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "CredentialReminderSent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CredentialReminderSent" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "CredentialReminderSent_tenant_rw" ON "CredentialReminderSent";
CREATE POLICY "CredentialReminderSent_tenant_rw" ON "CredentialReminderSent"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "CredentialReminderSent_insert_bootstrap" ON "CredentialReminderSent";
CREATE POLICY "CredentialReminderSent_insert_bootstrap" ON "CredentialReminderSent"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "Payroll" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Payroll" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Payroll_tenant_rw" ON "Payroll";
CREATE POLICY "Payroll_tenant_rw" ON "Payroll"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "Payroll_insert_bootstrap" ON "Payroll";
CREATE POLICY "Payroll_insert_bootstrap" ON "Payroll"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "StatutoryReturn" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StatutoryReturn" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "StatutoryReturn_tenant_rw" ON "StatutoryReturn";
CREATE POLICY "StatutoryReturn_tenant_rw" ON "StatutoryReturn"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "StatutoryReturn_insert_bootstrap" ON "StatutoryReturn";
CREATE POLICY "StatutoryReturn_insert_bootstrap" ON "StatutoryReturn"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "StatutoryReturnItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StatutoryReturnItem" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "StatutoryReturnItem_tenant_rw" ON "StatutoryReturnItem";
CREATE POLICY "StatutoryReturnItem_tenant_rw" ON "StatutoryReturnItem"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "StatutoryReturnItem_insert_bootstrap" ON "StatutoryReturnItem";
CREATE POLICY "StatutoryReturnItem_insert_bootstrap" ON "StatutoryReturnItem"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "LeaveType" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaveType" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "LeaveType_tenant_rw" ON "LeaveType";
CREATE POLICY "LeaveType_tenant_rw" ON "LeaveType"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "LeaveType_insert_bootstrap" ON "LeaveType";
CREATE POLICY "LeaveType_insert_bootstrap" ON "LeaveType"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "LeaveBalance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaveBalance" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "LeaveBalance_tenant_rw" ON "LeaveBalance";
CREATE POLICY "LeaveBalance_tenant_rw" ON "LeaveBalance"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "LeaveBalance_insert_bootstrap" ON "LeaveBalance";
CREATE POLICY "LeaveBalance_insert_bootstrap" ON "LeaveBalance"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "LeaveApplication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaveApplication" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "LeaveApplication_tenant_rw" ON "LeaveApplication";
CREATE POLICY "LeaveApplication_tenant_rw" ON "LeaveApplication"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "LeaveApplication_insert_bootstrap" ON "LeaveApplication";
CREATE POLICY "LeaveApplication_insert_bootstrap" ON "LeaveApplication"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "BiometricDevice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BiometricDevice" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "BiometricDevice_tenant_rw" ON "BiometricDevice";
CREATE POLICY "BiometricDevice_tenant_rw" ON "BiometricDevice"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "BiometricDevice_insert_bootstrap" ON "BiometricDevice";
CREATE POLICY "BiometricDevice_insert_bootstrap" ON "BiometricDevice"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "BiometricPunch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BiometricPunch" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "BiometricPunch_tenant_rw" ON "BiometricPunch";
CREATE POLICY "BiometricPunch_tenant_rw" ON "BiometricPunch"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "BiometricPunch_insert_bootstrap" ON "BiometricPunch";
CREATE POLICY "BiometricPunch_insert_bootstrap" ON "BiometricPunch"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "Attendance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Attendance" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Attendance_tenant_rw" ON "Attendance";
CREATE POLICY "Attendance_tenant_rw" ON "Attendance"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "Attendance_insert_bootstrap" ON "Attendance";
CREATE POLICY "Attendance_insert_bootstrap" ON "Attendance"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "Job" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Job" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Job_tenant_rw" ON "Job";
CREATE POLICY "Job_tenant_rw" ON "Job"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "Job_insert_bootstrap" ON "Job";
CREATE POLICY "Job_insert_bootstrap" ON "Job"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "Candidate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Candidate" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Candidate_tenant_rw" ON "Candidate";
CREATE POLICY "Candidate_tenant_rw" ON "Candidate"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "Candidate_insert_bootstrap" ON "Candidate";
CREATE POLICY "Candidate_insert_bootstrap" ON "Candidate"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "Application" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Application" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Application_tenant_rw" ON "Application";
CREATE POLICY "Application_tenant_rw" ON "Application"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "Application_insert_bootstrap" ON "Application";
CREATE POLICY "Application_insert_bootstrap" ON "Application"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "ApplicationView" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApplicationView" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ApplicationView_tenant_rw" ON "ApplicationView";
CREATE POLICY "ApplicationView_tenant_rw" ON "ApplicationView"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "ApplicationView_insert_bootstrap" ON "ApplicationView";
CREATE POLICY "ApplicationView_insert_bootstrap" ON "ApplicationView"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "Interview" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Interview" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Interview_tenant_rw" ON "Interview";
CREATE POLICY "Interview_tenant_rw" ON "Interview"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "Interview_insert_bootstrap" ON "Interview";
CREATE POLICY "Interview_insert_bootstrap" ON "Interview"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "InterviewScheduleBreak" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InterviewScheduleBreak" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "InterviewScheduleBreak_tenant_rw" ON "InterviewScheduleBreak";
CREATE POLICY "InterviewScheduleBreak_tenant_rw" ON "InterviewScheduleBreak"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "InterviewScheduleBreak_insert_bootstrap" ON "InterviewScheduleBreak";
CREATE POLICY "InterviewScheduleBreak_insert_bootstrap" ON "InterviewScheduleBreak"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "JobRequisitionApproval" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobRequisitionApproval" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "JobRequisitionApproval_tenant_rw" ON "JobRequisitionApproval";
CREATE POLICY "JobRequisitionApproval_tenant_rw" ON "JobRequisitionApproval"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "JobRequisitionApproval_insert_bootstrap" ON "JobRequisitionApproval";
CREATE POLICY "JobRequisitionApproval_insert_bootstrap" ON "JobRequisitionApproval"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "InterviewScorecard" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "InterviewScorecard" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "InterviewScorecard_tenant_rw" ON "InterviewScorecard";
CREATE POLICY "InterviewScorecard_tenant_rw" ON "InterviewScorecard"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "InterviewScorecard_insert_bootstrap" ON "InterviewScorecard";
CREATE POLICY "InterviewScorecard_insert_bootstrap" ON "InterviewScorecard"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "JobOfferApproval" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobOfferApproval" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "JobOfferApproval_tenant_rw" ON "JobOfferApproval";
CREATE POLICY "JobOfferApproval_tenant_rw" ON "JobOfferApproval"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "JobOfferApproval_insert_bootstrap" ON "JobOfferApproval";
CREATE POLICY "JobOfferApproval_insert_bootstrap" ON "JobOfferApproval"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "ApplicationHireConversion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApplicationHireConversion" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ApplicationHireConversion_tenant_rw" ON "ApplicationHireConversion";
CREATE POLICY "ApplicationHireConversion_tenant_rw" ON "ApplicationHireConversion"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "ApplicationHireConversion_insert_bootstrap" ON "ApplicationHireConversion";
CREATE POLICY "ApplicationHireConversion_insert_bootstrap" ON "ApplicationHireConversion"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "UserPermissionOverride" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UserPermissionOverride" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "UserPermissionOverride_tenant_rw" ON "UserPermissionOverride";
CREATE POLICY "UserPermissionOverride_tenant_rw" ON "UserPermissionOverride"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "UserPermissionOverride_insert_bootstrap" ON "UserPermissionOverride";
CREATE POLICY "UserPermissionOverride_insert_bootstrap" ON "UserPermissionOverride"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "EssPortalUser" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "EssPortalUser" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "EssPortalUser_tenant_rw" ON "EssPortalUser";
CREATE POLICY "EssPortalUser_tenant_rw" ON "EssPortalUser"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "EssPortalUser_insert_bootstrap" ON "EssPortalUser";
CREATE POLICY "EssPortalUser_insert_bootstrap" ON "EssPortalUser"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "AuditEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AuditEvent" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AuditEvent_tenant_rw" ON "AuditEvent";
CREATE POLICY "AuditEvent_tenant_rw" ON "AuditEvent"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "AuditEvent_insert_bootstrap" ON "AuditEvent";
CREATE POLICY "AuditEvent_insert_bootstrap" ON "AuditEvent"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "SystemSetting" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SystemSetting" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "SystemSetting_tenant_rw" ON "SystemSetting";
CREATE POLICY "SystemSetting_tenant_rw" ON "SystemSetting"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "SystemSetting_insert_bootstrap" ON "SystemSetting";
CREATE POLICY "SystemSetting_insert_bootstrap" ON "SystemSetting"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "StaffLeaveType" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffLeaveType" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "StaffLeaveType_tenant_rw" ON "StaffLeaveType";
CREATE POLICY "StaffLeaveType_tenant_rw" ON "StaffLeaveType"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "StaffLeaveType_insert_bootstrap" ON "StaffLeaveType";
CREATE POLICY "StaffLeaveType_insert_bootstrap" ON "StaffLeaveType"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "StaffLeaveBalance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffLeaveBalance" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "StaffLeaveBalance_tenant_rw" ON "StaffLeaveBalance";
CREATE POLICY "StaffLeaveBalance_tenant_rw" ON "StaffLeaveBalance"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "StaffLeaveBalance_insert_bootstrap" ON "StaffLeaveBalance";
CREATE POLICY "StaffLeaveBalance_insert_bootstrap" ON "StaffLeaveBalance"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "StaffLeaveApplication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffLeaveApplication" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "StaffLeaveApplication_tenant_rw" ON "StaffLeaveApplication";
CREATE POLICY "StaffLeaveApplication_tenant_rw" ON "StaffLeaveApplication"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "StaffLeaveApplication_insert_bootstrap" ON "StaffLeaveApplication";
CREATE POLICY "StaffLeaveApplication_insert_bootstrap" ON "StaffLeaveApplication"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "LeaveApprovalStep" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaveApprovalStep" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "LeaveApprovalStep_tenant_rw" ON "LeaveApprovalStep";
CREATE POLICY "LeaveApprovalStep_tenant_rw" ON "LeaveApprovalStep"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "LeaveApprovalStep_insert_bootstrap" ON "LeaveApprovalStep";
CREATE POLICY "LeaveApprovalStep_insert_bootstrap" ON "LeaveApprovalStep"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "LeaveApprovalAction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "LeaveApprovalAction" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "LeaveApprovalAction_tenant_rw" ON "LeaveApprovalAction";
CREATE POLICY "LeaveApprovalAction_tenant_rw" ON "LeaveApprovalAction"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "LeaveApprovalAction_insert_bootstrap" ON "LeaveApprovalAction";
CREATE POLICY "LeaveApprovalAction_insert_bootstrap" ON "LeaveApprovalAction"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "OrganizationMembership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OrganizationMembership" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "OrganizationMembership_tenant_rw" ON "OrganizationMembership";
CREATE POLICY "OrganizationMembership_tenant_rw" ON "OrganizationMembership"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "OrganizationMembership_insert_bootstrap" ON "OrganizationMembership";
CREATE POLICY "OrganizationMembership_insert_bootstrap" ON "OrganizationMembership"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "AccountsClient" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccountsClient" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AccountsClient_tenant_rw" ON "AccountsClient";
CREATE POLICY "AccountsClient_tenant_rw" ON "AccountsClient"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "AccountsClient_insert_bootstrap" ON "AccountsClient";
CREATE POLICY "AccountsClient_insert_bootstrap" ON "AccountsClient"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "AccountsStaffAccess" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccountsStaffAccess" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AccountsStaffAccess_tenant_rw" ON "AccountsStaffAccess";
CREATE POLICY "AccountsStaffAccess_tenant_rw" ON "AccountsStaffAccess"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "AccountsStaffAccess_insert_bootstrap" ON "AccountsStaffAccess";
CREATE POLICY "AccountsStaffAccess_insert_bootstrap" ON "AccountsStaffAccess"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "AccountsContract" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccountsContract" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AccountsContract_tenant_rw" ON "AccountsContract";
CREATE POLICY "AccountsContract_tenant_rw" ON "AccountsContract"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "AccountsContract_insert_bootstrap" ON "AccountsContract";
CREATE POLICY "AccountsContract_insert_bootstrap" ON "AccountsContract"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "ContractManager" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContractManager" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ContractManager_tenant_rw" ON "ContractManager";
CREATE POLICY "ContractManager_tenant_rw" ON "ContractManager"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "ContractManager_insert_bootstrap" ON "ContractManager";
CREATE POLICY "ContractManager_insert_bootstrap" ON "ContractManager"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "ContractReminderSent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ContractReminderSent" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ContractReminderSent_tenant_rw" ON "ContractReminderSent";
CREATE POLICY "ContractReminderSent_tenant_rw" ON "ContractReminderSent"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "ContractReminderSent_insert_bootstrap" ON "ContractReminderSent";
CREATE POLICY "ContractReminderSent_insert_bootstrap" ON "ContractReminderSent"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "AccountsPaymentAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccountsPaymentAccount" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AccountsPaymentAccount_tenant_rw" ON "AccountsPaymentAccount";
CREATE POLICY "AccountsPaymentAccount_tenant_rw" ON "AccountsPaymentAccount"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "AccountsPaymentAccount_insert_bootstrap" ON "AccountsPaymentAccount";
CREATE POLICY "AccountsPaymentAccount_insert_bootstrap" ON "AccountsPaymentAccount"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "AccountsInvoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccountsInvoice" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AccountsInvoice_tenant_rw" ON "AccountsInvoice";
CREATE POLICY "AccountsInvoice_tenant_rw" ON "AccountsInvoice"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "AccountsInvoice_insert_bootstrap" ON "AccountsInvoice";
CREATE POLICY "AccountsInvoice_insert_bootstrap" ON "AccountsInvoice"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "AccountsCreditNote" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccountsCreditNote" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AccountsCreditNote_tenant_rw" ON "AccountsCreditNote";
CREATE POLICY "AccountsCreditNote_tenant_rw" ON "AccountsCreditNote"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "AccountsCreditNote_insert_bootstrap" ON "AccountsCreditNote";
CREATE POLICY "AccountsCreditNote_insert_bootstrap" ON "AccountsCreditNote"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "AccountsCreditNoteLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccountsCreditNoteLine" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AccountsCreditNoteLine_tenant_rw" ON "AccountsCreditNoteLine";
CREATE POLICY "AccountsCreditNoteLine_tenant_rw" ON "AccountsCreditNoteLine"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "AccountsCreditNoteLine_insert_bootstrap" ON "AccountsCreditNoteLine";
CREATE POLICY "AccountsCreditNoteLine_insert_bootstrap" ON "AccountsCreditNoteLine"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "AccountsInvoiceLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccountsInvoiceLine" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AccountsInvoiceLine_tenant_rw" ON "AccountsInvoiceLine";
CREATE POLICY "AccountsInvoiceLine_tenant_rw" ON "AccountsInvoiceLine"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "AccountsInvoiceLine_insert_bootstrap" ON "AccountsInvoiceLine";
CREATE POLICY "AccountsInvoiceLine_insert_bootstrap" ON "AccountsInvoiceLine"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "AccountsClientPayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccountsClientPayment" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AccountsClientPayment_tenant_rw" ON "AccountsClientPayment";
CREATE POLICY "AccountsClientPayment_tenant_rw" ON "AccountsClientPayment"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "AccountsClientPayment_insert_bootstrap" ON "AccountsClientPayment";
CREATE POLICY "AccountsClientPayment_insert_bootstrap" ON "AccountsClientPayment"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "AccountsInvoicePaymentAllocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccountsInvoicePaymentAllocation" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AccountsInvoicePaymentAllocation_tenant_rw" ON "AccountsInvoicePaymentAllocation";
CREATE POLICY "AccountsInvoicePaymentAllocation_tenant_rw" ON "AccountsInvoicePaymentAllocation"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "AccountsInvoicePaymentAllocation_insert_bootstrap" ON "AccountsInvoicePaymentAllocation";
CREATE POLICY "AccountsInvoicePaymentAllocation_insert_bootstrap" ON "AccountsInvoicePaymentAllocation"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "AccountsVendor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccountsVendor" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AccountsVendor_tenant_rw" ON "AccountsVendor";
CREATE POLICY "AccountsVendor_tenant_rw" ON "AccountsVendor"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "AccountsVendor_insert_bootstrap" ON "AccountsVendor";
CREATE POLICY "AccountsVendor_insert_bootstrap" ON "AccountsVendor"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "AccountsVendorBill" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccountsVendorBill" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AccountsVendorBill_tenant_rw" ON "AccountsVendorBill";
CREATE POLICY "AccountsVendorBill_tenant_rw" ON "AccountsVendorBill"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "AccountsVendorBill_insert_bootstrap" ON "AccountsVendorBill";
CREATE POLICY "AccountsVendorBill_insert_bootstrap" ON "AccountsVendorBill"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "AccountsVendorBillLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccountsVendorBillLine" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AccountsVendorBillLine_tenant_rw" ON "AccountsVendorBillLine";
CREATE POLICY "AccountsVendorBillLine_tenant_rw" ON "AccountsVendorBillLine"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "AccountsVendorBillLine_insert_bootstrap" ON "AccountsVendorBillLine";
CREATE POLICY "AccountsVendorBillLine_insert_bootstrap" ON "AccountsVendorBillLine"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "AccountsVendorPayment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccountsVendorPayment" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AccountsVendorPayment_tenant_rw" ON "AccountsVendorPayment";
CREATE POLICY "AccountsVendorPayment_tenant_rw" ON "AccountsVendorPayment"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "AccountsVendorPayment_insert_bootstrap" ON "AccountsVendorPayment";
CREATE POLICY "AccountsVendorPayment_insert_bootstrap" ON "AccountsVendorPayment"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "AccountsVendorPaymentAllocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccountsVendorPaymentAllocation" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "AccountsVendorPaymentAllocation_tenant_rw" ON "AccountsVendorPaymentAllocation";
CREATE POLICY "AccountsVendorPaymentAllocation_tenant_rw" ON "AccountsVendorPaymentAllocation"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "AccountsVendorPaymentAllocation_insert_bootstrap" ON "AccountsVendorPaymentAllocation";
CREATE POLICY "AccountsVendorPaymentAllocation_insert_bootstrap" ON "AccountsVendorPaymentAllocation"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "StaffNotification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "StaffNotification" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "StaffNotification_tenant_rw" ON "StaffNotification";
CREATE POLICY "StaffNotification_tenant_rw" ON "StaffNotification"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "StaffNotification_insert_bootstrap" ON "StaffNotification";
CREATE POLICY "StaffNotification_insert_bootstrap" ON "StaffNotification"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "WorkflowRun" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkflowRun" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "WorkflowRun_tenant_rw" ON "WorkflowRun";
CREATE POLICY "WorkflowRun_tenant_rw" ON "WorkflowRun"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "WorkflowRun_insert_bootstrap" ON "WorkflowRun";
CREATE POLICY "WorkflowRun_insert_bootstrap" ON "WorkflowRun"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "WorkflowEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "WorkflowEvent" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "WorkflowEvent_tenant_rw" ON "WorkflowEvent";
CREATE POLICY "WorkflowEvent_tenant_rw" ON "WorkflowEvent"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "WorkflowEvent_insert_bootstrap" ON "WorkflowEvent";
CREATE POLICY "WorkflowEvent_insert_bootstrap" ON "WorkflowEvent"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "NotificationPolicy" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationPolicy" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "NotificationPolicy_tenant_rw" ON "NotificationPolicy";
CREATE POLICY "NotificationPolicy_tenant_rw" ON "NotificationPolicy"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "NotificationPolicy_insert_bootstrap" ON "NotificationPolicy";
CREATE POLICY "NotificationPolicy_insert_bootstrap" ON "NotificationPolicy"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "NotificationDelivery" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "NotificationDelivery" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "NotificationDelivery_tenant_rw" ON "NotificationDelivery";
CREATE POLICY "NotificationDelivery_tenant_rw" ON "NotificationDelivery"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "NotificationDelivery_insert_bootstrap" ON "NotificationDelivery";
CREATE POLICY "NotificationDelivery_insert_bootstrap" ON "NotificationDelivery"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "ChartOfAccount" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ChartOfAccount" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ChartOfAccount_tenant_rw" ON "ChartOfAccount";
CREATE POLICY "ChartOfAccount_tenant_rw" ON "ChartOfAccount"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "ChartOfAccount_insert_bootstrap" ON "ChartOfAccount";
CREATE POLICY "ChartOfAccount_insert_bootstrap" ON "ChartOfAccount"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "GeneralLedgerEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "GeneralLedgerEntry" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "GeneralLedgerEntry_tenant_rw" ON "GeneralLedgerEntry";
CREATE POLICY "GeneralLedgerEntry_tenant_rw" ON "GeneralLedgerEntry"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "GeneralLedgerEntry_insert_bootstrap" ON "GeneralLedgerEntry";
CREATE POLICY "GeneralLedgerEntry_insert_bootstrap" ON "GeneralLedgerEntry"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "ExpenseClaim" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExpenseClaim" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ExpenseClaim_tenant_rw" ON "ExpenseClaim";
CREATE POLICY "ExpenseClaim_tenant_rw" ON "ExpenseClaim"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "ExpenseClaim_insert_bootstrap" ON "ExpenseClaim";
CREATE POLICY "ExpenseClaim_insert_bootstrap" ON "ExpenseClaim"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "ExpenseClaimItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExpenseClaimItem" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ExpenseClaimItem_tenant_rw" ON "ExpenseClaimItem";
CREATE POLICY "ExpenseClaimItem_tenant_rw" ON "ExpenseClaimItem"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "ExpenseClaimItem_insert_bootstrap" ON "ExpenseClaimItem";
CREATE POLICY "ExpenseClaimItem_insert_bootstrap" ON "ExpenseClaimItem"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "Budget" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Budget" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Budget_tenant_rw" ON "Budget";
CREATE POLICY "Budget_tenant_rw" ON "Budget"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "Budget_insert_bootstrap" ON "Budget";
CREATE POLICY "Budget_insert_bootstrap" ON "Budget"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "BudgetLineItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "BudgetLineItem" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "BudgetLineItem_tenant_rw" ON "BudgetLineItem";
CREATE POLICY "BudgetLineItem_tenant_rw" ON "BudgetLineItem"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "BudgetLineItem_insert_bootstrap" ON "BudgetLineItem";
CREATE POLICY "BudgetLineItem_insert_bootstrap" ON "BudgetLineItem"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "PettyCashFund" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PettyCashFund" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "PettyCashFund_tenant_rw" ON "PettyCashFund";
CREATE POLICY "PettyCashFund_tenant_rw" ON "PettyCashFund"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "PettyCashFund_insert_bootstrap" ON "PettyCashFund";
CREATE POLICY "PettyCashFund_insert_bootstrap" ON "PettyCashFund"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "PettyCashTransaction" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PettyCashTransaction" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "PettyCashTransaction_tenant_rw" ON "PettyCashTransaction";
CREATE POLICY "PettyCashTransaction_tenant_rw" ON "PettyCashTransaction"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "PettyCashTransaction_insert_bootstrap" ON "PettyCashTransaction";
CREATE POLICY "PettyCashTransaction_insert_bootstrap" ON "PettyCashTransaction"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "Announcement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Announcement" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Announcement_tenant_rw" ON "Announcement";
CREATE POLICY "Announcement_tenant_rw" ON "Announcement"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "Announcement_insert_bootstrap" ON "Announcement";
CREATE POLICY "Announcement_insert_bootstrap" ON "Announcement"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "TrainingProgram" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrainingProgram" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "TrainingProgram_tenant_rw" ON "TrainingProgram";
CREATE POLICY "TrainingProgram_tenant_rw" ON "TrainingProgram"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "TrainingProgram_insert_bootstrap" ON "TrainingProgram";
CREATE POLICY "TrainingProgram_insert_bootstrap" ON "TrainingProgram"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "TrainingEnrollment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrainingEnrollment" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "TrainingEnrollment_tenant_rw" ON "TrainingEnrollment";
CREATE POLICY "TrainingEnrollment_tenant_rw" ON "TrainingEnrollment"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "TrainingEnrollment_insert_bootstrap" ON "TrainingEnrollment";
CREATE POLICY "TrainingEnrollment_insert_bootstrap" ON "TrainingEnrollment"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "TrainingMaterial" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "TrainingMaterial" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "TrainingMaterial_tenant_rw" ON "TrainingMaterial";
CREATE POLICY "TrainingMaterial_tenant_rw" ON "TrainingMaterial"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "TrainingMaterial_insert_bootstrap" ON "TrainingMaterial";
CREATE POLICY "TrainingMaterial_insert_bootstrap" ON "TrainingMaterial"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "CompanyDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CompanyDocument" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "CompanyDocument_tenant_rw" ON "CompanyDocument";
CREATE POLICY "CompanyDocument_tenant_rw" ON "CompanyDocument"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "CompanyDocument_insert_bootstrap" ON "CompanyDocument";
CREATE POLICY "CompanyDocument_insert_bootstrap" ON "CompanyDocument"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "Insight" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Insight" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Insight_tenant_rw" ON "Insight";
CREATE POLICY "Insight_tenant_rw" ON "Insight"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "Insight_insert_bootstrap" ON "Insight";
CREATE POLICY "Insight_insert_bootstrap" ON "Insight"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

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

ALTER TABLE "PurchaseRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseRequest" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "PurchaseRequest_tenant_rw" ON "PurchaseRequest";
CREATE POLICY "PurchaseRequest_tenant_rw" ON "PurchaseRequest"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "PurchaseRequest_insert_bootstrap" ON "PurchaseRequest";
CREATE POLICY "PurchaseRequest_insert_bootstrap" ON "PurchaseRequest"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

ALTER TABLE "PurchaseRequestLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PurchaseRequestLine" FORCE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "PurchaseRequestLine_tenant_rw" ON "PurchaseRequestLine";
CREATE POLICY "PurchaseRequestLine_tenant_rw" ON "PurchaseRequestLine"
  FOR ALL
  USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

DROP POLICY IF EXISTS "PurchaseRequestLine_insert_bootstrap" ON "PurchaseRequestLine";
CREATE POLICY "PurchaseRequestLine_insert_bootstrap" ON "PurchaseRequestLine"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );

-- Global tables (no RLS): User, PermissionDefinition, RolePermission, SchedulerLock