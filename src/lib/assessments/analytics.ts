import { withOrgContext } from '@/lib/org-context';

export type ItemAnalysisRow = {
  questionId: string;
  prompt: string;
  type: string;
  attempts: number;
  /** Proportion answered correctly (0-1) — difficulty index. */
  difficultyIndex: number | null;
  /** Point-biserial-style discrimination: top third vs bottom third correctness gap. */
  discrimination: number | null;
  avgTimeSeconds: number | null;
};

export type TemplateAnalytics = {
  templateId: string;
  templateName: string;
  attempts: number;
  completed: number;
  completionRate: number;
  avgScorePercent: number | null;
  passRate: number | null;
  avgDurationMinutes: number | null;
  scoreDistribution: number[]; // 10 buckets 0-10,10-20,...
  items: ItemAnalysisRow[];
};

export async function computeTemplateAnalytics(
  organizationId: string,
  templateId: string,
): Promise<TemplateAnalytics | null> {
  return withOrgContext(organizationId, async (tx) => {
    const template = await tx.assessmentTemplate.findFirst({
      where: { id: templateId, organizationId },
      select: { id: true, name: true, passingScorePercent: true },
    });
    if (!template) return null;

    const attempts = await tx.applicationAssessmentAttempt.findMany({
      where: { templateId },
      select: {
        id: true,
        status: true,
        scorePercent: true,
        passed: true,
        startedAt: true,
        submittedAt: true,
      },
    });

    const submitted = attempts.filter((a) => a.status === 'submitted' || a.status === 'awaiting_review');
    const scores = submitted.map((a) => Number(a.scorePercent ?? 0));
    const avgScorePercent = scores.length ? round2(avg(scores)) : null;

    const distribution = new Array(10).fill(0) as number[];
    for (const s of scores) {
      const bucket = Math.min(9, Math.floor(s / 10));
      distribution[bucket] += 1;
    }

    const durations = submitted
      .filter((a) => a.startedAt && a.submittedAt)
      .map((a) => (a.submittedAt!.getTime() - a.startedAt!.getTime()) / 60000);
    const avgDurationMinutes = durations.length ? round2(avg(durations)) : null;

    const passable = submitted.filter((a) => a.passed !== null);
    const passRate =
      template.passingScorePercent != null && passable.length
        ? round2((passable.filter((a) => a.passed).length / passable.length) * 100)
        : null;

    // Item analysis.
    const answers = await tx.applicationAssessmentAnswer.findMany({
      where: { attempt: { templateId } },
      select: {
        questionId: true,
        isCorrect: true,
        timeSpentSeconds: true,
        attemptId: true,
        question: { select: { prompt: true, type: true } },
      },
    });

    const scoreByAttempt = new Map(submitted.map((a) => [a.id, Number(a.scorePercent ?? 0)]));
    const sortedAttempts = [...submitted].sort(
      (a, b) => Number(b.scorePercent ?? 0) - Number(a.scorePercent ?? 0),
    );
    const third = Math.max(1, Math.floor(sortedAttempts.length / 3));
    const topSet = new Set(sortedAttempts.slice(0, third).map((a) => a.id));
    const bottomSet = new Set(sortedAttempts.slice(-third).map((a) => a.id));

    const byQuestion = new Map<
      string,
      {
        prompt: string;
        type: string;
        correct: number;
        graded: number;
        timeSum: number;
        timeCount: number;
        topCorrect: number;
        topTotal: number;
        bottomCorrect: number;
        bottomTotal: number;
      }
    >();

    for (const a of answers) {
      if (!scoreByAttempt.has(a.attemptId)) continue;
      const row =
        byQuestion.get(a.questionId) ??
        {
          prompt: a.question.prompt,
          type: a.question.type,
          correct: 0,
          graded: 0,
          timeSum: 0,
          timeCount: 0,
          topCorrect: 0,
          topTotal: 0,
          bottomCorrect: 0,
          bottomTotal: 0,
        };
      if (a.isCorrect !== null) {
        row.graded += 1;
        if (a.isCorrect) row.correct += 1;
        if (topSet.has(a.attemptId)) {
          row.topTotal += 1;
          if (a.isCorrect) row.topCorrect += 1;
        }
        if (bottomSet.has(a.attemptId)) {
          row.bottomTotal += 1;
          if (a.isCorrect) row.bottomCorrect += 1;
        }
      }
      if (a.timeSpentSeconds != null) {
        row.timeSum += a.timeSpentSeconds;
        row.timeCount += 1;
      }
      byQuestion.set(a.questionId, row);
    }

    const items: ItemAnalysisRow[] = [...byQuestion.entries()].map(([questionId, r]) => ({
      questionId,
      prompt: r.prompt,
      type: r.type,
      attempts: r.graded,
      difficultyIndex: r.graded ? round2(r.correct / r.graded) : null,
      discrimination:
        r.topTotal && r.bottomTotal
          ? round2(r.topCorrect / r.topTotal - r.bottomCorrect / r.bottomTotal)
          : null,
      avgTimeSeconds: r.timeCount ? Math.round(r.timeSum / r.timeCount) : null,
    }));

    return {
      templateId: template.id,
      templateName: template.name,
      attempts: attempts.length,
      completed: submitted.length,
      completionRate: attempts.length ? round2((submitted.length / attempts.length) * 100) : 0,
      avgScorePercent,
      passRate,
      avgDurationMinutes,
      scoreDistribution: distribution,
      items,
    };
  });
}

function avg(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
