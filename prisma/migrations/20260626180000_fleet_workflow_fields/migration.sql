-- FleetCustomer → AccountsClient debtor link
ALTER TABLE "FleetCustomer" ADD COLUMN IF NOT EXISTS "accountsClientId" TEXT;

CREATE INDEX IF NOT EXISTS "FleetCustomer_accountsClientId_idx" ON "FleetCustomer"("accountsClientId");

DO $$ BEGIN
  ALTER TABLE "FleetCustomer" ADD CONSTRAINT "FleetCustomer_accountsClientId_fkey"
    FOREIGN KEY ("accountsClientId") REFERENCES "AccountsClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- POD ops verification
ALTER TABLE "FleetTripDocument" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);
ALTER TABLE "FleetTripDocument" ADD COLUMN IF NOT EXISTS "verifiedByUserId" TEXT;

DO $$ BEGIN
  ALTER TABLE "FleetTripDocument" ADD CONSTRAINT "FleetTripDocument_verifiedByUserId_fkey"
    FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Incident ownership & escalation
ALTER TABLE "FleetIncident" ADD COLUMN IF NOT EXISTS "ownerUserId" TEXT;
ALTER TABLE "FleetIncident" ADD COLUMN IF NOT EXISTS "escalatedAt" TIMESTAMP(3);

DO $$ BEGIN
  ALTER TABLE "FleetIncident" ADD CONSTRAINT "FleetIncident_ownerUserId_fkey"
    FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
