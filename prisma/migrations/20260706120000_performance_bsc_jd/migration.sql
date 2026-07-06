-- PERF-01 / RAV-252: BSC Job Description library (manual entry + storage).

CREATE TYPE "JdStatus" AS ENUM ('draft', 'published', 'archived');
CREATE TYPE "JdParserMode" AS ENUM ('manual', 'stride', 'byo');
CREATE TYPE "BscPerspective" AS ENUM ('financial', 'customer', 'internal_process', 'learning_growth');

CREATE TABLE "JdDivision" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isReferencePack" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JdDivision_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobDescription" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "divisionId" TEXT,
    "title" TEXT NOT NULL,
    "grade" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "JdStatus" NOT NULL DEFAULT 'draft',
    "jobPurpose" TEXT,
    "keyActivities" TEXT,
    "authorityScope" TEXT,
    "workingConditions" TEXT,
    "qualifications" TEXT,
    "relationships" TEXT,
    "rootJobDescriptionId" TEXT,
    "previousVersionId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdByUserId" TEXT,
    "sourceDocumentId" TEXT,
    "isReferencePack" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobDescription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobKRA" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "jobDescriptionId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "bscPerspective" "BscPerspective",
    "weightPercent" INTEGER NOT NULL DEFAULT 25,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobKRA_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobKPI" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "jobDescriptionId" TEXT NOT NULL,
    "jobKraId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetValue" TEXT,
    "unit" TEXT,
    "weightPercent" INTEGER NOT NULL DEFAULT 25,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobKPI_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JobCompetency" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "jobDescriptionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "requiredLevel" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobCompetency_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JdDocument" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "jobDescriptionId" TEXT,
    "blobUrl" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "byteSize" INTEGER,
    "uploadedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JdDocument_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "JdParserConfig" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "mode" "JdParserMode" NOT NULL DEFAULT 'manual',
    "provider" TEXT,
    "apiKeyRef" TEXT,
    "promptTemplate" TEXT,
    "consentAt" TIMESTAMP(3),
    "consentByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JdParserConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "JdDivision_organizationId_name_key" ON "JdDivision"("organizationId", "name");
CREATE INDEX "JdDivision_organizationId_sortOrder_idx" ON "JdDivision"("organizationId", "sortOrder");

CREATE UNIQUE INDEX "JobDescription_sourceDocumentId_key" ON "JobDescription"("sourceDocumentId");
CREATE UNIQUE INDEX "JobDescription_organizationId_title_grade_version_key" ON "JobDescription"("organizationId", "title", "grade", "version");
CREATE UNIQUE INDEX "JobDescription_previousVersionId_key" ON "JobDescription"("previousVersionId");
CREATE INDEX "JobDescription_organizationId_status_idx" ON "JobDescription"("organizationId", "status");
CREATE INDEX "JobDescription_divisionId_idx" ON "JobDescription"("divisionId");
CREATE INDEX "JobDescription_rootJobDescriptionId_idx" ON "JobDescription"("rootJobDescriptionId");

CREATE INDEX "JobKRA_jobDescriptionId_sortOrder_idx" ON "JobKRA"("jobDescriptionId", "sortOrder");
CREATE INDEX "JobKPI_jobDescriptionId_sortOrder_idx" ON "JobKPI"("jobDescriptionId", "sortOrder");
CREATE INDEX "JobKPI_jobKraId_idx" ON "JobKPI"("jobKraId");
CREATE INDEX "JobCompetency_jobDescriptionId_sortOrder_idx" ON "JobCompetency"("jobDescriptionId", "sortOrder");
CREATE INDEX "JdDocument_jobDescriptionId_idx" ON "JdDocument"("jobDescriptionId");
CREATE UNIQUE INDEX "JdParserConfig_organizationId_key" ON "JdParserConfig"("organizationId");

