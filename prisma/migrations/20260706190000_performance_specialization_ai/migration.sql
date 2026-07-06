-- PERF-07 / PERF-08: AI evaluation assist flags + specialization models

CREATE TYPE "PerformanceCycleKind" AS ENUM ('annual', 'quarterly', 'probation', 'multi_rater_360');
CREATE TYPE "PerformanceObjectiveLevel" AS ENUM ('organization', 'division', 'role', 'individual');
CREATE TYPE "PerformancePipStatus" AS ENUM ('draft', 'active', 'completed', 'cancelled');

ALTER TABLE "JdParserConfig" ADD COLUMN IF NOT EXISTS "aiEvaluationEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "JdParserConfig" ADD COLUMN IF NOT EXISTS "aiEvaluationConsentAt" TIMESTAMP(3);
ALTER TABLE "JdParserConfig" ADD COLUMN IF NOT EXISTS "aiEvaluationConsentByUserId" TEXT;

ALTER TABLE "PerformanceCycle" ADD COLUMN IF NOT EXISTS "cycleKind" "PerformanceCycleKind" NOT NULL DEFAULT 'annual';
CREATE INDEX IF NOT EXISTS "PerformanceCycle_organizationId_cycleKind_idx" ON "PerformanceCycle"("organizationId", "cycleKind");

ALTER TABLE "PerformanceReview" ADD COLUMN IF NOT EXISTS "aiSuggestions" JSONB;

