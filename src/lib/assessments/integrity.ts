import type { IntegrityEventType } from '@prisma/client';

export type IntegrityInput = {
  type: IntegrityEventType;
};

/** Penalty weights per integrity signal (points deducted from a 100 baseline). */
const PENALTIES: Partial<Record<IntegrityEventType, number>> = {
  tab_blur: 6,
  paste: 10,
  paste_blocked: 4,
  fullscreen_exit: 8,
  right_click: 2,
  window_resize: 1,
  face_missing: 12,
  multiple_faces: 20,
};

const FLAG_LABELS: Partial<Record<IntegrityEventType, string>> = {
  tab_blur: 'Left the assessment tab',
  paste: 'Pasted content',
  paste_blocked: 'Attempted to paste (blocked)',
  fullscreen_exit: 'Exited fullscreen',
  right_click: 'Right-clicked',
  face_missing: 'Face not detected',
  multiple_faces: 'Multiple faces detected',
};

export type IntegritySummary = {
  score: number;
  flags: Array<{ type: IntegrityEventType; count: number; label: string }>;
};

export function computeIntegrity(events: IntegrityInput[]): IntegritySummary {
  const counts = new Map<IntegrityEventType, number>();
  let deduction = 0;

  for (const event of events) {
    const penalty = PENALTIES[event.type];
    if (penalty === undefined) continue;
    counts.set(event.type, (counts.get(event.type) ?? 0) + 1);
    // Diminishing returns: repeated same-type events penalised at a decay.
    const occurrence = counts.get(event.type)!;
    deduction += penalty * Math.pow(0.8, occurrence - 1);
  }

  const score = Math.max(0, Math.round(100 - deduction));
  const flags = [...counts.entries()]
    .filter(([type]) => FLAG_LABELS[type])
    .map(([type, count]) => ({ type, count, label: FLAG_LABELS[type] as string }))
    .sort((a, b) => b.count - a.count);

  return { score, flags };
}
