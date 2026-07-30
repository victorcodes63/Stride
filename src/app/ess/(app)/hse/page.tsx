'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { MapPin, ShieldAlert } from 'lucide-react';
import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { EssEmptyState, EssSectionTitle } from '@/components/ess/EssUi';
import { EssStatusPill } from '@/components/ess/EssStatusPill';

type HseReport = {
  id: string;
  incidentNumber: string;
  title: string;
  description?: string;
  status: string;
  statusLabel: string;
  severity?: string;
  severityLabel?: string;
  incidentTypeLabel?: string;
  location?: string | null;
  occurredAt?: string;
  submittedAt: string;
  openActionCount?: number;
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function severityTone(severity?: string) {
  if (severity === 'high' || severity === 'critical') {
    return 'bg-red-500/10 text-red-700';
  }
  if (severity === 'medium') {
    return 'bg-amber-500/10 text-amber-800';
  }
  return 'bg-[var(--ess-secondary-soft)] text-[var(--ess-secondary)]';
}

function cleanTitle(title: string) {
  return title.replace(/^HSE report:\s*/i, '').trim() || title;
}

export default function EssHsePage() {
  const [items, setItems] = useState<HseReport[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/ess/hse/reports')
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((data) => setItems(Array.isArray(data.items) ? data.items : []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const openCount = useMemo(
    () => items.filter((i) => i.status === 'open' || i.status === 'investigating').length,
    [items],
  );

  return (
    <div className="space-y-5">
      <EssPageHeader
        title="Health & safety"
        subtitle="Report incidents, near-misses, and hazards."
        backHref="/ess/more"
      />

      <Link href="/ess/hse/report" className="ess-btn-primary flex min-h-12 w-full text-base">
        Report incident or near-miss
      </Link>

      <section className="grid grid-cols-2 gap-2">
        <div className="rounded-2xl border border-[var(--ess-border)] bg-[var(--ess-surface)] px-3 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--ess-muted)]">My reports</p>
          <p className="mt-1 text-xl font-black text-[var(--ess-text)]">{items.length}</p>
        </div>
        <div className="rounded-2xl border border-[var(--ess-border)] bg-[var(--ess-surface)] px-3 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--ess-muted)]">Still open</p>
          <p className="mt-1 text-xl font-black text-[var(--ess-text)]">{openCount}</p>
        </div>
      </section>

      <section>
        <EssSectionTitle
          eyebrow="My reports"
          title="Submitted HSE reports"
          subtitle="Severity, location, and current review status"
        />
        {loading ? (
          <p className="ess-card-flat px-4 py-8 text-center text-sm text-[var(--ess-muted)]">Loading reports…</p>
        ) : items.length ? (
          <div className="space-y-3">
            {items.map((item) => (
              <article key={item.id} className="ess-card-flat overflow-hidden">
                <div className="flex items-start justify-between gap-3 border-b border-[var(--ess-border)] px-4 py-3.5">
                  <div className="flex min-w-0 items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[var(--ess-primary-soft)] text-[var(--ess-primary)]">
                      <ShieldAlert className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] font-black uppercase tracking-[0.1em] text-[var(--ess-muted)]">
                        {item.incidentNumber}
                      </p>
                      <h3 className="mt-1 text-base font-black leading-snug text-[var(--ess-text)]">
                        {cleanTitle(item.title)}
                      </h3>
                    </div>
                  </div>
                  <EssStatusPill status={item.statusLabel || item.status} />
                </div>

                <div className="space-y-2.5 px-4 py-3">
                  <dl className="grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-2xl bg-[var(--ess-surface-soft)] px-3 py-2">
                      <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--ess-muted)]">
                        Type
                      </dt>
                      <dd className="mt-0.5 font-black text-[var(--ess-text)]">
                        {item.incidentTypeLabel || 'HSE report'}
                      </dd>
                    </div>
                    <div className="rounded-2xl bg-[var(--ess-surface-soft)] px-3 py-2">
                      <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--ess-muted)]">
                        Severity
                      </dt>
                      <dd className="mt-0.5">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-[11px] font-black ${severityTone(item.severity)}`}
                        >
                          {item.severityLabel || item.severity || '—'}
                        </span>
                      </dd>
                    </div>
                    <div className="rounded-2xl bg-[var(--ess-surface-soft)] px-3 py-2">
                      <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--ess-muted)]">
                        Occurred
                      </dt>
                      <dd className="mt-0.5 font-black text-[var(--ess-text)]">
                        {formatDate(item.occurredAt || item.submittedAt)}
                      </dd>
                    </div>
                    <div className="rounded-2xl bg-[var(--ess-surface-soft)] px-3 py-2">
                      <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-[var(--ess-muted)]">
                        Actions
                      </dt>
                      <dd className="mt-0.5 font-black text-[var(--ess-text)]">
                        {item.openActionCount ?? 0} open
                      </dd>
                    </div>
                  </dl>

                  {item.location ? (
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ess-muted)]">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      {item.location}
                    </p>
                  ) : null}

                  {item.description ? (
                    <p className="line-clamp-2 text-sm leading-5 text-[var(--ess-text)]">{item.description}</p>
                  ) : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <EssEmptyState
            title="No HSE reports yet"
            message="Reports you submit will appear here with severity, location, and review status."
            icon={<ShieldAlert className="h-6 w-6" />}
          />
        )}
      </section>
    </div>
  );
}
