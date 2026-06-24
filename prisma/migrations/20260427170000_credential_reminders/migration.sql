-- Credential reminder audit log for milestone and overdue notifications

CREATE TYPE "CredentialReminderKind" AS ENUM ('days_30', 'days_14', 'days_7', 'overdue');

CREATE TABLE "CredentialReminderSent" (
  "id" TEXT NOT NULL,
  "credentialId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "kind" "CredentialReminderKind" NOT NULL,
  "sentOnYmd" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CredentialReminderSent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CredentialReminderSent_credentialId_userId_kind_sentOnYmd_key"
  ON "CredentialReminderSent"("credentialId", "userId", "kind", "sentOnYmd");
CREATE INDEX "CredentialReminderSent_sentOnYmd_idx"
  ON "CredentialReminderSent"("sentOnYmd");
CREATE INDEX "CredentialReminderSent_kind_idx"
  ON "CredentialReminderSent"("kind");

ALTER TABLE "CredentialReminderSent"
  ADD CONSTRAINT "CredentialReminderSent_credentialId_fkey"
  FOREIGN KEY ("credentialId") REFERENCES "EmployeeCredential"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CredentialReminderSent"
  ADD CONSTRAINT "CredentialReminderSent_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
