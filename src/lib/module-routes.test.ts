import { describe, expect, it } from 'vitest';
import { resolveModuleForPath } from '@/lib/module-routes';

describe('module-routes', () => {
  it('resolves nested payroll paths', () => {
    expect(resolveModuleForPath('/dashboard/payroll/payslips')).toBe('payroll');
  });

  it('gates the internal payroll API + pages by the payroll module', () => {
    expect(resolveModuleForPath('/dashboard/payroll')).toBe('payroll');
    expect(resolveModuleForPath('/dashboard/payroll/statutory')).toBe('payroll');
    expect(resolveModuleForPath('/dashboard/payroll/disbursements')).toBe('payroll');
    expect(resolveModuleForPath('/api/payroll')).toBe('payroll');
    expect(resolveModuleForPath('/api/payroll/generate')).toBe('payroll');
    expect(resolveModuleForPath('/api/payroll/statutory')).toBe('payroll');
  });

  it('gates outsourcing client payroll by the outsourcing module, not payroll', () => {
    expect(resolveModuleForPath('/dashboard/outsourcing/payroll')).toBe('outsourcing');
    expect(resolveModuleForPath('/api/outsourcing/payroll')).toBe('outsourcing');
    expect(resolveModuleForPath('/api/outsourcing/payroll/generate')).toBe('outsourcing');
  });

  it('resolves outsourcing paths to their functional modules', () => {
    expect(resolveModuleForPath('/dashboard/outsourcing')).toBe('outsourcing');
    expect(resolveModuleForPath('/api/outsourcing/clients')).toBe('outsourcing');
    expect(resolveModuleForPath('/dashboard/outsourcing/leave')).toBe('leave');
    expect(resolveModuleForPath('/dashboard/outsourcing/disciplinary')).toBe('outsourcing');
  });

  it('resolves leave before generic ess', () => {
    expect(resolveModuleForPath('/ess/leave')).toBe('leave');
    expect(resolveModuleForPath('/api/ess/leave/applications')).toBe('leave');
  });

  it('returns null for overview and login', () => {
    expect(resolveModuleForPath('/dashboard')).toBeNull();
    expect(resolveModuleForPath('/dashboard/login')).toBeNull();
  });

  it('maps careers to ATS', () => {
    expect(resolveModuleForPath('/careers/apply/abc')).toBe('ats');
  });
});
