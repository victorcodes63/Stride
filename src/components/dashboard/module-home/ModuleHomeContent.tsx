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
    salesStalledDeals?: number;
    salesPastDueCloses?: number;
    salesClosingThisWeek?: number;
    salesWeightedPipelineKes?: number;
    assetsAssigned?: number;
    assetsPendingHandoverAck?: number;
    assetsWarrantyExpiring?: number;
    openHseIncidents?: number;
    openHseActions?: number;
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

type AssetsSummary = {
  total?: number;
  assigned?: number;
  available?: number;
  maintenance?: number;
  warrantyExpiring?: number;
  handoverPending?: number;
  maintenanceDue?: number;
};

type HseSummary = {
  openCount?: number;
  followUpCount?: number;
};

type OpsSummary = {
  assets: AssetsSummary | null;
  hse: HseSummary | null;
};

type OutsourcingSummary = {
  endClients?: { total?: number; active?: number };
  workforce?: { total?: number; active?: number };
  leave?: { pendingApprovals?: number; onLeaveToday?: number };
  payroll?: { runsThisMonth?: number; month?: number; year?: number };
  attendance?: { openExceptions?: number };
  disciplinary?: { openCases?: number };
  billing?: { invoicesThisMonth?: number };
  rpo?: { openJobs?: number };
};

