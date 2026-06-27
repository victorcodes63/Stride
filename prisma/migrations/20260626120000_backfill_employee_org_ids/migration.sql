-- Align workforce rows with their outsourcing client's organization (fixes empty employee directory).

UPDATE "Employee" AS e
SET "organizationId" = c."organizationId"
FROM "OutsourcingClient" AS c
WHERE e."outsourcingClientId" = c.id
  AND e."organizationId" IS DISTINCT FROM c."organizationId";

UPDATE "Department" AS d
SET "organizationId" = c."organizationId"
FROM "OutsourcingClient" AS c
WHERE d."outsourcingClientId" = c.id
  AND d."organizationId" IS DISTINCT FROM c."organizationId";
