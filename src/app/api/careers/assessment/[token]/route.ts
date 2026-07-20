import { NextRequest, NextResponse } from 'next/server';
import type { Prisma } from '@prisma/client';
import { computeScorePercent, scoreAssessmentAnswer } from '@/lib/assessment-scoring';
import { AssessmentTokenNotFoundError, withAssessmentAccessToken } from '@/lib/assessment-token-context';
import { selectPresentedQuestionIds, type TemplateShape } from '@/lib/assessments/attempt-presentation';
import { computeDimensionScores } from '@/lib/assessments/scoring-normalization';
import { percentToPercentile, percentToSten } from '@/lib/assessments/scoring-normalization';
import { computeFitScore } from '@/lib/assessments/competency-fit';
import { computeIntegrity } from '@/lib/assessments/integrity';
import { isDimensionType, isManualGraded, type QuestionScoringConfig } from '@/lib/assessments/types';

function clientIp(request: NextRequest): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() ?? null;
  return request.headers.get('x-real-ip');
}

function templateShape(template: {
  shuffleSections: boolean;
  shuffleQuestions: boolean;
  sections: Array<{ id: string; orderIndex: number; shuffleQuestions: boolean; pickCount: number | null; title: string; description: string | null; timeLimitMinutes: number | null }>;
  questions: Array<{ id: string; sectionId: string | null; orderIndex: number }>;
}): TemplateShape {
  return {
    shuffleSections: template.shuffleSections,
    shuffleQuestions: template.shuffleQuestions,
    sections: template.sections.map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      orderIndex: s.orderIndex,
      timeLimitMinutes: s.timeLimitMinutes,
      shuffleQuestions: s.shuffleQuestions,
      pickCount: s.pickCount,
    })),
    questions: template.questions.map((q) => ({ id: q.id, sectionId: q.sectionId, orderIndex: q.orderIndex })),
  };
}

