'use client';

import { useEffect, useState } from 'react';
import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { EssPullRefresh } from '@/components/ess/EssPullRefresh';

type Shift = {
  id: string;
  workDate: string;
  startsAt: string;
  endsAt: string;
  shiftName: string;
  periodName: string | null;
};

export default function EssRotaPage() {
  const [items, setItems] = useState<Shift[]>([]);

  async function load() {
    const res = await fetch('/api/ess/rota');
    const data = await res.json().catch(() => ({}));
    setItems(Array.isArray(data.items) ? data.items : []);
  }

  useEffect(() => {
    load().catch(() => setItems([]));
  }, []);

  return (
    <EssPullRefresh onRefresh={load}>
      <EssPageHeader title="My rota" subtitle="Next 4 weeks" backHref="/ess/work" />
      <div className="space-y-3">
        {items.map((s) => (
          <div key={s.id} className="rounded-xl border border-neutral-200 bg-white p-4">
            <p className="font-semibold text-neutral-900">{s.shiftName}</p>
            <p className="text-sm text-neutral-600">
              {new Date(s.workDate).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
            <p className="mt-1 text-sm text-neutral-500">
              {new Date(s.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              {' – '}
              {new Date(s.endsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        ))}
        {!items.length ? (
          <p className="rounded-xl border border-neutral-200 bg-white py-10 text-center text-sm text-neutral-500">
            No upcoming shifts scheduled.
          </p>
        ) : null}
      </div>
    </EssPullRefresh>
  );
}