function buildStats(
  domainId: DashboardModuleDomainId,
  overview: OverviewMetrics | null,
  fleet: FleetOverview | null,
  projectsSummary: ProjectsSummary | null,
  opsSummary: OpsSummary | null,
  outsourcing: OutsourcingSummary | null,
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
    case 'admin-operations': {
      const assets = opsSummary?.assets;
      const totalAssets = assets?.total ?? 0;
      const assignedAssets = assets?.assigned ?? cross?.assetsAssigned ?? 0;
      const warrantyAlerts = assets?.warrantyExpiring ?? cross?.assetsWarrantyExpiring ?? 0;
      const pendingAck = assets?.handoverPending ?? cross?.assetsPendingHandoverAck ?? 0;
      const maintenanceDue = assets?.maintenanceDue ?? 0;
      const hseOpen =
        opsSummary?.hse != null
          ? (opsSummary.hse.openCount ?? 0)
          : (cross?.openHseIncidents ?? 0) + (cross?.openHseActions ?? 0);
      const hseFollowUp = opsSummary?.hse?.followUpCount ?? cross?.openHseActions ?? 0;
      return [
        {
          label: 'Total assets',
          value: totalAssets,
          hint: `${assets?.available ?? 0} available`,
          href: '/dashboard/assets',
          tone: 'primary',
        },
        {
          label: 'Assets assigned',
          value: assignedAssets,
          hint: pendingAck > 0 ? `${pendingAck} awaiting handover ack` : 'Currently issued',
          href: '/dashboard/assets?assigned=1',
          tone: 'sky',
        },
        {
          label: 'Handover pending',
          value: pendingAck,
          hint: pendingAck > 0 ? 'Awaiting acknowledgement' : 'All acknowledged',
          href: '/dashboard/assets?assigned=1',
          tone: 'warning',
          warn: pendingAck > 0,
        },
        {
          label: 'Maintenance due',
          value: maintenanceDue,
          hint: 'Due in 30 days',
          href: '/dashboard/assets',
          tone: 'violet',
          warn: maintenanceDue > 0,
        },
        {
          label: 'Warranty alerts',
          value: warrantyAlerts,
          hint: 'Expiring in 30 days',
          href: '/dashboard/assets',
          tone: 'warning',
          warn: warrantyAlerts > 0,
        },
        {
          label: 'Open HSE incidents',
          value: hseOpen,
          hint: hseFollowUp > 0 ? `${hseFollowUp} follow-up actions` : 'Incidents & safety',
          href: '/dashboard/hse',
          tone: 'warning',
          warn: hseOpen > 0,
        },
      ];
    }
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
    case 'sales':
      return [
        {
          label: 'Weighted pipeline',
          value: (cross?.salesWeightedPipelineKes ?? 0).toLocaleString('en-KE'),
          hint: 'KES open × probability',
          href: '/dashboard/sales/deals',
          tone: 'primary',
        },
        {
          label: 'Closing this week',
          value: cross?.salesClosingThisWeek ?? 0,
          hint: 'Expected closes',
          href: '/dashboard/sales/deals',
          tone: 'violet',
        },
        {
          label: 'Past-due closes',
          value: cross?.salesPastDueCloses ?? 0,
          hint: 'Needs attention',
          href: '/dashboard/sales/deals',
          tone: 'warning',
          warn: (cross?.salesPastDueCloses ?? 0) > 0,
        },
        {
          label: 'Stalled deals',
          value: cross?.salesStalledDeals ?? 0,
          hint: '14+ days idle',
          href: '/dashboard/sales/deals',
          tone: 'warning',
          warn: (cross?.salesStalledDeals ?? 0) > 0,
        },
      ];
    case 'hr-outsourcing': {
      const pendingLeave = outsourcing?.leave?.pendingApprovals ?? 0;
      const attendanceExceptions = outsourcing?.attendance?.openExceptions ?? 0;
      return [
        {
          label: 'End clients',
          value: outsourcing?.endClients?.total ?? 0,
          hint: `${outsourcing?.endClients?.active ?? 0} active`,
          href: '/dashboard/outsourcing/clients',
          tone: 'primary',
        },
        {
          label: 'Outsourced workforce',
          value: outsourcing?.workforce?.total ?? 0,
          hint: `${outsourcing?.workforce?.active ?? 0} active`,
          href: '/dashboard/outsourcing/employees',
          tone: 'sky',
        },
        {
          label: 'On leave today',
          value: outsourcing?.leave?.onLeaveToday ?? 0,
          hint: 'Away today',
          href: '/dashboard/outsourcing/leave',
          tone: 'violet',
        },
        {
          label: 'Leave pending',
          value: pendingLeave,
          hint: pendingLeave > 0 ? 'Needs approval' : 'Queue clear',
          href: '/dashboard/outsourcing/leave',
          tone: 'warning',
          warn: pendingLeave > 0,
        },
        {
          label: 'Attendance exceptions',
          value: attendanceExceptions,
          hint: 'Open today',
          href: '/dashboard/outsourcing/attendance',
          tone: 'warning',
          warn: attendanceExceptions > 0,
        },
        {
          label: 'Invoices this month',
          value: outsourcing?.billing?.invoicesThisMonth ?? 0,
          hint: 'Client billing',
          href: '/dashboard/outsourcing/billing',
          tone: 'success',
        },
      ];
    }
    default:
      return [];
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
  const [opsSummary, setOpsSummary] = useState<OpsSummary | null>(null);
  const [outsourcing, setOutsourcing] = useState<OutsourcingSummary | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const needsFleet = domainId === 'fleet-logistics';
    const needsProjects = domainId === 'projects';
    const needsOps = domainId === 'admin-operations';
    const needsOutsourcing = domainId === 'hr-outsourcing';

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
      needsOps
        ? fetch('/api/assets/summary', { credentials: 'include' }).then(async (r) =>
            r.ok ? ((await r.json()) as AssetsSummary) : null,
          )
        : Promise.resolve(null),
      needsOps
        ? fetch('/api/hse/incidents?page=1&pageSize=1', { credentials: 'include' }).then(async (r) =>
            r.ok ? ((await r.json()) as { summary?: HseSummary }) : null,
          )
        : Promise.resolve(null),
      needsOutsourcing
        ? fetch('/api/outsourcing/overview', { credentials: 'include' }).then(async (r) =>
            r.ok ? ((await r.json()) as OutsourcingSummary) : null,
          )
        : Promise.resolve(null),
    ])
      .then(([overviewData, fleetData, projectsData, assetsData, hseData, outsourcingData]) => {
        if (cancelled) return;
        setOverview(overviewData);
        setFleet(fleetData);
        setProjectsSummary(projectsData?.summary ?? null);
        setOpsSummary(
          needsOps
            ? { assets: assetsData ?? null, hse: hseData?.summary ?? null }
            : null,
        );
        setOutsourcing(outsourcingData);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [domainId]);

  const stats = useMemo(
    () => buildStats(domainId, overview, fleet, projectsSummary, opsSummary, outsourcing),
    [domainId, overview, fleet, projectsSummary, opsSummary, outsourcing],
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
        salesStalledDeals: overview.crossModule?.salesStalledDeals ?? 0,
        salesPastDueCloses: overview.crossModule?.salesPastDueCloses ?? 0,
        salesClosingThisWeek: overview.crossModule?.salesClosingThisWeek ?? 0,
        salesWeightedPipelineKes: overview.crossModule?.salesWeightedPipelineKes ?? 0,
        assetsAssigned: overview.crossModule?.assetsAssigned ?? 0,
        assetsPendingHandoverAck: overview.crossModule?.assetsPendingHandoverAck ?? 0,
        assetsWarrantyExpiring: overview.crossModule?.assetsWarrantyExpiring ?? 0,
        openHseIncidents: overview.crossModule?.openHseIncidents ?? 0,
        openHseActions: overview.crossModule?.openHseActions ?? 0,
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
