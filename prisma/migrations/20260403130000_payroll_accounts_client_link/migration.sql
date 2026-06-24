-- Link payroll rows to AccountsClient (billing profile) when outsourcing client is linked.

ALTER TABLE "Payroll" ADD COLUMN "accountsClientId" TEXT;

CREATE INDEX "Payroll_accountsClientId_idx" ON "Payroll"("accountsClientId");

ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_accountsClientId_fkey" FOREIGN KEY ("accountsClientId") REFERENCES "AccountsClient"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "Payroll" AS p
SET "accountsClientId" = ac.id
FROM "Employee" AS e
INNER JOIN "AccountsClient" AS ac ON ac."outsourcingClientId" = e."outsourcingClientId"
WHERE e.id = p."employeeId" AND ac."outsourcingClientId" IS NOT NULL;
