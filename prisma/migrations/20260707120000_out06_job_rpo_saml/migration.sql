-- OUT-06: RPO jobs scoped to end-client
ALTER TABLE "Job" ADD COLUMN IF NOT EXISTS "outsourcingClientId" TEXT;

CREATE INDEX IF NOT EXISTS "Job_outsourcingClientId_idx" ON "Job"("outsourcingClientId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'Job_outsourcingClientId_fkey'
  ) THEN
    ALTER TABLE "Job"
      ADD CONSTRAINT "Job_outsourcingClientId_fkey"
      FOREIGN KEY ("outsourcingClientId") REFERENCES "OutsourcingClient"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- AUTH-09: SAML enterprise stub fields on org auth config
ALTER TABLE "OrganizationAuthConfig" ADD COLUMN IF NOT EXISTS "samlIdpMetadataUrl" TEXT;
ALTER TABLE "OrganizationAuthConfig" ADD COLUMN IF NOT EXISTS "samlEnabledStaff" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "OrganizationAuthConfig" ADD COLUMN IF NOT EXISTS "samlEnabledEss" BOOLEAN NOT NULL DEFAULT false;
