import type { ProjectTaskPriority } from '@prisma/client';

/**
 * Blueprint stored on `ProjectTemplate.blueprint` (Json):
 *   { milestones: [{ title, description?, tasks: [{ title, priority?, estimateHours?, description? }] }],
 *     tasks?: [{ title, priority?, estimateHours?, description? }] }  // milestone-less tasks
 */
const TASK_PRIORITIES: ProjectTaskPriority[] = ['low', 'medium', 'high'];

export type ExpandedTask = {
  title: string;
  description: string | null;
  priority: ProjectTaskPriority;
  estimateHours: number | null;
};

export type ExpandedMilestone = {
  title: string;
  description: string | null;
  tasks: ExpandedTask[];
};

export type ExpandedBlueprint = {
  milestones: ExpandedMilestone[];
  tasks: ExpandedTask[];
};

function toTrimmedString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toNullableText(value: unknown): string | null {
  const trimmed = toTrimmedString(value);
  return trimmed ? trimmed : null;
}

function normalizePriority(value: unknown): ProjectTaskPriority {
  return typeof value === 'string' && TASK_PRIORITIES.includes(value as ProjectTaskPriority)
    ? (value as ProjectTaskPriority)
    : 'medium';
}

function normalizeEstimate(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value * 100) / 100;
}

function expandTask(raw: unknown): ExpandedTask | null {
  if (!raw || typeof raw !== 'object') return null;
  const record = raw as Record<string, unknown>;
  const title = toTrimmedString(record.title);
  if (!title) return null;
  return {
    title,
    description: toNullableText(record.description),
    priority: normalizePriority(record.priority),
    estimateHours: normalizeEstimate(record.estimateHours),
  };
}

function expandTasks(raw: unknown): ExpandedTask[] {
  if (!Array.isArray(raw)) return [];
  const out: ExpandedTask[] = [];
  for (const entry of raw) {
    const task = expandTask(entry);
    if (task) out.push(task);
  }
  return out;
}

/**
 * Normalize/validate a (possibly untrusted) template blueprint into a clean,
 * ready-to-instantiate structure. Invalid entries are dropped rather than
 * throwing so a partially-malformed template still yields usable output.
 */
export function expandTemplateBlueprint(blueprint: unknown): ExpandedBlueprint {
  if (!blueprint || typeof blueprint !== 'object') {
    return { milestones: [], tasks: [] };
  }
  const record = blueprint as Record<string, unknown>;

  const milestones: ExpandedMilestone[] = [];
  if (Array.isArray(record.milestones)) {
    for (const entry of record.milestones) {
      if (!entry || typeof entry !== 'object') continue;
      const milestoneRecord = entry as Record<string, unknown>;
      const title = toTrimmedString(milestoneRecord.title);
      if (!title) continue;
      milestones.push({
        title,
        description: toNullableText(milestoneRecord.description),
        tasks: expandTasks(milestoneRecord.tasks),
      });
    }
  }

  return {
    milestones,
    tasks: expandTasks(record.tasks),
  };
}

/** Total number of tasks a blueprint would create (across all milestones + loose tasks). */
export function countBlueprintTasks(expanded: ExpandedBlueprint): number {
  return (
    expanded.tasks.length +
    expanded.milestones.reduce((sum, milestone) => sum + milestone.tasks.length, 0)
  );
}
