'use client';

import { useEffect, useMemo, useState } from 'react';
import { ModuleHomePage, type ModuleHomeStat } from '@/components/dashboard/module-home/ModuleHomePage';
import { useDashboardSession } from '@/contexts/dashboard-session';
import type { DashboardModuleDomainId } from '@/lib/dashboard-module-domains';
import { getModuleHomeHeaderActions, getModuleHomeMeta } from '@/lib/dashboard-module-homes';
import { BOOTSTRAP_PENDING_MODULES } from '@/lib/bootstrap-pending-modules';
import { buildDomainWorkspacesFromNav } from '@/lib/dashboard-domain-nav';
import { useDashboardNavBuildOptions } from '@/hooks/use-dashboard-nav-build-options';
import {
  buildModuleDomainKpi,
  resolveOverviewPersona,
  type CrossModuleKpi,
} from '@/lib/dashboard-overview-personalization';

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

type ProjectsSummary = {
  total?: number;
  active?: number;
  openTasks?: number;
};

function buildStats(
  domainId: DashboardModuleDomainId,
  overview: OverviewMetrics | null,
  fleet: FleetOverview | null,
  projectsSummary: ProjectsSummary | null,
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
          label: 'Active projects',
          value: projectsSummary?.active ?? 0,
          hint: `${projectsSummary?.total ?? 0} total`,
          href: '/dashboard/projects/all?status=active',
          tone: 'primary',
        },
        {
          label: 'Open tasks',
          value: projectsSummary?.openTasks ?? 0,
          hint: 'Not done',
          href: '/dashboard/projects/tasks',
          tone: 'violet',
          warn: (projectsSummary?.openTasks ?? 0) > 0,
        },
      ];
    case 'fleet-logistics':
      return [
        {
          label: 'Active trips',
          value: fleet?.trips?.active ?? cross?.activeFleetTrips ?? 0,
          hint: 'In progress',
          href: '/dashboard/fleet/trips',
          tone: 'primary',
        },
        {
          label: 'Vehicles available',
          value: fleet?.vehicles?.available ?? 0,
          hint: `${fleet?.vehicles?.total ?? 0} in fleet`,
          href: '/dashboard/fleet/vehicles',
          tone: 'success',
        },
        {
          label: 'Open exceptions',
          value: fleet?.trips?.exception ?? 0,
          hint: 'Needs attention',
          href: '/dashboard/fleet/trips',
          tone: 'warning',
          warn: (fleet?.trips?.exception ?? 0) > 0,
        },
        {
          label: 'Pending settlements',
          value: fleet?.settlements?.pending ?? 0,
          hint: 'Driver & partner pay',
          href: '/dashboard/fleet/settlements',
          tone: 'violet',
          warn: (fleet?.settlements?.pending ?? 0) > 0,
        },
        {
          label: 'Open incidents',
          value: fleet?.incidents?.open ?? cross?.openFleetIncidents ?? 0,
          hint: 'Fleet incidents',
          href: '/dashboard/fleet/incidents',
          tone: 'warning',
          warn: (fleet?.incidents?.open ?? cross?.openFleetIncidents ?? 0) > 0,
        },
      ];
    case 'admin-operations':
      return [
        {
          label: 'Pending approvals',
          value: overview?.pendingApprovals ?? 0,
          hint: 'Across workflows',
          href: '/dashboard/reports',
          tone: 'warning',
          warn: (overview?.pendingApprovals ?? 0) > 0,
        },
        {
          label: 'Staff on duty',
          value: overview?.onDuty ?? 0,
          hint: `${overview?.totalStaff ?? 0} total staff`,
          href: '/dashboard/employees',
          tone: 'primary',
        },
      ];
    case 'platform-admin':
      return [
        {
          label: 'System users',
          value: overview?.totalStaff ?? 0,
          hint: 'Staff accounts',
          href: '/dashboard/users/staff',
          tone: 'primary',
        },
        {
          label: 'Credential alerts',
          value: (overview?.credentialsExpiring ?? 0) + (overview?.credentialsExpired ?? 0),
          hint: 'Expiring or expired',
          href: '/dashboard/credentials?status=expiring_soon',
          tone: 'warning',
          warn: ((overview?.credentialsExpiring ?? 0) + (overview?.credentialsExpired ?? 0)) > 0,
        },
      ];
  }
}

