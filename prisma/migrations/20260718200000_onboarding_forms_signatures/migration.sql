-- Onboarding: structured data-collection forms + e-signature requests + rich task types.

-- CreateEnum OnboardingTaskType
DO $$ BEGIN
  CREATE TYPE "OnboardingTaskType" AS ENUM ('CHECKLIST', 'FORM', 'SIGNATURE', 'DOCUMENT');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum OnboardingFormSubmissionStatus
DO $$ BEGIN
  CREATE TYPE "OnboardingFormSubmissionStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateEnum OnboardingSignatureStatus
DO $$ BEGIN
  CREATE TYPE "OnboardingSignatureStatus" AS ENUM ('PENDING', 'SIGNED', 'DECLINED', 'VOIDED');
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- CreateTable OnboardingFormTemplate
CREATE TABLE IF NOT EXISTS "OnboardingFormTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "fields" JSONB NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingFormTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable OnboardingFormSubmission
CREATE TABLE IF NOT EXISTS "OnboardingFormSubmission" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "formTemplateId" TEXT NOT NULL,
    "employeeId" TEXT,
    "essPortalUserId" TEXT,
    "data" JSONB NOT NULL,
    "status" "OnboardingFormSubmissionStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "reviewedByUserId" TEXT,
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingFormSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable OnboardingSignatureRequest
CREATE TABLE IF NOT EXISTS "OnboardingSignatureRequest" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "documentTitle" TEXT NOT NULL,
    "documentPath" TEXT,
    "employeeId" TEXT,
    "essPortalUserId" TEXT,
    "status" "OnboardingSignatureStatus" NOT NULL DEFAULT 'PENDING',
    "signerName" TEXT,
    "signatureImagePath" TEXT,
    "signedDocumentPath" TEXT,
    "declineReason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "signedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OnboardingSignatureRequest_pkey" PRIMARY KEY ("id")
);

-- AlterTable OnboardingTemplateStep: rich step kinds
ALTER TABLE "OnboardingTemplateStep" ADD COLUMN IF NOT EXISTS "taskType" "OnboardingTaskType" NOT NULL DEFAULT 'CHECKLIST';
ALTER TABLE "OnboardingTemplateStep" ADD COLUMN IF NOT EXISTS "formTemplateId" TEXT;
ALTER TABLE "OnboardingTemplateStep" ADD COLUMN IF NOT EXISTS "signatureDocumentTitle" TEXT;
ALTER TABLE "OnboardingTemplateStep" ADD COLUMN IF NOT EXISTS "signatureDocumentPath" TEXT;

-- AlterTable OnboardingTask: rich task kinds + form/signature links
ALTER TABLE "OnboardingTask" ADD COLUMN IF NOT EXISTS "taskType" "OnboardingTaskType" NOT NULL DEFAULT 'CHECKLIST';
ALTER TABLE "OnboardingTask" ADD COLUMN IF NOT EXISTS "formTemplateId" TEXT;
ALTER TABLE "OnboardingTask" ADD COLUMN IF NOT EXISTS "formSubmissionId" TEXT;
ALTER TABLE "OnboardingTask" ADD COLUMN IF NOT EXISTS "signatureRequestId" TEXT;

-- AlterTable NotificationPolicy: WhatsApp channel opt-in
ALTER TABLE "NotificationPolicy" ADD COLUMN IF NOT EXISTS "whatsappEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Indexes
CREATE INDEX IF NOT EXISTS "OnboardingFormTemplate_organizationId_isActive_idx" ON "OnboardingFormTemplate"("organizationId", "isActive");
CREATE INDEX IF NOT EXISTS "OnboardingFormSubmission_organizationId_status_idx" ON "OnboardingFormSubmission"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "OnboardingFormSubmission_formTemplateId_idx" ON "OnboardingFormSubmission"("formTemplateId");
CREATE INDEX IF NOT EXISTS "OnboardingFormSubmission_employeeId_idx" ON "OnboardingFormSubmission"("employeeId");
CREATE INDEX IF NOT EXISTS "OnboardingFormSubmission_essPortalUserId_idx" ON "OnboardingFormSubmission"("essPortalUserId");
CREATE INDEX IF NOT EXISTS "OnboardingSignatureRequest_organizationId_status_idx" ON "OnboardingSignatureRequest"("organizationId", "status");
CREATE INDEX IF NOT EXISTS "OnboardingSignatureRequest_employeeId_idx" ON "OnboardingSignatureRequest"("employeeId");
CREATE INDEX IF NOT EXISTS "OnboardingSignatureRequest_essPortalUserId_idx" ON "OnboardingSignatureRequest"("essPortalUserId");
CREATE INDEX IF NOT EXISTS "OnboardingTemplateStep_formTemplateId_idx" ON "OnboardingTemplateStep"("formTemplateId");
CREATE INDEX IF NOT EXISTS "OnboardingTask_formTemplateId_idx" ON "OnboardingTask"("formTemplateId");

-- Unique links from task -> submission / signature (one-to-one)
CREATE UNIQUE INDEX IF NOT EXISTS "OnboardingTask_formSubmissionId_key" ON "OnboardingTask"("formSubmissionId");
CREATE UNIQUE INDEX IF NOT EXISTS "OnboardingTask_signatureRequestId_key" ON "OnboardingTask"("signatureRequestId");

