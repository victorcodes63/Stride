'use client';

import { useState } from 'react';
import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { EssAlert, EssCard, essInputClass, essPrimaryButtonClass } from '@/components/ess/EssUi';

export default function EssAccountSecurityPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!navigator.onLine) {
      setError('You are offline. Reconnect before updating your password.');
      return;
    }
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const res = await fetch('/api/ess/auth/password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || 'Unable to update password.');
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setSuccess('Password updated successfully.');
    } catch {
      setError('Unable to update password.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <EssPageHeader title="Account security" subtitle="Keep your ESS password current." backHref="/ess/more" />
      <EssCard className="max-w-xl">
        <p className="mb-4 text-sm text-[var(--ess-muted)]">Use this page to reset your ESS password.</p>
        {error ? <div className="mb-3"><EssAlert tone="danger">{error}</EssAlert></div> : null}
        {success ? <div className="mb-3"><EssAlert tone="success">{success}</EssAlert></div> : null}
        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label className="block text-sm font-bold text-[var(--ess-text)] mb-1">Current password</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={essInputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-bold text-[var(--ess-text)] mb-1">New password</label>
            <input
              type="password"
              minLength={6}
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className={essInputClass}
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className={essPrimaryButtonClass}
          >
            {saving ? 'Updating...' : 'Update password'}
          </button>
        </form>
      </EssCard>
    </div>
  );
}
