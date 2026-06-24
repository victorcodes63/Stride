-- Module 2: Recruitment & ATS workflow controls (additive only)
CREATE TYPE "AtsApprovalStatus" AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE "AtsOfferDecision" AS ENUM ('strong_yes', 'yes', 'hold', 'no');

CREATE TABLE "JobRequisitionApproval" (
  "id" TEXT NOT NULL,
  "jobId" TEXT NOT NULL,
  "requestedByUserId" TEXT NOT NULL,
  "approverUserId" TEXT NOT NULL,
  "status" "AtsApprovalStatus" NOT NULL DEFAULT 'pending',
  "notes" TEXT,
  "actedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JobRequisitionApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InterviewScorecard" (
  "id" TEXT NOT NULL,
  "interviewId" TEXT NOT NULL,
  "interviewerUserId" TEXT NOT NULL,
  "technicalScore" INTEGER NOT NULL,
  "communicationScore" INTEGER NOT NULL,
  "cultureScore" INTEGER NOT NULL,
  "decision" "AtsOfferDecision" NOT NULL,
  "strengths" TEXT,
  "concerns" TEXT,
  "recommendationNotes" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "InterviewScorecard_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobOfferApproval" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "requestedByUserId" TEXT NOT NULL,
  "approverUserId" TEXT NOT NULL,
  "status" "AtsApprovalStatus" NOT NULL DEFAULT 'pending',
  "proposedGrossSalary" DECIMAL(12,2),
  "currency" TEXT NOT NULL DEFAULT 'KES',
  "startDate" DATE,
  "notes" TEXT,
  "actedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "JobOfferApproval_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApplicationHireConversion" (
  "id" TEXT NOT NULL,
  "applicationId" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "convertedByUserId" TEXT NOT NULL,
  "convertedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApplicationHireConversion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InterviewScorecard_interviewId_interviewerUserId_key" ON "InterviewScorecard"("interviewId", "interviewerUserId");
CREATE UNIQUE INDEX "ApplicationHireConversion_applicationId_key" ON "ApplicationHireConversion"("applicationId");
CREATE UNIQUE INDEX "ApplicationHireConversion_employeeId_key" ON "ApplicationHireConversion"("employeeId");

CREATE INDEX "JobRequisitionApproval_jobId_status_idx" ON "JobRequisitionApproval"("jobId", "status");
CREATE INDEX "JobRequisitionApproval_approverUserId_status_idx" ON "JobRequisitionApproval"("approverUserId", "status");
CREATE INDEX "InterviewScorecard_interviewId_submittedAt_idx" ON "InterviewScorecard"("interviewId", "submittedAt" DESC);
CREATE INDEX "JobOfferApproval_applicationId_status_idx" ON "JobOfferApproval"("applicationId", "status");
CREATE INDEX "JobOfferApproval_approverUserId_status_idx" ON "JobOfferApproval"("approverUserId", "status");
CREATE INDEX "ApplicationHireConversion_convertedAt_idx" ON "ApplicationHireConversion"("convertedAt" DESC);

ALTER TABLE "JobRequisitionApproval"
  ADD CONSTRAINT "JobRequisitionApproval_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InterviewScorecard"
  ADD CONSTRAINT "InterviewScorecard_interviewId_fkey"
  FOREIGN KEY ("interviewId") REFERENCES "Interview"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobOfferApproval"
  ADD CONSTRAINT "JobOfferApproval_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApplicationHireConversion"
  ADD CONSTRAINT "ApplicationHireConversion_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
