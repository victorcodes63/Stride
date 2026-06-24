import { describe, expect, it } from 'vitest';
import {
  applyAttendanceCorrection,
  computeAttendance,
  computeWeeklyOvertimeBreakdown,
  type EnginePunch,
  type EngineShiftAssignment,
} from './computeAttendance';

function d(value: string): Date {
  return new Date(value);
}

describe('Shift rules hardening', () => {
  it('R1 — cross-midnight shift produces one record', () => {
    const assignments: EngineShiftAssignment[] = [
      {
        id: 's1',
        employeeId: 'e1',
        scheduledStart: d('2026-04-27T20:00:00.000Z'),
        scheduledEnd: d('2026-04-28T08:00:00.000Z'),
      },
    ];
    const punches: EnginePunch[] = [
      { employeeId: 'e1', type: 'clock_in', timestamp: d('2026-04-27T20:03:00.000Z'), source: 'device' },
      { employeeId: 'e1', type: 'clock_out', timestamp: d('2026-04-28T07:58:00.000Z'), source: 'device' },
    ];

    const records = computeAttendance(punches, assignments);
    expect(records).toHaveLength(1);
    expect(records[0].shiftDate.toISOString().slice(0, 10)).toBe('2026-04-27');
    expect(records[0].totalHours).toBeCloseTo(11.92, 2);
  });

  it('R2 — 16+ hour shift remains one continuous record', () => {
    const assignments: EngineShiftAssignment[] = [
      {
        id: 's1',
        employeeId: 'e1',
        scheduledStart: d('2026-04-27T07:00:00.000Z'),
        scheduledEnd: d('2026-04-27T23:00:00.000Z'),
      },
    ];
    const punches: EnginePunch[] = [
      { employeeId: 'e1', type: 'clock_in', timestamp: d('2026-04-27T06:55:00.000Z'), source: 'device' },
      { employeeId: 'e1', type: 'clock_out', timestamp: d('2026-04-27T23:10:00.000Z'), source: 'device' },
    ];

    const [record] = computeAttendance(punches, assignments, { dailyRegularHours: 8 });
    expect(record.totalHours).toBeCloseTo(16.25, 2);
    expect(record.overtimeHours).toBeCloseTo(8.25, 2);
    expect(record.status).toBe('complete');
  });

  it('R2b — 16+ hour and cross-midnight remains one record', () => {
    const assignments: EngineShiftAssignment[] = [
      {
        id: 's1',
        employeeId: 'e1',
        scheduledStart: d('2026-04-27T19:00:00.000Z'),
        scheduledEnd: d('2026-04-28T12:00:00.000Z'),
      },
    ];
    const punches: EnginePunch[] = [
      { employeeId: 'e1', type: 'clock_in', timestamp: d('2026-04-27T18:55:00.000Z'), source: 'device' },
      { employeeId: 'e1', type: 'clock_out', timestamp: d('2026-04-28T12:05:00.000Z'), source: 'device' },
    ];

    const [record] = computeAttendance(punches, assignments);
    expect(record.totalHours).toBeCloseTo(17.17, 2);
    expect(record.status).toBe('complete');
  });

  it('R3 — punch is matched to nearest scheduled shift', () => {
    const assignments: EngineShiftAssignment[] = [
      {
        id: 'day',
        employeeId: 'e1',
        scheduledStart: d('2026-04-27T08:00:00.000Z'),
        scheduledEnd: d('2026-04-27T20:00:00.000Z'),
      },
      {
        id: 'night',
        employeeId: 'e1',
        scheduledStart: d('2026-04-27T20:00:00.000Z'),
        scheduledEnd: d('2026-04-28T08:00:00.000Z'),
      },
    ];
    const punches: EnginePunch[] = [
      { employeeId: 'e1', type: 'clock_in', timestamp: d('2026-04-27T19:30:00.000Z'), source: 'device' },
      { employeeId: 'e1', type: 'clock_out', timestamp: d('2026-04-28T08:05:00.000Z'), source: 'device' },
    ];

    const records = computeAttendance(punches, assignments, { shiftMatchToleranceHours: 4 });
    const night = records.find((r) => r.shiftAssignmentId === 'night');
    const day = records.find((r) => r.shiftAssignmentId === 'day');
    expect(night?.clockIn?.toISOString()).toBe('2026-04-27T19:30:00.000Z');
    expect(day?.clockIn).toBeNull();
  });

  it('R4 — duplicate punches are debounced within 60 seconds', () => {
    const assignments: EngineShiftAssignment[] = [
      {
        id: 's1',
        employeeId: 'e1',
        scheduledStart: d('2026-04-27T08:00:00.000Z'),
        scheduledEnd: d('2026-04-27T20:00:00.000Z'),
      },
    ];
    const punches: EnginePunch[] = [
      { employeeId: 'e1', type: 'clock_in', timestamp: d('2026-04-27T08:00:00.000Z'), source: 'device' },
      { employeeId: 'e1', type: 'clock_in', timestamp: d('2026-04-27T08:00:45.000Z'), source: 'device' },
      { employeeId: 'e1', type: 'clock_out', timestamp: d('2026-04-27T20:00:00.000Z'), source: 'device' },
    ];
    const [record] = computeAttendance(punches, assignments);
    expect(record.clockIn?.toISOString()).toBe('2026-04-27T08:00:00.000Z');
  });

  it('R5 — missing clock-out is pending review with null end', () => {
    const assignments: EngineShiftAssignment[] = [
      {
        id: 's1',
        employeeId: 'e1',
        scheduledStart: d('2026-04-27T08:00:00.000Z'),
        scheduledEnd: d('2026-04-27T20:00:00.000Z'),
      },
    ];
    const punches: EnginePunch[] = [
      { employeeId: 'e1', type: 'clock_in', timestamp: d('2026-04-27T08:02:00.000Z'), source: 'device' },
    ];
    const [record] = computeAttendance(punches, assignments);
    expect(record.status).toBe('pending_review');
    expect(record.clockOut).toBeNull();
  });

  it('R6 — manual correction preserves original via audit log', () => {
    const base = computeAttendance(
      [
        { employeeId: 'e1', type: 'clock_in', timestamp: d('2026-04-27T08:00:00.000Z'), source: 'manual' },
        { employeeId: 'e1', type: 'clock_out', timestamp: d('2026-04-27T20:00:00.000Z'), source: 'manual' },
      ],
      [{ id: 's1', employeeId: 'e1', scheduledStart: d('2026-04-27T08:00:00.000Z'), scheduledEnd: d('2026-04-27T20:00:00.000Z') }]
    )[0];
    const { corrected, log } = applyAttendanceCorrection(
      base,
      { clockOut: d('2026-04-27T21:00:00.000Z') },
      'supervisor-1',
      'Worked late'
    );
    expect(log.before.clockOut?.toISOString()).toBe('2026-04-27T20:00:00.000Z');
    expect(corrected.clockOut?.toISOString()).toBe('2026-04-27T21:00:00.000Z');
    expect(corrected.status).toBe('corrected');
    expect(log.correctedBy).toBe('supervisor-1');
  });

  it('R7 — weekly overtime config computation', () => {
    const breakdown = computeWeeklyOvertimeBreakdown(
      [
        { date: d('2026-04-27T00:00:00.000Z'), hours: 10 },
        { date: d('2026-04-28T00:00:00.000Z'), hours: 10 },
        { date: d('2026-04-29T00:00:00.000Z'), hours: 10 },
        { date: d('2026-04-30T00:00:00.000Z'), hours: 10 },
        { date: d('2026-05-01T00:00:00.000Z'), hours: 10 },
        { date: d('2026-05-02T00:00:00.000Z'), hours: 8, isRestDay: true },
      ],
      { dailyRegularHours: 8, weeklyRegularHours: 52, weekdayOvertimeMultiplier: 1.5, restDayMultiplier: 2 }
    );

    expect(breakdown.regularHours).toBe(52);
    expect(breakdown.weekdayOvertimeHours).toBe(6);
    expect(breakdown.restDayHours).toBe(8);
  });
});
