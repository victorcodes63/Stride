import { describe, expect, it } from 'vitest';

import { computeLeaveLiability, dailyRateFromSalary } from '@/lib/leave/employee-overview';

describe('employee leave overview', () => {
  it('computes daily rate from monthly salary', () => {
    expect(dailyRateFromSalary(110000)).toBe(5000);
  });

  it('computes leave liability', () => {
    expect(computeLeaveLiability(10, 5000)).toBe(50000);
  });
});
