-- PERF-03 / RAV-254: BSC scorecard templates generated from published JDs.

CREATE TYPE "ScorecardMeasureSource" AS ENUM ('manual', 'auto');

CREATE TABLE "ScorecardTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "jobDescriptionId" TEXT NOT NULL,
    "jobDescriptionVersion" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "grade" TEXT,
    "resultsWeightPercent" INTEGER NOT NULL DEFAULT 70,
    "competenciesWeightPercent" INTEGER NOT NULL DEFAULT 30,
    "status" "JdStatus" NOT NULL DEFAULT 'published',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScorecardTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScorecardPerspective" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "templateId" TEXT NOT NULL,
    "perspective" "BscPerspective" NOT NULL,
    "weightPercent" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ScorecardPerspective_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ScorecardMeasure" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "templateId" TEXT NOT NULL,
    "perspectiveId" TEXT,
    "jobKpiId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "targetValue" TEXT,
    "unit" TEXT,
    "weightPercent" INTEGER NOT NULL DEFAULT 25,
    "sourceType" "ScorecardMeasureSource" NOT NULL DEFAULT 'manual',
    "kpiSourceKey" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ScorecardMeasure_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CompetencyRequirement" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "templateId" TEXT NOT NULL,
    "jobCompetencyId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "requiredLevel" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "CompetencyRequirement_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ScorecardTemplate_organizationId_jobDescriptionId_jobDescriptionVersion_key" ON "ScorecardTemplate"("organizationId", "jobDescriptionId", "jobDescriptionVersion");
CREATE INDEX "ScorecardTemplate_organizationId_title_idx" ON "ScorecardTemplate"("organizationId", "title");
CREATE UNIQUE INDEX "ScorecardPerspective_templateId_perspective_key" ON "ScorecardPerspective"("templateId", "perspective");
CREATE INDEX "ScorecardMeasure_templateId_sortOrder_idx" ON "ScorecardMeasure"("templateId", "sortOrder");
CREATE INDEX "CompetencyRequirement_templateId_sortOrder_idx" ON "CompetencyRequirement"("templateId", "sortOrder");

ALTER TABLE "ScorecardTemplate" ADD CONSTRAINT "ScorecardTemplate_jobDescriptionId_fkey" FOREIGN KEY ("jobDescriptionId") REFERENCES "JobDescription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ScorecardPerspective" ADD CONSTRAINT "ScorecardPerspective_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ScorecardTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScorecardMeasure" ADD CONSTRAINT "ScorecardMeasure_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ScorecardTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ScorecardMeasure" ADD CONSTRAINT "ScorecardMeasure_perspectiveId_fkey" FOREIGN KEY ("perspectiveId") REFERENCES "ScorecardPerspective"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ScorecardMeasure" ADD CONSTRAINT "ScorecardMeasure_jobKpiId_fkey" FOREIGN KEY ("jobKpiId") REFERENCES "JobKPI"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CompetencyRequirement" ADD CONSTRAINT "CompetencyRequirement_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ScorecardTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CompetencyRequirement" ADD CONSTRAINT "CompetencyRequirement_jobCompetencyId_fkey" FOREIGN KEY ("jobCompetencyId") REFERENCES "JobCompetency"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ScorecardTemplate" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScorecardTemplate" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ScorecardTemplate_tenant_rw" ON "ScorecardTemplate";
CREATE POLICY "ScorecardTemplate_tenant_rw" ON "ScorecardTemplate" FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "ScorecardTemplate_insert_bootstrap" ON "ScorecardTemplate";
CREATE POLICY "ScorecardTemplate_insert_bootstrap" ON "ScorecardTemplate" FOR INSERT WITH CHECK (coalesce(current_setting('app.current_org', true), '') = '' OR "organizationId" = current_setting('app.current_org', true)::uuid);

ALTER TABLE "ScorecardPerspective" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScorecardPerspective" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ScorecardPerspective_tenant_rw" ON "ScorecardPerspective";
CREATE POLICY "ScorecardPerspective_tenant_rw" ON "ScorecardPerspective" FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "ScorecardPerspective_insert_bootstrap" ON "ScorecardPerspective";
CREATE POLICY "ScorecardPerspective_insert_bootstrap" ON "ScorecardPerspective" FOR INSERT WITH CHECK (coalesce(current_setting('app.current_org', true), '') = '' OR "organizationId" = current_setting('app.current_org', true)::uuid);

ALTER TABLE "ScorecardMeasure" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "ScorecardMeasure" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ScorecardMeasure_tenant_rw" ON "ScorecardMeasure";
CREATE POLICY "ScorecardMeasure_tenant_rw" ON "ScorecardMeasure" FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "ScorecardMeasure_insert_bootstrap" ON "ScorecardMeasure";
CREATE POLICY "ScorecardMeasure_insert_bootstrap" ON "ScorecardMeasure" FOR INSERT WITH CHECK (coalesce(current_setting('app.current_org', true), '') = '' OR "organizationId" = current_setting('app.current_org', true)::uuid);

ALTER TABLE "CompetencyRequirement" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "CompetencyRequirement" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "CompetencyRequirement_tenant_rw" ON "CompetencyRequirement";
CREATE POLICY "CompetencyRequirement_tenant_rw" ON "CompetencyRequirement" FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "CompetencyRequirement_insert_bootstrap" ON "CompetencyRequirement";
CREATE POLICY "CompetencyRequirement_insert_bootstrap" ON "CompetencyRequirement" FOR INSERT WITH CHECK (coalesce(current_setting('app.current_org', true), '') = '' OR "organizationId" = current_setting('app.current_org', true)::uuid);
