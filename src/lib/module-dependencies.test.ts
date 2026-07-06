import { describe, expect, it } from 'vitest';
import {
  cascadeDisableDependents,
  enforceDependencyClosure,
  getDisabledRequiredParents,
  getTransitiveDependents,
} from '@/lib/module-dependencies';
import { allModulesAdminEnabled } from '@/lib/module-admin-flags';

describe('module-dependencies', () => {
  it('cascades disable from core to ats and performance', () => {
    const flags = allModulesAdminEnabled();
    const next = cascadeDisableDependents('core', flags);
    expect(next.core).toBe(false);
    expect(next.ats).toBe(false);
    expect(next.performance).toBe(false);
    expect(next.assessments).toBe(false);
    expect(next.sales).toBe(false);
  });

  it('cascades disable from performance to sales', () => {
    const flags = allModulesAdminEnabled();
    const next = cascadeDisableDependents('performance', { ...flags, core: true });
    expect(next.performance).toBe(false);
    expect(next.sales).toBe(false);
    expect(next.ats).toBe(true);
  });

  it('reports missing parents for assessments when ats is off', () => {
    const flags = { ...allModulesAdminEnabled(), ats: false };
    expect(getDisabledRequiredParents('assessments', flags)).toEqual(['ats']);
  });

  it('enforceDependencyClosure turns off sales when performance is off', () => {
    const flags = { ...allModulesAdminEnabled(), performance: false, sales: true };
    const next = enforceDependencyClosure(flags);
    expect(next.sales).toBe(false);
  });

  it('lists transitive dependents of core', () => {
    const deps = getTransitiveDependents('core');
    expect(deps).toContain('ats');
    expect(deps).toContain('performance');
    expect(deps).toContain('sales');
  });
});
