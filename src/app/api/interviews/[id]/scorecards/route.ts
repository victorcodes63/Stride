import { NextRequest, NextResponse } from 'next/server';
import type { AtsOfferDecision } from '@prisma/client';
import { forbiddenResponse } from '@/lib/demo-route-access';
import { canSubmitScorecards } from '@/lib/ats-governance';
import { withTenant } from '@/lib/tenant-api';

const VALID_DECISIONS: AtsOfferDecision[] = ['strong_yes', 'yes', 'hold', 'no'];

function validScore(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isInteger(num) || num < 1 || num > 5) return null;
  return num;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    if (!canSubmitScorecards(ctx.staff)) return forbiddenResponse();
    const { id: interviewId } = await params;

    const interview = await ctx.run((tx) =>
      tx.interview.findFirst({
        where: ctx.where({ id: interviewId }),
        select: { id: true },
      }),
    );
    if (!interview) return NextResponse.json({ error: 'Interview not found.' }, { status: 404 });

    const scorecards = await ctx.run((tx) =>
      tx.interviewScorecard.findMany({
        where: ctx.where({ interviewId }),
        orderBy: { submittedAt: 'desc' },
      }),
    );
    return NextResponse.json(scorecards);
  });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return withTenant(request, async (ctx) => {
    if (!canSubmitScorecards(ctx.staff)) return forbiddenResponse();
    const { id: interviewId } = await params;
    const interview = await ctx.run((tx) =>
      tx.interview.findFirst({
        where: ctx.where({ id: interviewId }),
        include: { application: { select: { jobId: true } } },
      }),
    );
    if (!interview) return NextResponse.json({ error: 'Interview not found.' }, { status: 404 });

    const body = (await request.json().catch(() => null)) as {
      technicalScore?: unknown;
      communicationScore?: unknown;
      cultureScore?: unknown;
      decision?: AtsOfferDecision;
      strengths?: string;
      concerns?: string;
      recommendationNotes?: string;
    } | null;
    const technicalScore = validScore(body?.technicalScore);
    const communicationScore = validScore(body?.communicationScore);
    const cultureScore = validScore(body?.cultureScore);
    const decision = body?.decision;
    if (!technicalScore || !communicationScore || !cultureScore || !decision || !VALID_DECISIONS.includes(decision)) {
      return NextResponse.json(
        { error: 'Scores must be 1-5 and decision must be one of strong_yes, yes, hold, no.' },
        { status: 400 },
      );
    }

    const scorecard = await ctx.run((tx) =>
      tx.interviewScorecard.upsert({
        where: { interviewId_interviewerUserId: { interviewId, interviewerUserId: ctx.staff.id } },
        create: {
          organizationId: ctx.organizationId,
          interviewId,
          interviewerUserId: ctx.staff.id,
          technicalScore,
          communicationScore,
          cultureScore,
          decision,
          strengths: body?.strengths?.trim() || null,
          concerns: body?.concerns?.trim() || null,
          recommendationNotes: body?.recommendationNotes?.trim() || null,
        },
        update: {
          technicalScore,
          communicationScore,
          cultureScore,
          decision,
          strengths: body?.strengths?.trim() || null,
          concerns: body?.concerns?.trim() || null,
          recommendationNotes: body?.recommendationNotes?.trim() || null,
          submittedAt: new Date(),
        },
      }),
    );
    await ctx.audit({
      action: 'ats.scorecard.submitted',
      entityType: 'Interview',
      entityId: interviewId,
      route: 'POST /api/interviews/[id]/scorecards',
      metadata: { scorecardId: scorecard.id, jobId: interview.application.jobId },
    });
    return NextResponse.json(scorecard, { status: 201 });
  });
}
