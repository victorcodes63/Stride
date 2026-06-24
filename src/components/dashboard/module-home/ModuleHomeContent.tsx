'use client';

import { useEffect, useMemo, useState } from 'react';
import { ModuleHomePage, type ModuleHomeStat } from '@/components/dashboard/module-home/ModuleHomePage';
import { useDashboardSession } from '@/contexts/dashboard-session';
import type { DashboardModuleDomainId } from '@/lib/dashboard-module-domains';
import { getModuleHomeHeaderActions, getModuleHomeMeta } from '@/lib/dashboard-module-homes';
import { ALL_MODULES_ENABLED } from '@/lib/dashboard-nav-catalog';

type OverviewMetrics = {
  totalStaff?: number;
  onDuty?: number;
  pendingApprovals?: number;
  openAttendanceExceptions?: number;
  credentialsExpiring?: number;
  credentialsExpired?: number;
  payroll?: { denied?: boolean; grossTotal?: number; netTotal?: number };
  crossModule?: {
    invoicesOutstanding?: number;
    vendorBillsOutstanding?: number;
    activeFleetTrips?: number;
    openFleetIncidents?: number;
    pendingPurchaseRequests?: number;
  };
};

type FleetOverview = {
  vehicles?: { total?: number; available?: number; inTransit?: number };
  trips?: { active?: number; exception?: number };
  settlements?: { pending?: number };
  incidents?: { open?: number };
};

