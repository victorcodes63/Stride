/** Pure helpers for project velocity / burndown-style charts. */

export type VelocityWeek = {
  weekStart: string;
  label: string;
  completed: number;
  created: number;
};

function toKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, 12, 0, 0, 0);
  return x;
}

function startOfWeek(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12, 0, 0, 0);
  const day = x.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day; // Monday start
  return addDays(x, diff);
}

/**
 * Build an N-week series of completed vs created task counts.
 * Weeks are Monday-start; the last bucket is the current week.
 */
export function buildVelocitySeries(input: {
  weeks: number;
  completedAt: Date[];
  createdAt: Date[];
  /** Optional anchor; defaults to today. */
  now?: Date;
}): VelocityWeek[] {
  const weeks = Math.max(1, Math.min(26, input.weeks));
  const now = input.now ?? new Date();
  const currentWeek = startOfWeek(now);
  const series: VelocityWeek[] = [];

  for (let i = weeks - 1; i >= 0; i--) {
    const weekStart = addDays(currentWeek, -i * 7);
    const weekEnd = addDays(weekStart, 7);
    const key = toKey(weekStart);
    const bucket: VelocityWeek = {
      weekStart: key,
      label: weekStart.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      completed: 0,
      created: 0,
    };
    series.push(bucket);

    for (const d of input.completedAt) {
      const key = toKey(d);
      if (key >= toKey(weekStart) && key < toKey(weekEnd)) bucket.completed += 1;
    }
    for (const d of input.createdAt) {
      const key = toKey(d);
      if (key >= toKey(weekStart) && key < toKey(weekEnd)) bucket.created += 1;
    }
  }

  return series;
}
