'use client';

import { useEffect, useState } from 'react';
import { Phone, UserRound } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { EssPageHeader } from '@/components/ess/EssPageHeader';
import {
  EssAlert,
  EssCard,
  EssEmptyState,
  EssSectionTitle,
  essInputClass,
  essPrimaryButtonClass,
} from '@/components/ess/EssUi';
import { StrideSelect } from '@/components/ui/stride-select';

type Contact = {
  name: string;
  phone: string;
  relationship: string;
};

const RELATIONSHIP_OPTIONS = [
  { value: 'Spouse', label: 'Spouse' },
  { value: 'Parent', label: 'Parent' },
  { value: 'Sibling', label: 'Sibling' },
  { value: 'Child', label: 'Child' },
  { value: 'Relative', label: 'Relative' },
  { value: 'Friend', label: 'Friend' },
  { value: 'Colleague', label: 'Colleague' },
  { value: 'Other', label: 'Other' },
];

const EMPTY: Contact = { name: '', phone: '', relationship: '' };

function ContactPreview({
  title,
  contact,
}: {
  title: string;
  contact: Contact;
}) {
  if (!contact.name && !contact.phone) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--ess-border)] px-4 py-5 text-center">
        <p className="text-sm font-semibold text-[var(--ess-muted)]">No {title.toLowerCase()} saved</p>
      </div>
    );
  }

  return (
    <div className="ess-card-flat p-4">
      <p className="text-[11px] font-black uppercase tracking-[0.1em] text-[var(--ess-muted)]">{title}</p>
      <div className="mt-3 flex items-start gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--ess-primary-soft)] text-[var(--ess-primary)]">
          <UserRound className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="text-base font-black text-[var(--ess-text)]">{contact.name || '—'}</p>
          {contact.relationship ? (
            <p className="mt-0.5 text-xs font-bold text-[var(--ess-muted)]">{contact.relationship}</p>
          ) : null}
          {contact.phone ? (
            <a
              href={`tel:${contact.phone.replace(/\s+/g, '')}`}
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-bold text-[var(--ess-primary)]"
            >
              <Phone className="h-3.5 w-3.5" />
              {contact.phone}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ContactFields({
  label,
  value,
  onChange,
}: {
  label: string;
  value: Contact;
  onChange: (next: Contact) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm font-black text-[var(--ess-text)]">{label}</p>
      <label className="block">
        <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ess-muted)]">
          Full name
        </span>
        <input
          value={value.name}
          onChange={(e) => onChange({ ...value, name: e.target.value })}
          className={`${essInputClass} ess-field-compact`}
          placeholder="e.g. Jane Wanjiku"
          autoComplete="name"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ess-muted)]">
          Phone
        </span>
        <input
          type="tel"
          value={value.phone}
          onChange={(e) => onChange({ ...value, phone: e.target.value })}
          className={`${essInputClass} ess-field-compact`}
          placeholder="+254 7…"
          autoComplete="tel"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ess-muted)]">
          Relationship
        </span>
        <StrideSelect
          surface="ess"
          triggerClassName="ess-field-compact"
          value={value.relationship}
          onChange={(relationship) => onChange({ ...value, relationship })}
          options={[{ value: '', label: 'Select relationship' }, ...RELATIONSHIP_OPTIONS]}
          ariaLabel={`${label} relationship`}
        />
      </label>
    </div>
  );
}

export default function EssEmergencyContactsPage() {
  const [primary, setPrimary] = useState<Contact>(EMPTY);
  const [secondary, setSecondary] = useState<Contact>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/ess/profile/emergency');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Could not load emergency contacts.');
      }
      setPrimary({
        name: data.primary?.name || '',
        phone: data.primary?.phone || '',
        relationship: data.primary?.relationship || '',
      });
      setSecondary({
        name: data.secondary?.name || '',
        phone: data.secondary?.phone || '',
        relationship: data.secondary?.relationship || '',
      });
      setEditing(!data.primary?.name && !data.secondary?.name);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load emergency contacts.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!navigator.onLine) {
      setError('You are offline. Reconnect before saving emergency contacts.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const res = await fetch('/api/ess/profile/emergency', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ primary, secondary }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Could not save emergency contacts.');
        return;
      }
      setPrimary({
        name: data.primary?.name || '',
        phone: data.primary?.phone || '',
        relationship: data.primary?.relationship || '',
      });
      setSecondary({
        name: data.secondary?.name || '',
        phone: data.secondary?.phone || '',
        relationship: data.secondary?.relationship || '',
      });
      setEditing(false);
      toast.success('Emergency contacts saved.');
    } catch {
      setError('Could not save emergency contacts.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      <EssPageHeader
        title="Emergency contacts"
        subtitle="People HR and supervisors should call if something happens at work."
        backHref="/ess/profile"
      />

      {error ? <EssAlert tone="danger">{error}</EssAlert> : null}

      {loading ? (
        <p className="ess-card-flat px-4 py-8 text-center text-sm text-[var(--ess-muted)]">Loading contacts…</p>
      ) : editing ? (
        <EssCard as="form" onSubmit={onSave} className="space-y-5">
          <ContactFields label="Primary contact" value={primary} onChange={setPrimary} />
          <div className="border-t border-[var(--ess-border)] pt-5">
            <ContactFields label="Secondary contact (optional)" value={secondary} onChange={setSecondary} />
          </div>
          <div className="flex gap-2">
            {(primary.name || secondary.name) ? (
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  void load();
                }}
                className="ess-btn-secondary flex-1"
              >
                Cancel
              </button>
            ) : null}
            <button type="submit" disabled={saving} className={`${essPrimaryButtonClass} flex-1`}>
              {saving ? 'Saving…' : 'Save contacts'}
            </button>
          </div>
        </EssCard>
      ) : (
        <>
          <section className="space-y-3">
            <EssSectionTitle eyebrow="On file" title="Who we call" />
            <ContactPreview title="Primary" contact={primary} />
            <ContactPreview title="Secondary" contact={secondary} />
            {!primary.name && !secondary.name ? (
              <EssEmptyState
                title="No emergency contacts yet"
                message="Add at least one person HR can reach quickly in an emergency."
              />
            ) : null}
          </section>
          <button type="button" onClick={() => setEditing(true)} className={`${essPrimaryButtonClass} w-full`}>
            Update contacts
          </button>
        </>
      )}
    </div>
  );
}
