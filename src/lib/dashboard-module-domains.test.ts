import { describe, expect, it } from 'vitest';
import { BOOTSTRAP_PENDING_MODULES } from '@/lib/bootstrap-pending-modules';
import { resolveDomainAccess } from '@/lib/dashboard-module-domains';
import type { ModuleKey } from '@/lib/modules';

function modules(overrides: Partial<Record<ModuleKey, boolean>> = {}) {
  return { ...BOOTSTRAP_PENDING_MODULES, ...overrides };
}

describe('resolveDomainAccess', () => {
  it('locks fleet when fleet is not entitled', () => {
    expect(resolveDomainAccess('fleet-logistics', modules(), 'growth')).toBe('locked');
    expect(
      resolveDomainAccess('fleet-logistics', modules({ fleet: true }), 'growth'),
    ).toBe('active');
  });

  it('locks finance when accounts is not entitled', () => {
    expect(
      resolveDomainAccess('finance', modules({ accounts: false }), 'growth'),
    ).toBe('locked');
    expect(
      resolveDomainAccess('finance', modules({ accounts: true }), 'growth'),
    ).toBe('active');
  });

  it('locks projects when projects key is not entitled', () => {
    expect(resolveDomainAccess('projects', modules(), 'growth')).toBe('locked');
    expect(
      resolveDomainAccess('projects', modules({ projects: true }), 'growth'),
    ).toBe('active');
  });

  it('locks HR outsourcing when outsourcing is not entitled', () => {
    expect(resolveDomainAccess('hr-outsourcing', modules(), 'growth')).toBe('locked');
    expect(
      resolveDomainAccess('hr-outsourcing', modules({ outsourcing: true }), 'growth'),
    ).toBe('active');
  });
});
