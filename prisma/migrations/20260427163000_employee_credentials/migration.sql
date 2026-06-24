-- Employee clinical credentials and license tracking

CREATE TYPE "CredentialCategory" AS ENUM (
  'medical_license',
  'specialist_certification',
  'life_support',
  'regulatory_compliance',
  'training',
  'other'
);

CREATE TYPE "CredentialStatus" AS ENUM (
  'active',
  'expiring_soon',
  'expired',
  'suspended',
  'revoked'
);

CREATE TABLE "EmployeeCredential" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "category" "CredentialCategory" NOT NULL DEFAULT 'medical_license',
  "credentialName" TEXT NOT NULL,
  "credentialNumber" TEXT,
  "issuingAuthority" TEXT,
  "issueDate" DATE,
  "expiryDate" DATE,
  "reminderDays" INTEGER NOT NULL DEFAULT 30,
  "status" "CredentialStatus" NOT NULL DEFAULT 'active',
  "scopeOfPractice" TEXT,
  "notes" TEXT,
  "documentPath" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmployeeCredential_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmployeeCredential_employeeId_category_idx"
  ON "EmployeeCredential"("employeeId", "category");
CREATE INDEX "EmployeeCredential_expiryDate_idx"
  ON "EmployeeCredential"("expiryDate");
CREATE INDEX "EmployeeCredential_status_idx"
  ON "EmployeeCredential"("status");

ALTER TABLE "EmployeeCredential"
  ADD CONSTRAINT "EmployeeCredential_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
