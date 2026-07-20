'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  BadgeCheck,
  BarChart3,
  CalendarClock,
  FileSignature,
  FolderOpen,
  Gavel,
  ListChecks,
  ScrollText,
  ShieldCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { DashboardPage, DashboardPageSection } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardStatCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';
import {
  DashboardAsyncState,
  DashboardEmptyState,
  DashboardPageSkeleton,
  type DashboardAsyncStatus,
} from '@/components/dashboard/DashboardAsyncState';
import { LegalModuleTabs } from '@/components/legal/LegalHubTabs';
import type { LegalOverviewResponse } from '@/app/api/legal/overview/route';

const RISK_TONE: Record<LegalOverviewResponse['risk']['level'], { label: string; className: string }> = {
  low: { label: 'Low risk', className: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  moderate: { label: 'Moderate risk', className: 'bg-sky-50 text-sky-800 border-sky-200' },
  elevated: { label: 'Elevated risk', className: 'bg-amber-50 text-amber-800 border-amber-200' },
  high: { label: 'High risk', className: 'bg-red-50 text-red-800 border-red-200' },
};

type WorkspaceLink = {
  href: string;
  label: string;
  note: string;
  icon: LucideIcon;
};

const WORKSPACES: WorkspaceLink[] = [
  {
    href: '/dashboard/legal/obligations',
    label: 'Obligations register',
    note: 'Filings, permits & regulator deadlines',
    icon: ListChecks,
  },
  {
    href: '/dashboard/people/contracts',
    label: 'Contracts',
    note: 'Renewal reminders & terms',
    icon: FileSignature,
  },
  {
    href: '/dashboard/credentials',
    label: 'Credentials',
    note: 'Licences & certification expiries',
    icon: BadgeCheck,
  },
  {
    href: '/dashboard/company-documents',
    label: 'Company policies',
    note: 'Governing documents & renewals',
    icon: FolderOpen,
  },
  {
    href: '/dashboard/legal/analytics',
    label: 'Analytics',
    note: 'Risk scoring & compliance trends',
    icon: BarChart3,
  },
  {
    href: '/dashboard/legal/calendar',
    label: 'Compliance calendar',
    note: 'Upcoming due-load month view',
    icon: CalendarClock,
  },
];

function WorkspaceCard({ link }: { link: WorkspaceLink }) {
  const Icon = link.icon;
  return (
    <Link
      href={link.href}
      className="dash-workspace-link group flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5"
    >
      <span className="flex min-w-0 items-center gap-3">
        <span className="dash-workspace-icon flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md">
          <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-medium text-[var(--dash-text-strong)]">{link.label}</span>
          <span className="mt-0.5 block text-[11px] text-[var(--dash-text-subtle)]">{link.note}</span>
        </span>
      </span>
      <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-[var(--dash-text-faint)] group-hover:text-[var(--dash-text-muted)]" />
    </Link>
  );
}

export function LegalHubContent() {
  const [data, setData] = useState<LegalOverviewResponse | null>(null);
  const [status, setStatus] = useState<DashboardAsyncStatus>('loading');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const res = await fetch('/api/legal/overview', { cache: 'no-store' });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `Request failed (${res.status})`);
      }
      const json = (await res.json()) as LegalOverviewResponse;
      setData(json);
      setStatus('success');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load legal overview.');
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const risk = data ? RISK_TONE[data.risk.level] : null;

  const meta = useMemo(() => {
    if (!data) return undefined;
    const total =
      data.obligations.total +
      data.contracts.total +
      data.credentials.total +
      data.policies.total;
    return `${total} tracked items · risk score ${data.risk.score}/100`;
  }, [data]);

  return (
    <DashboardPage>
      <DashboardPageHeader
        icon={Gavel}
        eyebrow="04 — Legal & Documents"
        title="Legal & compliance"
        description="Contracts, credentials, company policies, and regulatory obligations — one command center for document risk."
        meta={meta}
        badges={
          risk
            ? [
                {
                  bare: true,
                  label: (
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${risk.className}`}
                    >
                      <ShieldCheck className="h-3 w-3" aria-hidden />
                      {risk.label}
                    </span>
                  ),
                },
              ]
            : []
        }
        footer={<LegalModuleTabs active="overview" />}
      />

      <DashboardAsyncState
        status={status}
        error={error}
        onRetry={() => void load()}
        loading={<DashboardPageSkeleton variant="stats" />}
        empty={
          <DashboardEmptyState
            icon={Gavel}
            title="No compliance data yet"
            description="Add contracts, credentials, policies with expiry dates, or obligations to populate the hub."
          />
        }
      >
        {data ? (
          <>
            <DashboardPageSection title="At a glance" description="Live compliance signals across the module.">
              <DashboardStatGrid columns={4}>
                <DashboardStatCard
                  label="Overdue obligations"
                  value={data.stats.overdueObligations}
                  hint="Past due date"
                  tone="warning"
                  warn={data.stats.overdueObligations > 0}
                />
                <DashboardStatCard
                  label="Due soon"
                  value={data.stats.dueSoonObligations}
                  hint="Within reminder window"
                  tone="violet"
                />
                <DashboardStatCard
                  label="Contracts expiring"
                  value={data.stats.contractsExpiring}
                  hint="Within 60 days"
                  tone="sky"
                />
                <DashboardStatCard
                  label="Credential alerts"
                  value={data.stats.credentialAlerts}
                  hint={`${data.credentials.expired} expired · ${data.credentials.expiring} expiring`}
                  tone="warning"
                  warn={data.stats.credentialAlerts > 0}
                />
                <DashboardStatCard
                  label="Policies expiring"
                  value={data.stats.policiesExpiring}
                  hint="Within 60 days"
                  tone="warning"
                  warn={data.stats.policiesExpiring > 0}
                />
                <DashboardStatCard
                  label="Pending obligations"
                  value={data.obligations.byStatus.pending}
                  hint={`${data.obligations.total} total tracked`}
                  tone="primary"
                />
                <DashboardStatCard
                  label="Completed"
                  value={data.obligations.byStatus.completed}
                  hint="Closed out"
                  tone="success"
                />
                <DashboardStatCard
                  label="Compliance risk"
                  value={`${data.risk.score}`}
                  hint={risk ? `${risk.label} · out of 100` : 'out of 100'}
                  tone="primary"
                  trend={
                    <span className="flex items-center gap-1">
                      <ScrollText className="h-3.5 w-3.5" aria-hidden />
                      score
                    </span>
                  }
                />
              </DashboardStatGrid>
            </DashboardPageSection>

            <DashboardPageSection
              title="Workspaces"
              description="Jump into the areas you manage across Legal & compliance."
            >
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {WORKSPACES.map((link) => (
                  <WorkspaceCard key={link.href} link={link} />
                ))}
              </div>
            </DashboardPageSection>
          </>
        ) : null}
      </DashboardAsyncState>
    </DashboardPage>
  );
}
