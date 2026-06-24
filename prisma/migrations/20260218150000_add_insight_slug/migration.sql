-- AlterTable: add slug column (nullable for backfill)
ALTER TABLE "Insight" ADD COLUMN "slug" TEXT;

-- Backfill: unique slug from title (slugify-style) + short id suffix
UPDATE "Insight"
SET "slug" = LOWER(
  COALESCE(
    NULLIF(
      REGEXP_REPLACE(
        REGEXP_REPLACE(
          REGEXP_REPLACE(TRIM("title"), '\s+', '-', 'g'),
          '[^a-z0-9-]', '', 'gi'
        ),
        '-+', '-', 'g'
      ),
      ''
    ),
    'insight'
  )
) || '-' || LEFT("id", 8);

-- Add unique constraint
CREATE UNIQUE INDEX "Insight_slug_key" ON "Insight"("slug");