ALTER TABLE "JobDescription" ADD CONSTRAINT "JobDescription_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "JdDivision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JobDescription" ADD CONSTRAINT "JobDescription_rootJobDescriptionId_fkey" FOREIGN KEY ("rootJobDescriptionId") REFERENCES "JobDescription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JobDescription" ADD CONSTRAINT "JobDescription_previousVersionId_fkey" FOREIGN KEY ("previousVersionId") REFERENCES "JobDescription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JobDescription" ADD CONSTRAINT "JobDescription_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JobDescription" ADD CONSTRAINT "JobDescription_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "JdDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JobKRA" ADD CONSTRAINT "JobKRA_jobDescriptionId_fkey" FOREIGN KEY ("jobDescriptionId") REFERENCES "JobDescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobKPI" ADD CONSTRAINT "JobKPI_jobDescriptionId_fkey" FOREIGN KEY ("jobDescriptionId") REFERENCES "JobDescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JobKPI" ADD CONSTRAINT "JobKPI_jobKraId_fkey" FOREIGN KEY ("jobKraId") REFERENCES "JobKRA"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JobCompetency" ADD CONSTRAINT "JobCompetency_jobDescriptionId_fkey" FOREIGN KEY ("jobDescriptionId") REFERENCES "JobDescription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "JdDocument" ADD CONSTRAINT "JdDocument_jobDescriptionId_fkey" FOREIGN KEY ("jobDescriptionId") REFERENCES "JobDescription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JdDocument" ADD CONSTRAINT "JdDocument_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JdParserConfig" ADD CONSTRAINT "JdParserConfig_consentByUserId_fkey" FOREIGN KEY ("consentByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RLS
ALTER TABLE "JdDivision" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JdDivision" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "JdDivision_tenant_rw" ON "JdDivision";
CREATE POLICY "JdDivision_tenant_rw" ON "JdDivision" FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "JdDivision_insert_bootstrap" ON "JdDivision";
CREATE POLICY "JdDivision_insert_bootstrap" ON "JdDivision" FOR INSERT WITH CHECK (coalesce(current_setting('app.current_org', true), '') = '' OR "organizationId" = current_setting('app.current_org', true)::uuid);

ALTER TABLE "JobDescription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobDescription" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "JobDescription_tenant_rw" ON "JobDescription";
CREATE POLICY "JobDescription_tenant_rw" ON "JobDescription" FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "JobDescription_insert_bootstrap" ON "JobDescription";
CREATE POLICY "JobDescription_insert_bootstrap" ON "JobDescription" FOR INSERT WITH CHECK (coalesce(current_setting('app.current_org', true), '') = '' OR "organizationId" = current_setting('app.current_org', true)::uuid);

ALTER TABLE "JobKRA" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobKRA" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "JobKRA_tenant_rw" ON "JobKRA";
CREATE POLICY "JobKRA_tenant_rw" ON "JobKRA" FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "JobKRA_insert_bootstrap" ON "JobKRA";
CREATE POLICY "JobKRA_insert_bootstrap" ON "JobKRA" FOR INSERT WITH CHECK (coalesce(current_setting('app.current_org', true), '') = '' OR "organizationId" = current_setting('app.current_org', true)::uuid);

ALTER TABLE "JobKPI" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobKPI" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "JobKPI_tenant_rw" ON "JobKPI";
CREATE POLICY "JobKPI_tenant_rw" ON "JobKPI" FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "JobKPI_insert_bootstrap" ON "JobKPI";
CREATE POLICY "JobKPI_insert_bootstrap" ON "JobKPI" FOR INSERT WITH CHECK (coalesce(current_setting('app.current_org', true), '') = '' OR "organizationId" = current_setting('app.current_org', true)::uuid);

ALTER TABLE "JobCompetency" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JobCompetency" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "JobCompetency_tenant_rw" ON "JobCompetency";
CREATE POLICY "JobCompetency_tenant_rw" ON "JobCompetency" FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "JobCompetency_insert_bootstrap" ON "JobCompetency";
CREATE POLICY "JobCompetency_insert_bootstrap" ON "JobCompetency" FOR INSERT WITH CHECK (coalesce(current_setting('app.current_org', true), '') = '' OR "organizationId" = current_setting('app.current_org', true)::uuid);

ALTER TABLE "JdDocument" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JdDocument" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "JdDocument_tenant_rw" ON "JdDocument";
CREATE POLICY "JdDocument_tenant_rw" ON "JdDocument" FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "JdDocument_insert_bootstrap" ON "JdDocument";
CREATE POLICY "JdDocument_insert_bootstrap" ON "JdDocument" FOR INSERT WITH CHECK (coalesce(current_setting('app.current_org', true), '') = '' OR "organizationId" = current_setting('app.current_org', true)::uuid);

ALTER TABLE "JdParserConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "JdParserConfig" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "JdParserConfig_tenant_rw" ON "JdParserConfig";
CREATE POLICY "JdParserConfig_tenant_rw" ON "JdParserConfig" FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "JdParserConfig_insert_bootstrap" ON "JdParserConfig";
CREATE POLICY "JdParserConfig_insert_bootstrap" ON "JdParserConfig" FOR INSERT WITH CHECK (coalesce(current_setting('app.current_org', true), '') = '' OR "organizationId" = current_setting('app.current_org', true)::uuid);
