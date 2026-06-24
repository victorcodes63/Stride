-- AlterTable
ALTER TABLE "User" ADD COLUMN "leaveApproverId" TEXT;

-- CreateIndex
CREATE INDEX "User_leaveApproverId_idx" ON "User"("leaveApproverId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_leaveApproverId_fkey" FOREIGN KEY ("leaveApproverId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
