'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Loader2, RotateCcw } from 'lucide-react';
import { toast } from '@/components/ui/toast';

type LedgerEntry = {
  id: string;
  date: string;
  type: 'carry_forward' | 'accrual' | 'debit';
  label: string;
  days: number;
  balanceAfter: number;
};

type Ledger = {
  leaveTypeId: string;
  name: string;
  color: string | null;
  entitled: number;
  carriedOver: number;
  used: number;
  remaining: number;
  entries: LedgerEntry[];
};

type LedgerData = { year: number; userId: string; ledgers: Ledger[] };

const DEFAULT_COLOR = '#043d4a';

function entryIcon(type: LedgerEntry['type']) {
  if (type === 'debit') return <ArrowDownRight className="h-3.5 w-3.5 text-red-500" />;
  if (type === 'carry_forward') return <RotateCcw className="h-3.5 w-3.5 text-secondary-600" />;
  return <ArrowUpRight className="h-3.5 w-3.5 text-emerald-600" />;
}

export function StaffLeaveLedger({ year, userId }: { year: number; userId?: string }) {
  const [data, setData] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ year: String(year) });
      if (userId) qs.set('userId', userId);
      const res = await fetch(`/api/staff/leave/ledger?${qs.toString()}`, { cache: 'no-store' });
      if (!res.ok) throw new Error('failed');
      setData((await res.json()) as LedgerData);
    } catch {
      toast.error('Could not load the balance ledger.');
    } finally {
      setLoading(false);
    }
  }, [year, userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-neutral-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading ledger…
      </div>
    );
  }

  if (!data || data.ledgers.length === 0) {
    return (
      <p className="dashboard-surface rounded-xl p-10 text-center text-sm text-neutral-500 shadow-sm">
        No balances for {year} yet.
      </p>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {data.ledgers.map((ledger) => {
        const color = ledger.color || DEFAULT_COLOR;
        return (
          <div key={ledger.leaveTypeId} className="dashboard-surface overflow-hidden rounded-xl shadow-sm">
            <div className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
              <div className="inline-flex items-center gap-2 text-sm font-semibold text-neutral-800">
                <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                {ledger.name}
              </div>
              <div className="text-right">
                <div className="text-lg font-bold tabular-nums text-primary-900">{ledger.remaining}</div>
                <div className="text-[10px] uppercase tracking-wide text-neutral-400">Available</div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-px bg-neutral-100 text-center">
              {[
                { label: 'Carried', value: ledger.carriedOver },
                { label: 'Entitled', value: ledger.entitled },
                { label: 'Used', value: ledger.used },
              ].map((cell) => (
                <div key={cell.label} className="bg-white py-2">
                  <div className="text-sm font-semibold tabular-nums text-neutral-800">{cell.value}</div>
                  <div className="text-[10px] uppercase tracking-wide text-neutral-400">{cell.label}</div>
                </div>
              ))}
            </div>
            <ul className="divide-y divide-neutral-100">
              {ledger.entries.map((entry) => (
                <li key={entry.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-neutral-50">
                      {entryIcon(entry.type)}
                    </span>
                    <div className="min-w-0">
                      <div className="truncate text-sm text-neutral-800">{entry.label}</div>
                      <div className="text-[11px] text-neutral-400">{entry.date}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-sm font-semibold tabular-nums ${
                        entry.days < 0 ? 'text-red-600' : 'text-emerald-600'
                      }`}
                    >
                      {entry.days > 0 ? '+' : ''}
                      {entry.days}
                    </div>
                    <div className="text-[11px] tabular-nums text-neutral-400">bal {entry.balanceAfter}</div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
