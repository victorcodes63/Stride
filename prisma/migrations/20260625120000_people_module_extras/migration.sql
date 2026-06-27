-- Performance cycle templates + grievance documents

ALTER TABLE "PerformanceCycle" ADD COLUMN IF NOT EXISTS "goalTemplates" JSONB;
ALTER TABLE "PerformanceCycle" ADD COLUMN IF NOT EXISTS "ratingDimensions" JSONB;

CREATE TABLE IF NOT EXISTS "GrievanceDocument" (
  "id" TEXT NOT NULL,
  "organizationId" UUID NOT NULL,
  "grievanceId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "filePath" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "uploadedById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GrievanceDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GrievanceDocument_grievanceId_idx" ON "GrievanceDocument"("grievanceId");

DO $$ BEGIN
  ALTER TABLE "GrievanceDocument" ADD CONSTRAINT "GrievanceDocument_grievanceId_fkey"
    FOREIGN KEY ("grievanceId") REFERENCES "Grievance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "GrievanceDocument" ADD CONSTRAINT "GrievanceDocument_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