function buildStats(
  domainId: DashboardModuleDomainId,
  overview: OverviewMetrics | null,
  fleet: FleetOverview | null,
): ModuleHomeStat[] {
  const cross = overview?.crossModule;

  switch (domainId) {
    case 'hr-payroll': {
      const pending = overview?.pendingApprovals ?? 0;
      return [
        {
          label: 'Total staff',
          value: overview?.totalStaff ?? 0,
          hint: 'Active workforce',
          href: '/dashboard/employees',
          tone: 'primary',
        },
        {
          label: 'On duty today',
          value: overview?.onDuty ?? 0,
          hint: 'Clocked in',
          href: '/dashboard/attendance',
          tone: 'success',
        },
        {
          label: 'Leave pending',
          value: pending,
          hint: pending > 0 ? 'Needs approval' : 'Queue clear',
          href: '/dashboard/staff-leave?tab=approvals',
          tone: 'warning',
          warn: pending > 0,
        },
        {
          label: 'Attendance exceptions',
          value: overview?.openAttendanceExceptions ?? 0,
          hint: 'Open today',
          href: '/dashboard/attendance?status=open',
          tone: 'violet',
          warn: (overview?.openAttendanceExceptions ?? 0) > 0,
        },
      ];
    }
    case 'finance':
      return [
        {
          label: 'Unpaid invoices',
          value: cross?.invoicesOutstanding ?? 0,
          hint: 'Awaiting payment',
          href: '/dashboard/accounts/invoices?status=unpaid',
          tone: 'warning',
          warn: (cross?.invoicesOutstanding ?? 0) > 0,
        },
        {
          label: 'Vendor bills',
          value: cross?.vendorBillsOutstanding ?? 0,
          hint: 'AP queue',
          href: '/dashboard/accounts/vendor-bills?status=unpaid',
          tone: 'warning',
          warn: (cross?.vendorBillsOutstanding ?? 0) > 0,
        },
        {
          label: 'Net payroll',
          value: overview?.payroll?.denied
            ? 'Restricted'
            : (overview?.payroll?.netTotal ?? 0).toLocaleString(),
          hint: 'Current month',
          href: '/dashboard/payroll',
          tone: 'success',
        },
      ];
    case 'procurement': {
      const pendingPr = cross?.pendingPurchaseRequests ?? 0;
      return [
        {
          label: 'PRs pending',
          value: pendingPr,
          hint: pendingPr > 0 ? 'Awaiting approval' : 'Queue clear',
          href: '/dashboard/procurement/purchase-requests?status=submitted',
          tone: 'warning',
          warn: pendingPr > 0,
        },
        {
          label: 'Vendor bills due',
          value: cross?.vendorBillsOutstanding ?? 0,
          hint: 'Pay via Finance AP',
          href: '/dashboard/accounts/vendor-bills',
          tone: 'warning',
          warn: (cross?.vendorBillsOutstanding ?? 0) > 0,
        },
        {
          label: 'Vendors',
          value: 'Finance',
          hint: 'Master vendor list',
          href: '/dashboard/accounts/vendors',
          tone: 'primary',
        },
      ];
    }
    case 'legal-documents': {
      const alerts = (overview?.credentialsExpiring ?? 0) + (overview?.credentialsExpired ?? 0);
      return [
        {
          label: 'Credential alerts',
          value: alerts,
          hint: 'Expiring or expired',
          href: '/dashboard/credentials?status=expiring_soon',
          tone: 'warning',
          warn: alerts > 0,
        },
        {
          label: 'Contracts',
          value: 'Live',
          hint: 'Renewal reminders',
          href: '/dashboard/people/contracts',
          tone: 'primary',
        },
        {
          label: 'Policies',
          value: 'Live',
          hint: 'Company documents',
          href: '/dashboard/company-documents',
          tone: 'success',
        },
      ];
    }
    case 'projects':
      return [
        {
          label: 'Budgets',
          value: 'Finance',
          hint: 'Not project-scoped yet',
          href: '/dashboard/accounts/budgets',
          tone: 'primary',
        },
        {
          label: 'Task pattern',
          value: 'HR',
          hint: 'Onboarding tasks live',
          href: '/dashboard/onboarding',
          tone: 'violet',
        },
      ];
    case 'admin-operations':
      return [
        {
          label: 'Active trips',
          value: fleet?.trips?.active ?? cross?.activeFleetTrips ?? 0,
          hint: 'In progress',
          href: '/dashboard/fleet/trips',
          tone: 'primary',
        },
        {
          label: 'Fleet vehicles',
          value: fleet?.vehicles?.total ?? 0,
          hint: `${fleet?.vehicles?.available ?? 0} available`,
          href: '/dashboard/fleet/vehicles',
          tone: 'success',
        },
        {
          label: 'Open incidents',
          value: fleet?.incidents?.open ?? cross?.openFleetIncidents ?? 0,
          hint: 'Needs review',
          href: '/dashboard/fleet/compliance',
          tone: 'warning',
          warn: (fleet?.incidents?.open ?? cross?.openFleetIncidents ?? 0) > 0,
        },
        {
          label: 'Pending settlements',
          value: fleet?.settlements?.pending ?? 0,
          hint: 'Fleet billing',
          href: '/dashboard/fleet/settlements',
          tone: 'violet',
        },
      ];
  }
}

export function ModuleHomeContent({ domainId }: { domainId: DashboardModuleDomainId }) {
  const { user, modules: sessionModules } = useDashboardSession();
  const modules = sessionModules ?? ALL_MODULES_ENABLED;
  const meta = useMemo(() => getModuleHomeMeta(domainId), [domainId]);
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [fleet, setFleet] = useState<FleetOverview | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const needsFleet = domainId === 'admin-operations';

    Promise.all([
      fetch('/api/dashboard/overview?metricsOnly=1', { credentials: 'include' }).then(async (r) =>
        r.ok ? ((await r.json()) as OverviewMetrics) : null,
      ),
      needsFleet
        ? fetch('/api/fleet/overview', { credentials: 'include' }).then(async (r) =>
            r.ok ? ((await r.json()) as FleetOverview) : null,
          )
        : Promise.resolve(null),
    ])
      .then(([overviewData, fleetData]) => {
        if (cancelled) return;
        setOverview(overviewData);
        setFleet(fleetData);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [domainId]);

  const stats = useMemo(() => buildStats(domainId, overview, fleet), [domainId, overview, fleet]);
  const headerActions = useMemo(
    () => getModuleHomeHeaderActions(domainId, user, modules),
    [domainId, user, modules],
  );

  return <ModuleHomePage meta={meta} stats={stats} loading={loading} headerActions={headerActions} />;
}
