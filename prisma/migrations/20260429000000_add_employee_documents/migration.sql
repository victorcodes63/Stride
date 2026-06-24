-- CreateEnum
CREATE TYPE "EmployeeDocumentCategory" AS ENUM (
  'CONTRACT',
  'IDENTIFICATION',
  'QUALIFICATION',
  'PERFORMANCE',
  'DISCIPLINARY',
  'POLICY_ACKNOWLEDGMENT',
  'MEDICAL',
  'OTHER'
);

-- CreateTable
CREATE TABLE "EmployeeDocument" (
  "id" TEXT NOT NULL,
  "employeeId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "category" "EmployeeDocumentCategory" NOT NULL,
  "filePath" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "fileSize" INTEGER,
  "mimeType" TEXT,
  "notes" TEXT,
  "uploadedBy" TEXT NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "EmployeeDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "EmployeeDocument_employeeId_idx" ON "EmployeeDocument"("employeeId");

-- CreateIndex
CREATE INDEX "EmployeeDocument_category_idx" ON "EmployeeDocument"("category");

-- AddForeignKey
ALTER TABLE "EmployeeDocument"
ADD CONSTRAINT "EmployeeDocument_employeeId_fkey"
FOREIGN KEY ("employeeId") REFERENCES "Employee"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmployeeDocument"
ADD CONSTRAINT "EmployeeDocument_uploadedBy_fkey"
FOREIGN KEY ("uploadedBy") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
