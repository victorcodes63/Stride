-- Module 13 hardening: additive MFA and session-security fields.
ALTER TABLE "User"
ADD COLUMN "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "mfaSecret" TEXT,
ADD COLUMN "mfaRecoveryCodes" JSONB,
ADD COLUMN "mfaVerifiedAt" TIMESTAMP(3),
ADD COLUMN "lastLoginAt" TIMESTAMP(3);
