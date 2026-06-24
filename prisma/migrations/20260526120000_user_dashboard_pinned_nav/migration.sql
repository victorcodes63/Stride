-- Per-user dashboard sidebar pins (ordered href list stored as JSON).
ALTER TABLE "User" ADD COLUMN "dashboardPinnedNav" JSONB;
