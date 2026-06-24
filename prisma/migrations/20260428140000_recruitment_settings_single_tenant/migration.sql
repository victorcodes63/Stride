-- Single-tenant recruitment: org profile + optional link to one legacy `Client` for Accounts.

CREATE TABLE "RecruitmentSettings" (
    "id" TEXT NOT NULL,
    "employerName" TEXT NOT NULL,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "linkedClientId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RecruitmentSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecruitmentSettings_linkedClientId_key" ON "RecruitmentSettings"("linkedClientId");

ALTER TABLE "RecruitmentSettings" ADD CONSTRAINT "RecruitmentSettings_linkedClientId_fkey" FOREIGN KEY ("linkedClientId") REFERENCES "Client"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Default row: copy from earliest Client if any, else placeholder name
INSERT INTO "RecruitmentSettings" ("id", "employerName", "createdAt", "updatedAt")
SELECT
    'default',
    COALESCE((SELECT "name" FROM "Client" ORDER BY "createdAt" ASC LIMIT 1), 'Demo Corporation'),
    NOW(),
    NOW()
WHERE NOT EXISTS (SELECT 1 FROM "RecruitmentSettings" WHERE "id" = 'default');

-- Link the canonical org client and sync contact display fields when Clients exist
UPDATE "RecruitmentSettings" AS rs
SET
    "linkedClientId" = c."id",
    "employerName" = c."name",
    "contactName" = c."contactName",
    "contactEmail" = c."contactEmail",
    "contactPhone" = c."contactPhone",
    "updatedAt" = NOW()
FROM (
    SELECT "id", "name", "contactName", "contactEmail", "contactPhone"
    FROM "Client"
    ORDER BY "createdAt" ASC
    LIMIT 1
) AS c
WHERE
    rs."id" = 'default'
    AND (rs."linkedClientId" IS NULL)
    AND EXISTS (SELECT 1 FROM "Client" LIMIT 1);

-- Attach orphan jobs to the same linked client (optional FK consistency)
UPDATE "Job"
SET "clientId" = (SELECT "linkedClientId" FROM "RecruitmentSettings" WHERE "id" = 'default' LIMIT 1)
WHERE
    "clientId" IS NULL
    AND (SELECT "linkedClientId" FROM "RecruitmentSettings" WHERE "id" = 'default' LIMIT 1) IS NOT NULL;
