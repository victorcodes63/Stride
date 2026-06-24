'use client';

import { useEffect, useState } from 'react';
import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { EssPullRefresh } from '@/components/ess/EssPullRefresh';
import { EssStatusPill } from '@/components/ess/EssStatusPill';
import { toast } from '@/components/ui/toast';
import { EssEmptyState, EssListItem, essSecondaryButtonClass } from '@/components/ess/EssUi';

type Task = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  dueDate: string | null;
  isRequired: boolean;
};

export default function EssOnboardingPage() {
  const [templateName, setTemplateName] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/ess/onboarding/tasks');
    const data = await res.json().catch(() => ({}));
    setTemplateName(data.templateName ?? null);
    setTasks(Array.isArray(data.items) ? data.items : []);
  }

  useEffect(() => {
    load().catch(() => {});
  }, []);

  async function complete(id: string) {
    if (!navigator.onLine) {
      toast.error('You are offline. Reconnect before updating onboarding tasks.');
      return;
    }
    setBusy(id);
    const res = await fetch(`/api/ess/onboarding/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'COMPLETED' }),
    });
    setBusy(null);
    if (!res.ok) {
      toast.error('Could not update task.');
      return;
    }
    toast.success('Task marked complete.');
    await load();
  }

  return (
    <EssPullRefresh onRefresh={load}>
      <EssPageHeader
        title="Onboarding"
        subtitle={templateName ?? 'Your checklist'}
        backHref="/ess/work"
      />
      <div className="space-y-3">
        {tasks.map((t) => (
          <article key={t.id} className="space-y-3">
            <EssListItem
              title={t.title}
              subtitle={t.description}
              meta={t.dueDate ? `Due ${new Date(t.dueDate).toLocaleDateString()}` : t.isRequired ? 'Required' : undefined}
              trailing={<EssStatusPill status={t.status.toLowerCase()} />}
            />
            {t.status !== 'COMPLETED' ? (
              <button
                type="button"
                disabled={busy === t.id}
                onClick={() => complete(t.id)}
                className={`${essSecondaryButtonClass} w-full`}
              >
                Mark complete
              </button>
            ) : null}
          </article>
        ))}
        {!tasks.length ? (
          <EssEmptyState title="No active onboarding tasks" message="Your HR checklist will appear here when assigned." />
        ) : null}
      </div>
    </EssPullRefresh>
  );
}
