-- AlterTable
ALTER TABLE "StaffNotification"
ADD COLUMN "essPortalUserId" TEXT,
ADD COLUMN "event" TEXT,
ADD COLUMN "priority" TEXT NOT NULL DEFAULT 'info';

-- AlterTable
ALTER TABLE "StaffNotification"
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "StaffNotification_essPortalUserId_createdAt_idx" ON "StaffNotification"("essPortalUserId", "createdAt");

-- CreateIndex
CREATE INDEX "StaffNotification_event_priority_idx" ON "StaffNotification"("event", "priority");

-- AddForeignKey
ALTER TABLE "StaffNotification"
ADD CONSTRAINT "StaffNotification_essPortalUserId_fkey"
FOREIGN KEY ("essPortalUserId") REFERENCES "EssPortalUser"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
