-- AlterTable
ALTER TABLE "Project" ADD COLUMN "budgetId" TEXT;

-- CreateIndex
CREATE INDEX "Project_budgetId_idx" ON "Project"("budgetId");

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_budgetId_fkey" FOREIGN KEY ("budgetId") REFERENCES "Budget"("id") ON DELETE SET NULL ON UPDATE CASCADE;
