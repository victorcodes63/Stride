import { randomBytes } from 'crypto';
import type { ApplicationStatus, PrismaClient } from '@prisma/client';
import { withOrgContext } from '@/lib/org-context';

export function generateAssessmentAccessToken(): string {
  return randomBytes(24).toString('base64url');
}

export async function createAssessmentAttemptsForApplication(
  _db: PrismaClient,
  input: {
    applicationId: string;
    jobId: string;
    organizationId: string;
    applicationStatus: ApplicationStatus;
  },
): Promise<Array<{ templateId: string; accessToken: string; templateName: string }>> {
  return withOrgContext(input.organizationId, async (db) => {
  const assignments = await db.jobAssessmentAssignment.findMany({
    where: { jobId: input.jobId },
    include: { template: { select: { id: true, name: true, isActive: true, timeLimitMinutes: true } } },
  });

  const created: Array<{ templateId: string; accessToken: string; templateName: string }> = [];
  for (const assignment of assignments) {
    if (!assignment.template.isActive) continue;
    const trigger = assignment.triggerStatus;
    if (trigger && trigger !== input.applicationStatus) continue;

    const existing = await db.applicationAssessmentAttempt.findUnique({
      where: {
        applicationId_templateId: {
          applicationId: input.applicationId,
          templateId: assignment.templateId,
        },
      },
    });
    if (existing) continue;

    const accessToken = generateAssessmentAccessToken();
    await db.applicationAssessmentAttempt.create({
      data: {
        organizationId: input.organizationId,
        applicationId: input.applicationId,
        templateId: assignment.templateId,
        accessToken,
        status: 'pending',
      },
    });
    created.push({
      templateId: assignment.templateId,
      accessToken,
      templateName: assignment.template.name,
    });
  }
  return created;
  });
}
