#!/usr/bin/env node
/**
 * RAV-62: Build additive tenancy migration (nullable → backfill → NOT NULL → RLS).
 */
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const schemaPath = resolve(__dirname, '../prisma/schema.prisma');
const rlsPath = resolve(__dirname, '../prisma/migrations/rls_policies.sql');
const outDir = resolve(__dirname, '../prisma/migrations/20260624120000_tenancy_organization');
const outPath = resolve(outDir, 'migration.sql');

const DEFAULT_ORG_ID = '00000000-0000-4000-8000-000000000001';

const GLOBAL_MODELS = new Set([
  'User',
  'PermissionDefinition',
  'RolePermission',
  'SchedulerLock',
  'Organization',
  'OrganizationMembership',
]);

const schema = readFileSync(schemaPath, 'utf8');
const tenantModels = [...schema.matchAll(/^model (\w+) \{/gm)]
  .map((m) => m[1])
  .filter((m) => !GLOBAL_MODELS.has(m));

const lines = [
  '-- RAV-62: Tenancy schema + default org backfill (additive-only)',
  '',
  '-- 1) Organization tables',
  `CREATE TABLE "Organization" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "country" TEXT NOT NULL DEFAULT 'KE',
    "currency" TEXT NOT NULL DEFAULT 'KES',
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Nairobi',
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);`,
  `CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");`,
  '',
  `CREATE TABLE "OrganizationMembership" (
    "id" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'staff',
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrganizationMembership_pkey" PRIMARY KEY ("id")
);`,
  `CREATE INDEX "OrganizationMembership_organizationId_idx" ON "OrganizationMembership"("organizationId");`,
  `CREATE UNIQUE INDEX "OrganizationMembership_userId_organizationId_key" ON "OrganizationMembership"("userId", "organizationId");`,
  `ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  `ALTER TABLE "OrganizationMembership" ADD CONSTRAINT "OrganizationMembership_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;`,
  '',
  '-- 2) Default organization (existing single-tenant data migrates here)',
  `INSERT INTO "Organization" ("id", "name", "slug", "updatedAt")`,
  `VALUES ('${DEFAULT_ORG_ID}', 'Default Organization', 'default', CURRENT_TIMESTAMP);`,
  '',
  '-- 3) Nullable organizationId columns',
];

for (const model of tenantModels) {
  lines.push(`ALTER TABLE "${model}" ADD COLUMN IF NOT EXISTS "organizationId" UUID;`);
}

lines.push('', '-- 4) Backfill existing rows');
for (const model of tenantModels) {
  lines.push(
    `UPDATE "${model}" SET "organizationId" = '${DEFAULT_ORG_ID}' WHERE "organizationId" IS NULL;`,
  );
}

lines.push('', '-- 5) Enforce NOT NULL');
for (const model of tenantModels) {
  lines.push(`ALTER TABLE "${model}" ALTER COLUMN "organizationId" SET NOT NULL;`);
}

lines.push('', '-- 6) Indexes on organizationId');
for (const model of tenantModels) {
  lines.push(
    `CREATE INDEX IF NOT EXISTS "${model}_organizationId_idx" ON "${model}"("organizationId");`,
  );
}

lines.push('', '-- 7) Memberships for existing staff users');
lines.push(`INSERT INTO "OrganizationMembership" ("id", "userId", "organizationId", "role", "updatedAt")
SELECT gen_random_uuid(), u."id", '${DEFAULT_ORG_ID}', u."role", CURRENT_TIMESTAMP
FROM "User" u
WHERE NOT EXISTS (
  SELECT 1 FROM "OrganizationMembership" m
  WHERE m."userId" = u."id" AND m."organizationId" = '${DEFAULT_ORG_ID}'
);`);

lines.push('', '-- 8) Row-Level Security');
lines.push(readFileSync(rlsPath, 'utf8'));

mkdirSync(outDir, { recursive: true });
writeFileSync(outPath, lines.join('\n'));
console.log(`Wrote tenancy migration (${tenantModels.length} tables) → ${outPath}`);
