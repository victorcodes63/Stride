-- FleetCustomer → AccountsClient debtor link
ALTER TABLE "FleetCustomer" ADD COLUMN "accountsClientId" TEXT;

CREATE INDEX "FleetCustomer_accountsClientId_idx" ON "FleetCustomer"("accountsClientId");

ALTER TABLE "FleetCustomer" ADD CONSTRAINT "FleetCustomer_accountsClientId_fkey"
  FOREIGN KEY ("accountsClientId") REFERENCES "AccountsClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- POD ops verification
ALTER TABLE "FleetTripDocument" ADD COLUMN "verifiedAt" TIMESTAMP(3);
ALTER TABLE "FleetTripDocument" ADD COLUMN "verifiedByUserId" TEXT;

ALTER TABLE "FleetTripDocument" ADD CONSTRAINT "FleetTripDocument_verifiedByUserId_fkey"
  FOREIGN KEY ("verifiedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Incident ownership & escalation
ALTER TABLE "FleetIncident" ADD COLUMN "ownerUserId" TEXT;
ALTER TABLE "FleetIncident" ADD COLUMN "escalatedAt" TIMESTAMP(3);

ALTER TABLE "FleetIncident" ADD CONSTRAINT "FleetIncident_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
