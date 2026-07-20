import { NextRequest, NextResponse } from 'next/server';
import { AssessmentTokenNotFoundError, withAssessmentAccessToken } from '@/lib/assessment-token-context';

/** Autosave in-progress answers so a candidate can resume after a reload/disconnect. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    return await withAssessmentAccessToken(token, async (tx) => {
      const attempt = await tx.applicationAssessmentAttempt.findUnique({
        where: { accessToken: token },
        select: { id: true, organizationId: true, status: true, expiresAt: true },
      });
      if (!attempt) return NextResponse.json({ error: 'Assessment not found.' }, { status: 404 });
      if (attempt.status !== 'in_progress') return NextResponse.json({ ok: false, reason: 'not_in_progress' });
      if (attempt.expiresAt && attempt.expiresAt < new Date()) {
        return NextResponse.json({ ok: false, reason: 'expired' });
      }

      const body = (await request.json()) as { answers?: Array<{ questionId: string; answer?: unknown }> };
      const answers = Array.isArray(body.answers) ? body.answers : [];

      for (const a of answers) {
        if (!a.questionId) continue;
        const value = a.answer ?? null;
        await tx.applicationAssessmentAnswer.upsert({
          where: { attemptId_questionId: { attemptId: attempt.id, questionId: a.questionId } },
          create: {
            organizationId: attempt.organizationId,
            attemptId: attempt.id,
            questionId: a.questionId,
            answer: value !== null ? ({ value } as object) : undefined,
          },
          update: { answer: value !== null ? ({ value } as object) : undefined },
        });
      }

      await tx.applicationAssessmentAttempt.update({
        where: { id: attempt.id },
        data: { lastActivityAt: new Date() },
      });
      return NextResponse.json({ ok: true, saved: answers.length });
    });
  } catch (error) {
    if (error instanceof AssessmentTokenNotFoundError) {
      return NextResponse.json({ error: 'Assessment not found.' }, { status: 404 });
    }
    throw error;
  }
}
