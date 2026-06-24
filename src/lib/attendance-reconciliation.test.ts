import { describe, expect, it } from 'vitest';
import { computeReconciledSummaryMetrics } from './attendance-reconciliation';

function dt(iso: string): Date {
  return new Date(iso);
}

/** Mirrors `POST /api/outsourcing/payroll/generate` overtime allowance (excluding payroll-calc). */
function overtimeAllowanceFromAttendanceMinutes(overtimeMinutes: number, basicSalary: number): number {
  const hourlyRate = basicSalary > 0 ? basicSalary / (26 * 8) : 0;
  return Math.round((overtimeMinutes / 60) * hourlyRate * 1.5 * 100) / 100;
}

const noHolidayResolver = async () => ({ isHoliday: false });

describe('computeReconciledSummaryMetrics (production path via shift engine)', () => {
  it('cross-midnight: one segment, start-date shift, hours match engine pairing', async () => {
    const shift = {
      id: 's-night',
      startsAt: dt('2026-04-27T20:00:00.000Z'),
      endsAt: dt('2026-04-28T08:00:00.000Z'),
      breakMinutes: 0,
    };
    const events = [
      { kind: 'check_in', observedAt: dt('2026-04-27T20:03:00.000Z'), source: 'biometric' },
      { kind: 'check_out', observedAt: dt('2026-04-28T07:58:00.000Z'), source: 'biometric' },
    ];
    const m = await computeReconciledSummaryMetrics(events, [shift], 'e1', noHolidayResolver);
    expect(m.firstInAt?.toISOString()).toBe('2026-04-27T20:03:00.000Z');
    expect(m.lastOutAt?.toISOString()).toBe('2026-04-28T07:58:00.000Z');
    expect(m.minutesWorked).toBe(715);
    const scheduled = 12 * 60;
    expect(m.overtimeMinutes).toBe(Math.max(0, 715 - scheduled));
    expect(m.summaryStatus).toBe('reconciled');
  });

  it('16+ hour shift: one record, overtime vs scheduled shift (not daily bucket)', async () => {
    const shift = {
      id: 's-long',
      startsAt: dt('2026-04-27T07:00:00.000Z'),
      endsAt: dt('2026-04-27T23:00:00.000Z'),
      breakMinutes: 0,
    };
    const events = [
      { kind: 'check_in', observedAt: dt('2026-04-27T06:55:00.000Z'), source: 'biometric' },
      { kind: 'check_out', observedAt: dt('2026-04-27T23:10:00.000Z'), source: 'biometric' },
    ];
    const m = await computeReconciledSummaryMetrics(events, [shift], 'e1', noHolidayResolver);
    expect(m.minutesWorked).toBe(975);
    expect(m.overtimeMinutes).toBe(975 - 16 * 60);
    expect(m.summaryStatus).toBe('reconciled');
  });

  it('16+ hours crossing midnight: one segment', async () => {
    const shift = {
      id: 's-x',
      startsAt: dt('2026-04-27T19:00:00.000Z'),
      endsAt: dt('2026-04-28T12:00:00.000Z'),
      breakMinutes: 0,
    };
    const events = [
      { kind: 'check_in', observedAt: dt('2026-04-27T18:55:00.000Z'), source: 'biometric' },
      { kind: 'check_out', observedAt: dt('2026-04-28T12:05:00.000Z'), source: 'biometric' },
    ];
    const m = await computeReconciledSummaryMetrics(events, [shift], 'e1', noHolidayResolver);
    expect(m.minutesWorked).toBe(1030);
    const scheduled = 17 * 60;
    expect(m.overtimeMinutes).toBe(1030 - scheduled);
    expect(m.summaryStatus).toBe('reconciled');
  });

  it('missing clock-out: draft status and no last out', async () => {
    const shift = {
      id: 's1',
      startsAt: dt('2026-04-27T08:00:00.000Z'),
      endsAt: dt('2026-04-27T20:00:00.000Z'),
      breakMinutes: 0,
    };
    const events = [{ kind: 'check_in', observedAt: dt('2026-04-27T08:02:00.000Z'), source: 'biometric' }];
    const m = await computeReconciledSummaryMetrics(events, [shift], 'e1', noHolidayResolver);
    expect(m.summaryStatus).toBe('draft');
    expect(m.lastOutAt).toBeNull();
    expect(m.minutesWorked).toBe(0);
    expect(m.overtimeMinutes).toBe(0);
  });

  it('debounces duplicate check-ins within 60s (shift engine)', async () => {
    const shift = {
      id: 's1',
      startsAt: dt('2026-04-27T08:00:00.000Z'),
      endsAt: dt('2026-04-27T20:00:00.000Z'),
      breakMinutes: 0,
    };
    const events = [
      { kind: 'check_in', observedAt: dt('2026-04-27T08:00:00.000Z'), source: 'biometric' },
      { kind: 'check_in', observedAt: dt('2026-04-27T08:00:45.000Z'), source: 'biometric' },
      { kind: 'check_out', observedAt: dt('2026-04-27T20:00:00.000Z'), source: 'biometric' },
    ];
    const m = await computeReconciledSummaryMetrics(events, [shift], 'e1', noHolidayResolver);
    expect(m.firstInAt?.toISOString()).toBe('2026-04-27T08:00:00.000Z');
    expect(m.minutesWorked).toBe(12 * 60);
  });

  it('payroll overtime line uses reconciled minutes × hourly × 1.5', () => {
    const basic = 26 * 8 * 1000;
    const allowance = overtimeAllowanceFromAttendanceMinutes(120, basic);
    expect(allowance).toBe(3000);
  });
});
