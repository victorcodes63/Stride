-- CreateTable
CREATE TABLE "InterviewScheduleBreak" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 15,
    "label" TEXT NOT NULL DEFAULT 'Break',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InterviewScheduleBreak_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InterviewScheduleBreak_jobId_idx" ON "InterviewScheduleBreak"("jobId");

-- CreateIndex
CREATE INDEX "InterviewScheduleBreak_scheduledAt_idx" ON "InterviewScheduleBreak"("scheduledAt");

-- AddForeignKey
ALTER TABLE "InterviewScheduleBreak" ADD CONSTRAINT "InterviewScheduleBreak_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
