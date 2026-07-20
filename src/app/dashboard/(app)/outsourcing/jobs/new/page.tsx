'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Briefcase, Loader2 } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import {
  DashboardTableToolbar,
} from '@/components/dashboard/DashboardDataTable';
import { dashboardFilterSelectClass } from '@/components/dashboard/DashboardFilterBar';
import { OutsourcingClientSwitcher } from '@/components/outsourcing/OutsourcingClientSwitcher';
import { StrideSelect } from '@/components/ui/stride-select';
import { useOutsourcingClient } from '@/hooks/use-outsourcing-client';

const inputClass =
  'w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2.5 text-sm text-neutral-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30';

const EMPLOYMENT_TYPES = ['Full Time', 'Part Time', 'Contract', 'Remote'] as const;

function NewOutsourcingJobContent() {
  const router = useRouter();
  const { clientId, clients, setClientId, showSwitcher, selectedClient } = useOutsourcingClient();

  const [title, setTitle] = useState('');
  const [referenceId, setReferenceId] = useState('');
  const [location, setLocation] = useState('');
  const [employmentType, setEmploymentType] = useState<string>('Full Time');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clientQuery = clientId ? `?clientId=${encodeURIComponent(clientId)}` : '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!clientId) {
      setError('Select an end-client before creating a job.');
      return;
    }
    if (!title.trim()) {
      setError('Job title is required.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/outsourcing/clients/${clientId}/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          referenceId: referenceId.trim() || undefined,
          location: location.trim() || undefined,
          employmentType,
          description: description.trim() || undefined,
          isActive,
        }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) throw new Error(data.error || 'Failed to create RPO job.');
      router.push(`/dashboard/outsourcing/jobs/${data.id}${clientQuery}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create RPO job.');
      setSubmitting(false);
    }
  };

  return (
    <DashboardPage>
      <nav className="mb-4 text-sm text-neutral-500" aria-label="Breadcrumb">
        <Link href={`/dashboard/outsourcing/jobs${clientQuery}`} className="hover:text-primary-700">
          Recruitment (RPO)
        </Link>
        <span className="mx-1.5">/</span>
        <span className="text-primary-900 font-medium">New RPO job</span>
      </nav>

      <DashboardPageHeader
        eyebrow="09 — HR Outsourcing"
        icon={Briefcase}
        title="New RPO job"
        description={
          selectedClient
            ? `Create a recruitment job linked to ${selectedClient.name}.`
            : 'Create a recruitment job scoped to the selected end-client.'
        }
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

      <form onSubmit={handleSubmit} className="space-y-6">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {error}
          </div>
        ) : null}

        <section className="dashboard-surface p-5 shadow-sm space-y-4">
          <h2 className="text-sm font-semibold text-primary-900">Job details</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-neutral-800">Job title</span>
              <input
                className={inputClass}
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Security Supervisor"
                required
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-neutral-800">
                Reference (optional)
              </span>
              <input
                className={inputClass}
                value={referenceId}
                onChange={(e) => setReferenceId(e.target.value)}
                placeholder="Auto-generated if blank"
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-neutral-800">Employment type</span>
              <StrideSelect
                value={employmentType}
                onChange={setEmploymentType}
                options={EMPLOYMENT_TYPES.map((t) => ({ value: t, label: t }))}
                ariaLabel="Employment type"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-neutral-800">Location</span>
              <input
                className={inputClass}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Nairobi"
              />
            </label>
            <label className="block md:col-span-2">
              <span className="mb-1.5 block text-sm font-medium text-neutral-800">Description</span>
              <textarea
                className={inputClass}
                rows={5}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Role summary, responsibilities and requirements."
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-neutral-800 md:col-span-2">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Open for applications
            </label>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={submitting || !clientId}
            className="inline-flex items-center gap-2 rounded-xl bg-primary-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary-800 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create RPO job
          </button>
          <Link
            href={`/dashboard/outsourcing/jobs${clientQuery}`}
            className="text-sm font-medium text-neutral-600 hover:text-primary-700"
          >
            Cancel
          </Link>
        </div>
      </form>
    </DashboardPage>
  );
}

export default function NewOutsourcingJobPage() {
  return (
    <Suspense
      fallback={
        <div className="py-16 text-center text-sm text-neutral-500">Loading…</div>
      }
    >
      <NewOutsourcingJobContent />
    </Suspense>
  );
}
