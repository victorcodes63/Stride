import { describe, expect, it } from 'vitest';
import { buildAttendanceForShift } from './attendanceFromShift';
import { debouncePunchesWithin60s } from './debouncePunches';
import { computeOvertimeMinutes } from './overtime';
import { isPunchInShiftWindow, shiftWindowDurationMs } from './shiftWindow';
import { resolveUnknownPunchTypes } from './resolveUnknown';
import { weeklyWorkedMinutesIsoWeek, weeklyExcessOverCapMinutes } from './weeklyLimit';
import type { BiometricPunch, OvertimeConfig, ShiftAssignment } from './types';

/* --- R4: debounce (same type within 60s) — keep first, drop rest, stable by `at` --- */
describe('M2 shift engine — R4 debounce (same type within 60s)', () => {
  it('keeps the first in-punch, drops a second in-punch 30s later', () => {
    const base: BiometricPunch = {
      id: '1',
      employeeId: 'e1',
      at: '2026-04-26T20:00:00.000Z',
      type: 'in',
      source: 'device',
    };
    const dup: BiometricPunch = { ...base, id: '2', at: '2026-04-26T20:00:30.000Z' };
    const result = debouncePunchesWithin60s([dup, base]);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1');
  });

  it('keeps in then out 30s apart (different types)', () => {
    const a: BiometricPunch = {
      id: '1',
      employeeId: 'e1',
      at: '2026-04-26T20:00:00.000Z',
      type: 'in',
      source: 'device',
    };
    const b: BiometricPunch = { ...a, id: '2', at: '2026-04-26T20:00:30.000Z', type: 'out' };
    const result = debouncePunchesWithin60s([b, a]);
    expect(result).toHaveLength(2);
  });
});

/* --- R2: shift window is [scheduledStart, scheduledEnd) in instant time (overnight ok) --- */
describe('M2 shift engine — R2 shift window (half-open span)', () => {
  const shift: ShiftAssignment = {
    id: 's1',
    employeeId: 'e1',
    scheduledStart: '2026-04-26T15:00:00.000Z',
    scheduledEnd: '2026-04-27T03:00:00.000Z',
  };

  it('includes a punch on the day after start but before end', () => {
    expect(isPunchInShiftWindow('2026-04-27T02:00:00.000Z', shift)).toBe(true);
  });

  it('excludes scheduledEnd (half-open upper bound)', () => {
    expect(isPunchInShiftWindow('2026-04-27T03:00:00.000Z', shift)).toBe(false);
  });

  it('excludes instants before scheduledStart', () => {
    expect(isPunchInShiftWindow('2026-04-26T14:59:59.999Z', shift)).toBe(false);
  });

  it('reports a positive duration in ms for overnight window', () => {
    expect(shiftWindowDurationMs(shift)).toBe(12 * 60 * 60 * 1000);
  });
});

/* --- R1: one AttendanceRecord per shift assignment, not split at calendar midnight --- */
describe('M2 shift engine — R1 one record across midnight', () => {
  it('produces a single AttendanceRecord for a night shift spanning two calendar days', () => {
    const shift: ShiftAssignment = {
      id: 'night1',
      employeeId: 'e1',
      scheduledStart: '2026-04-26T15:00:00.000Z',
      scheduledEnd: '2026-04-27T03:00:00.000Z',
    };
    const punches: BiometricPunch[] = [
      {
        id: 'a',
        employeeId: 'e1',
        at: '2026-04-26T15:05:00.000Z',
        type: 'in',
        source: 'device',
      },
      {
        id: 'b',
        employeeId: 'e1',
        at: '2026-04-27T02:50:00.000Z',
        type: 'out',
        source: 'device',
      },
    ];
    const rec = buildAttendanceForShift(shift, punches);
    expect(rec.shiftAssignmentId).toBe(shift.id);
    expect(rec.start).toBe('2026-04-26T15:05:00.000Z');
    expect(rec.end).toBe('2026-04-27T02:50:00.000Z');
    expect(rec.status).toBe('closed');
  });
});

