'use client';

import { useEffect, useState } from 'react';
import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { EssAlert, EssCard, EssEmptyState, EssListItem, essInputClass, essPrimaryButtonClass } from '@/components/ess/EssUi';
import { EssStatusPill } from '@/components/ess/EssStatusPill';

type Grievance = {
  id: string;
  grievanceNumber: string;
  subject: string;
  category: string;
  status: string;
  submittedAt: string;
};

export default function EssGrievancesPage() {
  const [items, setItems] = useState<Grievance[]>([]);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('OTHER');
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch('/api/ess/grievances');
    const data = await res.json().catch(() => []);
    if (res.ok) setItems(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    void load();
  }, []);

  async function submit() {
    setError(null);
    if (!navigator.onLine) {
      setError('You are offline. Reconnect before submitting a grievance.');
      return;
    }
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
  }

  return (
    <div className="space-y-5">
      <div>
        <EssPageHeader title="Grievances" subtitle="Raise workplace concerns for formal HR review." backHref="/ess/more" />
        <p className="text-sm leading-6 text-[var(--ess-muted)]">
          Use this form for workplace concerns (safety, harassment, workload, management, and similar). Your case is logged and reviewed under the employer’s grievance procedure and applicable labour law. This is not the same as a{' '}
          <a className="font-medium text-primary-700 underline" href="/ess/disciplinary">
            disciplinary case
          </a>{' '}
          against you.
        </p>
      </div>
      <EssCard>
        <p className="text-sm font-black text-[var(--ess-text)]">Submit grievance</p>
        <div className="mt-2 space-y-2">
          <select className={essInputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
            {['WORKPLACE_SAFETY','HARASSMENT','DISCRIMINATION','WORKLOAD','MANAGEMENT','COMPENSATION','POLICY','OTHER'].map((c) => <option key={c} value={c}>{c.replaceAll('_', ' ')}</option>)}
          </select>
          <input className={essInputClass} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" />
          <textarea className={`${essInputClass} min-h-28`} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the grievance" />
          {error ? <EssAlert tone="danger">{error}</EssAlert> : null}
          <button onClick={submit} className={essPrimaryButtonClass}>Submit</button>
        </div>
      </EssCard>
      <section className="space-y-2">
        {items.map((item) => (
          <EssListItem
            key={item.id}
            title={item.subject}
            subtitle={`${item.grievanceNumber} · ${item.category.replaceAll('_', ' ')}`}
            meta={new Date(item.submittedAt).toLocaleDateString()}
            trailing={<EssStatusPill status={item.status} />}
          />
        ))}
        {!items.length ? (
          <EssEmptyState title="No grievances submitted" message="Cases you raise will appear here with their review status." />
        ) : null}
      </section>
    </div>
  );
}
