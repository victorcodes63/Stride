'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { EssPageHeader } from '@/components/ess/EssPageHeader';
import {
  EssAlert,
  EssCard,
  EssEmptyState,
  EssSectionTitle,
  essInputClass,
  essPrimaryButtonClass,
} from '@/components/ess/EssUi';
import { EssStatusPill } from '@/components/ess/EssStatusPill';
import { StrideSelect } from '@/components/ui/stride-select';
import { toDisplayLabel } from '@/lib/format-label';

type Grievance = {
  id: string;
  grievanceNumber: string;
  subject: string;
  description?: string;
  category: string;
  status: string;
  submittedAt: string;
};

const CATEGORIES = [
  'WORKPLACE_SAFETY',
  'HARASSMENT',
  'DISCRIMINATION',
  'WORKLOAD',
  'MANAGEMENT',
  'COMPENSATION',
  'POLICY',
  'OTHER',
] as const;

function formatDate(value: string) {
  return new Date(value).toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function statusHelper(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === 'submitted' || normalized === 'open') return 'Logged with HR for review';
  if (normalized.includes('investigat')) return 'Under investigation';
  if (normalized.includes('resolv') || normalized.includes('closed')) return 'Resolved / closed';
  return toDisplayLabel(status);
}

export default function EssGrievancesPage() {
  const [items, setItems] = useState<Grievance[]>([]);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('OTHER');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function load() {
    const res = await fetch('/api/ess/grievances');
    const data = await res.json().catch(() => []);
    if (res.ok) setItems(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!navigator.onLine) {
      setError('You are offline. Reconnect before submitting a grievance.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/ess/grievances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subject, description, category }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error || 'Failed to submit grievance');
        return;
      }
      setSubject('');
      setDescription('');
      setCategory('OTHER');
      await load();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <EssPageHeader
          title="Grievances"
          subtitle="Raise workplace concerns for formal HR review."
          backHref="/ess/more"
        />
        <p className="text-sm leading-6 text-[var(--ess-muted)]">
          Use this for safety, harassment, workload, management, and similar concerns. Cases follow the employer’s
          grievance procedure. This is not the same as a{' '}
          <Link className="font-semibold text-[var(--ess-primary)] underline" href="/ess/disciplinary">
            disciplinary case
          </Link>{' '}
          against you.
        </p>
      </div>

      <EssCard as="form" onSubmit={submit} className="space-y-3">
        <p className="text-sm font-black text-[var(--ess-text)]">Submit grievance</p>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ess-muted)]">
            Category
          </span>
          <StrideSelect
            surface="ess"
            triggerClassName="ess-field-compact"
            value={category}
            onChange={setCategory}
            options={CATEGORIES.map((c) => ({ value: c, label: toDisplayLabel(c) }))}
            ariaLabel="Grievance category"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ess-muted)]">
            Subject
          </span>
          <input
            className={`${essInputClass} ess-field-compact`}
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Short summary"
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ess-muted)]">
            Details
          </span>
          <textarea
            className={`${essInputClass} min-h-28`}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what happened, when, and who was involved"
            required
          />
        </label>
        {error ? <EssAlert tone="danger">{error}</EssAlert> : null}
        <button type="submit" disabled={saving} className={`${essPrimaryButtonClass} w-full`}>
          {saving ? 'Submitting…' : 'Submit grievance'}
        </button>
      </EssCard>

      <section>
        <EssSectionTitle eyebrow="History" title="Your cases" subtitle="Status and category for each submission" />
        <div className="space-y-3">
          {items.map((item) => (
            <Link key={item.id} href={`/ess/grievances/${item.id}`} className="block">
              <article className="ess-card-flat overflow-hidden transition-transform active:scale-[0.99]">
                <div className="flex items-start justify-between gap-3 border-b border-[var(--ess-border)] px-4 py-3.5">
                  <div className="min-w-0">
                    <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[var(--ess-muted)]">
                      {item.grievanceNumber}
                    </p>
                    <h3 className="mt-1 text-base font-black text-[var(--ess-text)]">{item.subject}</h3>
                  </div>
                  <EssStatusPill status={item.status} />
                </div>
                <div className="space-y-2 px-4 py-3">
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-2xl bg-[var(--ess-surface-soft)] px-3 py-2">
                      <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--ess-muted)]">
                        Category
                      </dt>
                      <dd className="mt-0.5 font-black text-[var(--ess-text)]">
                        {toDisplayLabel(item.category)}
                      </dd>
                    </div>
                    <div className="rounded-2xl bg-[var(--ess-surface-soft)] px-3 py-2">
                      <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--ess-muted)]">
                        Submitted
                      </dt>
                      <dd className="mt-0.5 font-black text-[var(--ess-text)]">
                        {formatDate(item.submittedAt)}
                      </dd>
                    </div>
                  </dl>
                  <p className="text-xs font-semibold text-[var(--ess-muted)]">{statusHelper(item.status)}</p>
                </div>
              </article>
            </Link>
          ))}
          {!items.length ? (
            <EssEmptyState
              title="No grievances submitted"
              message="Cases you raise will appear here with their review status."
            />
          ) : null}
        </div>
      </section>
    </div>
  );
}
