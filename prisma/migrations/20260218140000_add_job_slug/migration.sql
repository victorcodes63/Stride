-- AlterTable: add slug column (nullable first for backfill)
ALTER TABLE "Job" ADD COLUMN "slug" TEXT;

-- Backfill: unique slug from title + location + short id suffix
UPDATE "Job"
SET "slug" = LOWER(
  COALESCE(
    NULLIF(
      REGEXP_REPLACE(
        REGEXP_REPLACE(TRIM("title") || '-' || TRIM("location"), '\s+', '-', 'g'),
        '[^a-z0-9-]', '', 'gi'
      ),
      ''
    ),
    'job'
  )
) || '-' || LEFT("id", 8);

-- Add unique constraint
CREATE UNIQUE INDEX "Job_slug_key" ON "Job"("slug");
