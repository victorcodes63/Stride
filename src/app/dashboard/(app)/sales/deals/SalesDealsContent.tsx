'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DASHBOARD_SURFACE_CLASS } from '@/lib/dashboard-layout';

const STAGE_COLORS: Record<string, string> = {
  lead: 'bg-neutral-100 text-neutral-700',
  qualified: 'bg-blue-50 text-blue-700',
  proposal: 'bg-amber-50 text-amber-800',
  negotiation: 'bg-orange-50 text-orange-800',
  won: 'bg-emerald-50 text-emerald-800',
  lost: 'bg-red-50 text-red-700',
};

type DealRow = {
  id: string;
  name: string;
  stage: string;
  value: number;
  currency: string;
  owner: { name: string } | null;
  expectedCloseDate: string | null;
  accountsInvoiceId: string | null;
};

export default function SalesDealsContent() {
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    fetch('/api/sales/deals')
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error || 'Failed');
        return data.deals as DealRow[];
      })
      .then(setDeals)
      .catch(() => setDeals([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Sales pipeline"
        description="Deals from lead to won/lost. Won revenue reconciles with Finance when an invoice is linked."
      />

      {loading ? (
        <div className="flex items-center gap-2 text-neutral-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading pipeline…
        </div>
      ) : (
        <div className={`overflow-hidden ${DASHBOARD_SURFACE_CLASS} shadow-sm`}>
          <table className="min-w-full text-sm">
            <thead className="bg-neutral-50 text-left text-xs uppercase tracking-wide text-neutral-500">
              <tr>
                <th className="px-4 py-3">Deal</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Stage</th>
                <th className="px-4 py-3">Value</th>
                <th className="px-4 py-3">Close</th>
                <th className="px-4 py-3">Finance</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((d) => (
                <tr key={d.id} className="border-t border-neutral-100">
                  <td className="px-4 py-3 font-medium text-neutral-900">{d.name}</td>
                  <td className="px-4 py-3">{d.owner?.name ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STAGE_COLORS[d.stage] ?? ''}`}
                    >
                      {d.stage}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {d.value.toLocaleString('en-KE')} {d.currency}
                  </td>
                  <td className="px-4 py-3">{d.expectedCloseDate ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-neutral-500">
                    {d.accountsInvoiceId ? 'Linked invoice' : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </DashboardPage>
  );
}