/* --- R3: in/out pairing within window; orphan in → pending_review; orphan out dropped --- */
describe('M2 shift engine — R3 in/out pairing', () => {
  it('leaves end null and pending_review when only an in-punch is in the window', () => {
    const shift: ShiftAssignment = {
      id: 's1',
      employeeId: 'e1',
      scheduledStart: '2026-04-26T08:00:00.000Z',
      scheduledEnd: '2026-04-26T16:00:00.000Z',
    };
    const punches: BiometricPunch[] = [
      {
        id: '1',
        employeeId: 'e1',
        at: '2026-04-26T09:00:00.000Z',
        type: 'in',
        source: 'device',
      },
    ];
    const rec = buildAttendanceForShift(shift, punches);
    expect(rec.end).toBeNull();
    expect(rec.status).toBe('pending_review');
  });

  it('ignores an out-punch in the window when no in-punch opened the segment', () => {
    const shift: ShiftAssignment = {
      id: 's1',
      employeeId: 'e1',
      scheduledStart: '2026-04-26T08:00:00.000Z',
      scheduledEnd: '2026-04-26T16:00:00.000Z',
    };
    const punches: BiometricPunch[] = [
      {
        id: '1',
        employeeId: 'e1',
        at: '2026-04-26T09:00:00.000Z',
        type: 'out',
        source: 'device',
      },
    ];
    const rec = buildAttendanceForShift(shift, punches);
    expect(rec.end).toBeNull();
    expect(rec.status).toBe('pending_review');
  });
});

/* --- R5: unknown → in/out by alternation (first unknown defaults to in) --- */
describe('M2 shift engine — R5 resolve unknown', () => {
  it('first unknown is treated as in, second as out when no prior typed punch', () => {
    const a: BiometricPunch = {
      id: '1',
      employeeId: 'e1',
      at: '2026-04-26T08:00:00.000Z',
      type: 'unknown',
      source: 'device',
    };
    const b: BiometricPunch = { ...a, id: '2', at: '2026-04-26T16:00:00.000Z', type: 'unknown' };
    const r = resolveUnknownPunchTypes([b, a]);
    expect(r.find((p) => p.id === '1')?.type).toBe('in');
    expect(r.find((p) => p.id === '2')?.type).toBe('out');
  });
});

/* --- R6: overtime = max(0, worked − scheduledLength − dailyThreshold) in whole minutes --- */
describe('M2 shift engine — R6 overtime', () => {
  it('returns extra minutes when worked exceeds scheduled window length (minus threshold)', () => {
    const config: OvertimeConfig = { dailyThresholdMinutes: 0 };
    // 8h shift, 9h worked
    const ot = computeOvertimeMinutes(
      new Date('2026-04-26T08:00:00.000Z').getTime(), // 9h worked
      new Date('2026-04-26T17:00:00.000Z').getTime(),
      new Date('2026-04-26T08:00:00.000Z').getTime(), // 8h scheduled
      new Date('2026-04-26T16:00:00.000Z').getTime(),
      config
    );
    expect(ot).toBe(60);
  });
});

/* --- R7: ISO week total and excess over a weekly cap (e.g. 60h) --- */
describe('M2 shift engine — R7 weekly cap (ISO week, UTC)', () => {
  it('sums worked minutes in the ISO week for the employee', () => {
    const t = weeklyWorkedMinutesIsoWeek(
      'e1',
      '2026-04-29T12:00:00.000Z',
      [
        { employeeId: 'e1', start: '2026-04-27T08:00:00.000Z', end: '2026-04-27T12:00:00.000Z' },
        { employeeId: 'e1', start: '2026-04-28T08:00:00.000Z', end: '2026-04-28T10:00:00.000Z' },
        { employeeId: 'e2', start: '2026-04-28T00:00:00.000Z', end: '2026-04-28T08:00:00.000Z' },
      ]
    );
    // Mon 27: 4h, Tue 28: 2h  — only e1: 6h = 360m
    expect(t).toBe(360);
  });

  it('returns excess over cap in minutes (60h = 3600m)', () => {
    const excess = weeklyExcessOverCapMinutes(3700, 60 * 60);
    expect(excess).toBe(100);
  });
});