ALTER TABLE "JdParserConfig" ADD CONSTRAINT "JdParserConfig_aiEvaluationConsentByUserId_fkey"
  FOREIGN KEY ("aiEvaluationConsentByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "CompetencyFramework" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompetencyFramework_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompetencyFrameworkEntry" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "level1Descriptor" TEXT,
    "level2Descriptor" TEXT,
    "level3Descriptor" TEXT,
    "level4Descriptor" TEXT,
    "level5Descriptor" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CompetencyFrameworkEntry_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PerformanceObjective" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "cycleId" TEXT,
    "parentObjectiveId" TEXT,
    "level" "PerformanceObjectiveLevel" NOT NULL,
    "divisionId" TEXT,
    "jobDescriptionId" TEXT,
    "employeeId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "weightPercent" INTEGER NOT NULL DEFAULT 100,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PerformanceObjective_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PerformancePip" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "employeeId" TEXT NOT NULL,
    "cycleId" TEXT,
    "reviewId" TEXT,
    "status" "PerformancePipStatus" NOT NULL DEFAULT 'draft',
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "goals" JSONB,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PerformancePip_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PerformanceRater" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "reviewId" TEXT NOT NULL,
    "raterEmployeeId" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "submittedAt" TIMESTAMP(3),
    "summary" TEXT,
    "ratings" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PerformanceRater_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CompetencyFramework_organizationId_name_key" ON "CompetencyFramework"("organizationId", "name");
CREATE INDEX "CompetencyFramework_organizationId_isDefault_idx" ON "CompetencyFramework"("organizationId", "isDefault");
CREATE INDEX "CompetencyFrameworkEntry_frameworkId_sortOrder_idx" ON "CompetencyFrameworkEntry"("frameworkId", "sortOrder");
CREATE INDEX "PerformanceObjective_organizationId_cycleId_idx" ON "PerformanceObjective"("organizationId", "cycleId");
CREATE INDEX "PerformanceObjective_parentObjectiveId_idx" ON "PerformanceObjective"("parentObjectiveId");
CREATE INDEX "PerformanceObjective_employeeId_idx" ON "PerformanceObjective"("employeeId");
CREATE UNIQUE INDEX "PerformancePip_reviewId_key" ON "PerformancePip"("reviewId");
CREATE INDEX "PerformancePip_organizationId_status_idx" ON "PerformancePip"("organizationId", "status");
CREATE INDEX "PerformancePip_employeeId_idx" ON "PerformancePip"("employeeId");
CREATE UNIQUE INDEX "PerformanceRater_reviewId_raterEmployeeId_key" ON "PerformanceRater"("reviewId", "raterEmployeeId");
CREATE INDEX "PerformanceRater_organizationId_idx" ON "PerformanceRater"("organizationId");

ALTER TABLE "CompetencyFrameworkEntry" ADD CONSTRAINT "CompetencyFrameworkEntry_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "CompetencyFramework"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerformanceObjective" ADD CONSTRAINT "PerformanceObjective_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "PerformanceCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerformanceObjective" ADD CONSTRAINT "PerformanceObjective_parentObjectiveId_fkey" FOREIGN KEY ("parentObjectiveId") REFERENCES "PerformanceObjective"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PerformanceObjective" ADD CONSTRAINT "PerformanceObjective_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "JdDivision"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PerformanceObjective" ADD CONSTRAINT "PerformanceObjective_jobDescriptionId_fkey" FOREIGN KEY ("jobDescriptionId") REFERENCES "JobDescription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PerformanceObjective" ADD CONSTRAINT "PerformanceObjective_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PerformancePip" ADD CONSTRAINT "PerformancePip_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerformancePip" ADD CONSTRAINT "PerformancePip_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "PerformanceCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PerformancePip" ADD CONSTRAINT "PerformancePip_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "PerformanceReview"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PerformanceRater" ADD CONSTRAINT "PerformanceRater_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "PerformanceReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerformanceRater" ADD CONSTRAINT "PerformanceRater_raterEmployeeId_fkey" FOREIGN KEY ("raterEmployeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RLS
ALTER TABLE "CompetencyFramework" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CompetencyFramework" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "CompetencyFramework_tenant_rw" ON "CompetencyFramework";
CREATE POLICY "CompetencyFramework_tenant_rw" ON "CompetencyFramework" FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "CompetencyFramework_insert_bootstrap" ON "CompetencyFramework";
CREATE POLICY "CompetencyFramework_insert_bootstrap" ON "CompetencyFramework" FOR INSERT WITH CHECK (coalesce(current_setting('app.current_org', true), '') = '' OR "organizationId" = current_setting('app.current_org', true)::uuid);

ALTER TABLE "CompetencyFrameworkEntry" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CompetencyFrameworkEntry" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "CompetencyFrameworkEntry_tenant_rw" ON "CompetencyFrameworkEntry";
CREATE POLICY "CompetencyFrameworkEntry_tenant_rw" ON "CompetencyFrameworkEntry" FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "CompetencyFrameworkEntry_insert_bootstrap" ON "CompetencyFrameworkEntry";
CREATE POLICY "CompetencyFrameworkEntry_insert_bootstrap" ON "CompetencyFrameworkEntry" FOR INSERT WITH CHECK (coalesce(current_setting('app.current_org', true), '') = '' OR "organizationId" = current_setting('app.current_org', true)::uuid);

ALTER TABLE "PerformanceObjective" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PerformanceObjective" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "PerformanceObjective_tenant_rw" ON "PerformanceObjective";
CREATE POLICY "PerformanceObjective_tenant_rw" ON "PerformanceObjective" FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "PerformanceObjective_insert_bootstrap" ON "PerformanceObjective";
CREATE POLICY "PerformanceObjective_insert_bootstrap" ON "PerformanceObjective" FOR INSERT WITH CHECK (coalesce(current_setting('app.current_org', true), '') = '' OR "organizationId" = current_setting('app.current_org', true)::uuid);

ALTER TABLE "PerformancePip" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PerformancePip" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "PerformancePip_tenant_rw" ON "PerformancePip";
CREATE POLICY "PerformancePip_tenant_rw" ON "PerformancePip" FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "PerformancePip_insert_bootstrap" ON "PerformancePip";
CREATE POLICY "PerformancePip_insert_bootstrap" ON "PerformancePip" FOR INSERT WITH CHECK (coalesce(current_setting('app.current_org', true), '') = '' OR "organizationId" = current_setting('app.current_org', true)::uuid);

ALTER TABLE "PerformanceRater" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PerformanceRater" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "PerformanceRater_tenant_rw" ON "PerformanceRater";
CREATE POLICY "PerformanceRater_tenant_rw" ON "PerformanceRater" FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "PerformanceRater_insert_bootstrap" ON "PerformanceRater";
CREATE POLICY "PerformanceRater_insert_bootstrap" ON "PerformanceRater" FOR INSERT WITH CHECK (coalesce(current_setting('app.current_org', true), '') = '' OR "organizationId" = current_setting('app.current_org', true)::uuid);
