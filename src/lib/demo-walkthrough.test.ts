import { describe, expect, it } from 'vitest';

import { DEMO_HR_PRIMARY_PATHS, DEMO_WALKTHROUGH_STEPS } from './demo-walkthrough';

describe('demo-walkthrough', () => {
  it('lists core HR demo paths without duplicates', () => {
    expect(DEMO_WALKTHROUGH_STEPS.length).toBeGreaterThanOrEqual(6);
    expect(new Set(DEMO_HR_PRIMARY_PATHS).size).toBe(DEMO_HR_PRIMARY_PATHS.length);
    for (const step of DEMO_WALKTHROUGH_STEPS) {
      expect(step.href.startsWith('/')).toBe(true);
      expect(step.title.length).toBeGreaterThan(0);
    }
  });

  it('covers leave, payroll, performance, and disbursements', () => {
    const hrefs = DEMO_HR_PRIMARY_PATHS.join(' ');
    expect(hrefs).toContain('/dashboard/leave');
    expect(hrefs).toContain('/dashboard/payroll');
    expect(hrefs).toContain('/dashboard/performance');
    expect(hrefs).toContain('/dashboard/payroll/disbursements');
  });
});
