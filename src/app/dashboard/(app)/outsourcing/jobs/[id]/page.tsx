'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Briefcase } from 'lucide-react';
import {
  DashboardAsyncState,
  DashboardPageSkeleton,
} from '@/components/dashboard/DashboardAsyncState';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { useOutsourcingClient } from '@/hooks/use-outsourcing-client';

type JobDetail = {
  id: string;
  referenceId: string | null;
  title: string;
  company: string;
  location: string;
  employmentType: string;
  category: string;
  description: string;
  isActive: boolean;
  postedDate: string;
  applicationCount: number;
};

function OutsourcingJobDetailContent() {
  const params = useParams<{ id: string }>();
  const jobId = params?.id;
  const { clientId } = useOutsourcingClient();

  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clientQuery = clientId ? `?clientId=${encodeURIComponent(clientId)}` : '';

  const load = useCallback(async () => {
    if (!clientId || !jobId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/outsourcing/clients/${clientId}/jobs/${jobId}`);
      const json = (await res.json()) as { job?: JobDetail; error?: string };
      if (!res.ok || !json.job) throw new Error(json.error || 'Failed to load RPO job.');
      setJob(json.job);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load RPO job.');
      setJob(null);
    } finally {
      setLoading(false);
    }
  }, [clientId, jobId]);

  useEffect(() => {
    void load();
  }, [load]);

  const status = !clientId
    ? 'empty'
    : loading
      ? 'loading'
      : error
        ? 'error'
        : !job
          ? 'empty'
          : 'success';

  return (
    <DashboardPage>
      <nav className="mb-4 text-sm text-neutral-500" aria-label="Breadcrumb">
        <Link href={`/dashboard/outsourcing/jobs${clientQuery}`} className="hover:text-primary-700">
          Recruitment (RPO)
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-primary-900 font-medium">{job?.title ?? 'Job'}</span>
      </nav>

      <DashboardPageHeader
        eyebrow="09 — HR Outsourcing"
        icon={Briefcase}
        title={job?.title ?? 'RPO job'}
        description={job ? `${job.company} · ${job.employmentType}` : 'End-client recruitment job detail.'}
      />

      <div className="mb-4">
        <Link
          href={`/dashboard/outsourcing/jobs${clientQuery}`}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-600 hover:text-primary-700"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to jobs
        </Link>
      </div>

      <DashboardAsyncState
        status={status}
        error={error}
        onRetry={() => void load()}
        loading={<DashboardPageSkeleton variant="detail" />}
        empty={
          <div className="dashboard-surface p-8 text-center text-sm text-neutral-500 shadow-sm">
            {clientId ? 'RPO job not found for this end-client.' : 'Select an end-client to view this job.'}
          </div>
        }
      >
        {job ? (
          <div className="space-y-6">
            <section className="dashboard-surface p-5 shadow-sm">
              <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Status</dt>
                  <dd className="mt-1">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        job.isActive
                          ? 'bg-green-50 text-green-700'
                          : 'bg-neutral-100 text-neutral-600'
                      }`}
                    >
                      {job.isActive ? 'Open' : 'Closed'}
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Reference</dt>
                  <dd className="mt-1 text-sm tabular-nums text-neutral-900">{job.referenceId || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Posted</dt>
                  <dd className="mt-1 text-sm tabular-nums text-neutral-900">{job.postedDate.slice(0, 10)}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Applications</dt>
                  <dd className="mt-1 text-sm tabular-nums text-neutral-900">{job.applicationCount}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Location</dt>
                  <dd className="mt-1 text-sm text-neutral-900">{job.location || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Employment type</dt>
                  <dd className="mt-1 text-sm text-neutral-900">{job.employmentType}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">Category</dt>
                  <dd className="mt-1 text-sm text-neutral-900">{job.category}</dd>
                </div>
                <div>
                  <dt className="text-xs font-medium uppercase tracking-wide text-neutral-500">End-client</dt>
                  <dd className="mt-1 text-sm text-neutral-900">{job.company}</dd>
                </div>
              </dl>
            </section>

            <section className="dashboard-surface p-5 shadow-sm space-y-3">
              <h2 className="text-sm font-semibold text-primary-900">Description</h2>
              {job.description ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-700">
                  {job.description}
                </p>
              ) : (
                <p className="text-sm text-neutral-500">No description provided.</p>
              )}
            </section>
          </div>
        ) : null}
      </DashboardAsyncState>
    </DashboardPage>
  );
}

export default function OutsourcingJobDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="py-16 text-center text-sm text-neutral-500">Loading job…</div>
      }
    >
      <OutsourcingJobDetailContent />
    </Suspense>
  );
}
