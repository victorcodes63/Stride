-- B4 — Link delivery projects back to the won sales deal (additive).

ALTER TABLE "Project" ADD COLUMN IF NOT EXISTS "sourceDealId" TEXT;

CREATE INDEX IF NOT EXISTS "Project_organizationId_sourceDealId_idx"
  ON "Project"("organizationId", "sourceDealId");

DO $$ BEGIN
  ALTER TABLE "Project" ADD CONSTRAINT "Project_sourceDealId_fkey"
    FOREIGN KEY ("sourceDealId") REFERENCES "SalesDeal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
