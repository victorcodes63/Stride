'use client';

import { useEffect, useMemo, useState } from 'react';
import { Fingerprint, RefreshCw } from 'lucide-react';
import { DashboardAsyncState } from '@/components/dashboard/DashboardAsyncState';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

type Device = {
  id: string;
  name: string;
  adapterKind: string;
  isActive: boolean;
  clientName: string;
  punchCount: number;
  lastObservedAt: string | null;
};

export default function BiometricDevicesPage() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch('/api/biometric/devices', { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to load biometric devices');
      setDevices(json.devices ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load biometric devices');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const listStatus = useMemo(() => {
    if (loading) return 'loading' as const;
    if (error) return 'error' as const;
    if (devices.length === 0) return 'empty' as const;
    return 'success' as const;
  }, [devices.length, error, loading]);

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Biometric devices"
        icon={Fingerprint}
        iconClassName="h-7 w-7 shrink-0 text-primary-700"
        description="Monitor device health and punch sync activity."
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

      <DashboardTableCard>
        <DashboardAsyncState
          status={listStatus}
          error={error}
          onRetry={() => void load()}
          empty={
            <DashboardTableEmpty
              icon={<Fingerprint className="h-8 w-8 text-neutral-300" aria-hidden />}
              title="No biometric devices"
              description="No biometric devices registered yet."
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
                  <tr key={device.id} className="border-t border-neutral-100">
                    <td className="px-3 py-2 font-medium">{device.name}</td>
                    <td className="px-3 py-2">{device.clientName}</td>
                    <td className="px-3 py-2">{device.adapterKind}</td>
                    <td className="px-3 py-2 col-center tabular-nums">{device.punchCount}</td>
                    <td className="px-3 py-2 col-center tabular-nums">
                      {device.lastObservedAt ? new Date(device.lastObservedAt).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-3 py-2 col-center">{device.isActive ? 'Active' : 'Disabled'}</td>
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
