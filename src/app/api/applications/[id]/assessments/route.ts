import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(_request, async (ctx) => {
    const { id: applicationId } = await params;

    const application = await ctx.run((tx) =>
      tx.application.findFirst({ where: ctx.where({ id: applicationId }), select: { id: true } }),
    );
    if (!application) return NextResponse.json({ error: 'Application not found.' }, { status: 404 });

    const [attempts, invites] = await ctx.run(async (tx) => {
      const a = await tx.applicationAssessmentAttempt.findMany({
        where: { applicationId },
        include: {
          template: { select: { id: true, name: true, kind: true, timeLimitMinutes: true, passingScorePercent: true } },
          answers: {
            include: { question: { select: { id: true, prompt: true, type: true, maxPoints: true } } },
          },
          _count: { select: { integrityEvents: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
      const i = await tx.externalAssessmentInvite.findMany({
        where: { applicationId },
        include: {
          externalAssessment: { select: { name: true } },
          connection: { select: { label: true } },
        },
        orderBy: { createdAt: 'asc' },
      });
      return [a, i];
    });

    return NextResponse.json({
      attempts: attempts.map((attempt) => ({
        id: attempt.id,
        kind: 'native' as const,
        templateName: attempt.template.name,
        templateKind: attempt.template.kind,
        status: attempt.status,
        scorePercent: attempt.scorePercent ? Number(attempt.scorePercent) : null,
        passed: attempt.passed,
        earnedPoints: attempt.earnedPoints,
        maxPoints: attempt.maxPoints,
        fitScore: attempt.fitScore ? Number(attempt.fitScore) : null,
        dimensionScores: attempt.dimensionScores,
        integrityScore: attempt.integrityScore,
        integrityFlags: attempt.integrityFlags,
        tabSwitchCount: attempt.tabSwitchCount,
        integrityEventCount: attempt._count.integrityEvents,
        needsManualGrading: attempt.needsManualGrading,
        startedAt: attempt.startedAt?.toISOString() ?? null,
        submittedAt: attempt.submittedAt?.toISOString() ?? null,
        clientIp: attempt.clientIp,
        accessUrl: `/careers/assessment/${attempt.accessToken}`,
        answers: attempt.answers.map((ans) => ({
          questionId: ans.questionId,
          question: ans.question.prompt,
          type: ans.question.type,
          maxPoints: ans.question.maxPoints,
          answer: ans.answer,
          filePath: ans.filePath,
          isCorrect: ans.isCorrect,
          pointsAwarded: ans.pointsAwarded,
          timeSpentSeconds: ans.timeSpentSeconds,
          gradedAt: ans.gradedAt?.toISOString() ?? null,
        })),
      })),
      externalInvites: invites.map((invite) => ({
        id: invite.id,
        kind: 'external' as const,
        name: invite.externalAssessment.name,
        provider: invite.provider,
        connectionLabel: invite.connection.label,
        status: invite.status,
        scorePercent: invite.scorePercent ? Number(invite.scorePercent) : null,
        normalizedResult: invite.normalizedResult,
        candidateUrl: invite.candidateUrl,
        invitedAt: invite.invitedAt?.toISOString() ?? null,
        completedAt: invite.completedAt?.toISOString() ?? null,
      })),
    });
  });
}
