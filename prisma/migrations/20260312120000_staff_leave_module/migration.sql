-- Staff leave (HRIS demo internal)
CREATE TYPE "StaffLeaveApplicationStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

CREATE TABLE "StaffLeaveType" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "daysPerYear" INTEGER NOT NULL DEFAULT 21,
    "description" TEXT,
    "color" TEXT,
    "requiresApproval" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffLeaveType_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StaffLeaveType_active_sortOrder_idx" ON "StaffLeaveType"("active", "sortOrder");

CREATE TABLE "StaffLeaveBalance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "entitledDays" INTEGER NOT NULL DEFAULT 0,
    "usedDays" INTEGER NOT NULL DEFAULT 0,
    "carriedOver" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffLeaveBalance_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "StaffLeaveBalance_userId_leaveTypeId_year_key" ON "StaffLeaveBalance"("userId", "leaveTypeId", "year");
CREATE INDEX "StaffLeaveBalance_userId_year_idx" ON "StaffLeaveBalance"("userId", "year");

ALTER TABLE "StaffLeaveBalance" ADD CONSTRAINT "StaffLeaveBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffLeaveBalance" ADD CONSTRAINT "StaffLeaveBalance_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "StaffLeaveType"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "StaffLeaveApplication" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "leaveTypeId" TEXT NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE NOT NULL,
    "totalDays" INTEGER NOT NULL,
    "reason" TEXT,
    "status" "StaffLeaveApplicationStatus" NOT NULL DEFAULT 'pending',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffLeaveApplication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "StaffLeaveApplication_userId_status_idx" ON "StaffLeaveApplication"("userId", "status");
CREATE INDEX "StaffLeaveApplication_status_createdAt_idx" ON "StaffLeaveApplication"("status", "createdAt");
CREATE INDEX "StaffLeaveApplication_startDate_endDate_idx" ON "StaffLeaveApplication"("startDate", "endDate");

ALTER TABLE "StaffLeaveApplication" ADD CONSTRAINT "StaffLeaveApplication_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "StaffLeaveApplication" ADD CONSTRAINT "StaffLeaveApplication_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "StaffLeaveApplication" ADD CONSTRAINT "StaffLeaveApplication_leaveTypeId_fkey" FOREIGN KEY ("leaveTypeId") REFERENCES "StaffLeaveType"("id") ON DELETE CASCADE ON UPDATE CASCADE;