export function ModuleHomeContent({ domainId }: { domainId: DashboardModuleDomainId }) {
  const { user, modules: sessionModules } = useDashboardSession();
  const navOptions = useDashboardNavBuildOptions();
  const modules = sessionModules ?? BOOTSTRAP_PENDING_MODULES;
  const meta = useMemo(() => getModuleHomeMeta(domainId), [domainId]);
  const workspaces = useMemo(
    () => buildDomainWorkspacesFromNav(navOptions, domainId),
    [navOptions, domainId],
  );
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [fleet, setFleet] = useState<FleetOverview | null>(null);
  const [projectsSummary, setProjectsSummary] = useState<ProjectsSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const needsFleet = domainId === 'fleet-logistics';
    const needsProjects = domainId === 'projects';

    Promise.all([
      fetch('/api/dashboard/overview?metricsOnly=1&slice=core', { credentials: 'include' }).then(async (r) =>
        r.ok ? ((await r.json()) as OverviewMetrics) : null,
      ),
      needsFleet
        ? fetch('/api/fleet/overview', { credentials: 'include' }).then(async (r) =>
            r.ok ? ((await r.json()) as FleetOverview) : null,
          )
        : Promise.resolve(null),
      needsProjects
        ? fetch('/api/projects', { credentials: 'include' }).then(async (r) =>
            r.ok ? ((await r.json()) as { summary?: ProjectsSummary }) : null,
          )
        : Promise.resolve(null),
    ])
      .then(([overviewData, fleetData, projectsData]) => {
        if (cancelled) return;
        setOverview(overviewData);
        setFleet(fleetData);
        setProjectsSummary(projectsData?.summary ?? null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [domainId]);

  const stats = useMemo(
    () => buildStats(domainId, overview, fleet, projectsSummary),
    [domainId, overview, fleet, projectsSummary],
  );

  const snapshotKpi = useMemo((): CrossModuleKpi | null => {
    if (!overview) return null;
    const persona = resolveOverviewPersona(user);
    const base = buildModuleDomainKpi(domainId, {
      totalStaff: overview.totalStaff ?? 0,
      onDuty: overview.onDuty ?? 0,
      pendingLeave: overview.pendingApprovals ?? 0,
      credentialsExpiring: overview.credentialsExpiring ?? 0,
      credentialsExpired: overview.credentialsExpired ?? 0,
      crossModule: {
        invoicesOutstanding: overview.crossModule?.invoicesOutstanding ?? 0,
        vendorBillsOutstanding: overview.crossModule?.vendorBillsOutstanding ?? 0,
        activeFleetTrips: overview.crossModule?.activeFleetTrips ?? 0,
        openFleetIncidents: overview.crossModule?.openFleetIncidents ?? 0,
        pendingPurchaseRequests: overview.crossModule?.pendingPurchaseRequests ?? 0,
      },
      persona,
      modules,
    });
    if (!base) return null;

    if (domainId === 'projects' && projectsSummary) {
      const active = projectsSummary.active ?? 0;
      const tasks = projectsSummary.openTasks ?? 0;
      return {
        ...base,
        value: active,
        note: tasks > 0 ? `${tasks} open tasks` : 'Active projects',
        chartPlaceholder: false,
        chartSegments: [
          { label: 'Active', value: active, tone: active > 0 ? 'primary' : 'muted' },
          { label: 'Tasks', value: tasks, tone: tasks > 0 ? 'violet' : 'muted' },
          { label: 'Total', value: projectsSummary.total ?? 0, tone: 'muted' },
        ],
      };
    }

    if (domainId === 'fleet-logistics' && fleet) {
      const trips = fleet.trips?.active ?? overview.crossModule?.activeFleetTrips ?? 0;
      const incidents = fleet.incidents?.open ?? overview.crossModule?.openFleetIncidents ?? 0;
      const vehicles = fleet.vehicles?.available ?? 0;
      return {
        ...base,
        value: trips,
        note: incidents > 0 ? `${incidents} incidents open` : `${vehicles} vehicles available`,
        chartSegments: [
          { label: 'Trips', value: trips, tone: trips > 0 ? 'violet' : 'muted' },
          { label: 'Incidents', value: incidents, tone: incidents > 0 ? 'amber' : 'muted' },
          { label: 'Available', value: vehicles, tone: vehicles > 0 ? 'emerald' : 'muted' },
        ],
      };
    }

    return base;
  }, [domainId, overview, fleet, projectsSummary, user, modules]);

  const headerActions = useMemo(
    () => getModuleHomeHeaderActions(domainId, user, modules),
    [domainId, user, modules],
  );

  return (
    <ModuleHomePage
      meta={meta}
      workspaces={workspaces}
      stats={stats}
      snapshotKpi={loading ? null : snapshotKpi}
      loading={loading}
      headerActions={headerActions}
    />
  );
}
