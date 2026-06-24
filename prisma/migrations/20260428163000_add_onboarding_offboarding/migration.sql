-- CreateEnum
CREATE TYPE "WorkflowType" AS ENUM ('ONBOARDING', 'OFFBOARDING');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "OnboardingTaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED', 'OVERDUE');

-- CreateTable
CREATE TABLE "OnboardingTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "WorkflowType" NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "OnboardingTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingTemplateStep" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assignedRole" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "dueDaysOffset" INTEGER NOT NULL DEFAULT 3,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "category" TEXT,
    CONSTRAINT "OnboardingTemplateStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingWorkflow" (
    "id" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "type" "WorkflowType" NOT NULL,
    "status" "WorkflowStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "OnboardingWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OnboardingTask" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assignedRole" TEXT NOT NULL,
    "assignedToId" TEXT,
    "category" TEXT,
    "order" INTEGER NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "dueDate" TIMESTAMP(3),
    "status" "OnboardingTaskStatus" NOT NULL DEFAULT 'PENDING',
    "completedAt" TIMESTAMP(3),
    "completedById" TEXT,
    "notes" TEXT,
    "documentId" TEXT,
    CONSTRAINT "OnboardingTask_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OnboardingTemplateStep_templateId_order_idx" ON "OnboardingTemplateStep"("templateId", "order");
CREATE INDEX "OnboardingWorkflow_employeeId_idx" ON "OnboardingWorkflow"("employeeId");
CREATE INDEX "OnboardingWorkflow_status_idx" ON "OnboardingWorkflow"("status");
CREATE INDEX "OnboardingTask_workflowId_order_idx" ON "OnboardingTask"("workflowId", "order");
CREATE INDEX "OnboardingTask_assignedRole_status_idx" ON "OnboardingTask"("assignedRole", "status");
CREATE INDEX "OnboardingTask_assignedToId_status_idx" ON "OnboardingTask"("assignedToId", "status");

-- AddForeignKey
ALTER TABLE "OnboardingTemplateStep" ADD CONSTRAINT "OnboardingTemplateStep_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "OnboardingTemplate"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnboardingWorkflow" ADD CONSTRAINT "OnboardingWorkflow_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "Employee"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnboardingWorkflow" ADD CONSTRAINT "OnboardingWorkflow_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "OnboardingTemplate"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "OnboardingTask" ADD CONSTRAINT "OnboardingTask_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "OnboardingWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OnboardingTask" ADD CONSTRAINT "OnboardingTask_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "OnboardingTask" ADD CONSTRAINT "OnboardingTask_completedById_fkey" FOREIGN KEY ("completedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
