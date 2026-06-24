-- Public holiday calendar + attendance summary holiday fields

ALTER TABLE "AttendanceDaySummary"
  ADD COLUMN IF NOT EXISTS "holidayOvertimeMinutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "publicHolidayName" TEXT;

CREATE TABLE IF NOT EXISTS "PublicHoliday" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "date" TIMESTAMP(3),
  "recurring" BOOLEAN NOT NULL DEFAULT false,
  "recurDay" INTEGER,
  "recurMonth" INTEGER,
  "notes" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PublicHoliday_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PublicHoliday_date_key" ON "PublicHoliday"("date");
CREATE INDEX IF NOT EXISTS "PublicHoliday_date_idx" ON "PublicHoliday"("date");
CREATE INDEX IF NOT EXISTS "PublicHoliday_recurMonth_recurDay_idx" ON "PublicHoliday"("recurMonth", "recurDay");
