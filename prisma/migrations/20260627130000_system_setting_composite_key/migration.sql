-- ISO-05 (RAV-249): Per-tenant SystemSetting rows — composite PK (organizationId, key).
-- Existing global rows remain on the default org from RAV-62 backfill.

UPDATE "SystemSetting"
SET "organizationId" = '00000000-0000-4000-8000-000000000001'
WHERE "organizationId" IS NULL;

ALTER TABLE "SystemSetting" DROP CONSTRAINT IF EXISTS "SystemSetting_pkey";

ALTER TABLE "SystemSetting"
  ADD CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("organizationId", "key");

CREATE INDEX IF NOT EXISTS "SystemSetting_key_idx" ON "SystemSetting"("key");
