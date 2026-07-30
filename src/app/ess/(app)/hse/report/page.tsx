'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { toast } from '@/components/ui/toast';
import { EssAlert, EssCard, essInputClass, essPrimaryButtonClass } from '@/components/ess/EssUi';
import { StrideSelect } from '@/components/ui/stride-select';

export default function EssHseReportPage() {
  const router = useRouter();
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [severity, setSeverity] = useState('medium');
  const [happenedAt, setHappenedAt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!description.trim()) {
      setError('Please describe what happened.');
      return;
    }
    if (!navigator.onLine) {
      setError('You are offline. Reconnect before submitting this report.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/ess/hse/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description, location, severity, happenedAt }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not submit report.');
        return;
      }
      toast.success('HSE report submitted for review.');
      router.push('/ess/hse');
      router.refresh();
    } catch {
      setError('Could not submit report.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <EssPageHeader
        title="Report incident"
        subtitle="Report incidents, near-misses, and hazards."
        backHref="/ess/hse"
      />
      {error ? <EssAlert tone="danger">{error}</EssAlert> : null}
      <EssCard as="form" onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ess-muted)]">
            Severity
          </span>
          <StrideSelect
            surface="ess"
            triggerClassName="ess-field-compact"
            value={severity}
            onChange={setSeverity}
            options={[
              { value: 'low', label: 'Low — unsafe condition' },
              { value: 'medium', label: 'Medium — near-miss / minor' },
              { value: 'high', label: 'High — injury or urgent hazard' },
            ]}
            ariaLabel="Severity"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ess-muted)]">
            When did it happen? (optional)
          </span>
          <input
            type="datetime-local"
            value={happenedAt}
            onChange={(e) => setHappenedAt(e.target.value)}
            className={`${essInputClass} ess-field-compact`}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ess-muted)]">
            What happened?
          </span>
          <textarea
            required
            rows={5}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the incident, near-miss, or hazard"
            className={`${essInputClass} mt-0 min-h-32`}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ess-muted)]">
            Location (optional)
          </span>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="Site, yard, warehouse aisle…"
            className={`${essInputClass} ess-field-compact`}
          />
        </label>
        <button type="submit" disabled={saving} className={`${essPrimaryButtonClass} w-full`}>
          {saving ? 'Submitting…' : 'Submit report'}
        </button>
      </EssCard>
    </div>
  );
}
