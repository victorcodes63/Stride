import type { DashboardModuleDomainId } from '@/lib/dashboard-module-domains';
import { getDashboardModuleDomain } from '@/lib/dashboard-module-domains';
import { getDomainQuickActions } from '@/lib/dashboard-domain-quick-actions';
import type { UserSummary } from '@/types/dashboard';
import type { ModuleKey } from '@/lib/modules';

export type ModuleHomeLink = {
  href: string;
  label: string;
  note?: string;
  icon: import('lucide-react').LucideIcon;
};

export type ModuleHomeWorkspace = {
  title: string;
  links: ModuleHomeLink[];
};

/** Copy-only metadata for module hub pages — workspace links come from sidebar nav. */
export type ModuleHomeMeta = {
  domainId: DashboardModuleDomainId;
  eyebrow: string;
  title: string;
  description: string;
  phase?: string;
  plannedBullets?: string[];
};

export function getModuleHomeMeta(domainId: DashboardModuleDomainId): ModuleHomeMeta {
  const domain = getDashboardModuleDomain(domainId);

  switch (domainId) {
    case 'hr-payroll':
      return {
        domainId,
        eyebrow: domain.marketingLabel,
        title: 'People & workforce',
        description:
          'Headcount, leave, time, payroll, recruitment, and employee lifecycle — your HR command post.',
      };

    case 'finance':
      return {
        domainId,
        eyebrow: domain.marketingLabel,
        title: 'Finance overview',
        description: 'Invoicing, accounts payable, expenses, budgets, and financial reporting.',
      };

    case 'procurement':
      return {
        domainId,
        eyebrow: domain.marketingLabel,
        title: 'Procurement',
        description:
          'Purchase-to-pay: requests, LPOs, receiving, vendors, and spend visibility. Vendor master is shared with Finance.',
      };

    case 'legal-documents':
      return {
        domainId,
        eyebrow: domain.marketingLabel,
        title: 'Legal & compliance',
        description:
          'Contracts, credentials, company policies, and regulatory obligations — one place for document risk.',
      };

    case 'projects':
      return {
        domainId,
        eyebrow: domain.marketingLabel,
        title: 'Projects',
        description: 'Deliverables, milestones, and tasks across client and internal work.',
        phase: 'Phase D — live',
      };

    case 'fleet-logistics':
      return {
        domainId,
        eyebrow: domain.marketingLabel,
        title: 'Fleet & logistics',
        description:
          'End-to-end transport operations — order intake, dispatch, live tracking, compliance, settlements, and client billing. Built for Kenya road freight and cross-border corridors.',
      };

    case 'admin-operations':
      return {
        domainId,
        eyebrow: domain.marketingLabel,
        title: 'Operations',
        description: 'Assets, HSE, company communications, and operational reporting.',
      };

    case 'platform-admin':
      return {
        domainId,
        eyebrow: domain.marketingLabel,
        title: 'Platform admin',
        description:
          'Company branding, system users, roles, holidays, facilities, and workspace settings.',
      };

    case 'hr-outsourcing':
      return {
        domainId,
        eyebrow: domain.marketingLabel,
        title: 'HR Outsourcing',
        description:
          'End clients, outsourced workforce, and per-client payroll, attendance, leave, and disciplinary.',
      };

    case 'sales':
      return {
        domainId,
        eyebrow: domain.marketingLabel,
        title: 'Sales performance',
        description:
          'Pipeline, quotas, attainment, and commission estimates — linked to Finance customers on close.',
      };

    default:
      return {
        domainId,
        eyebrow: domain.marketingLabel,
        title: domain.shortLabel,
        description: 'Module workspace.',
      };
  }
}

export function getModuleHomeHeaderActions(
  domainId: DashboardModuleDomainId,
  user: UserSummary | null,
  modules: Partial<Record<ModuleKey, boolean>>,
) {
  const { primary, more } = getDomainQuickActions(domainId, user, modules);
  const actions: {
    href: string;
    label: string;
    icon: typeof primary.icon;
    variant: 'primary' | 'secondary';
  }[] = [{ href: primary.href, label: primary.label, icon: primary.icon, variant: 'primary' }];
  if (more[0]) {
    actions.push({
      href: more[0].href,
      label: more[0].label,
      icon: more[0].icon,
      variant: 'secondary',
    });
  }
  return actions;
}
