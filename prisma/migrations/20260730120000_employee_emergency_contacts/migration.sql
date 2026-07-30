-- AlterTable (idempotent for P3005 baselined Neon cells)
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "emergencyContactName" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "emergencyContactPhone" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "emergencyContactRelationship" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "emergencyContactAltName" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "emergencyContactAltPhone" TEXT;
ALTER TABLE "Employee" ADD COLUMN IF NOT EXISTS "emergencyContactAltRelationship" TEXT;
