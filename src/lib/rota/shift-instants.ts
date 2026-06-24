/**
 * Build local wall-clock instants for a calendar work day from template minute-of-day values.
 * When endMinutes <= startMinutes, the shift crosses midnight (end is on the next calendar day).
 */
export function instantsFromTemplateMinutes(
  workDateStr: string,
  startMinutes: number,
  endMinutes: number,
): { startsAt: Date; endsAt: Date } {
  const [y, m, d] = workDateStr.split('-').map((x) => parseInt(x, 10));
  if (!y || !m || !d) {
    throw new Error(`Invalid workDate (expected YYYY-MM-DD): ${workDateStr}`);
  }
  const sh = Math.floor(startMinutes / 60);
  const sm = startMinutes % 60;
  const eh = Math.floor(endMinutes / 60);
  const em = endMinutes % 60;
  const startsAt = new Date(y, m - 1, d, sh, sm, 0, 0);
  const endsAt = new Date(y, m - 1, d, eh, em, 0, 0);
  if (endMinutes <= startMinutes) {
    endsAt.setDate(endsAt.getDate() + 1);
  }
  if (endsAt.getTime() <= startsAt.getTime()) {
    throw new Error('Shift has zero or negative duration');
  }
  return { startsAt, endsAt };
}

export function dateKeyLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
