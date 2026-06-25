import { NextRequest, NextResponse } from 'next/server';
import { computeScorePercent, scoreAssessmentAnswer } from '@/lib/assessment-scoring';
import {
  AssessmentTokenNotFoundError,
  withAssessmentAccessToken,
} from '@/lib/assessment-token-context';

function clientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? null;
  return request.headers.get('x-real-ip');
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    return await withAssessmentAccessToken(token, async (tx) => {
      const attempt = await tx.applicationAssessmentAttempt.findUnique({
        where: { accessToken: token },
        include: {
          template: {
            include: { questions: { orderBy: { orderIndex: 'asc' } } },
          },
          application: { include: { job: { select: { title: true, company: true } } } },
        },
      });
      if (!attempt) return NextResponse.json({ error: 'Assessment not found.' }, { status: 404 });

      if (attempt.status === 'submitted') {
        return NextResponse.json({
          status: attempt.status,
          submittedAt: attempt.submittedAt?.toISOString() ?? null,
          scorePercent: attempt.scorePercent ? Number(attempt.scorePercent) : null,
          jobTitle: attempt.application.job.title,
          company: attempt.application.job.company,
        });
      }
      if (attempt.status === 'expired') {
        return NextResponse.json({ error: 'This assessment has expired.', status: 'expired' }, { status: 410 });
      }

      const now = new Date();
      if (attempt.expiresAt && attempt.expiresAt < now) {
        await tx.applicationAssessmentAttempt.update({
          where: { id: attempt.id },
          data: { status: 'expired' },
        });
        return NextResponse.json({ error: 'Time limit exceeded.', status: 'expired' }, { status: 410 });
      }

      if (!attempt.startedAt) {
        const expiresAt = new Date(now.getTime() + attempt.template.timeLimitMinutes * 60_000);
        await tx.applicationAssessmentAttempt.update({
          where: { id: attempt.id },
          data: { status: 'in_progress', startedAt: now, expiresAt },
        });
        attempt.startedAt = now;
        attempt.expiresAt = expiresAt;
        attempt.status = 'in_progress';
      }

      return NextResponse.json({
        status: attempt.status,
        jobTitle: attempt.application.job.title,
        company: attempt.application.job.company,
        templateName: attempt.template.name,
        description: attempt.template.description,
        timeLimitMinutes: attempt.template.timeLimitMinutes,
        expiresAt: attempt.expiresAt?.toISOString() ?? null,
        questions: attempt.template.questions.map((q) => ({
          id: q.id,
          type: q.type,
          prompt: q.prompt,
          options: q.options,
          maxPoints: q.maxPoints,
        })),
      });
    });
  } catch (error) {
    if (error instanceof AssessmentTokenNotFoundError) {
      return NextResponse.json({ error: 'Assessment not found.' }, { status: 404 });
    }
    throw error;
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    return await withAssessmentAccessToken(token, async (tx) => {
      const attempt = await tx.applicationAssessmentAttempt.findUnique({
        where: { accessToken: token },
        include: { template: { include: { questions: true } } },
      });
      if (!attempt) return NextResponse.json({ error: 'Assessment not found.' }, { status: 404 });
      if (attempt.status === 'submitted') {
        return NextResponse.json({ error: 'Assessment already submitted.' }, { status: 409 });
      }
      if (attempt.status === 'expired') {
        return NextResponse.json({ error: 'Assessment expired.' }, { status: 410 });
      }

      const now = new Date();
      if (attempt.expiresAt && attempt.expiresAt < now) {
        await tx.applicationAssessmentAttempt.update({
          where: { id: attempt.id },
          data: { status: 'expired' },
        });
        return NextResponse.json({ error: 'Time limit exceeded.' }, { status: 410 });
      }

      const body = (await request.json()) as Record<string, unknown>;
      const answersRaw = Array.isArray(body.answers) ? body.answers : [];
      const answerByQuestion = new Map<string, unknown>();
      for (const row of answersRaw) {
        if (row && typeof row === 'object' && 'questionId' in row) {
          const r = row as { questionId: string; answer?: unknown; filePath?: string };
          answerByQuestion.set(r.questionId, r.filePath ?? r.answer ?? null);
        }
      }

      let earned = 0;
      let max = 0;
      const answerRows = attempt.template.questions.map((question) => {
        max += question.maxPoints;
        const candidateAnswer = answerByQuestion.get(question.id) ?? null;
        const scored = scoreAssessmentAnswer(
          question.type,
          question.correctAnswer,
          candidateAnswer,
          question.maxPoints,
        );
        earned += scored.pointsAwarded;
        return {
          organizationId: attempt.organizationId,
          attemptId: attempt.id,
          questionId: question.id,
          answer: candidateAnswer !== null ? ({ value: candidateAnswer } as object) : undefined,
          filePath: question.type === 'file' && typeof candidateAnswer === 'string' ? candidateAnswer : null,
          isCorrect: scored.isCorrect,
          pointsAwarded: scored.pointsAwarded,
        };
      });

      await tx.applicationAssessmentAnswer.deleteMany({ where: { attemptId: attempt.id } });
      for (const row of answerRows) {
        await tx.applicationAssessmentAnswer.create({ data: row });
      }
      await tx.applicationAssessmentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'submitted',
          submittedAt: now,
          clientIp: clientIp(request),
          earnedPoints: earned,
          maxPoints: max,
          scorePercent: computeScorePercent(earned, max),
        },
      });

      return NextResponse.json({
        status: 'submitted',
        scorePercent: computeScorePercent(earned, max),
        earnedPoints: earned,
        maxPoints: max,
      });
    });
  } catch (error) {
    if (error instanceof AssessmentTokenNotFoundError) {
      return NextResponse.json({ error: 'Assessment not found.' }, { status: 404 });
    }
    throw error;
  }
}
