-- CreateEnum
CREATE TYPE "StaffUserType" AS ENUM ('operations', 'business_manager', 'finance', 'director');

-- AlterTable
ALTER TABLE "User" ADD COLUMN "staffUserType" "StaffUserType" NOT NULL DEFAULT 'operations';
