'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardAsyncState } from '@/components/dashboard/DashboardAsyncState';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { fleetSettlementStatusBadgeClass } from '@/lib/fleet-settlement';

type SettlementRow = {
  id: string;
  tripId: string;
  tripNumber: string;
  route: string;
  settlementType: string;
  settlementTypeLabel: string;
  payeeName: string;
  amountKes: number;
  status: string;
  statusLabel: string;
  podVerified: boolean;
};

export default function FleetSettlementsPage() {
  const [rows, setRows] = useState<SettlementRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/fleet/settlements');
      if (!res.ok) throw new Error('Unable to load settlements.');
      setRows((await res.json()) as SettlementRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load settlements.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateSettlement(id: string, body: Record<string, unknown>) {
    setSavingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/fleet/settlements/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || 'Update failed.');
      }
      const updated = (await res.json()) as SettlementRow;
      setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed.');
    } finally {
      setSavingId(null);
    }
  }

  const listStatus = loading ? 'loading' : error ? 'error' : 'success';

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Fleet & Logistics"
        title="Settlements"
        description="Driver mileage, trip expenses, and transporter payouts — partner payments gated on POD verification."
      />

      <DashboardAsyncState status={listStatus} error={error} onRetry={() => void load()}>
        <DashboardTableCard>
          <DashboardTableViewport>
            {rows.length === 0 ? (
              <DashboardTableEmpty
                title="No settlements in queue"
                description="Settlements are created when trips are delivered. Run the fleet demo seed to populate sample data."
              />
            ) : (
              <DashboardTable>
                <thead>
                  <tr>
                    <th>Trip</th>
                    <th>Payee</th>
                    <th>Type</th>
                    <th className="col-right">Amount (KES)</th>
                    <th>Status</th>
                    <th className="col-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="col-primary">
                        <Link
                          href={`/dashboard/fleet/trips/${row.tripId}`}
                          className="font-medium text-primary-600 hover:underline"
                        >
                          {row.tripNumber}
                        </Link>
                        <span className="mt-0.5 block text-xs font-normal text-neutral-500">
                          {row.route}
                        </span>
                      </td>
                      <td>{row.payeeName}</td>
                      <td className="col-muted text-sm">{row.settlementTypeLabel}</td>
                      <td className="col-right">{row.amountKes.toLocaleString()}</td>
                      <td>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${fleetSettlementStatusBadgeClass(row.status as never)}`}
                        >
                          {row.statusLabel}
                        </span>
                        {row.settlementType === 'partner' && !row.podVerified ? (
                          <span className="mt-1 block text-[11px] text-amber-700">POD not verified</span>
                        ) : null}
                      </td>
                      <td className="col-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          {row.status === 'pending' ? (
                            <>
                              {row.settlementType === 'partner' ? (
                                <button
                                  type="button"
                                  disabled={savingId === row.id}
                                  onClick={() => void updateSettlement(row.id, { podVerified: true })}
                                  className="text-xs font-medium text-neutral-600 hover:text-primary-600"
                                >
                                  Verify POD
                                </button>
                              ) : null}
                              <button
                                type="button"
                                disabled={savingId === row.id}
                                onClick={() => void updateSettlement(row.id, { status: 'approved' })}
                                className="text-xs font-medium text-primary-600 hover:text-primary-700"
                              >
                                Approve
                              </button>
                            </>
                          ) : null}
                          {row.status === 'approved' ? (
                            <button
                              type="button"
                              disabled={savingId === row.id}
                              onClick={() => void updateSettlement(row.id, { status: 'paid' })}
                              className="text-xs font-medium text-primary-600 hover:text-primary-700"
                            >
                              Mark paid
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DashboardTable>
            )}
          </DashboardTableViewport>
        </DashboardTableCard>
      </DashboardAsyncState>
    </DashboardPage>
  );
}
