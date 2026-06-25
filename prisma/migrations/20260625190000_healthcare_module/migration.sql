-- RAV-94: Healthcare vertical pack — clinical wards, licence-gated assignments, NHIF hooks

CREATE TYPE "HealthcareClinicalRole" AS ENUM ('nurse', 'medical_officer', 'anaesthetist', 'clinical_officer', 'support');

CREATE TABLE "HealthcareWard" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "requiredCredentials" JSONB NOT NULL DEFAULT '[]',
    "minRestHours" INTEGER NOT NULL DEFAULT 11,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthcareWard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "HealthcareClinicalAssignment" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "outsourcingClientId" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "shiftAssignmentId" TEXT,
    "employeeId" TEXT NOT NULL,
    "clinicalRole" "HealthcareClinicalRole" NOT NULL DEFAULT 'nurse',
    "workDate" DATE NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "licenseOk" BOOLEAN NOT NULL DEFAULT false,
    "licenseWarnings" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HealthcareClinicalAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HealthcareWard_outsourcingClientId_code_key" ON "HealthcareWard"("outsourcingClientId", "code");
CREATE INDEX "HealthcareWard_outsourcingClientId_isActive_idx" ON "HealthcareWard"("outsourcingClientId", "isActive");

CREATE UNIQUE INDEX "HealthcareClinicalAssignment_shiftAssignmentId_key" ON "HealthcareClinicalAssignment"("shiftAssignmentId");
CREATE INDEX "HealthcareClinicalAssignment_outsourcingClientId_workDate_idx" ON "HealthcareClinicalAssignment"("outsourcingClientId", "workDate");
CREATE INDEX "HealthcareClinicalAssignment_wardId_workDate_idx" ON "HealthcareClinicalAssignment"("wardId", "workDate");
CREATE INDEX "HealthcareClinicalAssignment_employeeId_workDate_idx" ON "HealthcareClinicalAssignment"("employeeId", "workDate");

ALTER TABLE "HealthcareWard" ADD CONSTRAINT "HealthcareWard_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "HealthcareClinicalAssignment" ADD CONSTRAINT "HealthcareClinicalAssignment_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HealthcareClinicalAssignment" ADD CONSTRAINT "HealthcareClinicalAssignment_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "HealthcareWard"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HealthcareClinicalAssignment" ADD CONSTRAINT "HealthcareClinicalAssignment_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HealthcareClinicalAssignment" ADD CONSTRAINT "HealthcareClinicalAssignment_shiftAssignmentId_fkey" FOREIGN KEY ("shiftAssignmentId") REFERENCES "ShiftAssignment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
