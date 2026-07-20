'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Briefcase, Plus } from 'lucide-react';
import {
  DashboardAsyncState,
  DashboardPageSkeleton,
} from '@/components/dashboard/DashboardAsyncState';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableToolbar,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { dashboardFilterSelectClass } from '@/components/dashboard/DashboardFilterBar';
import { OutsourcingClientSwitcher } from '@/components/outsourcing/OutsourcingClientSwitcher';
import { useOutsourcingClient } from '@/hooks/use-outsourcing-client';

type JobRow = {
  id: string;
  referenceId: string | null;
  title: string;
  isActive: boolean;
  postedDate: string;
  applicationCount: number;
};

function OutsourcingJobsContent() {
  const { clientId, clients, setClientId, showSwitcher } = useOutsourcingClient();
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clientId) {
      setJobs([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/outsourcing/clients/${clientId}/jobs`);
      const json = (await res.json()) as { jobs?: JobRow[]; error?: string };
      if (!res.ok) throw new Error(json.error || 'Failed to load RPO jobs.');
      setJobs(json.jobs ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load RPO jobs.');
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const status = !clientId
    ? 'empty'
    : loading
      ? 'loading'
      : error
        ? 'error'
        : jobs.length === 0
          ? 'empty'
          : 'success';

  const newJobHref = clientId
    ? `/dashboard/outsourcing/jobs/new?clientId=${encodeURIComponent(clientId)}`
    : '/dashboard/outsourcing/jobs/new';

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="09 — HR Outsourcing"
        icon={Briefcase}
        title="Recruitment (RPO)"
        description="End-client recruitment jobs and applications, scoped to the selected client."
        actions={[
          {
            href: newJobHref,
            label: 'New job',
            icon: Plus,
          },
        ]}
      />

      {showSwitcher ? (
        <div className="mb-4 overflow-hidden dashboard-surface shadow-sm">
          <DashboardTableToolbar>
            <OutsourcingClientSwitcher
              clients={clients}
              value={clientId}
              onChange={setClientId}
              className={dashboardFilterSelectClass}
            />
          </DashboardTableToolbar>
        </div>
      ) : null}

      <DashboardTableCard>
        <DashboardAsyncState
          status={status}
          error={error}
          onRetry={() => void load()}
          loading={<DashboardPageSkeleton variant="list" />}
          empty={
            <DashboardTableEmpty
              icon={<Briefcase className="h-8 w-8 text-neutral-300" aria-hidden />}
              title={clientId ? 'No RPO jobs for this client' : 'Select an end-client'}
              description={
                clientId
                  ? 'Create a job linked to this end-client to start recruiting.'
                  : 'Choose an end-client to list linked recruitment jobs.'
              }
            />
          }
        >
          <DashboardTableViewport minWidth={640}>
            <DashboardTable>
              <thead className="bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="px-3 py-2">Job</th>
                  <th className="px-3 py-2">Reference</th>
                  <th className="px-3 py-2">Posted</th>
                  <th className="px-3 py-2 col-center">Applications</th>
                  <th className="px-3 py-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id}>
                    <td className="px-3 py-2">
                      <Link
                        href={`/dashboard/outsourcing/jobs/${job.id}${clientId ? `?clientId=${encodeURIComponent(clientId)}` : ''}`}
                        className="font-medium text-primary-700 hover:underline"
                      >
                        {job.title}
                      </Link>
                    </td>
                    <td className="px-3 py-2 tabular-nums text-neutral-600">
                      {job.referenceId || '—'}
                    </td>
                    <td className="px-3 py-2 tabular-nums">
                      {job.postedDate.slice(0, 10)}
                    </td>
                    <td className="px-3 py-2 col-center tabular-nums">{job.applicationCount}</td>
                    <td className="px-3 py-2">{job.isActive ? 'Open' : 'Closed'}</td>
                  </tr>
                ))}
              </tbody>
            </DashboardTable>
          </DashboardTableViewport>
        </DashboardAsyncState>
      </DashboardTableCard>
    </DashboardPage>
  );
}

export default function OutsourcingJobsPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-neutral-500">Loading jobs…</div>}>
      <OutsourcingJobsContent />
    </Suspense>
  );
}
