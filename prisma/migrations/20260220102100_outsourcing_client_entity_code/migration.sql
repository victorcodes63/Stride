-- AlterTable
ALTER TABLE "OutsourcingClient" ADD COLUMN IF NOT EXISTS "entityCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "OutsourcingClient_entityCode_key" ON "OutsourcingClient"("entityCode");
