import { debouncePunchesWithin60s } from './debouncePunches';
import { isPunchInShiftWindow } from './shiftWindow';
import { resolveUnknownPunchTypes } from './resolveUnknown';
import type { AttendanceRecord, BiometricPunch, ShiftAssignment } from './types';

/**
 * R1: One `AttendanceRecord` per shift assignment — including overnight windows (no split at
 *     calendar midnight; window logic is R2).
 * R3: In/out pairing within the window: first `in` opens, next `in` is ignored, first `out`
 *     after an open `in` closes. Orphan `out` is dropped; open `in` with no `out` is pending.
 */
export function buildAttendanceForShift(shift: ShiftAssignment, punches: BiometricPunch[]): AttendanceRecord {
  const mine = punches.filter((p) => p.employeeId === shift.employeeId);
  const debounced = debouncePunchesWithin60s(mine);
  const resolved = resolveUnknownPunchTypes(debounced);
  const inWindow = resolved
    .filter((p) => isPunchInShiftWindow(p.at, shift))
    .sort((a, b) => a.at.localeCompare(b.at));

  let open: BiometricPunch | null = null;
  for (const p of inWindow) {
    if (p.type === 'in') {
      if (!open) open = p;
      continue;
    }
    if (p.type === 'out') {
      if (open) {
        return {
          employeeId: shift.employeeId,
          shiftAssignmentId: shift.id,
          start: open.at,
          end: p.at,
          status: 'closed',
        };
      }
    }
  }
  if (open) {
    return {
      employeeId: shift.employeeId,
      shiftAssignmentId: shift.id,
      start: open.at,
      end: null,
      status: 'pending_review',
    };
  }
  if (inWindow.some((p) => p.type === 'out')) {
    return {
      employeeId: shift.employeeId,
      shiftAssignmentId: shift.id,
      start: shift.scheduledStart,
      end: null,
      status: 'pending_review',
    };
  }
  return {
    employeeId: shift.employeeId,
    shiftAssignmentId: shift.id,
    start: shift.scheduledStart,
    end: null,
    status: 'pending_review',
  };
}
