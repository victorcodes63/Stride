'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ClipboardList, FileWarning } from 'lucide-react';
import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { EssPullRefresh } from '@/components/ess/EssPullRefresh';
import { EssStatusPill } from '@/components/ess/EssStatusPill';
import {
  EssCard,
  EssEmptyState,
  EssListItem,
  EssLoadingState,
  EssMetricCard,
} from '@/components/ess/EssUi';

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  dueDate: string | null;
  isRequired: boolean;
  category: string | null;
  overdue: boolean;
  needsEvidence: boolean;
  document?: { id: string; fileName: string; title: string } | null;
};

type Summary = {
  totalOpen: number;
  due: number;
  overdue: number;
  noDue: number;
  completed: number;
  total: number;
};

export default function EssOnboardingPage() {
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const res = await fetch('/api/ess/onboarding/tasks');
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error || 'Could not load onboarding tasks.');
      setTasks([]);
      setSummary(null);
      return;
    }
    setTemplateName(data.templateName ?? null);
    setTasks(Array.isArray(data.items) ? data.items : []);
    setSummary(data.summary ?? null);
  }, []);

  useEffect(() => {
    setLoading(true);
    void load().finally(() => setLoading(false));
  }, [load]);

  return (
    <EssPullRefresh onRefresh={load}>
      <EssPageHeader
        title="Onboarding"
        subtitle={templateName ?? 'Your checklist'}
        backHref="/ess/work"
      />

      {loading ? <EssLoadingState label="Loading onboarding…" /> : null}

      {!loading && error ? (
        <EssCard className="border border-red-200 bg-red-50 text-sm text-red-800">{error}</EssCard>
      ) : null}

      {!loading && summary ? (
        <div className="mb-4 grid grid-cols-2 gap-3">
          <EssMetricCard label="Open" value={summary.totalOpen} helper={`${summary.completed} done`} />
          <EssMetricCard
            label="Overdue"
            value={summary.overdue}
            tone={summary.overdue > 0 ? 'warning' : 'default'}
            helper={`${summary.due} due · ${summary.noDue} no date`}
          />
        </div>
      ) : null}

      {!loading ? (
        <div className="space-y-3">
          {tasks.map((t) => (
            <Link key={t.id} href={`/ess/onboarding/tasks/${t.id}`} className="block">
              <EssListItem
                title={t.title}
                subtitle={t.description}
                meta={[
                  t.dueDate ? `Due ${new Date(t.dueDate).toLocaleDateString()}` : null,
                  t.isRequired ? 'Required' : null,
                  t.needsEvidence ? 'Evidence needed' : null,
                  t.document ? `File: ${t.document.fileName}` : null,
                ]
                  .filter(Boolean)
                  .join(' · ')}
                trailing={
                  <div className="flex flex-col items-end gap-1">
                    <EssStatusPill status={t.status.toLowerCase()} />
                    {t.overdue ? (
                      <span className="inline-flex items-center gap-1 text-[0.65rem] font-semibold uppercase text-red-600">
                        <FileWarning className="h-3 w-3" />
                        Overdue
                      </span>
                    ) : t.status === 'COMPLETED' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    ) : null}
                  </div>
                }
              />
            </Link>
          ))}
          {!tasks.length ? (
            <EssEmptyState
              title="No active onboarding tasks"
              message="Your HR checklist will appear here when assigned."
              icon={<ClipboardList className="h-6 w-6" />}
            />
          ) : null}
        </div>
      ) : null}
    </EssPullRefresh>
  );
}
