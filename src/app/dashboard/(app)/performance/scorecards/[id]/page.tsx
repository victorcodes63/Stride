'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

export default function ScorecardDetailPage({ params }: { params: { id: string } }) {
  const [loading, setLoading] = useState(true);
  const [template, setTemplate] = useState<{
    title: string;
    grade: string | null;
    resultsWeightPercent: number;
    competenciesWeightPercent: number;
    measures: Array<{ title: string; targetValue: string | null; unit: string | null }>;
    competencies: Array<{ name: string; requiredLevel: number }>;
  } | null>(null);

  useEffect(() => {
    void fetch(`/api/performance/scorecards/${params.id}`, { credentials: 'include' })
      .then((r) => r.json())
      .then((data) => {
        if (data.template) setTemplate(data.template);
      })
      .finally(() => setLoading(false));
  }, [params.id]);

  if (loading) {
    return (
      <div className="flex justify-center py-24 text-sm text-zinc-500">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        Loading scorecard…
      </div>
    );
  }

  if (!template) {
    return <div className="p-8 text-sm text-red-700">Scorecard not found.</div>;
  }

  return (
    <DashboardPage>
      <DashboardPageHeader
        title={template.title}
        description={`BSC blend ${template.resultsWeightPercent}% results / ${template.competenciesWeightPercent}% competencies`}
        footer={
          <Link href="/dashboard/performance/scorecards" className="btn-secondary h-10 px-3">
            Back to scorecards
          </Link>
        }
      />
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="dashboard-surface p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Results measures</h2>
          <ul className="space-y-2 text-sm">
            {template.measures.map((m, i) => (
              <li key={i} className="rounded-lg border border-neutral-200 px-3 py-2">
                <div className="font-medium">{m.title}</div>
                <div className="text-neutral-500">
                  Target: {m.targetValue ?? '—'} {m.unit ?? ''}
                </div>
              </li>
            ))}
          </ul>
        </section>
        <section className="dashboard-surface p-4 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold">Competency requirements</h2>
          <ul className="space-y-2 text-sm">
            {template.competencies.map((c, i) => (
              <li key={i} className="flex items-center justify-between rounded-lg border border-neutral-200 px-3 py-2">
                <span>{c.name}</span>
                <span className="text-neutral-500">Level {c.requiredLevel}/5</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </DashboardPage>
  );
}
