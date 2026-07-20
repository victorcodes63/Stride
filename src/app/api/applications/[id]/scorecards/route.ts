import { NextRequest, NextResponse } from 'next/server';
import { withTenant } from '@/lib/tenant-api';

export type ApplicationScorecardItem = {
  id: string;
  interviewId: string;
  interviewerUserId: string;
  interviewerName: string | null;
  interviewScheduledAt: string | null;
  interviewType: string | null;
  technicalScore: number;
  communicationScore: number;
  cultureScore: number;
  decision: string;
  strengths: string | null;
  concerns: string | null;
  recommendationNotes: string | null;
  submittedAt: string;
};

export type ApplicationScorecardsResponse = {
  items: ApplicationScorecardItem[];
  summary: {
    count: number;
    avgTechnical: number | null;
    avgCommunication: number | null;
    avgCulture: number | null;
    avgOverall: number | null;
    decisions: Record<string, number>;
  };
};

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  return withTenant(request, async (ctx) => {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Application id required' }, { status: 400 });
    }

    const empty: ApplicationScorecardsResponse = {
      items: [],
      summary: {
        count: 0,
        avgTechnical: null,
        avgCommunication: null,
        avgCulture: null,
        avgOverall: null,
        decisions: {},
      },
    };

    if (!process.env.DATABASE_URL) {
      return NextResponse.json(empty);
    }

    try {
      const interviews = await ctx.run((tx) =>
        tx.interview.findMany({
          where: ctx.where({ applicationId: id }),
          include: { scorecards: true },
        }),
      );

      const flat = interviews.flatMap((iv) =>
        iv.scorecards.map((s) => ({ interview: iv, scorecard: s })),
      );

      if (flat.length === 0) {
        return NextResponse.json(empty);
      }

      const interviewerIds = [...new Set(flat.map((f) => f.scorecard.interviewerUserId))];
      const users = await ctx.run((tx) =>
        tx.user.findMany({
          where: { id: { in: interviewerIds } },
          select: { id: true, name: true },
        }),
      );
      const nameById = new Map(users.map((u) => [u.id, u.name]));

      const items: ApplicationScorecardItem[] = flat
        .map(({ interview, scorecard }) => ({
          id: scorecard.id,
          interviewId: interview.id,
          interviewerUserId: scorecard.interviewerUserId,
          interviewerName: nameById.get(scorecard.interviewerUserId) ?? null,
          interviewScheduledAt: interview.scheduledAt?.toISOString() ?? null,
          interviewType: interview.type ?? null,
          technicalScore: scorecard.technicalScore,
          communicationScore: scorecard.communicationScore,
          cultureScore: scorecard.cultureScore,
          decision: scorecard.decision,
          strengths: scorecard.strengths,
          concerns: scorecard.concerns,
          recommendationNotes: scorecard.recommendationNotes,
          submittedAt: scorecard.submittedAt.toISOString(),
        }))
        .sort((a, b) => (a.submittedAt < b.submittedAt ? 1 : -1));

      const count = items.length;
      const sum = (fn: (i: ApplicationScorecardItem) => number) =>
        items.reduce((acc, i) => acc + fn(i), 0);
      const decisions: Record<string, number> = {};
      for (const i of items) decisions[i.decision] = (decisions[i.decision] ?? 0) + 1;

      const avgTechnical = round1(sum((i) => i.technicalScore) / count);
      const avgCommunication = round1(sum((i) => i.communicationScore) / count);
      const avgCulture = round1(sum((i) => i.cultureScore) / count);
      const avgOverall = round1(
        sum((i) => i.technicalScore + i.communicationScore + i.cultureScore) / (count * 3),
      );

      const response: ApplicationScorecardsResponse = {
        items,
        summary: { count, avgTechnical, avgCommunication, avgCulture, avgOverall, decisions },
      };
      return NextResponse.json(response);
    } catch {
      return NextResponse.json(empty);
    }
  });
}
