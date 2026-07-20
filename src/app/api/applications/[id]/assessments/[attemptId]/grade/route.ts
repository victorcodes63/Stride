import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';
import { computeScorePercent } from '@/lib/assessment-scoring';

/**
 * Manual grading for open-ended answers. Body: { grades: [{ questionId, pointsAwarded, note? }] }.
 * Recomputes the attempt score and clears the awaiting_review flag when fully graded.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; attemptId: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id: applicationId, attemptId } = await params;
    const body = (await request.json()) as { grades?: Array<{ questionId: string; pointsAwarded: number; note?: string }> };
    const grades = Array.isArray(body.grades) ? body.grades : [];

    const attempt = await ctx.run((tx) =>
      tx.applicationAssessmentAttempt.findFirst({
        where: ctx.where({ id: attemptId, applicationId }),
        include: { answers: { include: { question: { select: { maxPoints: true } } } } },
      }),
    );
    if (!attempt) return NextResponse.json({ error: 'Attempt not found.' }, { status: 404 });

    const result = await ctx.run(async (tx) => {
      for (const grade of grades) {
        const answer = attempt.answers.find((a) => a.questionId === grade.questionId);
        if (!answer) continue;
        const capped = Math.max(0, Math.min(grade.pointsAwarded, answer.question.maxPoints));
        await tx.applicationAssessmentAnswer.update({
          where: { id: answer.id },
          data: {
            pointsAwarded: capped,
            isCorrect: capped >= answer.question.maxPoints,
            gradedByUserId: ctx.staff.id,
            gradedAt: new Date(),
            graderNote: grade.note?.trim() || null,
          },
        });
      }

      // Recompute totals from fresh answer rows.
      const answers = await tx.applicationAssessmentAnswer.findMany({
        where: { attemptId },
        include: { question: { select: { maxPoints: true } } },
      });
      const earned = answers.reduce((sum, a) => sum + (a.pointsAwarded ?? 0), 0);
      const max = answers.reduce((sum, a) => sum + a.question.maxPoints, 0);
      const stillNeedsGrading = answers.some((a) => a.isCorrect === null);
      const scorePercent = computeScorePercent(earned, max);

      const template = await tx.assessmentTemplate.findUnique({
        where: { id: attempt.templateId },
        select: { passingScorePercent: true },
      });
      const passed =
        template?.passingScorePercent != null ? scorePercent >= template.passingScorePercent : null;

      return tx.applicationAssessmentAttempt.update({
        where: { id: attemptId },
        data: {
          earnedPoints: earned,
          maxPoints: max,
          scorePercent,
          passed,
          needsManualGrading: stillNeedsGrading,
          status: stillNeedsGrading ? 'awaiting_review' : 'submitted',
          gradedAt: new Date(),
        },
        select: { id: true, scorePercent: true, earnedPoints: true, maxPoints: true, needsManualGrading: true, passed: true },
      });
    });

    await ctx.audit({ action: 'ats.assessment.graded', entityType: 'ApplicationAssessmentAttempt', entityId: attemptId });
    return NextResponse.json(result);
  });
}
