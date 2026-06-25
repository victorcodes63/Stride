-- RAV-124: candidate assessment library + job assignments + attempts

CREATE TYPE "AssessmentQuestionType" AS ENUM ('mcq', 'numeric', 'file');
CREATE TYPE "AssessmentAttemptStatus" AS ENUM ('pending', 'in_progress', 'submitted', 'expired');

CREATE TABLE "AssessmentTemplate" (
  "id" TEXT NOT NULL,
  "organizationId" UUID NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "timeLimitMinutes" INTEGER NOT NULL DEFAULT 30,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssessmentTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AssessmentQuestion" (
  "id" TEXT NOT NULL,
  "organizationId" UUID NOT NULL,
  "templateId" TEXT NOT NULL,
  "type" "AssessmentQuestionType" NOT NULL,
  "prompt" TEXT NOT NULL,
  "options" JSONB,
  "correctAnswer" JSONB,
  "maxPoints" INTEGER NOT NULL DEFAULT 1,
  "orderIndex" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AssessmentQuestion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobAssessmentAssignment" (
  "id" TEXT NOT NULL,
  "organizationId" UUID NOT NULL,
  "jobId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "triggerStatus" "ApplicationStatus",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "JobAssessmentAssignment_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApplicationAssessmentAttempt" (
  "id" TEXT NOT NULL,
  "organizationId" UUID NOT NULL,
  "applicationId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "accessToken" TEXT NOT NULL,
  "status" "AssessmentAttemptStatus" NOT NULL DEFAULT 'pending',
  "startedAt" TIMESTAMP(3),
  "submittedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "clientIp" TEXT,
  "scorePercent" DECIMAL(5,2),
  "earnedPoints" INTEGER,
  "maxPoints" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApplicationAssessmentAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ApplicationAssessmentAnswer" (
  "id" TEXT NOT NULL,
  "organizationId" UUID NOT NULL,
  "attemptId" TEXT NOT NULL,
  "questionId" TEXT NOT NULL,
  "answer" JSONB,
  "filePath" TEXT,
  "isCorrect" BOOLEAN,
  "pointsAwarded" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ApplicationAssessmentAnswer_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "AssessmentQuestion"
  ADD CONSTRAINT "AssessmentQuestion_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "AssessmentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobAssessmentAssignment"
  ADD CONSTRAINT "JobAssessmentAssignment_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "JobAssessmentAssignment"
  ADD CONSTRAINT "JobAssessmentAssignment_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "AssessmentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApplicationAssessmentAttempt"
  ADD CONSTRAINT "ApplicationAssessmentAttempt_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApplicationAssessmentAttempt"
  ADD CONSTRAINT "ApplicationAssessmentAttempt_templateId_fkey"
  FOREIGN KEY ("templateId") REFERENCES "AssessmentTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApplicationAssessmentAnswer"
  ADD CONSTRAINT "ApplicationAssessmentAnswer_attemptId_fkey"
  FOREIGN KEY ("attemptId") REFERENCES "ApplicationAssessmentAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ApplicationAssessmentAnswer"
  ADD CONSTRAINT "ApplicationAssessmentAnswer_questionId_fkey"
  FOREIGN KEY ("questionId") REFERENCES "AssessmentQuestion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "JobAssessmentAssignment_jobId_templateId_key" ON "JobAssessmentAssignment"("jobId", "templateId");
CREATE INDEX "JobAssessmentAssignment_jobId_idx" ON "JobAssessmentAssignment"("jobId");
CREATE INDEX "AssessmentTemplate_organizationId_isActive_idx" ON "AssessmentTemplate"("organizationId", "isActive");
CREATE INDEX "AssessmentQuestion_templateId_orderIndex_idx" ON "AssessmentQuestion"("templateId", "orderIndex");
CREATE UNIQUE INDEX "ApplicationAssessmentAttempt_accessToken_key" ON "ApplicationAssessmentAttempt"("accessToken");
CREATE UNIQUE INDEX "ApplicationAssessmentAttempt_applicationId_templateId_key" ON "ApplicationAssessmentAttempt"("applicationId", "templateId");
CREATE INDEX "ApplicationAssessmentAttempt_applicationId_idx" ON "ApplicationAssessmentAttempt"("applicationId");
CREATE UNIQUE INDEX "ApplicationAssessmentAnswer_attemptId_questionId_key" ON "ApplicationAssessmentAnswer"("attemptId", "questionId");
CREATE INDEX "ApplicationAssessmentAnswer_attemptId_idx" ON "ApplicationAssessmentAnswer"("attemptId");

ALTER TABLE "AssessmentTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssessmentTemplate" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "AssessmentTemplate_tenant_rw" ON "AssessmentTemplate";
CREATE POLICY "AssessmentTemplate_tenant_rw" ON "AssessmentTemplate"
  FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

ALTER TABLE "AssessmentQuestion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AssessmentQuestion" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "AssessmentQuestion_tenant_rw" ON "AssessmentQuestion";
CREATE POLICY "AssessmentQuestion_tenant_rw" ON "AssessmentQuestion"
  FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

ALTER TABLE "JobAssessmentAssignment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobAssessmentAssignment" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "JobAssessmentAssignment_tenant_rw" ON "JobAssessmentAssignment";
CREATE POLICY "JobAssessmentAssignment_tenant_rw" ON "JobAssessmentAssignment"
  FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

ALTER TABLE "ApplicationAssessmentAttempt" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApplicationAssessmentAttempt" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ApplicationAssessmentAttempt_tenant_rw" ON "ApplicationAssessmentAttempt";
CREATE POLICY "ApplicationAssessmentAttempt_tenant_rw" ON "ApplicationAssessmentAttempt"
  FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

ALTER TABLE "ApplicationAssessmentAnswer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ApplicationAssessmentAnswer" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ApplicationAssessmentAnswer_tenant_rw" ON "ApplicationAssessmentAnswer";
CREATE POLICY "ApplicationAssessmentAnswer_tenant_rw" ON "ApplicationAssessmentAnswer"
  FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid)
  WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);

-- Public candidate access via signed access token (no staff session).
DROP POLICY IF EXISTS "ApplicationAssessmentAttempt_token_access" ON "ApplicationAssessmentAttempt";
CREATE POLICY "ApplicationAssessmentAttempt_token_access" ON "ApplicationAssessmentAttempt"
  FOR ALL
  USING ("accessToken" = current_setting('app.assessment_access_token', true))
  WITH CHECK ("accessToken" = current_setting('app.assessment_access_token', true));

DROP POLICY IF EXISTS "ApplicationAssessmentAnswer_token_access" ON "ApplicationAssessmentAnswer";
CREATE POLICY "ApplicationAssessmentAnswer_token_access" ON "ApplicationAssessmentAnswer"
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

DROP POLICY IF EXISTS "ApplicationAssessmentAttempt_insert_bootstrap" ON "ApplicationAssessmentAttempt";
CREATE POLICY "ApplicationAssessmentAttempt_insert_bootstrap" ON "ApplicationAssessmentAttempt"
  FOR INSERT
  WITH CHECK (
    coalesce(current_setting('app.current_org', true), '') = ''
    OR "organizationId" = current_setting('app.current_org', true)::uuid
  );
