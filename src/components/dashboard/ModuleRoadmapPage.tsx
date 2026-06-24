'use client';

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { NavReadinessBadge } from '@/components/dashboard/NavReadinessBadge';
import { getRoadmapPageConfig } from '@/lib/dashboard-roadmap-pages';

export function ModuleRoadmapPage({ slug }: { slug: string }) {
  const config = getRoadmapPageConfig(slug);
  if (!config) notFound();

  const Icon = config.icon;

  return (
    <DashboardPage>
      <DashboardPageHeader
        icon={Icon}
        title={config.title}
        description={config.summary}
        badges={[
          {
            label: (
              <span className="inline-flex items-center gap-1.5">
                <NavReadinessBadge readiness={config.readiness} />
                <span>{config.phase}</span>
              </span>
            ),
          },
        ]}
      />

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="dashboard-panel space-y-4 p-5 sm:p-6 lg:col-span-3">
          <h2 className="text-sm font-semibold text-ink">Planned scope</h2>
          <ul className="space-y-2.5">
            {config.bullets.map((bullet) => (
              <li key={bullet} className="flex gap-2.5 text-sm text-neutral-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary-600" strokeWidth={1.75} />
                <span>{bullet}</span>
              </li>
            ))}
          </ul>
          <p className="text-xs leading-relaxed text-neutral-500">
            This page is visible in the sidebar so the team can track roadmap coverage. It will be replaced by
            production UI as each phase ships. See{' '}
            <code className="rounded bg-neutral-100 px-1 py-0.5 text-[11px]">docs/stride/module-roadmap.md</code>{' '}
            for the full sequence.
          </p>
        </div>

        {config.related?.length ? (
          <aside className="dashboard-panel p-5 sm:p-6 lg:col-span-2">
            <h2 className="text-sm font-semibold text-ink">Use today</h2>
            <p className="mt-1 text-xs text-neutral-500">Related areas that are already live or partially built.</p>
            <ul className="mt-4 space-y-2">
              {config.related.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="group flex items-center justify-between gap-2 rounded-lg border border-neutral-200/80 bg-white px-3 py-2.5 text-sm transition-colors hover:border-primary-200 hover:bg-primary-50/40"
                  >
                    <span>
                      <span className="font-medium text-ink group-hover:text-primary-800">{link.label}</span>
                      {link.note ? (
                        <span className="mt-0.5 block text-[11px] text-neutral-500">{link.note}</span>
                      ) : null}
                    </span>
                    <ArrowRight className="h-4 w-4 flex-shrink-0 text-neutral-400 group-hover:text-primary-600" />
                  </Link>
                </li>
              ))}
            </ul>
          </aside>
        ) : null}
      </div>
    </DashboardPage>
  );
}
