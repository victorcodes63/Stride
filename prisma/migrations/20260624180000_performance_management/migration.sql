-- RAV-69: Performance management cycles, goals, reviews, ratings, feedback.

CREATE TYPE "PerformanceCycleStatus" AS ENUM ('draft', 'active', 'closed');
CREATE TYPE "PerformanceReviewStatus" AS ENUM ('not_started', 'self_in_progress', 'self_submitted', 'manager_in_progress', 'completed');

CREATE TABLE "PerformanceCycle" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "status" "PerformanceCycleStatus" NOT NULL DEFAULT 'draft',
    "outsourcingClientId" TEXT,
    "createdByUserId" TEXT,
    "activatedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceCycle_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PerformanceGoal" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "cycleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "weightPercent" INTEGER NOT NULL DEFAULT 25,
    "selfScore" INTEGER,
    "managerScore" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceGoal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PerformanceReview" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "cycleId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "managerUserId" TEXT,
    "status" "PerformanceReviewStatus" NOT NULL DEFAULT 'not_started',
    "selfSummary" TEXT,
    "managerSummary" TEXT,
    "overallSelfRating" INTEGER,
    "overallManagerRating" INTEGER,
    "selfSubmittedAt" TIMESTAMP(3),
    "managerSubmittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PerformanceReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PerformanceReviewRating" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "reviewId" TEXT NOT NULL,
    "dimension" TEXT NOT NULL,
    "selfScore" INTEGER,
    "managerScore" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PerformanceReviewRating_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "PerformanceFeedback" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "reviewId" TEXT NOT NULL,
    "authorType" TEXT NOT NULL,
    "authorUserId" TEXT,
    "authorEssUserId" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PerformanceFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PerformanceCycle_organizationId_status_idx" ON "PerformanceCycle"("organizationId", "status");
CREATE INDEX "PerformanceCycle_outsourcingClientId_idx" ON "PerformanceCycle"("outsourcingClientId");
CREATE INDEX "PerformanceGoal_cycleId_employeeId_idx" ON "PerformanceGoal"("cycleId", "employeeId");
CREATE UNIQUE INDEX "PerformanceReview_cycleId_employeeId_key" ON "PerformanceReview"("cycleId", "employeeId");
CREATE INDEX "PerformanceReview_organizationId_status_idx" ON "PerformanceReview"("organizationId", "status");
CREATE INDEX "PerformanceReview_employeeId_idx" ON "PerformanceReview"("employeeId");
CREATE UNIQUE INDEX "PerformanceReviewRating_reviewId_dimension_key" ON "PerformanceReviewRating"("reviewId", "dimension");
CREATE INDEX "PerformanceReviewRating_reviewId_idx" ON "PerformanceReviewRating"("reviewId");
CREATE INDEX "PerformanceFeedback_reviewId_idx" ON "PerformanceFeedback"("reviewId");

ALTER TABLE "PerformanceCycle" ADD CONSTRAINT "PerformanceCycle_outsourcingClientId_fkey" FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PerformanceCycle" ADD CONSTRAINT "PerformanceCycle_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PerformanceGoal" ADD CONSTRAINT "PerformanceGoal_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "PerformanceCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerformanceGoal" ADD CONSTRAINT "PerformanceGoal_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerformanceReview" ADD CONSTRAINT "PerformanceReview_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "PerformanceCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerformanceReview" ADD CONSTRAINT "PerformanceReview_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerformanceReview" ADD CONSTRAINT "PerformanceReview_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PerformanceReviewRating" ADD CONSTRAINT "PerformanceReviewRating_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "PerformanceReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerformanceFeedback" ADD CONSTRAINT "PerformanceFeedback_reviewId_fkey" FOREIGN KEY ("reviewId") REFERENCES "PerformanceReview"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "PerformanceFeedback" ADD CONSTRAINT "PerformanceFeedback_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "PerformanceFeedback" ADD CONSTRAINT "PerformanceFeedback_authorEssUserId_fkey" FOREIGN KEY ("authorEssUserId") REFERENCES "EssPortalUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PerformanceCycle" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PerformanceCycle" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "PerformanceCycle_tenant_rw" ON "PerformanceCycle";
CREATE POLICY "PerformanceCycle_tenant_rw" ON "PerformanceCycle" FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "PerformanceCycle_insert_bootstrap" ON "PerformanceCycle";
CREATE POLICY "PerformanceCycle_insert_bootstrap" ON "PerformanceCycle" FOR INSERT WITH CHECK (coalesce(current_setting('app.current_org', true), '') = '' OR "organizationId" = current_setting('app.current_org', true)::uuid);

ALTER TABLE "PerformanceGoal" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PerformanceGoal" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "PerformanceGoal_tenant_rw" ON "PerformanceGoal";
CREATE POLICY "PerformanceGoal_tenant_rw" ON "PerformanceGoal" FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "PerformanceGoal_insert_bootstrap" ON "PerformanceGoal";
CREATE POLICY "PerformanceGoal_insert_bootstrap" ON "PerformanceGoal" FOR INSERT WITH CHECK (coalesce(current_setting('app.current_org', true), '') = '' OR "organizationId" = current_setting('app.current_org', true)::uuid);

ALTER TABLE "PerformanceReview" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PerformanceReview" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "PerformanceReview_tenant_rw" ON "PerformanceReview";
CREATE POLICY "PerformanceReview_tenant_rw" ON "PerformanceReview" FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "PerformanceReview_insert_bootstrap" ON "PerformanceReview";
CREATE POLICY "PerformanceReview_insert_bootstrap" ON "PerformanceReview" FOR INSERT WITH CHECK (coalesce(current_setting('app.current_org', true), '') = '' OR "organizationId" = current_setting('app.current_org', true)::uuid);

ALTER TABLE "PerformanceReviewRating" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PerformanceReviewRating" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "PerformanceReviewRating_tenant_rw" ON "PerformanceReviewRating";
CREATE POLICY "PerformanceReviewRating_tenant_rw" ON "PerformanceReviewRating" FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "PerformanceReviewRating_insert_bootstrap" ON "PerformanceReviewRating";
CREATE POLICY "PerformanceReviewRating_insert_bootstrap" ON "PerformanceReviewRating" FOR INSERT WITH CHECK (coalesce(current_setting('app.current_org', true), '') = '' OR "organizationId" = current_setting('app.current_org', true)::uuid);

ALTER TABLE "PerformanceFeedback" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "PerformanceFeedback" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "PerformanceFeedback_tenant_rw" ON "PerformanceFeedback";
CREATE POLICY "PerformanceFeedback_tenant_rw" ON "PerformanceFeedback" FOR ALL USING ("organizationId" = current_setting('app.current_org', true)::uuid) WITH CHECK ("organizationId" = current_setting('app.current_org', true)::uuid);
DROP POLICY IF EXISTS "PerformanceFeedback_insert_bootstrap" ON "PerformanceFeedback";
CREATE POLICY "PerformanceFeedback_insert_bootstrap" ON "PerformanceFeedback" FOR INSERT WITH CHECK (coalesce(current_setting('app.current_org', true), '') = '' OR "organizationId" = current_setting('app.current_org', true)::uuid);
