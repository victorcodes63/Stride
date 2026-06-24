-- Per-user dashboard home layout (pinned/hidden widgets and KPI tiles).
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "dashboardOverviewLayout" JSONB;
