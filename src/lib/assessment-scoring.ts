import type { AssessmentQuestionType } from '@prisma/client';
import { isManualGraded } from '@/lib/assessments/types';

export type ScoredAnswer = {
  isCorrect: boolean | null;
  pointsAwarded: number;
};

/**
 * Auto-score a single answer. Manual-graded types (file/long_text/code/video)
 * return `isCorrect: null` with 0 points until a human grades them.
 */
export function scoreAssessmentAnswer(
  type: AssessmentQuestionType,
  correctAnswer: unknown,
  candidateAnswer: unknown,
  maxPoints: number,
): ScoredAnswer {
  if (isManualGraded(type)) {
    return { isCorrect: null, pointsAwarded: 0 };
  }

  if (isEmpty(candidateAnswer)) {
    return { isCorrect: false, pointsAwarded: 0 };
  }

  if (type === 'mcq') {
    const expected = extractScalar(correctAnswer);
    const given = extractScalar(candidateAnswer);
    const isCorrect = expected !== null && given !== null && expected === given;
    return { isCorrect, pointsAwarded: isCorrect ? maxPoints : 0 };
  }

  if (type === 'short_text') {
    // Accept any of a set of acceptable answers (case/space-insensitive).
    const accepted = extractList(correctAnswer).map(normalizeText);
    const given = normalizeText(String(extractScalar(candidateAnswer) ?? ''));
    const isCorrect = accepted.length > 0 && accepted.includes(given);
    return { isCorrect, pointsAwarded: isCorrect ? maxPoints : 0 };
  }

  if (type === 'multi_select') {
    const expected = new Set(extractList(correctAnswer).map(normalizeText));
    const given = new Set(extractList(candidateAnswer).map(normalizeText));
    if (expected.size === 0) return { isCorrect: false, pointsAwarded: 0 };
    const exactMatch = expected.size === given.size && [...expected].every((v) => given.has(v));
    if (exactMatch) return { isCorrect: true, pointsAwarded: maxPoints };
    // Partial credit: correct selections minus wrong selections, floored at 0.
    let correct = 0;
    let wrong = 0;
    for (const v of given) {
      if (expected.has(v)) correct += 1;
      else wrong += 1;
    }
    const ratio = Math.max(0, (correct - wrong) / expected.size);
    const points = Math.round(ratio * maxPoints);
    return { isCorrect: points >= maxPoints, pointsAwarded: points };
  }

  if (type === 'ranking') {
    const expected = extractList(correctAnswer).map(normalizeText);
    const given = extractList(candidateAnswer).map(normalizeText);
    if (expected.length === 0) return { isCorrect: false, pointsAwarded: 0 };
    let matches = 0;
    for (let i = 0; i < expected.length; i += 1) {
      if (given[i] !== undefined && given[i] === expected[i]) matches += 1;
    }
    const ratio = matches / expected.length;
    const points = Math.round(ratio * maxPoints);
    return { isCorrect: matches === expected.length, pointsAwarded: points };
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

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined || value === '') return true;
  if (Array.isArray(value) && value.length === 0) return true;
  return false;
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function extractScalar(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object' && value !== null && 'value' in value) {
    return String((value as { value: unknown }).value).trim().toLowerCase();
  }
  return String(value).trim().toLowerCase();
}

/** Extract a string[] from various shapes: array, {value: [...]}, CSV string. */
function extractList(value: unknown): string[] {
  const inner =
    value !== null && typeof value === 'object' && 'value' in value
      ? (value as { value: unknown }).value
      : value;
  if (Array.isArray(inner)) return inner.map((v) => String(v));
  if (typeof inner === 'string') {
    return inner
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

export function computeScorePercent(earned: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round((earned / max) * 10000) / 100;
}
