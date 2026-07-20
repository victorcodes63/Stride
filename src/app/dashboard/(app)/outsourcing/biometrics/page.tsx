'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Fingerprint, RefreshCw } from 'lucide-react';
import { DashboardAsyncState } from '@/components/dashboard/DashboardAsyncState';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableToolbar,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { dashboardFilterSelectClass } from '@/components/dashboard/DashboardFilterBar';
import { OutsourcingClientSwitcher } from '@/components/outsourcing/OutsourcingClientSwitcher';
import { useOutsourcingClient } from '@/hooks/use-outsourcing-client';

type Device = {
  id: string;
  name: string;
  adapterKind: string;
  isActive: boolean;
  clientName: string;
  punchCount: number;
  lastObservedAt: string | null;
};

function OutsourcingBiometricsContent() {
  const { clientId, clients, setClientId, showSwitcher } = useOutsourcingClient();
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!clientId) {
      setDevices([]);
      setLoading(false);
      return;
    }
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(
        `/api/biometric/devices?clientId=${encodeURIComponent(clientId)}`,
        { cache: 'no-store' },
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load biometric devices');
      setDevices(json.devices ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load biometric devices');
      setDevices([]);
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    void load();
  }, [load]);

  const listStatus = useMemo(() => {
    if (!clientId) return 'empty' as const;
    if (loading) return 'loading' as const;
    if (error) return 'error' as const;
    if (devices.length === 0) return 'empty' as const;
    return 'success' as const;
  }, [clientId, devices.length, error, loading]);

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="09 — HR Outsourcing"
        title="Client biometrics"
        icon={Fingerprint}
        iconClassName="h-7 w-7 shrink-0 text-primary-700"
        description="Biometric devices and punch sync for the selected end-client."
        actions={
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary inline-flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        }
      />

      {showSwitcher ? (
        <div className="mb-4 overflow-hidden dashboard-surface shadow-sm">
          <DashboardTableToolbar>
            <OutsourcingClientSwitcher
              clients={clients}
              value={clientId}
              onChange={setClientId}
              className={dashboardFilterSelectClass}
            />
          </DashboardTableToolbar>
        </div>
      ) : null}

      <DashboardTableCard>
        <DashboardAsyncState
          status={listStatus}
          error={error}
          onRetry={() => void load()}
          empty={
            <DashboardTableEmpty
              icon={<Fingerprint className="h-8 w-8 text-neutral-300" aria-hidden />}
              title={clientId ? 'No biometric devices' : 'Select an end-client'}
              description={
                clientId
                  ? 'No biometric devices registered for this end-client yet.'
                  : 'Choose an end-client to view devices.'
              }
            />
          }
        >
          <DashboardTableViewport minWidth={720}>
            <DashboardTable>
              <thead className="bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="px-3 py-2">Device</th>
                  <th className="px-3 py-2">Client</th>
                  <th className="px-3 py-2">Adapter</th>
                  <th className="px-3 py-2 col-center">Punches</th>
                  <th className="px-3 py-2 col-center">Last Seen</th>
                  <th className="px-3 py-2 col-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => (
                  <tr key={device.id}>
                    <td className="px-3 py-2 font-medium">{device.name}</td>
                    <td className="px-3 py-2">{device.clientName}</td>
                    <td className="px-3 py-2">{device.adapterKind}</td>
                    <td className="px-3 py-2 col-center tabular-nums">{device.punchCount}</td>
                    <td className="px-3 py-2 col-center tabular-nums">
                      {device.lastObservedAt
                        ? new Date(device.lastObservedAt).toLocaleString()
                        : '—'}
                    </td>
                    <td className="px-3 py-2 col-center">
                      {device.isActive ? 'Active' : 'Inactive'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </DashboardTable>
          </DashboardTableViewport>
        </DashboardAsyncState>
      </DashboardTableCard>
    </DashboardPage>
  );
}

export default function OutsourcingBiometricsPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-neutral-500">Loading biometrics…</div>}>
      <OutsourcingBiometricsContent />
    </Suspense>
  );
}
