'use client';

import Link from 'next/link';
import { ArrowRight, CheckCircle2, LayoutDashboard } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { DashboardPage, DashboardPageSection } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardStatCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';
import { NavReadinessBadge } from '@/components/dashboard/NavReadinessBadge';
import { getDashboardModuleDomain } from '@/lib/dashboard-module-domains';
import type { ModuleHomeMeta } from '@/lib/dashboard-module-homes';
import type { DashboardStatTone } from '@/lib/platform-swatches';
import type { NavReadiness } from '@/lib/dashboard-nav-readiness';

export type ModuleHomeStat = {
  label: string;
  value: string | number;
  hint?: string;
  href?: string;
  tone?: DashboardStatTone;
  warn?: boolean;
};

export type ModuleHomePageProps = {
  meta: ModuleHomeMeta;
  stats?: ModuleHomeStat[];
  loading?: boolean;
  headerActions?: {
    href: string;
    label: string;
    icon?: LucideIcon;
    variant?: 'primary' | 'secondary';
  }[];
};

function domainReadinessToNav(readiness: 'live' | 'partial' | 'planned'): NavReadiness {
  if (readiness === 'planned') return 'planned';
  if (readiness === 'live') return 'live';
  return 'partial';
}

function workspaceGridClass(count: number): string {
  if (count >= 3) return 'grid-cols-1 md:grid-cols-2 xl:grid-cols-3';
  if (count === 2) return 'grid-cols-1 md:grid-cols-2';
  return 'grid-cols-1';
}

function WorkspaceLink({ link }: { link: { href: string; label: string; note?: string; icon: LucideIcon } }) {
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
          <span className="block text-sm font-medium text-[var(--dash-text-strong)] group-hover:text-[var(--dash-text-strong)]">
            {link.label}
          </span>
          {link.note ? (
            <span className="mt-0.5 block text-[11px] text-[var(--dash-text-subtle)]">{link.note}</span>
          ) : null}
        </span>
      </span>
      <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-[var(--dash-text-faint)] group-hover:text-[var(--dash-text-muted)]" />
    </Link>
  );
}

function WorkspacePanel({
  title,
  links,
}: {
  title: string;
  links: { href: string; label: string; note?: string; icon: LucideIcon }[];
}) {
  return (
    <div className="dashboard-panel flex h-full flex-col p-4 sm:p-5">
      <h2 className="text-sm font-semibold text-[var(--dash-text-strong)]">{title}</h2>
      <div className="mt-3 flex flex-1 flex-col gap-2">
        {links.map((link) => (
          <WorkspaceLink key={link.href + link.label} link={link} />
        ))}
      </div>
    </div>
  );
}

export function ModuleHomePage({ meta, stats = [], loading = false, headerActions }: ModuleHomePageProps) {
  const domain = getDashboardModuleDomain(meta.domainId);
  const hasRoadmap = Boolean(meta.plannedBullets?.length);

  return (
    <DashboardPage>
      <DashboardPageHeader
        variant="hero"
        eyebrow={meta.eyebrow}
        title={meta.title}
        description={meta.description}
        actions={headerActions}
        badges={[
          {
            bare: true,
            label: <NavReadinessBadge readiness={domainReadinessToNav(domain.readiness)} hero />,
          },
        ]}
      />

      {stats.length > 0 || loading ? (
        <DashboardPageSection title="At a glance">
          {loading ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="skeleton h-24 rounded-xl" />
              ))}
            </div>
          ) : (
            <DashboardStatGrid columns={stats.length >= 4 ? 4 : stats.length === 3 ? 3 : 2}>
              {stats.map((stat) => {
                const card = (
                  <DashboardStatCard
                    label={stat.label}
                    value={stat.value}
                    hint={stat.hint}
                    tone={stat.tone ?? 'primary'}
                    warn={stat.warn}
                  />
                );
                return stat.href ? (
                  <Link key={stat.label} href={stat.href} className="block transition hover:opacity-90">
                    {card}
                  </Link>
                ) : (
                  <div key={stat.label}>{card}</div>
                );
              })}
            </DashboardStatGrid>
          )}
        </DashboardPageSection>
      ) : null}

      <DashboardPageSection
        title="Workspaces"
        description="Jump into the areas you manage in this module."
      >
        <div className={`grid gap-4 ${workspaceGridClass(meta.workspaces.length)}`}>
          {meta.workspaces.map((workspace) => (
            <WorkspacePanel key={workspace.title} title={workspace.title} links={workspace.links} />
          ))}
        </div>
      </DashboardPageSection>

      <div className={`grid gap-4 ${hasRoadmap ? 'lg:grid-cols-2' : ''}`}>
        {hasRoadmap ? (
          <div className="dashboard-panel space-y-3 p-5 sm:p-6">
            <h2 className="text-sm font-semibold text-ink">On the roadmap</h2>
            {meta.phase ? <p className="text-xs text-[var(--dash-text-subtle)]">{meta.phase}</p> : null}
            <ul className="space-y-2.5">
              {meta.plannedBullets!.map((bullet) => (
                <li key={bullet} className="flex gap-2.5 text-sm text-[var(--dash-text-body)]">
                  <CheckCircle2
                    className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--stride-coral)]"
                    strokeWidth={1.75}
                  />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        <div
          className={`dashboard-panel flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center sm:p-6 ${
            hasRoadmap ? '' : ''
          }`}
        >
          <div className="flex min-w-0 items-start gap-3">
            <span className="dash-coral-icon-wrap flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl">
              <LayoutDashboard className="h-5 w-5" strokeWidth={1.75} />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-[var(--dash-text-strong)]">Business command center</h2>
              <p className="mt-1 max-w-xl text-xs leading-relaxed text-[var(--dash-text-muted)]">
                See what needs you across HR, Finance, Legal, Procurement, Projects, and Operations — not just this module.
              </p>
            </div>
          </div>
          <Link
            href="/dashboard"
            className="dash-coral-cta inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition"
          >
            Open command center
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </DashboardPage>
  );
}
