/**
 * Inclusive working-day count (Mon–Fri). Public holiday refinement can be added later.
 */
export function workingDaysBetween(start: Date, end: Date): number {
  const s = new Date(start);
  s.setHours(12, 0, 0, 0);
  const e = new Date(end);
  e.setHours(12, 0, 0, 0);
  if (e < s) return 0;
  let n = 0;
  const cur = new Date(s);
  while (cur <= e) {
    const d = cur.getDay();
    if (d !== 0 && d !== 6) n++;
    cur.setDate(cur.getDate() + 1);
  }
  return n;
}
