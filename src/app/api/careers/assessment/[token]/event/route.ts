import { NextRequest, NextResponse } from 'next/server';
import type { IntegrityEventType, Prisma } from '@prisma/client';
import { AssessmentTokenNotFoundError, withAssessmentAccessToken } from '@/lib/assessment-token-context';

const VALID: IntegrityEventType[] = [
  'tab_blur',
  'tab_focus',
  'copy',
  'paste',
  'paste_blocked',
  'right_click',
  'fullscreen_enter',
  'fullscreen_exit',
  'window_resize',
  'webcam_snapshot',
  'face_missing',
  'multiple_faces',
];

/** Record a proctoring/integrity signal for the in-progress attempt. */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  try {
    return await withAssessmentAccessToken(token, async (tx) => {
      const attempt = await tx.applicationAssessmentAttempt.findUnique({
        where: { accessToken: token },
        select: { id: true, organizationId: true, status: true, tabSwitchCount: true },
      });
      if (!attempt) return NextResponse.json({ error: 'Assessment not found.' }, { status: 404 });
      if (attempt.status !== 'in_progress') return NextResponse.json({ ok: false });

      const body = (await request.json()) as { type?: string; detail?: unknown; mediaUrl?: string };
      const type = body.type as IntegrityEventType;
      if (!VALID.includes(type)) return NextResponse.json({ error: 'Unknown event type.' }, { status: 400 });

      await tx.attemptIntegrityEvent.create({
        data: {
          organizationId: attempt.organizationId,
          attemptId: attempt.id,
          type,
          detail: (body.detail ?? undefined) as Prisma.InputJsonValue | undefined,
          mediaUrl: typeof body.mediaUrl === 'string' ? body.mediaUrl : null,
        },
      });

      if (type === 'tab_blur') {
        await tx.applicationAssessmentAttempt.update({
          where: { id: attempt.id },
          data: { tabSwitchCount: { increment: 1 }, lastActivityAt: new Date() },
        });
      }
      return NextResponse.json({ ok: true });
    });
  } catch (error) {
    if (error instanceof AssessmentTokenNotFoundError) {
      return NextResponse.json({ error: 'Assessment not found.' }, { status: 404 });
    }
    throw error;
  }
}
