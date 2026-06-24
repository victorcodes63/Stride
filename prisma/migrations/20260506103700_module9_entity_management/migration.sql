-- Module 9: multi-company entity transfer audit trail (additive)
CREATE TABLE "EmployeeEntityTransfer" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "sourceEmployeeId" TEXT NOT NULL,
  "sourceClientId" TEXT NOT NULL,
  "sourceEntityCode" TEXT NOT NULL,
  "targetClientId" TEXT NOT NULL,
  "targetEntityCode" TEXT NOT NULL,
  "effectiveAt" TIMESTAMP(3) NOT NULL,
  "transferReason" TEXT,
  "initiatedByUserId" TEXT,
  "previousDepartmentId" TEXT,
  "previousJobTitle" TEXT,
  "previousEmploymentStatus" "EmployeeEmploymentStatus",
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmployeeEntityTransfer_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EmployeeEntityTransfer_employeeId_createdAt_idx"
  ON "EmployeeEntityTransfer"("employeeId", "createdAt" DESC);
CREATE INDEX "EmployeeEntityTransfer_sourceEntityCode_targetEntityCode_createdAt_idx"
  ON "EmployeeEntityTransfer"("sourceEntityCode", "targetEntityCode", "createdAt" DESC);
CREATE INDEX "EmployeeEntityTransfer_sourceClientId_idx"
  ON "EmployeeEntityTransfer"("sourceClientId");
CREATE INDEX "EmployeeEntityTransfer_targetClientId_idx"
  ON "EmployeeEntityTransfer"("targetClientId");

ALTER TABLE "EmployeeEntityTransfer"
  ADD CONSTRAINT "EmployeeEntityTransfer_employeeId_fkey"
  FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeEntityTransfer"
  ADD CONSTRAINT "EmployeeEntityTransfer_sourceEmployeeId_fkey"
  FOREIGN KEY ("sourceEmployeeId") REFERENCES "Employee"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EmployeeEntityTransfer"
  ADD CONSTRAINT "EmployeeEntityTransfer_sourceClientId_fkey"
  FOREIGN KEY ("sourceClientId") REFERENCES "OutsourcingClient"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeEntityTransfer"
  ADD CONSTRAINT "EmployeeEntityTransfer_targetClientId_fkey"
  FOREIGN KEY ("targetClientId") REFERENCES "OutsourcingClient"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EmployeeEntityTransfer"
  ADD CONSTRAINT "EmployeeEntityTransfer_initiatedByUserId_fkey"
  FOREIGN KEY ("initiatedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
