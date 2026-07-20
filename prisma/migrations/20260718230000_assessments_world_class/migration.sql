-- World-class assessments: new question types, sections, question bank, proctoring,
-- provider integrations, competency fit, and usage metering.

-- 1. Extend enums --------------------------------------------------------------
ALTER TYPE "AssessmentQuestionType" ADD VALUE IF NOT EXISTS 'multi_select';
ALTER TYPE "AssessmentQuestionType" ADD VALUE IF NOT EXISTS 'short_text';
ALTER TYPE "AssessmentQuestionType" ADD VALUE IF NOT EXISTS 'long_text';
ALTER TYPE "AssessmentQuestionType" ADD VALUE IF NOT EXISTS 'code';
ALTER TYPE "AssessmentQuestionType" ADD VALUE IF NOT EXISTS 'likert';
ALTER TYPE "AssessmentQuestionType" ADD VALUE IF NOT EXISTS 'rating';
ALTER TYPE "AssessmentQuestionType" ADD VALUE IF NOT EXISTS 'ranking';
ALTER TYPE "AssessmentQuestionType" ADD VALUE IF NOT EXISTS 'situational';
ALTER TYPE "AssessmentQuestionType" ADD VALUE IF NOT EXISTS 'video_response';

ALTER TYPE "AssessmentAttemptStatus" ADD VALUE IF NOT EXISTS 'awaiting_review';

CREATE TYPE "AssessmentDifficulty" AS ENUM ('easy', 'medium', 'hard');
CREATE TYPE "AssessmentKind" AS ENUM ('skills', 'personality', 'cognitive', 'situational', 'mixed');
CREATE TYPE "IntegrityEventType" AS ENUM (
  'tab_blur', 'tab_focus', 'copy', 'paste', 'paste_blocked', 'right_click',
  'fullscreen_enter', 'fullscreen_exit', 'window_resize', 'webcam_snapshot',
  'face_missing', 'multiple_faces'
);
CREATE TYPE "AssessmentProviderKey" AS ENUM (
  'generic', 'criteria', 'shl', 'hogan', 'predictive_index', 'disc', 'big_five', 'hirevue'
);
CREATE TYPE "ExternalInviteStatus" AS ENUM (
  'pending', 'invited', 'in_progress', 'completed', 'error', 'expired'
);
CREATE TYPE "AssessmentUsageType" AS ENUM (
  'native_attempt', 'external_invite', 'proctoring_snapshot'
);

-- 2. Extend AssessmentTemplate -------------------------------------------------
ALTER TABLE "AssessmentTemplate"
  ADD COLUMN "kind" "AssessmentKind" NOT NULL DEFAULT 'skills',
  ADD COLUMN "category" TEXT,
  ADD COLUMN "passingScorePercent" INTEGER,
  ADD COLUMN "shuffleSections" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "shuffleQuestions" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "negativeMarking" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "showResultsToCandidate" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "requireConsent" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "requireWebcam" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "lockdown" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "retentionDays" INTEGER,
  ADD COLUMN "translations" JSONB;

CREATE INDEX "AssessmentTemplate_organizationId_kind_idx" ON "AssessmentTemplate"("organizationId", "kind");

