import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(_request, async (ctx) => {
    const { id: applicationId } = await params;

    const application = await ctx.run((tx) =>
      tx.application.findFirst({
        where: ctx.where({ id: applicationId }),
        select: { id: true },
      }),
    );
    if (!application) return NextResponse.json({ error: 'Application not found.' }, { status: 404 });

    const attempts = await ctx.run((tx) =>
      tx.applicationAssessmentAttempt.findMany({
        where: { applicationId },
        include: {
          template: { select: { id: true, name: true, timeLimitMinutes: true } },
          answers: {
            include: { question: { select: { id: true, prompt: true, type: true, maxPoints: true } } },
          },
        },
        orderBy: { createdAt: 'asc' },
      }),
    );

    return NextResponse.json(
      attempts.map((attempt) => ({
        id: attempt.id,
        templateName: attempt.template.name,
        status: attempt.status,
        scorePercent: attempt.scorePercent ? Number(attempt.scorePercent) : null,
        earnedPoints: attempt.earnedPoints,
        maxPoints: attempt.maxPoints,
        startedAt: attempt.startedAt?.toISOString() ?? null,
        submittedAt: attempt.submittedAt?.toISOString() ?? null,
        clientIp: attempt.clientIp,
        accessUrl: `/careers/assessment/${attempt.accessToken}`,
        answers: attempt.answers.map((a) => ({
          question: a.question.prompt,
          type: a.question.type,
          answer: a.answer,
          filePath: a.filePath,
          isCorrect: a.isCorrect,
          pointsAwarded: a.pointsAwarded,
        })),
      })),
    );
  });
}
