-- Disciplinary + grievance HR modules (core tables; East Africa fair-process fields included on DisciplinaryCase).

CREATE TYPE "DisciplinaryCaseType" AS ENUM (
  'MISCONDUCT',
  'POOR_PERFORMANCE',
  'POLICY_VIOLATION',
  'INSUBORDINATION',
  'ABSENTEEISM',
  'HARASSMENT',
  'NEGLIGENCE',
  'OTHER'
);

CREATE TYPE "DisciplinaryCaseStatus" AS ENUM (
  'OPEN',
  'UNDER_INVESTIGATION',
  'HEARING_SCHEDULED',
  'AWAITING_RESPONSE',
  'RESOLVED',
  'ESCALATED',
  'CLOSED'
);

CREATE TYPE "DisciplinarySeverity" AS ENUM ('MINOR', 'MODERATE', 'SERIOUS', 'GROSS');

CREATE TYPE "DisciplinaryActionType" AS ENUM (
  'VERBAL_WARNING',
  'WRITTEN_WARNING',
  'FINAL_WARNING',
  'SHOW_CAUSE_LETTER',
  'HEARING',
  'SUSPENSION',
  'DEMOTION',
  'TERMINATION',
  'CASE_DISMISSED'
);

CREATE TYPE "GrievanceStatus" AS ENUM (
  'SUBMITTED',
  'UNDER_REVIEW',
  'INVESTIGATING',
  'RESOLVED',
  'ESCALATED',
  'WITHDRAWN'
);

CREATE TYPE "GrievanceCategory" AS ENUM (
  'WORKPLACE_SAFETY',
  'HARASSMENT',
  'DISCRIMINATION',
  'WORKLOAD',
  'MANAGEMENT',
  'COMPENSATION',
  'POLICY',
  'OTHER'
);

CREATE TABLE "DisciplinaryCase" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "caseNumber" TEXT NOT NULL,
  "type" "DisciplinaryCaseType" NOT NULL,
  "status" "DisciplinaryCaseStatus" NOT NULL DEFAULT 'OPEN',
  "severity" "DisciplinarySeverity" NOT NULL DEFAULT 'MINOR',
  "subject" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "incidentDate" TIMESTAMP(3) NOT NULL,
  "reportedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reportedById" TEXT NOT NULL,
  "resolution" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolvedById" TEXT,
  "laborJurisdiction" TEXT NOT NULL DEFAULT 'KE',
  "showCauseResponseDueAt" TIMESTAMP(3),
  "hearingAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DisciplinaryCase_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DisciplinaryAction" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "type" "DisciplinaryActionType" NOT NULL,
  "description" TEXT NOT NULL,
  "actionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "performedById" TEXT NOT NULL,
  "employeeResponse" TEXT,
  "employeeAcknowledged" BOOLEAN NOT NULL DEFAULT false,
  "acknowledgedAt" TIMESTAMP(3),
  "nextActionDue" TIMESTAMP(3),
  "letterGenerated" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "overrideSequence" BOOLEAN NOT NULL DEFAULT false,
  "overrideReason" TEXT,

  CONSTRAINT "DisciplinaryAction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DisciplinaryDocument" (
  "id" TEXT NOT NULL,
  "caseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "uploadedById" TEXT NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DisciplinaryDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Grievance" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "grievanceNumber" TEXT NOT NULL,
  "status" "GrievanceStatus" NOT NULL DEFAULT 'SUBMITTED',
  "subject" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "category" "GrievanceCategory" NOT NULL,
  "againstId" TEXT,
  "investigationNotes" TEXT,
  "resolution" TEXT,
  "resolvedAt" TIMESTAMP(3),
  "resolvedById" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Grievance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DisciplinaryCase_caseNumber_key" ON "DisciplinaryCase"("caseNumber");
CREATE INDEX "DisciplinaryCase_employeeId_idx" ON "DisciplinaryCase"("employeeId");
CREATE INDEX "DisciplinaryCase_status_idx" ON "DisciplinaryCase"("status");
CREATE INDEX "DisciplinaryCase_type_idx" ON "DisciplinaryCase"("type");

CREATE INDEX "DisciplinaryAction_caseId_actionDate_idx" ON "DisciplinaryAction"("caseId", "actionDate");

CREATE INDEX "DisciplinaryDocument_caseId_idx" ON "DisciplinaryDocument"("caseId");

CREATE UNIQUE INDEX "Grievance_grievanceNumber_key" ON "Grievance"("grievanceNumber");
CREATE INDEX "Grievance_employeeId_idx" ON "Grievance"("employeeId");
CREATE INDEX "Grievance_status_idx" ON "Grievance"("status");

ALTER TABLE "DisciplinaryCase"
  ADD CONSTRAINT "DisciplinaryCase_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DisciplinaryCase"
  ADD CONSTRAINT "DisciplinaryCase_reportedById_fkey"
  FOREIGN KEY ("reportedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DisciplinaryCase"
  ADD CONSTRAINT "DisciplinaryCase_resolvedById_fkey"
  FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "DisciplinaryAction"
  ADD CONSTRAINT "DisciplinaryAction_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "DisciplinaryCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DisciplinaryAction"
  ADD CONSTRAINT "DisciplinaryAction_performedById_fkey"
  FOREIGN KEY ("performedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DisciplinaryDocument"
  ADD CONSTRAINT "DisciplinaryDocument_caseId_fkey"
  FOREIGN KEY ("caseId") REFERENCES "DisciplinaryCase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DisciplinaryDocument"
  ADD CONSTRAINT "DisciplinaryDocument_uploadedById_fkey"
  FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Grievance"
  ADD CONSTRAINT "Grievance_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Grievance"
  ADD CONSTRAINT "Grievance_againstId_fkey"
  FOREIGN KEY ("againstId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Grievance"
  ADD CONSTRAINT "Grievance_resolvedById_fkey"
  FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
