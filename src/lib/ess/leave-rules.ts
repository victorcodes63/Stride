export function countInclusiveDays(start: Date, end: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1;
}

export function hasDateRangeOverlap(
  existingStart: Date,
  existingEnd: Date,
  requestedStart: Date,
  requestedEnd: Date,
): boolean {
  return existingStart <= requestedEnd && existingEnd >= requestedStart;
}

export function computeRemainingLeaveDays(input: {
  entitled: number;
  used: number;
  pending: number;
}): number {
  return input.entitled - input.used - input.pending;
}

export function canRequestLeave(input: {
  requestedDays: number;
  entitled: number;
  used: number;
  pending: number;
}): boolean {
  if (input.requestedDays <= 0) return false;
  return input.requestedDays <= computeRemainingLeaveDays(input);
}
