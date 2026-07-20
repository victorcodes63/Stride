'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { ListChecks, RefreshCw, UserPlus } from 'lucide-react';
import { DashboardAsyncState } from '@/components/dashboard/DashboardAsyncState';
import {
  DashboardTable,
  DashboardTableActionButton,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableMeta,
  DashboardTableToolbar,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { StrideSelect } from '@/components/ui/stride-select';
import { dashStatusChip } from '@/lib/dashboard-status-chips';
import type { StaffBiometricDevice, StaffBiometricPunch } from './types';

const INPUT_CLASS =
  'rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-raised)] px-3 py-2 text-sm text-[var(--dash-text)] focus:outline-none focus:ring-2 focus:ring-primary-500/30';

type Props = {
  devices: StaffBiometricDevice[];
  canManage: boolean;
  refreshKey: number;
  onMap: (punch: StaffBiometricPunch) => void;
};

function directionChip(direction: 'in' | 'out' | 'unknown') {
  const tone = direction === 'in' ? 'success' : direction === 'out' ? 'info' : 'neutral';
  return <span className={dashStatusChip(tone)}>{direction}</span>;
}

export function PunchStreamCard({ devices, canManage, refreshKey, onMap }: Props) {
  const [punches, setPunches] = useState<StaffBiometricPunch[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deviceId, setDeviceId] = useState('');
  const [match, setMatch] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (deviceId) params.set('deviceId', deviceId);
      if (match !== 'all') params.set('match', match);
      if (from) params.set('from', from);
      if (to) params.set('to', to);
      if (search.trim()) params.set('search', search.trim());
      const res = await fetch(`/api/staff/biometric/punches?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to load punches.');
      setPunches(Array.isArray(data.punches) ? data.punches : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load punches.');
    } finally {
      setLoading(false);
    }
  }, [deviceId, match, from, to, search]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const deviceOptions = useMemo(
    () => [{ value: '', label: 'All devices' }, ...devices.map((d) => ({ value: d.id, label: d.name }))],
    [devices],
  );

  const status = loading
    ? ('loading' as const)
    : error
      ? ('error' as const)
      : punches.length === 0
        ? ('empty' as const)
        : ('success' as const);

  return (
    <DashboardTableCard>
      <DashboardTableToolbar>
        <div className="flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-end">
          <div className="min-w-[180px]">
            <label className="mb-1 block text-xs font-medium text-[var(--dash-text-muted)]">Device</label>
            <StrideSelect
              value={deviceId}
              onChange={setDeviceId}
              options={deviceOptions}
              ariaLabel="Filter by device"
              size="sm"
            />
          </div>
          <div className="min-w-[150px]">
            <label className="mb-1 block text-xs font-medium text-[var(--dash-text-muted)]">Match</label>
            <StrideSelect
              value={match}
              onChange={setMatch}
              options={[
                { value: 'all', label: 'All punches' },
                { value: 'matched', label: 'Matched only' },
                { value: 'unmatched', label: 'Unmatched only' },
              ]}
              ariaLabel="Filter by match"
              size="sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--dash-text-muted)]">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={INPUT_CLASS} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--dash-text-muted)]">To</label>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={INPUT_CLASS} />
          </div>
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-xs font-medium text-[var(--dash-text-muted)]">Subject</label>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search subject id…"
              className={`w-full ${INPUT_CLASS}`}
            />
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="btn-secondary inline-flex h-9 items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </DashboardTableToolbar>

      <DashboardTableMeta
        title="Punch stream"
        description="Most recent punches across all tenant-owned devices."
      />

      <DashboardAsyncState
        status={status}
        error={error}
        onRetry={() => void load()}
        empty={
          <DashboardTableEmpty
            icon={<ListChecks className="h-8 w-8 text-neutral-300" aria-hidden />}
            title="No punches"
            description="No punches match the current filters."
          />
        }
      >
        <DashboardTableViewport minWidth={860}>
          <DashboardTable>
            <thead className="bg-neutral-50 text-neutral-600">
              <tr>
                <th className="px-3 py-2">Time</th>
                <th className="px-3 py-2">Device</th>
                <th className="px-3 py-2">Subject</th>
                <th className="px-3 py-2">Direction</th>
                <th className="px-3 py-2">Source</th>
                <th className="px-3 py-2">Staff</th>
                {canManage ? <th className="px-3 py-2 col-center">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {punches.map((punch) => (
                <tr key={punch.id} className="border-t border-neutral-100">
                  <td className="whitespace-nowrap px-3 py-2 tabular-nums">
                    {new Date(punch.observedAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2">{punch.deviceName}</td>
                  <td className="px-3 py-2 font-mono text-xs">{punch.rawSubjectId}</td>
                  <td className="px-3 py-2">{directionChip(punch.direction)}</td>
                  <td className="px-3 py-2">
                    <span className={dashStatusChip(punch.source === 'device' ? 'primary' : 'info')}>
                      {punch.source}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {punch.userName ? (
                      <span className="font-medium">{punch.userName}</span>
                    ) : (
                      <span className={dashStatusChip('warning')}>Unmatched</span>
                    )}
                  </td>
                  {canManage ? (
                    <td className="px-3 py-2 col-center">
                      {!punch.userId ? (
                        <DashboardTableActionButton onClick={() => onMap(punch)}>
                          <UserPlus className="mr-1 h-3.5 w-3.5" />
                          Map
                        </DashboardTableActionButton>
                      ) : (
                        <DashboardTableActionButton variant="secondary" onClick={() => onMap(punch)}>
                          Reassign
                        </DashboardTableActionButton>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </DashboardTable>
        </DashboardTableViewport>
      </DashboardAsyncState>
    </DashboardTableCard>
  );
}