-- Foreign keys
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OnboardingFormSubmission_formTemplateId_fkey') THEN
    ALTER TABLE "OnboardingFormSubmission" ADD CONSTRAINT "OnboardingFormSubmission_formTemplateId_fkey"
      FOREIGN KEY ("formTemplateId") REFERENCES "OnboardingFormTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OnboardingFormSubmission_employeeId_fkey') THEN
    ALTER TABLE "OnboardingFormSubmission" ADD CONSTRAINT "OnboardingFormSubmission_employeeId_fkey"
      FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OnboardingFormSubmission_essPortalUserId_fkey') THEN
    ALTER TABLE "OnboardingFormSubmission" ADD CONSTRAINT "OnboardingFormSubmission_essPortalUserId_fkey"
      FOREIGN KEY ("essPortalUserId") REFERENCES "EssPortalUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OnboardingFormSubmission_reviewedByUserId_fkey') THEN
    ALTER TABLE "OnboardingFormSubmission" ADD CONSTRAINT "OnboardingFormSubmission_reviewedByUserId_fkey"
      FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OnboardingSignatureRequest_employeeId_fkey') THEN
    ALTER TABLE "OnboardingSignatureRequest" ADD CONSTRAINT "OnboardingSignatureRequest_employeeId_fkey"
      FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OnboardingSignatureRequest_essPortalUserId_fkey') THEN
    ALTER TABLE "OnboardingSignatureRequest" ADD CONSTRAINT "OnboardingSignatureRequest_essPortalUserId_fkey"
      FOREIGN KEY ("essPortalUserId") REFERENCES "EssPortalUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OnboardingSignatureRequest_createdByUserId_fkey') THEN
    ALTER TABLE "OnboardingSignatureRequest" ADD CONSTRAINT "OnboardingSignatureRequest_createdByUserId_fkey"
      FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OnboardingTemplateStep_formTemplateId_fkey') THEN
    ALTER TABLE "OnboardingTemplateStep" ADD CONSTRAINT "OnboardingTemplateStep_formTemplateId_fkey"
      FOREIGN KEY ("formTemplateId") REFERENCES "OnboardingFormTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OnboardingTask_formTemplateId_fkey') THEN
    ALTER TABLE "OnboardingTask" ADD CONSTRAINT "OnboardingTask_formTemplateId_fkey"
      FOREIGN KEY ("formTemplateId") REFERENCES "OnboardingFormTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OnboardingTask_formSubmissionId_fkey') THEN
    ALTER TABLE "OnboardingTask" ADD CONSTRAINT "OnboardingTask_formSubmissionId_fkey"
      FOREIGN KEY ("formSubmissionId") REFERENCES "OnboardingFormSubmission"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'OnboardingTask_signatureRequestId_fkey') THEN
    ALTER TABLE "OnboardingTask" ADD CONSTRAINT "OnboardingTask_signatureRequestId_fkey"
      FOREIGN KEY ("signatureRequestId") REFERENCES "OnboardingSignatureRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- RLS: OnboardingFormTemplate
ALTER TABLE "OnboardingFormTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OnboardingFormTemplate" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "OnboardingFormTemplate_tenant_rw" ON "OnboardingFormTemplate";
CREATE POLICY "OnboardingFormTemplate_tenant_rw" ON "OnboardingFormTemplate" FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "OnboardingFormTemplate_insert_bootstrap" ON "OnboardingFormTemplate";
CREATE POLICY "OnboardingFormTemplate_insert_bootstrap" ON "OnboardingFormTemplate" FOR INSERT WITH CHECK (coalesce(current_setting('app.current_org', true), '') = '' OR "organizationId" = current_setting('app.current_org', true)::uuid);

-- RLS: OnboardingFormSubmission
ALTER TABLE "OnboardingFormSubmission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OnboardingFormSubmission" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "OnboardingFormSubmission_tenant_rw" ON "OnboardingFormSubmission";
CREATE POLICY "OnboardingFormSubmission_tenant_rw" ON "OnboardingFormSubmission" FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "OnboardingFormSubmission_insert_bootstrap" ON "OnboardingFormSubmission";
CREATE POLICY "OnboardingFormSubmission_insert_bootstrap" ON "OnboardingFormSubmission" FOR INSERT WITH CHECK (coalesce(current_setting('app.current_org', true), '') = '' OR "organizationId" = current_setting('app.current_org', true)::uuid);

-- RLS: OnboardingSignatureRequest
ALTER TABLE "OnboardingSignatureRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "OnboardingSignatureRequest" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "OnboardingSignatureRequest_tenant_rw" ON "OnboardingSignatureRequest";
CREATE POLICY "OnboardingSignatureRequest_tenant_rw" ON "OnboardingSignatureRequest" FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "OnboardingSignatureRequest_insert_bootstrap" ON "OnboardingSignatureRequest";
CREATE POLICY "OnboardingSignatureRequest_insert_bootstrap" ON "OnboardingSignatureRequest" FOR INSERT WITH CHECK (coalesce(current_setting('app.current_org', true), '') = '' OR "organizationId" = current_setting('app.current_org', true)::uuid);
