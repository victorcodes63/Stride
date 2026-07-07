import { describe, expect, it } from 'vitest';
import { BOOTSTRAP_PENDING_MODULES } from '@/lib/bootstrap-pending-modules';
import { ALL_MODULES_ENABLED } from '@/lib/dashboard-nav-catalog';
import {
  buildDomainWorkspacesFromNav,
  getDomainNavModuleItems,
} from '@/lib/dashboard-domain-nav';

const navOptions = {
  currentUserRole: 'admin' as const,
  hasAccountsAccess: true,
  canViewSystemAnalytics: true,
  canAccessCompanySetup: true,
  enabledModules: ALL_MODULES_ENABLED,
};

describe('dashboard-domain-nav', () => {
  it('finance overview matches finance sidebar destinations', () => {
    const items = getDomainNavModuleItems(navOptions, 'finance');
    const hrefs = items.map((item) => item.href);

    expect(hrefs).toContain('/dashboard/accounts/clients');
    expect(hrefs).toContain('/dashboard/accounts/mpesa-reconciliation');
    expect(hrefs).not.toContain('/dashboard/accounts');
    expect(hrefs).not.toContain('/dashboard/people/contracts');
  });

  it('legal overview includes contracts from the legal sidebar', () => {
    const items = getDomainNavModuleItems(navOptions, 'legal-documents');
    const hrefs = items.map((item) => item.href);

    expect(hrefs).toContain('/dashboard/people/contracts');
    expect(hrefs).toContain('/dashboard/credentials');
    expect(hrefs).not.toContain('/dashboard/legal');
  });

  it('builds workspace panels from nav sections', () => {
    const workspaces = buildDomainWorkspacesFromNav(navOptions, 'hr-payroll');
    const labels = workspaces.flatMap((ws) => ws.links.map((link) => link.label));

    expect(workspaces.some((ws) => ws.title === 'People')).toBe(true);
    expect(labels).toContain('Employees');
    expect(labels).toContain('Payroll runs');
  });

  it('hr overview workspaces match entitled sidebar destinations', () => {
    const navOptionsRestricted = {
      ...navOptions,
      enabledModules: BOOTSTRAP_PENDING_MODULES,
    };
    const sidebarHrefs = getDomainNavModuleItems(navOptionsRestricted, 'hr-payroll').map(
      (item) => item.href,
    );
    const workspaceHrefs = buildDomainWorkspacesFromNav(navOptionsRestricted, 'hr-payroll').flatMap(
      (ws) => ws.links.map((link) => link.href),
    );

    expect(sidebarHrefs).not.toContain('/dashboard/jobs');
    expect(workspaceHrefs).not.toContain('/dashboard/jobs');
    expect(workspaceHrefs).not.toContain('/dashboard/performance/jds');
    expect(new Set(workspaceHrefs)).toEqual(new Set(sidebarHrefs));
  });
});
