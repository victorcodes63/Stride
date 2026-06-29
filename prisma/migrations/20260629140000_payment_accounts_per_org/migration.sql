-- Scope payment account legacy kinds per tenant (was globally unique — blocked 2nd org seed).

DROP INDEX IF EXISTS "AccountsPaymentAccount_legacyKind_key";

CREATE UNIQUE INDEX "AccountsPaymentAccount_organizationId_legacyKind_key"
  ON "AccountsPaymentAccount"("organizationId", "legacyKind");
