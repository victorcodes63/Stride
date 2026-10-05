'use client';

/**
 * Industry-pack previews built from the same components the dashboard pages render.
 * Each preview = the real page header + the real view component, fed demo data.
 */
import type { ReactNode } from 'react';
import { ApplicationsKanban } from '@/components/dashboard/ApplicationsKanban';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { ConstructionSiteTable } from '@/components/construction/ConstructionSiteTable';
import { EnergyHseRollupTable } from '@/components/energy/EnergyHseRollupTable';
import { FleetTripBoard } from '@/components/fleet/FleetTripBoard';
import { ClinicalRotaGrid } from '@/components/healthcare/ClinicalRotaGrid';
import { SaccoMemberRegister } from '@/components/sacco/SaccoMemberRegister';
import type { MarketingVerticalScreenshotId } from '@/lib/marketing-config';
import {
  DEMO_APPLICATIONS,
  DEMO_CONSTRUCTION_SITES,
  DEMO_ENERGY_ROLLUP,
  DEMO_FLEET_COLUMNS,
  DEMO_FLEET_TRIPS,
  DEMO_ROTA_ASSIGNMENTS,
  DEMO_ROTA_WARDS,
  DEMO_ROTA_WEEK_START,
  DEMO_SACCO_MEMBERS,
} from './demo-industries';
import { ProductFrame } from './ProductFrame';

type PreviewConfig = {
  path: string;
  eyebrow?: string;
  title: string;
  label: string;
  body: ReactNode;
};

const noop = () => undefined;

const PREVIEWS: Record<MarketingVerticalScreenshotId, PreviewConfig> = {
  logistics: {
    path: '/dashboard/fleet/trips',
    eyebrow: 'Fleet & Logistics',
    title: 'Trip board',
    label: 'Stride fleet trip board with planned, in-transit and delivered trips',
    body: <FleetTripBoard trips={DEMO_FLEET_TRIPS} columns={DEMO_FLEET_COLUMNS} tripHref={() => '#'} />,
  },
  saccos: {
    path: '/dashboard/sacco/members',
    eyebrow: 'SACCO',
    title: 'Members',
    label: 'Stride SACCO member register',
    body: <SaccoMemberRegister members={DEMO_SACCO_MEMBERS} showBalances={false} />,
  },
  healthcare: {
    path: '/dashboard/healthcare/rota',
    eyebrow: 'Healthcare',
    title: 'Clinical rota',
    label: 'Stride clinical rota: wards by day with licence checks',
    body: <ClinicalRotaGrid assignments={DEMO_ROTA_ASSIGNMENTS} wards={DEMO_ROTA_WARDS} weekStart={DEMO_ROTA_WEEK_START} days={5} />,
  },
  hr_consultancy: {
    path: '/dashboard/applications',
    title: 'Applications',
    label: 'Stride recruitment pipeline board',
    body: <ApplicationsKanban applications={DEMO_APPLICATIONS} onCardClick={noop} onStatusChange={noop} />,
  },
  energy: {
    path: '/dashboard/energy/hse',
    eyebrow: 'Energy',
    title: 'Multi-entity HSE rollup',
    label: 'Stride energy HSE rollup across operating entities',
    body: <EnergyHseRollupTable rows={DEMO_ENERGY_ROLLUP} />,
  },
  construction: {
    path: '/dashboard/construction/sites',
    eyebrow: 'Construction',
    title: 'Site hierarchy',
    label: 'Stride construction site hierarchy',
    body: <ConstructionSiteTable sites={DEMO_CONSTRUCTION_SITES} />,
  },
};

export function ProductIndustryPreview({
  industryId,
  fill = false,
  className,
  designWidth = 760,
}: {
  industryId: MarketingVerticalScreenshotId;
  fill?: boolean;
  className?: string;
  designWidth?: number;
}) {
  const config = PREVIEWS[industryId];
  return (
    <ProductFrame label={config.label} path={config.path} designWidth={designWidth} fill={fill} className={className}>
      <div className="space-y-4">
        <DashboardPageHeader eyebrow={config.eyebrow} title={config.title} href={config.path} titleAs="p" />
        {config.body}
      </div>
    </ProductFrame>
  );
}
