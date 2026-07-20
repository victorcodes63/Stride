import { describe, expect, it, vi, beforeEach } from 'vitest';

const resolvePrimaryWorkspaceClientId = vi.fn();

vi.mock('@/lib/primary-workspace-client', () => ({
  resolvePrimaryWorkspaceClientId: (...args: unknown[]) => resolvePrimaryWorkspaceClientId(...args),
}));

import {
  payrollApiBase,
  payrollBasePath,
  resolvePayrollClientId,
} from '@/lib/payroll-api/scope';

describe('payroll scope helpers', () => {
  beforeEach(() => {
    resolvePrimaryWorkspaceClientId.mockReset();
    resolvePrimaryWorkspaceClientId.mockResolvedValue('primary-workspace-client');
  });

  it('maps each surface to its own dashboard + api namespace', () => {
    expect(payrollBasePath('internal')).toBe('/dashboard/payroll');
    expect(payrollApiBase('internal')).toBe('/api/payroll');
    expect(payrollBasePath('outsourcing')).toBe('/dashboard/outsourcing/payroll');
    expect(payrollApiBase('outsourcing')).toBe('/api/outsourcing/payroll');
  });

  it('internal payroll ignores an inbound clientId and resolves the primary workspace client', async () => {
    const db = {} as never;
    const request = {} as never;
    const clientId = await resolvePayrollClientId(
      'internal',
      db,
      'some-end-client-id',
      request,
      'org-1',
    );

    expect(clientId).toBe('primary-workspace-client');
    // The end-client id must be dropped (null) before hitting the resolver.
    expect(resolvePrimaryWorkspaceClientId).toHaveBeenCalledWith(db, null, request, 'org-1');
  });

  it('outsourcing payroll forwards the requested end-client id', async () => {
    const db = {} as never;
    const request = {} as never;
    await resolvePayrollClientId('outsourcing', db, 'end-client-42', request, 'org-1');

    expect(resolvePrimaryWorkspaceClientId).toHaveBeenCalledWith(
      db,
      'end-client-42',
      request,
      'org-1',
    );
  });
});
