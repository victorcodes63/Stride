-- Remove client_recruitment from StaffUserType (those users belong in RecruitmentClientPortalUser now)
UPDATE "User" SET "staffUserType" = 'operations' WHERE "staffUserType"::text = 'client_recruitment';

ALTER TYPE "StaffUserType" RENAME TO "StaffUserType_old";
CREATE TYPE "StaffUserType" AS ENUM ('operations', 'business_manager', 'finance', 'director');

ALTER TABLE "User" ALTER COLUMN "staffUserType" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "staffUserType" TYPE "StaffUserType" USING "staffUserType"::text::"StaffUserType";
ALTER TABLE "User" ALTER COLUMN "staffUserType" SET DEFAULT 'operations'::"StaffUserType";

DROP TYPE "StaffUserType_old";

-- CreateTable
CREATE TABLE "RecruitmentClientPortalUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecruitmentClientPortalUser_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RecruitmentClientPortalUser_email_key" ON "RecruitmentClientPortalUser"("email");
CREATE INDEX "RecruitmentClientPortalUser_clientId_idx" ON "RecruitmentClientPortalUser"("clientId");
CREATE INDEX "RecruitmentClientPortalUser_isActive_idx" ON "RecruitmentClientPortalUser"("isActive");

ALTER TABLE "RecruitmentClientPortalUser" ADD CONSTRAINT "RecruitmentClientPortalUser_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
