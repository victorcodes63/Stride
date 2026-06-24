import { describe, expect, it } from 'vitest';
import { isWithinQuietHours, shouldEscalateWorkflow } from './notifications';

describe('notification policy quiet hours', () => {
  it('handles quiet window within same day', () => {
    const now = new Date('2026-05-06T09:30:00.000Z');
    expect(isWithinQuietHours(now, '09:00', '10:00')).toBe(true);
    expect(isWithinQuietHours(now, '10:00', '11:00')).toBe(false);
  });

  it('handles overnight quiet window', () => {
    expect(isWithinQuietHours(new Date('2026-05-06T23:30:00.000Z'), '22:00', '06:00')).toBe(true);
    expect(isWithinQuietHours(new Date('2026-05-06T04:30:00.000Z'), '22:00', '06:00')).toBe(true);
    expect(isWithinQuietHours(new Date('2026-05-06T12:30:00.000Z'), '22:00', '06:00')).toBe(false);
  });
});

describe('workflow SLA escalation', () => {
  it('marks overdue pending workflow as escalatable', () => {
    const now = new Date('2026-05-06T10:00:00.000Z');
    const dueAt = new Date('2026-05-06T09:00:00.000Z');
    expect(shouldEscalateWorkflow({ dueAt, status: 'pending', now })).toBe(true);
  });

  it('does not escalate completed workflow', () => {
    const now = new Date('2026-05-06T10:00:00.000Z');
    const dueAt = new Date('2026-05-06T09:00:00.000Z');
    expect(shouldEscalateWorkflow({ dueAt, status: 'completed', now })).toBe(false);
  });

  it('delegated workflow still escalates after due date', () => {
    const now = new Date('2026-05-06T10:00:00.000Z');
    const dueAt = new Date('2026-05-06T09:00:00.000Z');
    expect(shouldEscalateWorkflow({ dueAt, status: 'delegated', now })).toBe(true);
  });
});
