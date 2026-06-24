'use client';

import { useEffect, useState } from 'react';
import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { EssPullRefresh } from '@/components/ess/EssPullRefresh';
import { EssEmptyState, EssListItem } from '@/components/ess/EssUi';

type Doc = {
  id: string;
  title: string;
  category: string;
  fileName: string;
  expiresOn: string | null;
  isVerified: boolean;
};

export default function EssDocumentsPage() {
  const [items, setItems] = useState<Doc[]>([]);

  async function load() {
    const res = await fetch('/api/ess/documents');
    const data = await res.json().catch(() => ({}));
    setItems(Array.isArray(data.items) ? data.items : []);
  }

  useEffect(() => {
    load().catch(() => setItems([]));
  }, []);

  return (
    <EssPullRefresh onRefresh={load}>
      <EssPageHeader title="Documents" subtitle="HR files on your record" backHref="/ess/more" />
      <div className="space-y-3">
        {items.map((d) => (
          <EssListItem
            key={d.id}
            title={d.title}
            subtitle={`${d.category.replace(/_/g, ' ')} · ${d.fileName}`}
            meta={d.expiresOn ? `Expires ${d.expiresOn}` : d.isVerified ? 'Verified' : undefined}
          />
        ))}
        {!items.length ? (
          <EssEmptyState title="No documents yet" message="Contracts, HR letters, and employee documents will appear here." />
        ) : null}
      </div>
    </EssPullRefresh>
  );
}
