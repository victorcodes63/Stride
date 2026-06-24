'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { EssAlert, EssEmptyState, EssListItem } from '@/components/ess/EssUi';
import { EssStatusPill } from '@/components/ess/EssStatusPill';
import { getJurisdictionPolicy } from '@/lib/east-africa-hr-policy';

type Row = {
  id: string;
  caseNumber: string;
  type: string;
  status: string;
  severity: string;
  subject: string;
  laborJurisdiction: string;
  showCauseResponseDueAt: string | null;
  hearingAt: string | null;
  createdAt: string;
};

function label(s: string) {
  return s.replaceAll('_', ' ');
}

export default function EssDisciplinaryPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch('/api/ess/disciplinary/cases');
      const data = await res.json().catch(() => []);
      if (!cancelled) {
        setRows(Array.isArray(data) ? data : []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <EssPageHeader title="Disciplinary" backHref="/ess/more" />
        <p className="mt-1 text-sm text-neutral-600">
          View the status of workplace disciplinary matters involving you. Submit grievances separately under{' '}
          <Link href="/ess/grievances" className="font-medium text-primary-700 underline">
            Grievances
          </Link>
          .
        </p>
      </div>

      <EssAlert tone="warning">
        <p className="font-semibold">Fair process & labour law</p>
        <p className="mt-1">
          Your employer should follow written procedures, natural justice, and the labour laws that apply to your contract.
          This portal helps you track steps and acknowledge formal notices — it does not replace legal advice.
        </p>
      </EssAlert>

      <div className="space-y-2">
        {loading ? (
          <p className="ess-card-flat px-4 py-8 text-center text-sm text-[var(--ess-muted)]">Loading...</p>
        ) : rows.length === 0 ? (
          <EssEmptyState title="No disciplinary cases" message="You have no disciplinary cases on file." />
        ) : (
          rows.map((item) => {
            const pol = getJurisdictionPolicy(item.laborJurisdiction);
            return (
              <EssListItem
                key={item.id}
                href={`/ess/disciplinary/cases/${item.id}`}
                title={`${item.caseNumber} · ${item.subject}`}
                subtitle={`${label(item.type)} · ${label(item.severity)} · ${pol.label}`}
                meta={new Date(item.createdAt).toLocaleDateString()}
                trailing={<EssStatusPill status={item.status} />}
              />
            );
          })
        )}
      </div>
    </div>
  );
}
