import { NextRequest, NextResponse } from 'next/server';
import { AssessmentTokenNotFoundError, withAssessmentAccessToken } from '@/lib/assessment-token-context';

/** Candidate accepts consent (if required) and starts the timed attempt. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    return await withAssessmentAccessToken(token, async (tx) => {
      const attempt = await tx.applicationAssessmentAttempt.findUnique({
        where: { accessToken: token },
        include: { template: { select: { timeLimitMinutes: true, requireConsent: true } } },
      });
      if (!attempt) return NextResponse.json({ error: 'Assessment not found.' }, { status: 404 });
      if (attempt.status === 'submitted' || attempt.status === 'awaiting_review') {
        return NextResponse.json({ error: 'Assessment already submitted.' }, { status: 409 });
      }
      if (attempt.status === 'expired') return NextResponse.json({ error: 'Assessment expired.' }, { status: 410 });

      const body = (await request.json().catch(() => ({}))) as { consent?: boolean; locale?: string };
      if (attempt.template.requireConsent && !attempt.consentAcceptedAt && !body.consent) {
        return NextResponse.json({ error: 'Consent is required to begin.' }, { status: 400 });
      }

      const now = new Date();
      // Idempotent: if already in progress, keep the original timer.
      if (attempt.status === 'in_progress' && attempt.startedAt) {
        return NextResponse.json({ status: 'in_progress', expiresAt: attempt.expiresAt?.toISOString() ?? null });
      }

      const expiresAt = new Date(now.getTime() + attempt.template.timeLimitMinutes * 60_000);
      await tx.applicationAssessmentAttempt.update({
        where: { id: attempt.id },
        data: {
          status: 'in_progress',
          startedAt: now,
          expiresAt,
          lastActivityAt: now,
          consentAcceptedAt: attempt.consentAcceptedAt ?? (body.consent ? now : null),
          locale: body.locale?.slice(0, 12) ?? null,
          userAgent: request.headers.get('user-agent'),
        },
      });

      return NextResponse.json({ status: 'in_progress', expiresAt: expiresAt.toISOString() });
    });
  } catch (error) {
    if (error instanceof AssessmentTokenNotFoundError) {
      return NextResponse.json({ error: 'Assessment not found.' }, { status: 404 });
    }
    throw error;
  }
}
