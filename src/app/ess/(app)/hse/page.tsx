'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { EssEmptyState, EssListItem, EssSectionTitle } from '@/components/ess/EssUi';
import { EssStatusPill } from '@/components/ess/EssStatusPill';

type HseReport = {
  id: string;
  grievanceNumber: string;
  subject: string;
  status: string;
  submittedAt: string;
};

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

  return (
    <div className="space-y-5">
      <EssPageHeader
        title="Health & safety"
        subtitle="Report incidents, near-misses, and workplace hazards for HR/HSE follow-up."
        backHref="/ess/more"
      />
      <Link
        href="/ess/hse/report"
        className="ess-btn-primary flex min-h-[72px] w-full text-base"
      >
        Report incident or near-miss
      </Link>
      <section>
        <EssSectionTitle eyebrow="My reports" title="Submitted HSE reports" />
        {loading ? (
          <p className="ess-card-flat px-4 py-8 text-center text-sm text-[var(--ess-muted)]">Loading reports...</p>
        ) : items.length ? (
          <div className="space-y-2">
            {items.map((item) => (
              <EssListItem
                key={item.id}
                title={item.subject.replace(/^HSE report:\s*/, '')}
                subtitle={item.grievanceNumber}
                meta={new Date(item.submittedAt).toLocaleString()}
                icon={<ShieldAlert className="h-5 w-5" />}
                trailing={<EssStatusPill status={item.status} />}
              />
            ))}
          </div>
        ) : (
          <EssEmptyState
            title="No HSE reports yet"
            message="Reports you submit will appear here with their current review status."
            icon={<ShieldAlert className="h-6 w-6" />}
          />
        )}
      </section>
    </div>
  );
}
