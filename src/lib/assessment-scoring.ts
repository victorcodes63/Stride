import type { AssessmentQuestionType } from '@prisma/client';

export type ScoredAnswer = {
  isCorrect: boolean | null;
  pointsAwarded: number;
};

export function scoreAssessmentAnswer(
  type: AssessmentQuestionType,
  correctAnswer: unknown,
  candidateAnswer: unknown,
  maxPoints: number,
): ScoredAnswer {
  if (type === 'file') {
    const hasFile =
      typeof candidateAnswer === 'string'
        ? candidateAnswer.trim().length > 0
        : Boolean(candidateAnswer);
    return { isCorrect: null, pointsAwarded: hasFile ? 0 : 0 };
  }

  if (candidateAnswer === null || candidateAnswer === undefined || candidateAnswer === '') {
    return { isCorrect: false, pointsAwarded: 0 };
  }

  if (type === 'mcq') {
    const expected = extractScalar(correctAnswer);
    const given = extractScalar(candidateAnswer);
    const isCorrect = expected !== null && given !== null && expected === given;
    return { isCorrect, pointsAwarded: isCorrect ? maxPoints : 0 };
  }

  if (type === 'numeric') {
    const expected = Number(extractScalar(correctAnswer));
    const given = Number(extractScalar(candidateAnswer));
    if (Number.isNaN(expected) || Number.isNaN(given)) {
      return { isCorrect: false, pointsAwarded: 0 };
    }
    const tolerance = Math.max(0.001, Math.abs(expected) * 0.001);
    const isCorrect = Math.abs(expected - given) <= tolerance;
    return { isCorrect, pointsAwarded: isCorrect ? maxPoints : 0 };
  }

  return { isCorrect: false, pointsAwarded: 0 };
}

function extractScalar(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object' && value !== null && 'value' in value) {
    return String((value as { value: unknown }).value).trim().toLowerCase();
  }
  return String(value).trim().toLowerCase();
}

export function computeScorePercent(earned: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round((earned / max) * 10000) / 100;
}
