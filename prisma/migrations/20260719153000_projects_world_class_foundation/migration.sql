-- CreateEnum
CREATE TYPE "ProjectHealth" AS ENUM ('on_track', 'at_risk', 'off_track');

-- CreateEnum
CREATE TYPE "ProjectActivityType" AS ENUM ('created', 'updated', 'status_changed', 'comment', 'assignee_changed', 'milestone_changed', 'attachment_added', 'task_completed', 'due_date_changed', 'dependency_added', 'label_added');

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "archivedAt" TIMESTAMP(3),
ADD COLUMN     "color" TEXT,
ADD COLUMN     "health" "ProjectHealth" NOT NULL DEFAULT 'on_track';

-- AlterTable
ALTER TABLE "ProjectMilestone" ADD COLUMN     "color" TEXT,
ADD COLUMN     "progress" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ProjectTask" ADD COLUMN     "estimateHours" DECIMAL(8,2),
ADD COLUMN     "parentTaskId" TEXT,
ADD COLUMN     "progress" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "startDate" DATE;

-- CreateTable
CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectLabel" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "projectId" TEXT,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6b7280',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTaskLabel" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "taskId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectTaskLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTaskDependency" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "blockingTaskId" TEXT NOT NULL,
    "blockedTaskId" TEXT NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectTaskDependency_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectComment" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "mentions" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectAttachment" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "contentType" TEXT,
    "uploadedByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectActivity" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "type" "ProjectActivityType" NOT NULL,
    "actorUserId" TEXT,
    "summary" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProjectActivity_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProjectTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "blueprint" JSONB NOT NULL,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProjectTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProjectMember_projectId_idx" ON "ProjectMember"("projectId");

-- CreateIndex
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");

-- CreateIndex
CREATE INDEX "ProjectMember_organizationId_idx" ON "ProjectMember"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");

-- CreateIndex
CREATE INDEX "ProjectLabel_organizationId_idx" ON "ProjectLabel"("organizationId");

-- CreateIndex
CREATE INDEX "ProjectLabel_projectId_idx" ON "ProjectLabel"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectLabel_organizationId_projectId_name_key" ON "ProjectLabel"("organizationId", "projectId", "name");

-- CreateIndex
CREATE INDEX "ProjectTaskLabel_taskId_idx" ON "ProjectTaskLabel"("taskId");

-- CreateIndex
CREATE INDEX "ProjectTaskLabel_labelId_idx" ON "ProjectTaskLabel"("labelId");

-- CreateIndex
CREATE INDEX "ProjectTaskLabel_organizationId_idx" ON "ProjectTaskLabel"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTaskLabel_taskId_labelId_key" ON "ProjectTaskLabel"("taskId", "labelId");

-- CreateIndex
CREATE INDEX "ProjectTaskDependency_blockingTaskId_idx" ON "ProjectTaskDependency"("blockingTaskId");

-- CreateIndex
CREATE INDEX "ProjectTaskDependency_blockedTaskId_idx" ON "ProjectTaskDependency"("blockedTaskId");

-- CreateIndex
CREATE INDEX "ProjectTaskDependency_organizationId_idx" ON "ProjectTaskDependency"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "ProjectTaskDependency_blockingTaskId_blockedTaskId_key" ON "ProjectTaskDependency"("blockingTaskId", "blockedTaskId");

-- CreateIndex
CREATE INDEX "ProjectComment_projectId_createdAt_idx" ON "ProjectComment"("projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ProjectComment_taskId_createdAt_idx" ON "ProjectComment"("taskId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ProjectComment_authorUserId_idx" ON "ProjectComment"("authorUserId");

-- CreateIndex
CREATE INDEX "ProjectComment_organizationId_idx" ON "ProjectComment"("organizationId");

-- CreateIndex
CREATE INDEX "ProjectAttachment_projectId_idx" ON "ProjectAttachment"("projectId");

-- CreateIndex
CREATE INDEX "ProjectAttachment_taskId_idx" ON "ProjectAttachment"("taskId");

-- CreateIndex
CREATE INDEX "ProjectAttachment_organizationId_idx" ON "ProjectAttachment"("organizationId");

-- CreateIndex
CREATE INDEX "ProjectActivity_organizationId_projectId_createdAt_idx" ON "ProjectActivity"("organizationId", "projectId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ProjectActivity_taskId_idx" ON "ProjectActivity"("taskId");

-- CreateIndex
CREATE INDEX "ProjectTemplate_organizationId_idx" ON "ProjectTemplate"("organizationId");

-- CreateIndex
CREATE INDEX "ProjectTask_parentTaskId_idx" ON "ProjectTask"("parentTaskId");

-- AddForeignKey
ALTER TABLE "ProjectTask" ADD CONSTRAINT "ProjectTask_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "ProjectTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectMember" ADD CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectLabel" ADD CONSTRAINT "ProjectLabel_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTaskLabel" ADD CONSTRAINT "ProjectTaskLabel_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ProjectTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTaskLabel" ADD CONSTRAINT "ProjectTaskLabel_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "ProjectLabel"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTaskDependency" ADD CONSTRAINT "ProjectTaskDependency_blockingTaskId_fkey" FOREIGN KEY ("blockingTaskId") REFERENCES "ProjectTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectTaskDependency" ADD CONSTRAINT "ProjectTaskDependency_blockedTaskId_fkey" FOREIGN KEY ("blockedTaskId") REFERENCES "ProjectTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectComment" ADD CONSTRAINT "ProjectComment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectComment" ADD CONSTRAINT "ProjectComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ProjectTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectComment" ADD CONSTRAINT "ProjectComment_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAttachment" ADD CONSTRAINT "ProjectAttachment_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAttachment" ADD CONSTRAINT "ProjectAttachment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ProjectTask"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectAttachment" ADD CONSTRAINT "ProjectAttachment_uploadedByUserId_fkey" FOREIGN KEY ("uploadedByUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectActivity" ADD CONSTRAINT "ProjectActivity_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectActivity" ADD CONSTRAINT "ProjectActivity_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "ProjectTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProjectActivity" ADD CONSTRAINT "ProjectActivity_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
