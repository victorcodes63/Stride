import { NextRequest, NextResponse } from 'next/server';
import type { AtsOfferDecision } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireStaffUser } from '@/lib/staff-api-auth';
import { forbiddenResponse, unauthorizedResponse } from '@/lib/demo-route-access';
import { canSubmitScorecards, getAtsEntityJobWhere } from '@/lib/ats-governance';
import { logAuditEvent } from '@/lib/audit-events';

const VALID_DECISIONS: AtsOfferDecision[] = ['strong_yes', 'yes', 'hold', 'no'];

function validScore(value: unknown): number | null {
  const num = Number(value);
  if (!Number.isInteger(num) || num < 1 || num > 5) return null;
  return num;
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (!canSubmitScorecards(user)) return forbiddenResponse();
  const { id: interviewId } = await params;

  const interview = await prisma.interview.findFirst({
    where: { id: interviewId, application: { job: { ...(getAtsEntityJobWhere(request) ?? {}) } } },
    select: { id: true },
  });
  if (!interview) return NextResponse.json({ error: 'Interview not found.' }, { status: 404 });

  const scorecards = await prisma.interviewScorecard.findMany({
    where: { interviewId },
    orderBy: { submittedAt: 'desc' },
  });
  return NextResponse.json(scorecards);
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await requireStaffUser(request);
  if (!user) return unauthorizedResponse();
  if (!canSubmitScorecards(user)) return forbiddenResponse();
  const { id: interviewId } = await params;
  const interview = await prisma.interview.findFirst({
    where: { id: interviewId, application: { job: { ...(getAtsEntityJobWhere(request) ?? {}) } } },
    include: { application: { select: { jobId: true } } },
  });
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
    return NextResponse.json({ error: 'Scores must be 1-5 and decision must be one of strong_yes, yes, hold, no.' }, { status: 400 });
  }

  const scorecard = await prisma.interviewScorecard.upsert({
    where: { interviewId_interviewerUserId: { interviewId, interviewerUserId: user.id } },
    create: {
      interviewId,
      interviewerUserId: user.id,
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
  });
  await logAuditEvent({
    actor: { userId: user.id, email: user.email, name: user.name },
    action: 'ats.scorecard.submitted',
    entityType: 'Interview',
    entityId: interviewId,
    route: 'POST /api/interviews/[id]/scorecards',
    metadata: { scorecardId: scorecard.id, jobId: interview.application.jobId },
  });
  return NextResponse.json(scorecard, { status: 201 });
}
