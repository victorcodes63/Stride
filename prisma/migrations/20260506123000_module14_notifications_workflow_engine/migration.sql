-- Module 14: Notifications & Workflow Engine (additive only).

-- Enums
CREATE TYPE "WorkflowRunStatus" AS ENUM (
  'pending',
  'in_progress',
  'delegated',
  'escalated',
  'approved',
  'rejected',
  'completed',
  'cancelled'
);

CREATE TYPE "WorkflowTriggerType" AS ENUM ('event', 'time', 'manual');
CREATE TYPE "WorkflowRecipientKind" AS ENUM ('staff', 'ess');
CREATE TYPE "NotificationDeliveryStatus" AS ENUM (
  'pending',
  'sent',
  'failed',
  'skipped_quiet_hours',
  'skipped_policy'
);

-- Central workflow run table
CREATE TABLE "WorkflowRun" (
  "id" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "event" TEXT NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "entityCode" TEXT,
  "status" "WorkflowRunStatus" NOT NULL DEFAULT 'pending',
  "currentAssigneeUserId" TEXT,
  "currentAssigneeEssPortalUserId" TEXT,
  "delegatedFromUserId" TEXT,
  "delegatedToUserId" TEXT,
  "delegatedAt" TIMESTAMP(3),
  "escalatedAt" TIMESTAMP(3),
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dueAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WorkflowEvent" (
  "id" TEXT NOT NULL,
  "workflowRunId" TEXT NOT NULL,
  "triggerType" "WorkflowTriggerType" NOT NULL,
  "eventType" TEXT NOT NULL,
  "recipientKind" "WorkflowRecipientKind",
  "recipientUserId" TEXT,
  "recipientEssPortalUserId" TEXT,
  "status" "WorkflowRunStatus",
  "dueAt" TIMESTAMP(3),
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WorkflowEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationPolicy" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "essPortalUserId" TEXT,
  "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
  "emailEnabled" BOOLEAN NOT NULL DEFAULT true,
  "actionRequiredEmail" BOOLEAN NOT NULL DEFAULT true,
  "urgentEmail" BOOLEAN NOT NULL DEFAULT true,
  "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
  "quietHoursStart" TEXT,
  "quietHoursEnd" TEXT,
  "timezone" TEXT NOT NULL DEFAULT 'Africa/Nairobi',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationPolicy_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "NotificationDelivery" (
  "id" TEXT NOT NULL,
  "staffNotificationId" TEXT,
  "workflowRunId" TEXT,
  "event" TEXT NOT NULL,
  "triggerType" "WorkflowTriggerType" NOT NULL DEFAULT 'event',
  "recipientKind" "WorkflowRecipientKind" NOT NULL,
  "recipientUserId" TEXT,
  "recipientEssPortalUserId" TEXT,
  "channel" TEXT NOT NULL,
  "status" "NotificationDeliveryStatus" NOT NULL DEFAULT 'pending',
  "provider" TEXT,
  "error" TEXT,
  "metadata" JSONB,
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "NotificationDelivery_pkey" PRIMARY KEY ("id")
);

-- Uniques
CREATE UNIQUE INDEX "NotificationPolicy_userId_key" ON "NotificationPolicy"("userId");
CREATE UNIQUE INDEX "NotificationPolicy_essPortalUserId_key" ON "NotificationPolicy"("essPortalUserId");

-- Indexes
CREATE INDEX "WorkflowRun_module_status_dueAt_idx" ON "WorkflowRun"("module", "status", "dueAt");
CREATE INDEX "WorkflowRun_entityType_entityId_idx" ON "WorkflowRun"("entityType", "entityId");
CREATE INDEX "WorkflowRun_entityCode_status_idx" ON "WorkflowRun"("entityCode", "status");
CREATE INDEX "WorkflowEvent_workflowRunId_createdAt_idx" ON "WorkflowEvent"("workflowRunId", "createdAt");
CREATE INDEX "WorkflowEvent_eventType_createdAt_idx" ON "WorkflowEvent"("eventType", "createdAt");
CREATE INDEX "NotificationDelivery_event_createdAt_idx" ON "NotificationDelivery"("event", "createdAt");
CREATE INDEX "NotificationDelivery_recipientUserId_createdAt_idx" ON "NotificationDelivery"("recipientUserId", "createdAt");
CREATE INDEX "NotificationDelivery_recipientEssPortalUserId_createdAt_idx" ON "NotificationDelivery"("recipientEssPortalUserId", "createdAt");
CREATE INDEX "NotificationDelivery_status_channel_idx" ON "NotificationDelivery"("status", "channel");

-- FKs
ALTER TABLE "WorkflowRun"
ADD CONSTRAINT "WorkflowRun_currentAssigneeUserId_fkey" FOREIGN KEY ("currentAssigneeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "WorkflowRun_currentAssigneeEssPortalUserId_fkey" FOREIGN KEY ("currentAssigneeEssPortalUserId") REFERENCES "EssPortalUser"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "WorkflowRun_delegatedFromUserId_fkey" FOREIGN KEY ("delegatedFromUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "WorkflowRun_delegatedToUserId_fkey" FOREIGN KEY ("delegatedToUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WorkflowEvent"
ADD CONSTRAINT "WorkflowEvent_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "WorkflowRun"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "WorkflowEvent_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "WorkflowEvent_recipientEssPortalUserId_fkey" FOREIGN KEY ("recipientEssPortalUserId") REFERENCES "EssPortalUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "NotificationPolicy"
ADD CONSTRAINT "NotificationPolicy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
ADD CONSTRAINT "NotificationPolicy_essPortalUserId_fkey" FOREIGN KEY ("essPortalUserId") REFERENCES "EssPortalUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationDelivery"
ADD CONSTRAINT "NotificationDelivery_staffNotificationId_fkey" FOREIGN KEY ("staffNotificationId") REFERENCES "StaffNotification"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "NotificationDelivery_workflowRunId_fkey" FOREIGN KEY ("workflowRunId") REFERENCES "WorkflowRun"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "NotificationDelivery_recipientUserId_fkey" FOREIGN KEY ("recipientUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE,
ADD CONSTRAINT "NotificationDelivery_recipientEssPortalUserId_fkey" FOREIGN KEY ("recipientEssPortalUserId") REFERENCES "EssPortalUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
