import { describe, expect, it } from 'vitest';
import { ACTIVE_ALLOCATION_TRIP_STATUSES } from '@/lib/fleet-allocation';

describe('fleet allocation', () => {
  it('blocks double-booking on active trip statuses only', () => {
    expect(ACTIVE_ALLOCATION_TRIP_STATUSES).toContain('allocated');
    expect(ACTIVE_ALLOCATION_TRIP_STATUSES).toContain('in_transit');
    expect(ACTIVE_ALLOCATION_TRIP_STATUSES).not.toContain('delivered');
    expect(ACTIVE_ALLOCATION_TRIP_STATUSES).not.toContain('planned');
  });
});
