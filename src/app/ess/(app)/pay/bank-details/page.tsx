'use client';

import { useEffect, useState } from 'react';
import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { toast } from '@/components/ui/toast';
import { EssAlert, EssCard, essInputClass, essPrimaryButtonClass } from '@/components/ess/EssUi';

export default function EssBankDetailsPage() {
  const [bankName, setBankName] = useState('');
  const [bankBranch, setBankBranch] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [reason, setReason] = useState('');
  const [masked, setMasked] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/ess/pay/bank-change')
      .then((r) => r.json())
      .then((d) => setMasked(d.bank?.bankAccountNumber ?? null))
      .catch(() => {});
  }, []);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!navigator.onLine) {
      toast.error('You are offline. Reconnect before requesting a bank details change.');
      return;
    }
    setSaving(true);
    const res = await fetch('/api/ess/pay/bank-change', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bankName, bankBranch, bankAccountNumber, reason }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) {
      toast.error(data.error || 'Request failed.');
      return;
    }
    toast.success(data.message || 'Request submitted.');
  }

  return (
    <div>
      <EssPageHeader title="Bank details" subtitle="Request secure salary payment changes for HR review." backHref="/ess/pay" />
      {masked ? (
        <div className="mb-4">
          <EssAlert>Current account on file: {masked}</EssAlert>
        </div>
      ) : null}
      <EssCard as="form" onSubmit={onSubmit} className="space-y-4">
        <label className="block">
          <span className="text-sm font-bold text-[var(--ess-text)]">Bank name</span>
          <input
            required
            value={bankName}
            onChange={(e) => setBankName(e.target.value)}
            className={`${essInputClass} mt-1`}
          />
        </label>
        <label className="block">
          <span className="text-sm font-bold text-[var(--ess-text)]">Branch</span>
          <input
            value={bankBranch}
            onChange={(e) => setBankBranch(e.target.value)}
            className={`${essInputClass} mt-1`}
          />
        </label>
        <label className="block">
          <span className="text-sm font-bold text-[var(--ess-text)]">Account number</span>
          <input
            required
            value={bankAccountNumber}
            onChange={(e) => setBankAccountNumber(e.target.value)}
            className={`${essInputClass} mt-1`}
          />
        </label>
        <label className="block">
          <span className="text-sm font-bold text-[var(--ess-text)]">Reason (optional)</span>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className={`${essInputClass} mt-1`}
          />
        </label>
        <button type="submit" disabled={saving} className={`${essPrimaryButtonClass} w-full`}>
          {saving ? 'Submitting...' : 'Submit change request'}
        </button>
      </EssCard>
    </div>
  );
}
