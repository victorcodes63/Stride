import { describe, expect, it } from 'vitest';
import {
  canTransitionTripStatus,
  FLEET_TRIP_LIFECYCLE_ORDER,
  getAllowedNextTripStatuses,
} from '@/lib/fleet-status';

describe('fleet trip lifecycle', () => {
  it('defines the canonical happy-path order', () => {
    expect(FLEET_TRIP_LIFECYCLE_ORDER).toEqual([
      'planned',
      'allocated',
      'compliance_check',
      'loaded',
      'in_transit',
      'delivered',
      'settled',
      'invoiced',
    ]);
  });

  it('allows staff to advance one step along the workflow', () => {
    for (let i = 0; i < FLEET_TRIP_LIFECYCLE_ORDER.length - 1; i += 1) {
      const from = FLEET_TRIP_LIFECYCLE_ORDER[i];
      const to = FLEET_TRIP_LIFECYCLE_ORDER[i + 1];
      expect(canTransitionTripStatus(from, to, 'staff')).toBe(true);
    }
    expect(canTransitionTripStatus('invoiced', 'closed', 'staff')).toBe(true);
  });

  it('rejects illegal staff jumps', () => {
    expect(canTransitionTripStatus('planned', 'in_transit', 'staff')).toBe(false);
    expect(canTransitionTripStatus('loaded', 'delivered', 'staff')).toBe(false);
    expect(canTransitionTripStatus('delivered', 'invoiced', 'staff')).toBe(false);
    expect(canTransitionTripStatus('closed', 'planned', 'staff')).toBe(false);
  });

  it('allows staff to mark exception from active stages', () => {
    for (const status of ['allocated', 'compliance_check', 'loaded', 'in_transit', 'delivered'] as const) {
      expect(canTransitionTripStatus(status, 'exception', 'staff')).toBe(true);
    }
  });

  it('restricts driver transitions to ESS subset', () => {
    expect(getAllowedNextTripStatuses('loaded', 'driver')).toEqual(['in_transit']);
    expect(canTransitionTripStatus('planned', 'allocated', 'driver')).toBe(false);
    expect(canTransitionTripStatus('loaded', 'in_transit', 'driver')).toBe(true);
    expect(canTransitionTripStatus('in_transit', 'delivered', 'driver')).toBe(true);
    expect(canTransitionTripStatus('delivered', 'settled', 'driver')).toBe(false);
  });

  it('allows idempotent same-status checks', () => {
    expect(canTransitionTripStatus('in_transit', 'in_transit', 'staff')).toBe(true);
  });
});
