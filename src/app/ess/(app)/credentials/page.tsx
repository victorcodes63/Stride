'use client';

import { useEffect, useState } from 'react';
import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { EssPullRefresh } from '@/components/ess/EssPullRefresh';
import { EssStatusPill } from '@/components/ess/EssStatusPill';
import { EssEmptyState, EssListItem } from '@/components/ess/EssUi';

type Cred = {
  id: string;
  credentialName: string;
  expiryDate: string | null;
  status: string;
  expiringSoon: boolean;
  daysUntilExpiry: number | null;
};

export default function EssCredentialsPage() {
  const [items, setItems] = useState<Cred[]>([]);

  async function load() {
    const res = await fetch('/api/ess/credentials');
    const data = await res.json().catch(() => ({}));
    setItems(Array.isArray(data.items) ? data.items : []);
  }

  useEffect(() => {
    load().catch(() => setItems([]));
  }, []);

  return (
    <EssPullRefresh onRefresh={load}>
      <EssPageHeader title="Credentials" subtitle="Licences and certifications" backHref="/ess/more" />
      <div className="space-y-3">
        {items.map((c) => (
          <EssListItem
            key={c.id}
            title={c.credentialName}
            subtitle={
              c.expiryDate
                ? `Expires ${c.expiryDate}${c.daysUntilExpiry != null && c.daysUntilExpiry >= 0 ? ` (${c.daysUntilExpiry} days)` : ''}`
                : 'No expiry date'
            }
            trailing={<EssStatusPill status={c.status} />}
            className={c.expiringSoon ? 'border-amber-500/40 bg-amber-500/10' : undefined}
          />
        ))}
        {!items.length ? (
          <EssEmptyState title="No credentials recorded" message="Licences, certifications, and renewals will appear here." />
        ) : null}
      </div>
    </EssPullRefresh>
  );
}
