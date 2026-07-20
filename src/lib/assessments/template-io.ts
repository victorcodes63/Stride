import type { AssessmentDifficulty, AssessmentKind, AssessmentQuestionType, Prisma } from '@prisma/client';
import { ALL_QUESTION_TYPES } from '@/lib/assessments/types';

const KINDS: AssessmentKind[] = ['skills', 'personality', 'cognitive', 'situational', 'mixed'];
const DIFFICULTIES: AssessmentDifficulty[] = ['easy', 'medium', 'hard'];

export type ParsedQuestion = {
  clientKey?: string;
  sectionKey?: string | null;
  bankItemId?: string | null;
  type: AssessmentQuestionType;
  prompt: string;
  options: Prisma.InputJsonValue | undefined;
  correctAnswer: Prisma.InputJsonValue | undefined;
  scoring: Prisma.InputJsonValue | undefined;
  explanation: string | null;
  mediaUrl: string | null;
  difficulty: AssessmentDifficulty;
  weight: number;
  maxPoints: number;
  required: boolean;
  orderIndex: number;
};

export type ParsedSection = {
  clientKey: string;
  title: string;
  description: string | null;
  orderIndex: number;
  timeLimitMinutes: number | null;
  shuffleQuestions: boolean;
  pickCount: number | null;
};

export type ParsedTemplate = {
  name: string;
  description: string | null;
  kind: AssessmentKind;
  category: string | null;
  timeLimitMinutes: number;
  passingScorePercent: number | null;
  shuffleSections: boolean;
  shuffleQuestions: boolean;
  negativeMarking: boolean;
  showResultsToCandidate: boolean;
  requireConsent: boolean;
  requireWebcam: boolean;
  lockdown: boolean;
  retentionDays: number | null;
  sections: ParsedSection[];
  questions: ParsedQuestion[];
};

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}
function boolOr(v: unknown, fallback: boolean): boolean {
  return typeof v === 'boolean' ? v : fallback;
}
function intOrNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

export function parseTemplateInput(body: Record<string, unknown>): ParsedTemplate {
  const name = str(body.name);
  if (!name) throw new TemplateValidationError('name is required.');

  const kindRaw = str(body.kind) as AssessmentKind;
  const kind = KINDS.includes(kindRaw) ? kindRaw : 'skills';

  const rawSections = Array.isArray(body.sections) ? body.sections : [];
  const sections: ParsedSection[] = rawSections.map((raw, index) => {
    const s = raw as Record<string, unknown>;
    return {
      clientKey: str(s.clientKey) || str(s.id) || `section-${index}`,
      title: str(s.title) || `Section ${index + 1}`,
      description: str(s.description) || null,
      orderIndex: index,
      timeLimitMinutes: intOrNull(s.timeLimitMinutes),
      shuffleQuestions: boolOr(s.shuffleQuestions, false),
      pickCount: intOrNull(s.pickCount),
    };
  });

  const rawQuestions = Array.isArray(body.questions) ? body.questions : [];
  const questions: ParsedQuestion[] = rawQuestions.map((raw, index) => {
    const q = raw as Record<string, unknown>;
    const typeRaw = str(q.type) as AssessmentQuestionType;
    const type = ALL_QUESTION_TYPES.includes(typeRaw) ? typeRaw : 'mcq';
    const difficultyRaw = str(q.difficulty) as AssessmentDifficulty;
    const difficulty = DIFFICULTIES.includes(difficultyRaw) ? difficultyRaw : 'medium';
    const maxPoints = intOrNull(q.maxPoints) ?? 1;
    return {
      clientKey: str(q.clientKey) || undefined,
      sectionKey: (q.sectionKey as string) ?? null,
      bankItemId: str(q.bankItemId) || null,
      type,
      prompt: str(q.prompt) || `Question ${index + 1}`,
      options: (q.options ?? undefined) as Prisma.InputJsonValue | undefined,
      correctAnswer: (q.correctAnswer ?? undefined) as Prisma.InputJsonValue | undefined,
      scoring: (q.scoring ?? undefined) as Prisma.InputJsonValue | undefined,
      explanation: str(q.explanation) || null,
      mediaUrl: str(q.mediaUrl) || null,
      difficulty,
      weight: intOrNull(q.weight) ?? 1,
      maxPoints: Math.max(0, maxPoints),
      required: boolOr(q.required, true),
      orderIndex: intOrNull(q.orderIndex) ?? index,
    };
  });

  return {
    name,
    description: str(body.description) || null,
    kind,
    category: str(body.category) || null,
    timeLimitMinutes: Math.max(1, Math.min(intOrNull(body.timeLimitMinutes) ?? 30, 480)),
    passingScorePercent: clampPercentOrNull(body.passingScorePercent),
    shuffleSections: boolOr(body.shuffleSections, false),
    shuffleQuestions: boolOr(body.shuffleQuestions, false),
    negativeMarking: boolOr(body.negativeMarking, false),
    showResultsToCandidate: boolOr(body.showResultsToCandidate, false),
    requireConsent: boolOr(body.requireConsent, true),
    requireWebcam: boolOr(body.requireWebcam, false),
    lockdown: boolOr(body.lockdown, false),
    retentionDays: intOrNull(body.retentionDays),
    sections,
    questions,
  };
}

function clampPercentOrNull(v: unknown): number | null {
  const n = intOrNull(v);
  if (n === null) return null;
  return Math.max(0, Math.min(100, n));
}

export class TemplateValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TemplateValidationError';
  }
}