-- 3. AssessmentSection ---------------------------------------------------------
CREATE TABLE "AssessmentSection" (
  "id" TEXT NOT NULL,
  "organizationId" UUID NOT NULL,
  "templateId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "timeLimitMinutes" INTEGER,
  "shuffleQuestions" BOOLEAN NOT NULL DEFAULT false,
  "pickCount" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssessmentSection_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AssessmentSection_templateId_orderIndex_idx" ON "AssessmentSection"("templateId", "orderIndex");
ALTER TABLE "AssessmentSection"
  ADD CONSTRAINT "AssessmentSection_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "AssessmentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. QuestionBankItem ----------------------------------------------------------
CREATE TABLE "QuestionBankItem" (
  "id" TEXT NOT NULL,
  "organizationId" UUID NOT NULL,
  "type" "AssessmentQuestionType" NOT NULL,
  "prompt" TEXT NOT NULL,
  "options" JSONB,
  "correctAnswer" JSONB,
  "scoring" JSONB,
  "explanation" TEXT,
  "mediaUrl" TEXT,
  "difficulty" "AssessmentDifficulty" NOT NULL DEFAULT 'medium',
  "defaultPoints" INTEGER NOT NULL DEFAULT 1,
  "category" TEXT,
  "tags" TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "QuestionBankItem_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "QuestionBankItem_organizationId_category_idx" ON "QuestionBankItem"("organizationId", "category");

-- 5. Extend AssessmentQuestion -------------------------------------------------
ALTER TABLE "AssessmentQuestion"
  ADD COLUMN "sectionId" TEXT,
  ADD COLUMN "bankItemId" TEXT,
  ADD COLUMN "scoring" JSONB,
  ADD COLUMN "explanation" TEXT,
  ADD COLUMN "mediaUrl" TEXT,
  ADD COLUMN "difficulty" "AssessmentDifficulty" NOT NULL DEFAULT 'medium',
  ADD COLUMN "weight" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN "required" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "translations" JSONB;

CREATE INDEX "AssessmentQuestion_sectionId_orderIndex_idx" ON "AssessmentQuestion"("sectionId", "orderIndex");
CREATE INDEX "AssessmentQuestion_bankItemId_idx" ON "AssessmentQuestion"("bankItemId");
ALTER TABLE "AssessmentQuestion"
  ADD CONSTRAINT "AssessmentQuestion_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "AssessmentSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AssessmentQuestion"
  ADD CONSTRAINT "AssessmentQuestion_bankItemId_fkey"
  FOREIGN KEY ("bankItemId") REFERENCES "QuestionBankItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. Extend ApplicationAssessmentAttempt --------------------------------------
ALTER TABLE "ApplicationAssessmentAttempt"
  ADD COLUMN "lastActivityAt" TIMESTAMP(3),
  ADD COLUMN "consentAcceptedAt" TIMESTAMP(3),
  ADD COLUMN "locale" TEXT,
  ADD COLUMN "userAgent" TEXT,
  ADD COLUMN "passed" BOOLEAN,
  ADD COLUMN "needsManualGrading" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "gradedAt" TIMESTAMP(3),
  ADD COLUMN "dimensionScores" JSONB,
  ADD COLUMN "fitScore" DECIMAL(5,2),
  ADD COLUMN "integrityScore" INTEGER,
  ADD COLUMN "integrityFlags" JSONB,
  ADD COLUMN "tabSwitchCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "purgedAt" TIMESTAMP(3);

-- 7. Extend ApplicationAssessmentAnswer ---------------------------------------
ALTER TABLE "ApplicationAssessmentAnswer"
  ADD COLUMN "timeSpentSeconds" INTEGER,
  ADD COLUMN "gradedByUserId" TEXT,
  ADD COLUMN "gradedAt" TIMESTAMP(3),
  ADD COLUMN "graderNote" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 8. AttemptIntegrityEvent -----------------------------------------------------
CREATE TABLE "AttemptIntegrityEvent" (
  "id" TEXT NOT NULL,
  "organizationId" UUID NOT NULL,
  "attemptId" TEXT NOT NULL,
  "type" "IntegrityEventType" NOT NULL,
  "detail" JSONB,
  "mediaUrl" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AttemptIntegrityEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AttemptIntegrityEvent_attemptId_createdAt_idx" ON "AttemptIntegrityEvent"("attemptId", "createdAt");
ALTER TABLE "AttemptIntegrityEvent"
  ADD CONSTRAINT "AttemptIntegrityEvent_attemptId_fkey"
  FOREIGN KEY ("attemptId") REFERENCES "ApplicationAssessmentAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 9. AssessmentProviderConnection ---------------------------------------------
CREATE TABLE "AssessmentProviderConnection" (
  "id" TEXT NOT NULL,
  "organizationId" UUID NOT NULL,
  "provider" "AssessmentProviderKey" NOT NULL,
  "label" TEXT NOT NULL,
  "baseUrl" TEXT,
  "credentialsCipher" TEXT NOT NULL,
  "webhookSecret" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdByUserId" TEXT,
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssessmentProviderConnection_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "AssessmentProviderConnection_organizationId_provider_label_key"
  ON "AssessmentProviderConnection"("organizationId", "provider", "label");
CREATE INDEX "AssessmentProviderConnection_organizationId_provider_idx"
  ON "AssessmentProviderConnection"("organizationId", "provider");

-- 10. ExternalAssessment -------------------------------------------------------
CREATE TABLE "ExternalAssessment" (
  "id" TEXT NOT NULL,
  "organizationId" UUID NOT NULL,
  "connectionId" TEXT NOT NULL,
  "provider" "AssessmentProviderKey" NOT NULL,
  "externalId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "category" TEXT,
  "durationMinutes" INTEGER,
  "dimensions" JSONB,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExternalAssessment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ExternalAssessment_connectionId_externalId_key" ON "ExternalAssessment"("connectionId", "externalId");
CREATE INDEX "ExternalAssessment_organizationId_isActive_idx" ON "ExternalAssessment"("organizationId", "isActive");
ALTER TABLE "ExternalAssessment"
  ADD CONSTRAINT "ExternalAssessment_connectionId_fkey"
  FOREIGN KEY ("connectionId") REFERENCES "AssessmentProviderConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 11. JobExternalAssessmentAssignment -----------------------------------------
CREATE TABLE "JobExternalAssessmentAssignment" (
  "id" TEXT NOT NULL,
  "organizationId" UUID NOT NULL,
  "jobId" TEXT NOT NULL,
  "externalAssessmentId" TEXT NOT NULL,
  "triggerStatus" "ApplicationStatus",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobExternalAssessmentAssignment_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "JobExternalAssessmentAssignment_jobId_externalAssessmentId_key"
  ON "JobExternalAssessmentAssignment"("jobId", "externalAssessmentId");
CREATE INDEX "JobExternalAssessmentAssignment_jobId_idx" ON "JobExternalAssessmentAssignment"("jobId");
ALTER TABLE "JobExternalAssessmentAssignment"
  ADD CONSTRAINT "JobExternalAssessmentAssignment_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobExternalAssessmentAssignment"
  ADD CONSTRAINT "JobExternalAssessmentAssignment_externalAssessmentId_fkey"
  FOREIGN KEY ("externalAssessmentId") REFERENCES "ExternalAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 12. ExternalAssessmentInvite ------------------------------------------------
CREATE TABLE "ExternalAssessmentInvite" (
  "id" TEXT NOT NULL,
  "organizationId" UUID NOT NULL,
  "applicationId" TEXT NOT NULL,
  "externalAssessmentId" TEXT NOT NULL,
  "connectionId" TEXT NOT NULL,
  "provider" "AssessmentProviderKey" NOT NULL,
  "externalInviteId" TEXT,
  "candidateUrl" TEXT,
  "status" "ExternalInviteStatus" NOT NULL DEFAULT 'pending',
  "rawResult" JSONB,
  "normalizedResult" JSONB,
  "scorePercent" DECIMAL(5,2),
  "costCents" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "invitedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ExternalAssessmentInvite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ExternalAssessmentInvite_applicationId_externalAssessmentId_key"
  ON "ExternalAssessmentInvite"("applicationId", "externalAssessmentId");
CREATE INDEX "ExternalAssessmentInvite_applicationId_idx" ON "ExternalAssessmentInvite"("applicationId");
CREATE INDEX "ExternalAssessmentInvite_externalInviteId_idx" ON "ExternalAssessmentInvite"("externalInviteId");
ALTER TABLE "ExternalAssessmentInvite"
  ADD CONSTRAINT "ExternalAssessmentInvite_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExternalAssessmentInvite"
  ADD CONSTRAINT "ExternalAssessmentInvite_externalAssessmentId_fkey"
  FOREIGN KEY ("externalAssessmentId") REFERENCES "ExternalAssessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExternalAssessmentInvite"
  ADD CONSTRAINT "ExternalAssessmentInvite_connectionId_fkey"
  FOREIGN KEY ("connectionId") REFERENCES "AssessmentProviderConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 13. JobCompetencyProfile ----------------------------------------------------
CREATE TABLE "JobCompetencyProfile" (
  "id" TEXT NOT NULL,
  "organizationId" UUID NOT NULL,
  "jobId" TEXT NOT NULL,
  "weights" JSONB NOT NULL,
  "targets" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobCompetencyProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "JobCompetencyProfile_jobId_key" ON "JobCompetencyProfile"("jobId");
ALTER TABLE "JobCompetencyProfile"
  ADD CONSTRAINT "JobCompetencyProfile_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 14. AssessmentUsageEvent ----------------------------------------------------
CREATE TABLE "AssessmentUsageEvent" (
  "id" TEXT NOT NULL,
  "organizationId" UUID NOT NULL,
  "type" "AssessmentUsageType" NOT NULL,
  "provider" "AssessmentProviderKey",
  "applicationId" TEXT,
  "quantity" INTEGER NOT NULL DEFAULT 1,
  "unitCostCents" INTEGER,
  "currency" TEXT NOT NULL DEFAULT 'USD',
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssessmentUsageEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AssessmentUsageEvent_organizationId_createdAt_idx" ON "AssessmentUsageEvent"("organizationId", "createdAt");
CREATE INDEX "AssessmentUsageEvent_organizationId_type_idx" ON "AssessmentUsageEvent"("organizationId", "type");

-- 15. Row Level Security -------------------------------------------------------
ALTER TABLE "AssessmentSection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssessmentSection" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "AssessmentSection_tenant_rw" ON "AssessmentSection";
CREATE POLICY "AssessmentSection_tenant_rw" ON "AssessmentSection"
  FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

ALTER TABLE "QuestionBankItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "QuestionBankItem" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "QuestionBankItem_tenant_rw" ON "QuestionBankItem";
CREATE POLICY "QuestionBankItem_tenant_rw" ON "QuestionBankItem"
  FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

ALTER TABLE "AttemptIntegrityEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AttemptIntegrityEvent" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "AttemptIntegrityEvent_tenant_rw" ON "AttemptIntegrityEvent";
CREATE POLICY "AttemptIntegrityEvent_tenant_rw" ON "AttemptIntegrityEvent"
  FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

-- Candidate (token) access for integrity events tied to their attempt.
DROP POLICY IF EXISTS "AttemptIntegrityEvent_token_access" ON "AttemptIntegrityEvent";
CREATE POLICY "AttemptIntegrityEvent_token_access" ON "AttemptIntegrityEvent"
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM "ApplicationAssessmentAttempt" a
      WHERE a.id = "attemptId"
        AND a."accessToken" = current_setting('app.assessment_access_token', true)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM "ApplicationAssessmentAttempt" a
      WHERE a.id = "attemptId"
        AND a."accessToken" = current_setting('app.assessment_access_token', true)
    )
  );

ALTER TABLE "AssessmentProviderConnection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssessmentProviderConnection" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "AssessmentProviderConnection_tenant_rw" ON "AssessmentProviderConnection";
CREATE POLICY "AssessmentProviderConnection_tenant_rw" ON "AssessmentProviderConnection"
  FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

ALTER TABLE "ExternalAssessment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExternalAssessment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ExternalAssessment_tenant_rw" ON "ExternalAssessment";
CREATE POLICY "ExternalAssessment_tenant_rw" ON "ExternalAssessment"
  FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

ALTER TABLE "JobExternalAssessmentAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobExternalAssessmentAssignment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "JobExternalAssessmentAssignment_tenant_rw" ON "JobExternalAssessmentAssignment";
CREATE POLICY "JobExternalAssessmentAssignment_tenant_rw" ON "JobExternalAssessmentAssignment"
  FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

ALTER TABLE "ExternalAssessmentInvite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ExternalAssessmentInvite" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ExternalAssessmentInvite_tenant_rw" ON "ExternalAssessmentInvite";
CREATE POLICY "ExternalAssessmentInvite_tenant_rw" ON "ExternalAssessmentInvite"
  FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

ALTER TABLE "JobCompetencyProfile" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobCompetencyProfile" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "JobCompetencyProfile_tenant_rw" ON "JobCompetencyProfile";
CREATE POLICY "JobCompetencyProfile_tenant_rw" ON "JobCompetencyProfile"
  FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

ALTER TABLE "AssessmentUsageEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssessmentUsageEvent" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "AssessmentUsageEvent_tenant_rw" ON "AssessmentUsageEvent";
CREATE POLICY "AssessmentUsageEvent_tenant_rw" ON "AssessmentUsageEvent"
  FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

-- Candidate (token) access for sections/questions of their attempt's template
-- (candidate GET reads questions through the template relation under token context).
DROP POLICY IF EXISTS "AssessmentSection_token_read" ON "AssessmentSection";
CREATE POLICY "AssessmentSection_token_read" ON "AssessmentSection"
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM "ApplicationAssessmentAttempt" a
      WHERE a."templateId" = "templateId"
        AND a."accessToken" = current_setting('app.assessment_access_token', true)
    )
  );
