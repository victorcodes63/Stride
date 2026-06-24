'use client';

import { useEffect, useState } from 'react';
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
};

export default function EssAssetsPage() {
  const [items, setItems] = useState<Asset[]>([]);

  async function load() {
    const res = await fetch('/api/ess/assets');
    const data = await res.json().catch(() => ({}));
    setItems(Array.isArray(data.items) ? data.items : []);
  }

  useEffect(() => {
    load().catch(() => setItems([]));
  }, []);

  return (
    <EssPullRefresh onRefresh={load}>
      <EssPageHeader title="My assets" subtitle="Equipment assigned to you" backHref="/ess/more" />
      <div className="space-y-3">
        {items.map((a) => (
          <EssListItem
            key={a.id}
            title={a.name}
            subtitle={`${a.assetTag} · ${a.category.replace(/_/g, ' ')}`}
            meta={[a.serialNumber ? `S/N ${a.serialNumber}` : null, a.location].filter(Boolean).join(' · ')}
          />
        ))}
        {!items.length ? (
          <EssEmptyState title="No assets assigned" message="Equipment and kits issued to you will appear here." />
        ) : null}
      </div>
    </EssPullRefresh>
  );
}
