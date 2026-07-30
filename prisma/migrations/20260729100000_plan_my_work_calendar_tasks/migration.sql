-- Plan my work: StaffTask + collaborative calendar (tenant-scoped)

-- CreateEnum
CREATE TYPE "StaffTaskStatus" AS ENUM ('todo', 'in_progress', 'done');

-- CreateEnum
CREATE TYPE "StaffTaskPriority" AS ENUM ('none', 'low', 'medium', 'high');

-- CreateTable
CREATE TABLE "StaffTask" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "StaffTaskStatus" NOT NULL DEFAULT 'todo',
    "priority" "StaffTaskPriority" NOT NULL DEFAULT 'none',
    "dueAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "assigneeId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalCalendarShare" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "ownerId" TEXT NOT NULL,
    "viewerId" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "windowEnd" TIMESTAMP(3) NOT NULL,
    "accessExpiresAt" TIMESTAMP(3) NOT NULL,
    "detailLevel" TEXT NOT NULL DEFAULT 'titles',
    "message" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalCalendarShare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PersonalCalendarEvent" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'event',
    "title" TEXT NOT NULL,
    "notes" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "isFocusBlock" BOOLEAN NOT NULL DEFAULT false,
    "recurrence" TEXT NOT NULL DEFAULT 'none',
    "recurrenceUntil" TIMESTAMP(3),
    "reminderMinutes" INTEGER,
    "reminderSentAt" TIMESTAMP(3),
    "priority" "StaffTaskPriority" NOT NULL DEFAULT 'none',
    "linkedTaskId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PersonalCalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyCalendarEvent" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'event',
    "title" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "allDay" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "recurrence" TEXT NOT NULL DEFAULT 'none',
    "recurrenceUntil" TIMESTAMP(3),
    "reminderMinutes" INTEGER,
    "reminderSentAt" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyCalendarEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarReminderDelivery" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "eventScope" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "occurrenceStartsAt" TIMESTAMP(3) NOT NULL,
    "channel" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CalendarReminderDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompanyCalendarEventParticipant" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "eventId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "respondedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyCalendarEventParticipant_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "StaffTask_organizationId_assigneeId_status_dueAt_idx" ON "StaffTask"("organizationId", "assigneeId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "StaffTask_organizationId_createdById_status_idx" ON "StaffTask"("organizationId", "createdById", "status");

-- CreateIndex
CREATE INDEX "StaffTask_organizationId_status_dueAt_idx" ON "StaffTask"("organizationId", "status", "dueAt");

-- CreateIndex
CREATE INDEX "PersonalCalendarShare_organizationId_viewerId_status_accessExpiresAt_idx" ON "PersonalCalendarShare"("organizationId", "viewerId", "status", "accessExpiresAt");

-- CreateIndex
CREATE INDEX "PersonalCalendarShare_organizationId_ownerId_status_idx" ON "PersonalCalendarShare"("organizationId", "ownerId", "status");

-- CreateIndex
CREATE INDEX "PersonalCalendarShare_organizationId_windowStart_windowEnd_idx" ON "PersonalCalendarShare"("organizationId", "windowStart", "windowEnd");

-- CreateIndex
CREATE UNIQUE INDEX "PersonalCalendarEvent_linkedTaskId_key" ON "PersonalCalendarEvent"("linkedTaskId");

-- CreateIndex
CREATE INDEX "PersonalCalendarEvent_organizationId_userId_startsAt_idx" ON "PersonalCalendarEvent"("organizationId", "userId", "startsAt");

-- CreateIndex
CREATE INDEX "PersonalCalendarEvent_organizationId_status_startsAt_idx" ON "PersonalCalendarEvent"("organizationId", "status", "startsAt");

-- CreateIndex
CREATE INDEX "PersonalCalendarEvent_organizationId_kind_startsAt_idx" ON "PersonalCalendarEvent"("organizationId", "kind", "startsAt");

-- CreateIndex
CREATE INDEX "CompanyCalendarEvent_organizationId_startsAt_idx" ON "CompanyCalendarEvent"("organizationId", "startsAt");

-- CreateIndex
CREATE INDEX "CompanyCalendarEvent_organizationId_status_startsAt_idx" ON "CompanyCalendarEvent"("organizationId", "status", "startsAt");

-- CreateIndex
CREATE INDEX "CompanyCalendarEvent_organizationId_createdById_idx" ON "CompanyCalendarEvent"("organizationId", "createdById");

-- CreateIndex
CREATE INDEX "CompanyCalendarEvent_organizationId_kind_startsAt_idx" ON "CompanyCalendarEvent"("organizationId", "kind", "startsAt");

-- CreateIndex
CREATE INDEX "CalendarReminderDelivery_organizationId_eventScope_eventId_idx" ON "CalendarReminderDelivery"("organizationId", "eventScope", "eventId");

-- CreateIndex
CREATE INDEX "CalendarReminderDelivery_organizationId_sentAt_idx" ON "CalendarReminderDelivery"("organizationId", "sentAt");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarReminderDelivery_organizationId_eventScope_eventId_occurrenceStartsAt_channel_key" ON "CalendarReminderDelivery"("organizationId", "eventScope", "eventId", "occurrenceStartsAt", "channel");

-- CreateIndex
CREATE INDEX "CompanyCalendarEventParticipant_organizationId_userId_status_idx" ON "CompanyCalendarEventParticipant"("organizationId", "userId", "status");

-- CreateIndex
CREATE INDEX "CompanyCalendarEventParticipant_eventId_idx" ON "CompanyCalendarEventParticipant"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "CompanyCalendarEventParticipant_eventId_userId_key" ON "CompanyCalendarEventParticipant"("eventId", "userId");

-- AddForeignKey
ALTER TABLE "StaffTask" ADD CONSTRAINT "StaffTask_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffTask" ADD CONSTRAINT "StaffTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalCalendarShare" ADD CONSTRAINT "PersonalCalendarShare_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalCalendarShare" ADD CONSTRAINT "PersonalCalendarShare_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalCalendarEvent" ADD CONSTRAINT "PersonalCalendarEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PersonalCalendarEvent" ADD CONSTRAINT "PersonalCalendarEvent_linkedTaskId_fkey" FOREIGN KEY ("linkedTaskId") REFERENCES "StaffTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyCalendarEvent" ADD CONSTRAINT "CompanyCalendarEvent_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyCalendarEventParticipant" ADD CONSTRAINT "CompanyCalendarEventParticipant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "CompanyCalendarEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompanyCalendarEventParticipant" ADD CONSTRAINT "CompanyCalendarEventParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
