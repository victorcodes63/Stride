import { Prisma } from '@prisma/client';
import { withOrgContext } from '@/lib/org-context';

/**
 * Governance: purge candidate PII / answers from submitted attempts whose template
 * retention window has elapsed. Score summaries are kept; free-text answers, IP,
 * user-agent, and integrity media are cleared. Idempotent (skips already-purged).
 */
export async function purgeExpiredAttempts(organizationId: string): Promise<number> {
  return withOrgContext(organizationId, async (tx) => {
    const templates = await tx.assessmentTemplate.findMany({
      where: { organizationId, retentionDays: { not: null } },
      select: { id: true, retentionDays: true },
    });

    let purged = 0;
    for (const template of templates) {
      const cutoff = new Date(Date.now() - (template.retentionDays ?? 0) * 24 * 60 * 60 * 1000);
      const attempts = await tx.applicationAssessmentAttempt.findMany({
        where: {
          templateId: template.id,
          status: { in: ['submitted', 'awaiting_review', 'expired'] },
          submittedAt: { lte: cutoff },
          purgedAt: null,
        },
        select: { id: true },
      });
      for (const attempt of attempts) {
        await tx.applicationAssessmentAnswer.updateMany({
          where: { attemptId: attempt.id },
          data: { answer: Prisma.DbNull, filePath: null, graderNote: null },
        });
        await tx.attemptIntegrityEvent.deleteMany({ where: { attemptId: attempt.id } });
        await tx.applicationAssessmentAttempt.update({
          where: { id: attempt.id },
          data: { clientIp: null, userAgent: null, integrityFlags: Prisma.DbNull, purgedAt: new Date() },
        });
        purged += 1;
      }
    }
    return purged;
  });
}
