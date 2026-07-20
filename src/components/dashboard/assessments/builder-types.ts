export type QuestionType =
  | 'mcq'
  | 'multi_select'
  | 'numeric'
  | 'short_text'
  | 'long_text'
  | 'code'
  | 'file'
  | 'likert'
  | 'rating'
  | 'ranking'
  | 'situational'
  | 'video_response';

export type Difficulty = 'easy' | 'medium' | 'hard';
export type TemplateKind = 'skills' | 'personality' | 'cognitive' | 'situational' | 'mixed';

export type BuilderQuestion = {
  clientKey: string;
  sectionKey: string | null;
  type: QuestionType;
  prompt: string;
  options: string[];
  correctAnswer: unknown;
  scoring: { dimension?: string; reverse?: boolean; scale?: number } | null;
  explanation: string;
  mediaUrl: string | null;
  difficulty: Difficulty;
  weight: number;
  maxPoints: number;
  required: boolean;
};

export type BuilderSection = {
  clientKey: string;
  title: string;
  description: string;
  timeLimitMinutes: number | null;
  shuffleQuestions: boolean;
  pickCount: number | null;
};

export type BuilderTemplate = {
  id?: string;
  name: string;
  description: string;
  kind: TemplateKind;
  category: string;
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
  sections: BuilderSection[];
  questions: BuilderQuestion[];
};

export const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
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

export const AUTO_KEYED: QuestionType[] = ['mcq', 'multi_select', 'numeric', 'short_text', 'ranking'];
export const DIMENSIONAL: QuestionType[] = ['likert', 'rating', 'situational'];
export const MANUAL: QuestionType[] = ['long_text', 'code', 'file', 'video_response'];

export function newClientKey(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function emptyQuestion(sectionKey: string | null): BuilderQuestion {
  return {
    clientKey: newClientKey('q'),
    sectionKey,
    type: 'mcq',
    prompt: '',
    options: ['', ''],
    correctAnswer: null,
    scoring: null,
    explanation: '',
    mediaUrl: null,
    difficulty: 'medium',
    weight: 1,
    maxPoints: 1,
    required: true,
  };
}

export function emptyTemplate(): BuilderTemplate {
  return {
    name: '',
    description: '',
    kind: 'skills',
    category: '',
    timeLimitMinutes: 30,
    passingScorePercent: null,
    shuffleSections: false,
    shuffleQuestions: false,
    negativeMarking: false,
    showResultsToCandidate: false,
    requireConsent: true,
    requireWebcam: false,
    lockdown: false,
    retentionDays: null,
    sections: [],
    questions: [],
  };
}
