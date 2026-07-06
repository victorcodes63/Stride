-- PERF-04/05: BSC review cycle engine + scoring fields.

CREATE TYPE "PerformanceMethod" AS ENUM ('bsc', 'okr', 'kpi_only');

ALTER TYPE "PerformanceReviewStatus" ADD VALUE IF NOT EXISTS 'manager_submitted';
ALTER TYPE "PerformanceReviewStatus" ADD VALUE IF NOT EXISTS 'calibration_pending';

ALTER TABLE "PerformanceCycle" ADD COLUMN IF NOT EXISTS "method" "PerformanceMethod" NOT NULL DEFAULT 'bsc';
ALTER TABLE "PerformanceCycle" ADD COLUMN IF NOT EXISTS "resultsWeightPercent" INTEGER NOT NULL DEFAULT 70;
ALTER TABLE "PerformanceCycle" ADD COLUMN IF NOT EXISTS "competenciesWeightPercent" INTEGER NOT NULL DEFAULT 30;

ALTER TABLE "PerformanceGoal" ADD COLUMN IF NOT EXISTS "scorecardMeasureId" TEXT;

ALTER TABLE "PerformanceReview" ADD COLUMN IF NOT EXISTS "scorecardTemplateId" TEXT;
ALTER TABLE "PerformanceReview" ADD COLUMN IF NOT EXISTS "jobDescriptionId" TEXT;
ALTER TABLE "PerformanceReview" ADD COLUMN IF NOT EXISTS "jobDescriptionVersion" INTEGER;
ALTER TABLE "PerformanceReview" ADD COLUMN IF NOT EXISTS "frozenScorecardSnapshot" JSONB;
ALTER TABLE "PerformanceReview" ADD COLUMN IF NOT EXISTS "finalResultsScore" DECIMAL(5,2);
ALTER TABLE "PerformanceReview" ADD COLUMN IF NOT EXISTS "finalCompetenciesScore" DECIMAL(5,2);
ALTER TABLE "PerformanceReview" ADD COLUMN IF NOT EXISTS "finalBlendedScore" DECIMAL(5,2);
ALTER TABLE "PerformanceReview" ADD COLUMN IF NOT EXISTS "calibratedAt" TIMESTAMP(3);

ALTER TABLE "PerformanceReviewRating" ADD COLUMN IF NOT EXISTS "requiredLevel" INTEGER;
ALTER TABLE "PerformanceReviewRating" ADD COLUMN IF NOT EXISTS "competencyRequirementId" TEXT;

ALTER TABLE "PerformanceReview" ADD CONSTRAINT "PerformanceReview_scorecardTemplateId_fkey" FOREIGN KEY ("scorecardTemplateId") REFERENCES "ScorecardTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PerformanceReview" ADD CONSTRAINT "PerformanceReview_jobDescriptionId_fkey" FOREIGN KEY ("jobDescriptionId") REFERENCES "JobDescription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
