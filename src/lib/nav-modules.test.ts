import { describe, expect, it } from 'vitest';
import { BOOTSTRAP_PENDING_MODULES } from '@/lib/bootstrap-pending-modules';
import { isDashboardNavItemVisible } from '@/lib/nav-modules';

describe('nav-modules', () => {
  it('hides performance sub-routes when performance module is off', () => {
    expect(
      isDashboardNavItemVisible(
        '/dashboard/performance/jds',
        'people-hr',
        BOOTSTRAP_PENDING_MODULES,
      ),
    ).toBe(false);
    expect(
      isDashboardNavItemVisible(
        '/dashboard/performance/scorecards',
        'people-hr',
        BOOTSTRAP_PENDING_MODULES,
      ),
    ).toBe(false);
  });

  it('hides ATS routes when ats module is off', () => {
    expect(
      isDashboardNavItemVisible('/dashboard/jobs', 'recruitment', BOOTSTRAP_PENDING_MODULES),
    ).toBe(false);
  });

  it('keeps core people routes when core is on', () => {
    expect(
      isDashboardNavItemVisible('/dashboard/employees', 'people-hr', BOOTSTRAP_PENDING_MODULES),
    ).toBe(true);
  });
});
