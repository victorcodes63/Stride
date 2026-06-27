-- Allow the same entityCode (e.g. ke) on different organizations.
DROP INDEX IF EXISTS "OutsourcingClient_entityCode_key";

CREATE UNIQUE INDEX "OutsourcingClient_organizationId_entityCode_key"
  ON "OutsourcingClient"("organizationId", "entityCode");
