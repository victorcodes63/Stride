import type { Prisma } from '@prisma/client';

import { getDeploymentTier } from '@/lib/deployment-tier-shared';

export type AiGoalSuggestion = {
  goalId: string;
  title: string;
  suggestedScore: number | null;
  rationale: string;
  missingEvidence: boolean;
};

export type AiCompetencySuggestion = {
  dimension: string;
  requiredLevel: number | null;
  suggestedScore: number | null;
  gap: number | null;
  rationale: string;
};

export type AiEvaluationSuggestions = {
  generatedAt: string;
  goals: AiGoalSuggestion[];
  competencies: AiCompetencySuggestion[];
  summary: string;
  /** Human-in-the-loop — manager must accept/override; never auto-applied. */
  disclaimer: string;
};

type SuggestInput = {
  organizationId: string;
  review: Prisma.PerformanceReviewGetPayload<{
    include: {
      goals: true;
      ratings: true;
    };
  }>;
  parserConfig: {
    mode: string;
    aiEvaluationEnabled: boolean;
    aiEvaluationConsentAt: Date | null;
    consentAt: Date | null;
  } | null;
};

function heuristicGoalScore(description: string | null | undefined, selfScore: number | null): number | null {
  const evidenceLen = (description ?? '').trim().length;
  if (evidenceLen === 0) return selfScore ?? 2;
  if (evidenceLen < 40) return Math.min(3, (selfScore ?? 2) + 0);
  if (evidenceLen < 120) return Math.min(4, (selfScore ?? 3));
  return Math.min(5, (selfScore ?? 4));
}

export function canUseAiEvaluation(
  parserConfig: SuggestInput['parserConfig'],
  tier = getDeploymentTier(),
): { ok: true } | { ok: false; reason: string } {
  const dryRun = process.env.STRIDE_AI_EVAL_DRY_RUN === '1';
  if (!dryRun && tier !== 'enterprise') {
    return { ok: false, reason: 'AI evaluation assist is Enterprise-gated.' };
  }
  if (!parserConfig?.aiEvaluationEnabled) {
    return { ok: false, reason: 'AI evaluation assist is disabled for this organization.' };
  }
  if (!parserConfig.aiEvaluationConsentAt) {
    return { ok: false, reason: 'Explicit AI evaluation consent is required before any review data is processed.' };
  }
  if (parserConfig.mode === 'manual') {
    return { ok: false, reason: 'Manual JD mode does not send review data to AI services.' };
  }
  return { ok: true };
}

/** Assistive rating suggestions — proposes only; manager decides. */
export async function buildAiEvaluationSuggestions(input: SuggestInput): Promise<AiEvaluationSuggestions> {
  const gate = canUseAiEvaluation(input.parserConfig);
  if (!gate.ok) {
    throw new Error(gate.reason);
  }

  if (process.env.STRIDE_AI_EVAL_ENABLE_LLM === '1') {
    // VICTOR TODO: wire org BYO/Stride LLM provider for evidence-assisted rating (same JdParserConfig keys).
    throw new Error('Stride LLM evaluation assist is not wired in this cell yet. Use STRIDE_AI_EVAL_DRY_RUN=1 for heuristic suggestions.');
  }

  const goals: AiGoalSuggestion[] = input.review.goals.map((goal) => {
    const missingEvidence = !(goal.description ?? '').trim();
    const suggested = heuristicGoalScore(goal.description, goal.selfScore);
    return {
      goalId: goal.id,
      title: goal.title,
      suggestedScore: suggested,
      rationale: missingEvidence
        ? 'No evidence text attached — suggest confirming deliverables before rating above 2.'
        : 'Evidence length supports a moderate-to-strong results rating; validate against KPI targets.',
      missingEvidence,
    };
  });

  const competencies: AiCompetencySuggestion[] = input.review.ratings.map((rating) => {
    const required = rating.requiredLevel ?? 3;
    const self = rating.selfScore ?? 3;
    const gap = required - self;
    const suggested = gap > 1 ? Math.min(required, self + 1) : Math.min(5, Math.max(self, required - 1));
    return {
      dimension: rating.dimension,
      requiredLevel: rating.requiredLevel,
      suggestedScore: suggested,
      gap: gap > 0 ? gap : 0,
      rationale:
        gap > 0
          ? `Competency gap of ${gap} level(s) vs required ${required} — discuss development plan.`
          : 'Self assessment meets or exceeds required proficiency.',
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    goals,
    competencies,
    summary: 'AI-assisted draft suggestions based on submitted evidence and competency gaps. Manager must confirm every score.',
    disclaimer: 'Suggestions only — never auto-finalized. No data leaves this org unless AI evaluation is enabled with consent.',
  };
}
