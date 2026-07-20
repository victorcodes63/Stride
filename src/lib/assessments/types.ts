import type { AssessmentQuestionType } from '@prisma/client';

/** Question types that are auto-scored right/wrong. */
export const AUTO_SCORED_TYPES: AssessmentQuestionType[] = [
  'mcq',
  'numeric',
  'multi_select',
  'short_text',
  'ranking',
];

/** Question types that require a human grader (no objective key). */
export const MANUAL_GRADED_TYPES: AssessmentQuestionType[] = [
  'file',
  'long_text',
  'code',
  'video_response',
];

/** Question types that contribute to psychometric dimension scores, not right/wrong. */
export const DIMENSION_TYPES: AssessmentQuestionType[] = ['likert', 'rating', 'situational'];

export const ALL_QUESTION_TYPES: AssessmentQuestionType[] = [
  'mcq',
  'multi_select',
  'numeric',
  'short_text',
  'long_text',
  'code',
  'file',
  'likert',
  'rating',
  'ranking',
  'situational',
  'video_response',
];

export const QUESTION_TYPE_LABELS: Record<AssessmentQuestionType, string> = {
  mcq: 'Multiple choice (single)',
  multi_select: 'Multiple choice (multi)',
  numeric: 'Numeric',
  short_text: 'Short text',
  long_text: 'Long text / essay',
  code: 'Code',
  file: 'File upload',
  likert: 'Likert scale',
  rating: 'Rating',
  ranking: 'Ranking / ordering',
  situational: 'Situational judgement',
  video_response: 'Video response',
};

/** Scoring config stored on a question (`scoring` JSON). */
export type QuestionScoringConfig = {
  /** Psychometric dimension this item loads onto (likert/rating/situational). */
  dimension?: string;
  /** If true, invert the likert value (5 -> 1). */
  reverse?: boolean;
  /** Likert scale size (default 5). */
  scale?: number;
};

/** Normalised result shape shared across native + external assessments. */
export type NormalizedResult = {
  scorePercent: number | null;
  percentile?: number | null;
  sten?: number | null;
  dimensions?: Record<string, number>;
  raw?: Record<string, unknown>;
};

export function isManualGraded(type: AssessmentQuestionType): boolean {
  return MANUAL_GRADED_TYPES.includes(type);
}

export function isDimensionType(type: AssessmentQuestionType): boolean {
  return DIMENSION_TYPES.includes(type);
}
