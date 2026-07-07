import { describe, expect, it } from 'vitest';
import {
  HR_DOMAIN_PRESETS,
  applyHrDomainPreset,
  countHrOptionalHorizontalModules,
} from '@/lib/module-presets';
import { allModulesAdminEnabled } from '@/lib/module-admin-flags';

describe('module-presets', () => {
  it('defines three HR domain presets', () => {
    expect(HR_DOMAIN_PRESETS.map((p) => p.id)).toEqual([
      'hr-essentials',
      'hr-talent',
      'full-hr',
    ]);
  });

  it('hr-essentials hides recruitment and vertical engines', () => {
    const next = applyHrDomainPreset('hr-essentials', allModulesAdminEnabled());
    expect(next.ats).toBe(false);
    expect(next.fleet).toBe(false);
    expect(next.leave).toBe(true);
    expect(next.payroll).toBe(true);
  });

  it('hr-talent enables ats and assessments', () => {
    const next = applyHrDomainPreset('hr-talent', allModulesAdminEnabled());
    expect(next.ats).toBe(true);
    expect(next.assessments).toBe(true);
    expect(next.performance).toBe(false);
  });

  it('full-hr enables talent and performance stack', () => {
    const next = applyHrDomainPreset('full-hr', allModulesAdminEnabled());
    expect(next.ats).toBe(true);
    expect(next.performance).toBe(true);
    expect(next.training).toBe(true);
    expect(next.sales).toBe(true);
  });

  it('counts only HR optional horizontal modules for quota', () => {
    const count = countHrOptionalHorizontalModules({
      ...allModulesAdminEnabled(),
      procurement: true,
      fleet: true,
    });
    expect(count).toBeGreaterThanOrEqual(4);
    const withoutProcurement = countHrOptionalHorizontalModules({
      ...allModulesAdminEnabled(),
      procurement: false,
      fleet: false,
      ats: true,
      performance: true,
      training: false,
      assessments: false,
      sales: false,
    });
    expect(withoutProcurement).toBe(2);
  });
});