export async function GET(_request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    return await withAssessmentAccessToken(token, async (tx) => {
      const attempt = await tx.applicationAssessmentAttempt.findUnique({
        where: { accessToken: token },
        include: {
          template: { include: { sections: { orderBy: { orderIndex: 'asc' } }, questions: { orderBy: { orderIndex: 'asc' } } } },
          application: { include: { job: { select: { title: true, company: true } } } },
          answers: true,
        },
      });
      if (!attempt) return NextResponse.json({ error: 'Assessment not found.' }, { status: 404 });

      const meta = {
        jobTitle: attempt.application.job.title,
        company: attempt.application.job.company,
        templateName: attempt.template.name,
        description: attempt.template.description,
        timeLimitMinutes: attempt.template.timeLimitMinutes,
        requireConsent: attempt.template.requireConsent,
        requireWebcam: attempt.template.requireWebcam,
        lockdown: attempt.template.lockdown,
        showResultsToCandidate: attempt.template.showResultsToCandidate,
      };

      if (attempt.status === 'submitted' || attempt.status === 'awaiting_review') {
        return NextResponse.json({
          ...meta,
          status: 'submitted',
          submittedAt: attempt.submittedAt?.toISOString() ?? null,
          scorePercent:
            attempt.template.showResultsToCandidate && attempt.scorePercent ? Number(attempt.scorePercent) : null,
        });
      }
      if (attempt.status === 'expired') {
        return NextResponse.json({ ...meta, status: 'expired' }, { status: 200 });
      }

      const now = new Date();
      if (attempt.expiresAt && attempt.expiresAt < now) {
        await tx.applicationAssessmentAttempt.update({ where: { id: attempt.id }, data: { status: 'expired' } });
        return NextResponse.json({ ...meta, status: 'expired' }, { status: 200 });
      }

      // Not started yet: require consent / explicit start (for webcam + proctoring setup).
      if (attempt.status === 'pending') {
        return NextResponse.json({
          ...meta,
          status: 'not_started',
          needsConsent: attempt.template.requireConsent && !attempt.consentAcceptedAt,
          sectionCount: attempt.template.sections.length,
          questionCount: attempt.template.questions.length,
        });
      }

      // in_progress: return presented questions (without answer keys) + saved answers.
      const presentedIds = selectPresentedQuestionIds(templateShape(attempt.template), attempt.accessToken);
      const byId = new Map(attempt.template.questions.map((q) => [q.id, q]));
      const savedByQ = new Map(attempt.answers.map((a) => [a.questionId, a.answer]));

      const questions = presentedIds
        .map((id) => byId.get(id))
        .filter((q): q is NonNullable<typeof q> => Boolean(q))
        .map((q) => ({
          id: q.id,
          sectionId: q.sectionId,
          type: q.type,
          prompt: q.prompt,
          options: q.options,
          mediaUrl: q.mediaUrl,
          maxPoints: q.maxPoints,
          required: q.required,
          scale: (q.scoring as QuestionScoringConfig | null)?.scale ?? null,
          savedAnswer: savedByQ.get(q.id) ?? null,
        }));

      const sections = attempt.template.sections.map((s) => ({
        id: s.id,
        title: s.title,
        description: s.description,
        timeLimitMinutes: s.timeLimitMinutes,
      }));

      return NextResponse.json({
        ...meta,
        status: 'in_progress',
        expiresAt: attempt.expiresAt?.toISOString() ?? null,
        sections,
        questions,
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
        include: {
          template: { include: { sections: true, questions: true } },
          application: { select: { jobId: true } },
          integrityEvents: { select: { type: true } },
        },
      });
      if (!attempt) return NextResponse.json({ error: 'Assessment not found.' }, { status: 404 });
      if (attempt.status === 'submitted' || attempt.status === 'awaiting_review') {
        return NextResponse.json({ error: 'Assessment already submitted.' }, { status: 409 });
      }
      if (attempt.status === 'expired') return NextResponse.json({ error: 'Assessment expired.' }, { status: 410 });

      const now = new Date();
      if (attempt.expiresAt && attempt.expiresAt < now) {
        await tx.applicationAssessmentAttempt.update({ where: { id: attempt.id }, data: { status: 'expired' } });
        return NextResponse.json({ error: 'Time limit exceeded.' }, { status: 410 });
      }

      const body = (await request.json()) as { answers?: unknown; timings?: Record<string, number> };
      const answersRaw = Array.isArray(body.answers) ? body.answers : [];
      const timings = (body.timings ?? {}) as Record<string, number>;
      const answerByQuestion = new Map<string, unknown>();
      for (const row of answersRaw) {
        if (row && typeof row === 'object' && 'questionId' in row) {
          const r = row as { questionId: string; answer?: unknown; filePath?: string };
          answerByQuestion.set(r.questionId, r.filePath ?? r.answer ?? null);
        }
      }

      // Only score the questions actually presented (respects pooling).
      const presentedIds = new Set(
        selectPresentedQuestionIds(
          {
            shuffleSections: attempt.template.shuffleSections,
            shuffleQuestions: attempt.template.shuffleQuestions,
            sections: attempt.template.sections.map((s) => ({
              id: s.id,
              title: s.title,
              description: s.description,
              orderIndex: s.orderIndex,
              timeLimitMinutes: s.timeLimitMinutes,
              shuffleQuestions: s.shuffleQuestions,
              pickCount: s.pickCount,
            })),
            questions: attempt.template.questions.map((q) => ({ id: q.id, sectionId: q.sectionId, orderIndex: q.orderIndex })),
          },
          attempt.accessToken,
        ),
      );
      const presented = attempt.template.questions.filter((q) => presentedIds.has(q.id));

      let earned = 0;
      let max = 0;
      let needsManualGrading = false;
      const dimensionItems: Array<{ scoring: QuestionScoringConfig | null; value: number | null }> = [];

      const answerRows = presented.map((question) => {
        const candidateAnswer = answerByQuestion.get(question.id) ?? null;
        const scoring = (question.scoring as QuestionScoringConfig | null) ?? null;

        if (isDimensionType(question.type)) {
          const value = candidateAnswer !== null ? Number(candidateAnswer) : null;
          dimensionItems.push({ scoring, value });
          return {
            organizationId: attempt.organizationId,
            attemptId: attempt.id,
            questionId: question.id,
            answer: candidateAnswer !== null ? ({ value: candidateAnswer } as object) : undefined,
            filePath: null,
            isCorrect: null,
            pointsAwarded: 0,
            timeSpentSeconds: timings[question.id] ?? null,
          };
        }

        max += question.maxPoints;
        if (isManualGraded(question.type)) needsManualGrading = true;
        const scored = scoreAssessmentAnswer(question.type, question.correctAnswer, candidateAnswer, question.maxPoints);
        earned += scored.pointsAwarded;
        return {
          organizationId: attempt.organizationId,
          attemptId: attempt.id,
          questionId: question.id,
          answer: candidateAnswer !== null ? ({ value: candidateAnswer } as object) : undefined,
          filePath: question.type === 'file' && typeof candidateAnswer === 'string' ? candidateAnswer : null,
          isCorrect: scored.isCorrect,
          pointsAwarded: scored.pointsAwarded,
          timeSpentSeconds: timings[question.id] ?? null,
        };
      });

      await tx.applicationAssessmentAnswer.deleteMany({ where: { attemptId: attempt.id } });
      for (const row of answerRows) {
        await tx.applicationAssessmentAnswer.create({ data: row as Prisma.ApplicationAssessmentAnswerUncheckedCreateInput });
      }

      const scorePercent = computeScorePercent(earned, max);
      const dimensions = computeDimensionScores(dimensionItems);
      const hasDimensions = Object.keys(dimensions).length > 0;

      // Competency fit against the job profile (if configured).
      let fitScore: number | null = null;
      if (hasDimensions) {
        const profile = await tx.jobCompetencyProfile.findUnique({ where: { jobId: attempt.application.jobId } });
        if (profile) fitScore = computeFitScore(dimensions, profile.weights as Record<string, number>);
      }

      const dimensionScores = hasDimensions
        ? {
            dimensions,
            percentile: percentToPercentile(scorePercent),
            sten: percentToSten(scorePercent),
          }
        : undefined;

      const integrity = computeIntegrity(attempt.integrityEvents);
      const passed =
        attempt.template.passingScorePercent != null && !needsManualGrading
          ? scorePercent >= attempt.template.passingScorePercent
          : null;

      await tx.applicationAssessmentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: needsManualGrading ? 'awaiting_review' : 'submitted',
          submittedAt: now,
          clientIp: clientIp(request),
          userAgent: request.headers.get('user-agent'),
          earnedPoints: earned,
          maxPoints: max,
          scorePercent,
          passed,
          needsManualGrading,
          dimensionScores: dimensionScores as Prisma.InputJsonValue | undefined,
          fitScore: fitScore ?? undefined,
          integrityScore: integrity.score,
          integrityFlags: integrity.flags as unknown as Prisma.InputJsonValue,
        },
      });

      return NextResponse.json({
        status: 'submitted',
        scorePercent: attempt.template.showResultsToCandidate ? scorePercent : null,
        awaitingReview: needsManualGrading,
      });
    });
  } catch (error) {
    if (error instanceof AssessmentTokenNotFoundError) {
      return NextResponse.json({ error: 'Assessment not found.' }, { status: 404 });
    }
    throw error;
  }
}
