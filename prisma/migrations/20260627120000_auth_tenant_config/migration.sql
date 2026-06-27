-- RAV-223: Per-tenant auth config + verified email domains

CREATE TYPE "AuthProvider" AS ENUM ('microsoft', 'google', 'credentials');

CREATE TABLE "OrganizationAuthConfig" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "staffEnabledProviders" "AuthProvider"[] NOT NULL DEFAULT ARRAY['credentials']::"AuthProvider"[],
    "essEnabledProviders" "AuthProvider"[] NOT NULL DEFAULT ARRAY['credentials']::"AuthProvider"[],
    "ssoEnforcedStaff" BOOLEAN NOT NULL DEFAULT false,
    "ssoEnforcedEss" BOOLEAN NOT NULL DEFAULT false,
    "jitProvisioning" BOOLEAN NOT NULL DEFAULT false,
    "lockedMsTenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrganizationAuthConfig_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationAuthConfig_organizationId_key" ON "OrganizationAuthConfig"("organizationId");
CREATE INDEX "OrganizationAuthConfig_organizationId_idx" ON "OrganizationAuthConfig"("organizationId");

CREATE TABLE "OrganizationEmailDomain" (
    "id" UUID NOT NULL,
    "organizationId" UUID NOT NULL,
    "domain" TEXT NOT NULL,
    "verificationToken" TEXT NOT NULL,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OrganizationEmailDomain_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OrganizationEmailDomain_organizationId_domain_key" ON "OrganizationEmailDomain"("organizationId", "domain");
CREATE INDEX "OrganizationEmailDomain_domain_idx" ON "OrganizationEmailDomain"("domain");
CREATE INDEX "OrganizationEmailDomain_organizationId_idx" ON "OrganizationEmailDomain"("organizationId");

ALTER TABLE "OrganizationAuthConfig" ADD CONSTRAINT "OrganizationAuthConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationEmailDomain" ADD CONSTRAINT "OrganizationEmailDomain_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Default org auth config
INSERT INTO "OrganizationAuthConfig" ("id", "organizationId", "staffEnabledProviders", "essEnabledProviders", "updatedAt")
SELECT gen_random_uuid(), '00000000-0000-4000-8000-000000000001', ARRAY['credentials']::"AuthProvider"[], ARRAY['credentials']::"AuthProvider"[], CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "OrganizationAuthConfig" WHERE "organizationId" = '00000000-0000-4000-8000-000000000001'
);
