-- B3 — Quote versioning (additive). Keep old unique until new composite unique exists.

ALTER TABLE "SalesQuote" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "SalesQuote" ADD COLUMN IF NOT EXISTS "supersededById" TEXT;
ALTER TABLE "SalesQuote" ADD COLUMN IF NOT EXISTS "acceptedByName" TEXT;

-- New unique: (organizationId, quoteNumber, version)
CREATE UNIQUE INDEX IF NOT EXISTS "SalesQuote_organizationId_quoteNumber_version_key"
  ON "SalesQuote"("organizationId", "quoteNumber", "version");

CREATE INDEX IF NOT EXISTS "SalesQuote_organizationId_quoteNumber_idx"
  ON "SalesQuote"("organizationId", "quoteNumber");

-- Self-FK for supersedes chain
DO $$ BEGIN
  ALTER TABLE "SalesQuote" ADD CONSTRAINT "SalesQuote_supersededById_fkey"
    FOREIGN KEY ("supersededById") REFERENCES "SalesQuote"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Drop legacy unique only after the composite unique is in place (verified by CREATE above).
DROP INDEX IF EXISTS "SalesQuote_organizationId_quoteNumber_key";
