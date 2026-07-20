import { createHash } from 'crypto';

export type PresentationSection = {
  id: string | null;
  title: string;
  description: string | null;
  orderIndex: number;
  timeLimitMinutes: number | null;
  shuffleQuestions: boolean;
  pickCount: number | null;
};

export type PresentationQuestion = {
  id: string;
  sectionId: string | null;
  orderIndex: number;
};

export type TemplateShape = {
  shuffleSections: boolean;
  shuffleQuestions: boolean;
  sections: PresentationSection[];
  questions: PresentationQuestion[];
};

/** Deterministic PRNG so shuffling/pooling is stable across reloads and matches scoring. */
function seededRandom(seed: string): () => number {
  let h = parseInt(createHash('sha256').update(seed).digest('hex').slice(0, 8), 16) || 1;
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

/**
 * Compute the ordered list of question ids a candidate is presented (applying
 * section order, per-section shuffle, question pooling). Seeded by the attempt token
 * so GET (render) and POST (scoring) agree without persisting the selection.
 */
export function selectPresentedQuestionIds(template: TemplateShape, seed: string): string[] {
  const rng = seededRandom(seed);
  const bySection = new Map<string | null, PresentationQuestion[]>();
  for (const q of template.questions) {
    const key = q.sectionId ?? null;
    const arr = bySection.get(key) ?? [];
    arr.push(q);
    bySection.set(key, arr);
  }

  let sections = [...template.sections].sort((a, b) => a.orderIndex - b.orderIndex);
  if (template.shuffleSections) sections = shuffle(sections, rng);

  const ordered: string[] = [];

  const emit = (
    questions: PresentationQuestion[],
    section: PresentationSection | null,
  ) => {
    let list = [...questions].sort((a, b) => a.orderIndex - b.orderIndex);
    if (template.shuffleQuestions || section?.shuffleQuestions) list = shuffle(list, rng);
    if (section?.pickCount && section.pickCount > 0 && section.pickCount < list.length) {
      list = list.slice(0, section.pickCount);
    }
    for (const q of list) ordered.push(q.id);
  };

  for (const section of sections) {
    emit(bySection.get(section.id) ?? [], section);
  }
  // Questions with no section (legacy / ad-hoc).
  emit(bySection.get(null) ?? [], null);

  return ordered;
}
