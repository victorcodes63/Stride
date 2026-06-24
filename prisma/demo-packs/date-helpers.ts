export function d(y: number, m: number, day: number): Date {
  return new Date(Date.UTC(y, m - 1, day, 0, 0, 0));
}

export function daysFromToday(offset: number): Date {
  const now = new Date();
  const dt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  dt.setUTCDate(dt.getUTCDate() + offset);
  return dt;
}
