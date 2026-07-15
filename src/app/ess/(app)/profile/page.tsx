'use client';

import { useEffect, useState } from 'react';
import { toast } from '@/components/ui/toast';
import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { EssCard, EssSectionTitle, essInputClass, essPrimaryButtonClass } from '@/components/ess/EssUi';

type MePayload = {
  name: string;
  email: string;
  role: string;
  employee: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    jobTitle: string | null;
    employeeNumber: string | null;
    employmentStatus: string;
    dateOfJoining: string | null;
  } | null;
};

export default function EssProfilePage() {
  const [me, setMe] = useState<MePayload | null>(null);
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/ess/auth/me')
      .then((r) => r.json())
      .then((data) => {
        const payload = data as MePayload;
        setMe(payload);
        setPhone(payload.employee?.phone || '');
        setEmail(payload.employee?.email || '');
      })
      .catch(() => setMe(null));
  }, []);

  async function onSave(e: React.FormEvent) {
    e.preventDefault();
    if (!navigator.onLine) {
      toast.error('You are offline. Reconnect before updating your profile.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/ess/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, email }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error || 'Could not update profile.');
        return;
      }
      toast.success('Profile updated successfully.');
      setMe((prev) =>
        prev
          ? {
              ...prev,
              employee: prev.employee
                ? { ...prev.employee, phone: data.phone ?? null, email: data.email ?? null }
                : prev.employee,
            }
          : prev,
      );
    } catch {
      toast.error('Could not update profile.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <EssPageHeader title="Profile" backHref="/ess/more" />
      <EssCard className="min-w-0 overflow-hidden">
        <EssSectionTitle eyebrow="Employee record" title="Your details" />
        <dl className="grid min-w-0 gap-4 text-sm sm:grid-cols-2">
          <div className="min-w-0">
            <dt className="text-[var(--ess-muted)]">ESS name</dt>
            <dd className="break-words font-bold text-[var(--ess-text)]">{me?.name || '-'}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[var(--ess-muted)]">ESS email</dt>
            <dd className="break-all font-bold text-[var(--ess-text)]">{me?.email || '-'}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[var(--ess-muted)]">Role</dt>
            <dd className="break-words font-bold capitalize text-[var(--ess-text)]">{me?.role || '-'}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[var(--ess-muted)]">Employee number</dt>
            <dd className="break-words font-bold text-[var(--ess-text)]">{me?.employee?.employeeNumber || '-'}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[var(--ess-muted)]">Job title</dt>
            <dd className="break-words font-bold text-[var(--ess-text)]">{me?.employee?.jobTitle || '-'}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[var(--ess-muted)]">Employment status</dt>
            <dd className="break-words font-bold capitalize text-[var(--ess-text)]">
              {me?.employee?.employmentStatus || '-'}
            </dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[var(--ess-muted)]">Phone</dt>
            <dd className="break-words font-bold text-[var(--ess-text)]">{me?.employee?.phone || '-'}</dd>
          </div>
          <div className="min-w-0">
            <dt className="text-[var(--ess-muted)]">Date joined</dt>
            <dd className="break-words font-bold text-[var(--ess-text)]">
              {me?.employee?.dateOfJoining ? new Date(me.employee.dateOfJoining).toLocaleDateString() : '-'}
            </dd>
          </div>
        </dl>
      </EssCard>
      <EssCard className="max-w-xl">
        <EssSectionTitle eyebrow="Self-service" title="Update contact details" />
        <form className="space-y-3" onSubmit={onSave}>
          <div>
            <label className="block text-sm font-bold text-[var(--ess-text)] mb-1">Phone</label>
            <input
              type="text"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={essInputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-[var(--ess-text)] mb-1">Employee email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={essInputClass}
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className={essPrimaryButtonClass}
          >
            {saving ? 'Saving...' : 'Save profile'}
          </button>
        </form>
      </EssCard>
    </div>
  );
}
