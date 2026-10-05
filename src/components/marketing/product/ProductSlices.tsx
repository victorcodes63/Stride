'use client';

/**
 * Marketing previews built from the dashboard's real components, fed the demo tenant.
 * Only import presentational dashboard components here — nothing that fetches data,
 * reads the session or touches the database.
 */
import { ModuleKpiSnapshotCard } from '@/components/dashboard/overview/ModuleKpiSnapshotCard';
import { NeedsAttentionSection } from '@/components/dashboard/overview/NeedsAttentionSection';
import { OverviewModuleCommandCenter } from '@/components/dashboard/overview/OverviewModuleCommandCenter';
import type { DashboardModuleDomainId } from '@/lib/dashboard-module-domains';
import {
  DEMO_ATTENTION_ITEMS,
  DEMO_DOMAINS,
  DEMO_DOMAIN_SNAPSHOTS,
  DEMO_KPIS,
  demoAttentionByDomain,
} from './demo-tenant';
import { ProductFrame } from './ProductFrame';

type FrameOptions = {
  className?: string;
  /** Fill a fixed-height parent (crops the bottom like a screenshot). */
  fill?: boolean;
  designWidth?: number;
};

function domainIcon(id: DashboardModuleDomainId) {
  return DEMO_DOMAINS.find((d) => d.id === id)!.icon;
}

/** Row of "Across the business" KPI cards. */
function KpiRow({ domains }: { domains?: DashboardModuleDomainId[] }) {
  const kpis = domains ? DEMO_KPIS.filter((k) => domains.includes(k.domainId)) : DEMO_KPIS;
  return (
    <div className={`grid gap-3 ${kpis.length >= 4 ? 'grid-cols-4' : kpis.length === 3 ? 'grid-cols-3' : 'grid-cols-2'}`}>
      {kpis.map((kpi) => (
        <ModuleKpiSnapshotCard
          key={kpi.label}
          label={kpi.label}
          value={kpi.value}
          note={kpi.note}
          icon={domainIcon(kpi.domainId)}
          href="#"
          chartSegments={kpi.segments}
        />
      ))}
    </div>
  );
}

/**
 * The dashboard home: KPI cards plus "Needs attention now".
 * Pass `domains` to narrow it to one area (e.g. HR & Payroll).
 */
export function ProductOverviewSlice({
  domains,
  ...frame
}: FrameOptions & { domains?: DashboardModuleDomainId[] }) {
  const items = domains ? DEMO_ATTENTION_ITEMS.filter((i) => domains.includes(i.domainId)) : DEMO_ATTENTION_ITEMS;
  const visibleDomains = domains ? DEMO_DOMAINS.filter((d) => domains.includes(d.id)) : DEMO_DOMAINS;
  return (
    <ProductFrame
      label="Stride dashboard: today's numbers and the items that need attention"
      path="/dashboard"
      designWidth={frame.designWidth ?? 720}
      fill={frame.fill}
      className={frame.className}
    >
      <div className="space-y-4">
        <KpiRow domains={domains} />
        <NeedsAttentionSection
          items={items}
          domains={visibleDomains}
          attentionByDomain={demoAttentionByDomain(items)}
        />
      </div>
    </ProductFrame>
  );
}

/** "Business pulse": one-line status for every module switched on, optionally under the KPI row. */
export function ProductBusinessPulseSlice({ withKpis = false, ...frame }: FrameOptions & { withKpis?: boolean }) {
  return (
    <ProductFrame
      label="Stride business pulse: one status line per module"
      path="/dashboard"
      designWidth={frame.designWidth ?? 720}
      fill={frame.fill}
      className={frame.className}
    >
      <div className="space-y-4">
        {withKpis ? <KpiRow /> : null}
        <OverviewModuleCommandCenter
          domains={DEMO_DOMAINS}
          attentionByDomain={demoAttentionByDomain()}
          domainSnapshots={DEMO_DOMAIN_SNAPSHOTS}
        />
      </div>
    </ProductFrame>
  );
}
