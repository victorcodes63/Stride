import type { ISODateTimeString, ShiftAssignment } from './types';

/**
 * R2: Shift matching uses a single instant window [scheduledStart, scheduledEnd) so overnight
 * shifts (end on the next calendar day) are one continuous span, not two date buckets.
 */
export function isPunchInShiftWindow(at: ISODateTimeString, shift: ShiftAssignment): boolean {
  const t = new Date(at).getTime();
  const s = new Date(shift.scheduledStart).getTime();
  const e = new Date(shift.scheduledEnd).getTime();
  return t >= s && t < e;
}

/** Length of the half-open window in ms (end − start, always ≥ 0 for valid data). */
export function shiftWindowDurationMs(shift: ShiftAssignment): number {
  return new Date(shift.scheduledEnd).getTime() - new Date(shift.scheduledStart).getTime();
}
