'use client';

import { useCallback, useEffect, useState } from 'react';
import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { EssPullRefresh } from '@/components/ess/EssPullRefresh';
import { EssEmptyState, EssListItem } from '@/components/ess/EssUi';

type Asset = {
  id: string;
  assetTag: string;
  name: string;
  category: string;
  serialNumber: string | null;
  location: string | null;
  assignedAt: string | null;
  handoverAcknowledgedAt: string | null;
  needsAck: boolean;
  warrantyExpiry: string | null;
};

export default function EssAssetsPage() {
  const [items, setItems] = useState<Asset[]>([]);
  const [ackLoading, setAckLoading] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch('/api/ess/assets');
    const data = await res.json().catch(() => ({}));
    setItems(Array.isArray(data.items) ? data.items : []);
  }, []);

  useEffect(() => {
    load().catch(() => setItems([]));
  }, [load]);

  const acknowledge = async (id: string) => {
    setAckLoading(id);
    try {
      const res = await fetch(`/api/ess/assets/${id}/ack`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to acknowledge');
      await load();
    } catch {
      /* keep list visible */
    } finally {
      setAckLoading(null);
    }
  };

  return (
    <EssPullRefresh onRefresh={load}>
      <EssPageHeader title="My assets" subtitle="Equipment assigned to you" backHref="/ess/more" />
      <div className="space-y-3">
        {items.map((a) => (
          <div key={a.id} className="rounded-xl border border-neutral-200 bg-white p-3 shadow-sm">
            <EssListItem
              title={a.name}
              subtitle={`${a.assetTag} · ${a.category.replace(/_/g, ' ')}`}
              meta={[
                a.serialNumber ? `S/N ${a.serialNumber}` : null,
                a.location,
                a.warrantyExpiry ? `Warranty until ${a.warrantyExpiry}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            />
            {a.needsAck ? (
              <button
                type="button"
                disabled={ackLoading === a.id}
                onClick={() => void acknowledge(a.id)}
                className="mt-3 w-full rounded-lg bg-primary-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {ackLoading === a.id ? 'Confirming…' : 'Acknowledge handover'}
              </button>
            ) : a.handoverAcknowledgedAt ? (
              <p className="mt-2 text-xs text-emerald-700">Handover acknowledged</p>
            ) : null}
          </div>
        ))}
        {!items.length ? (
          <EssEmptyState title="No assets assigned" message="Equipment and kits issued to you will appear here." />
        ) : null}
      </div>
    </EssPullRefresh>
  );
}
