'use client';

import { useState } from 'react';
import {
  Fingerprint,
  Loader2,
  Pencil,
  Plug,
  Power,
  RefreshCcw,
  Trash2,
} from 'lucide-react';
import {
  DashboardTable,
  DashboardTableActionButton,
  DashboardTableActions,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableMeta,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { DashboardAsyncState } from '@/components/dashboard/DashboardAsyncState';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { dashStatusChip } from '@/lib/dashboard-status-chips';
import { toast } from '@/components/ui/toast';
import { adapterLabel, type ConnectionTestResult, type StaffBiometricDevice } from './types';

type Props = {
  devices: StaffBiometricDevice[];
  loading: boolean;
  error: string | null;
  canManage: boolean;
  onRetry: () => void;
  onEdit: (device: StaffBiometricDevice) => void;
  onChanged: () => void;
};

function relativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '—';
  const mins = Math.round((Date.now() - then) / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function DevicesTable({
  devices,
  loading,
  error,
  canManage,
  onRetry,
  onEdit,
  onChanged,
}: Props) {
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<'test' | 'poll' | 'toggle' | null>(null);
  const [testResults, setTestResults] = useState<Record<string, ConnectionTestResult>>({});
  const [deleteTarget, setDeleteTarget] = useState<StaffBiometricDevice | null>(null);
  const [deleting, setDeleting] = useState(false);

  const status = loading
    ? ('loading' as const)
    : error
      ? ('error' as const)
      : devices.length === 0
        ? ('empty' as const)
        : ('success' as const);

  async function testConnection(device: StaffBiometricDevice) {
    setBusyId(device.id);
    setBusyAction('test');
    try {
      const res = await fetch(`/api/staff/biometric/devices/${device.id}/test-connection`, {
        method: 'POST',
      });
      const data = (await res.json().catch(() => ({}))) as ConnectionTestResult & { error?: string };
      setTestResults((prev) => ({ ...prev, [device.id]: data }));
      if (data.ok) toast.success(`${device.name} is online (${data.latencyMs ?? '?'}ms).`);
      else toast.error(`${device.name}: ${data.error || 'connection failed'}`);
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Connection test failed.';
      setTestResults((prev) => ({ ...prev, [device.id]: { ok: false, error: message } }));
      toast.error(message);
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  }

  async function pollNow(device: StaffBiometricDevice) {
    setBusyId(device.id);
    setBusyAction('poll');
    try {
      const res = await fetch(`/api/staff/biometric/devices/${device.id}/poll`, { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Poll failed.');
      toast.success(
        `Polled ${device.name}: ${data.inserted ?? 0} new punch(es), ${data.eventsCreated ?? 0} event(s).`,
      );
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Poll failed.');
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  }

  async function toggleActive(device: StaffBiometricDevice) {
    setBusyId(device.id);
    setBusyAction('toggle');
    try {
      const res = await fetch(`/api/staff/biometric/devices/${device.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !device.isActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Update failed.');
      toast.success(`${device.name} ${device.isActive ? 'deactivated' : 'activated'}.`);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Update failed.');
    } finally {
      setBusyId(null);
      setBusyAction(null);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/staff/biometric/devices/${deleteTarget.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Delete failed.');
      toast.success(`${deleteTarget.name} deleted.`);
      setDeleteTarget(null);
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Delete failed.');
    } finally {
      setDeleting(false);
    }
  }

  function connectionChip(device: StaffBiometricDevice) {
    const result = testResults[device.id];
    if (result) {
      return result.ok ? (
        <span className={dashStatusChip('success')}>Online{result.latencyMs != null ? ` · ${result.latencyMs}ms` : ''}</span>
      ) : (
        <span className={dashStatusChip('danger')} title={result.error}>
          Offline
        </span>
      );
    }
    if (!device.supportsConnection) return <span className={dashStatusChip('neutral')}>No probe</span>;
    if (device.stale) return <span className={dashStatusChip('warning')}>Stale</span>;
    return <span className={dashStatusChip('neutral')}>Untested</span>;
  }

  return (
    <>
      <DashboardTableCard>
        <DashboardTableMeta
          title="Devices"
          description="Register, test, and monitor tenant-owned biometric terminals."
        />
        <DashboardAsyncState
          status={status}
          error={error}
          onRetry={onRetry}
          empty={
            <DashboardTableEmpty
              icon={<Fingerprint className="h-8 w-8 text-neutral-300" aria-hidden />}
              title="No devices yet"
              description={
                canManage
                  ? 'Add your first biometric device to start syncing staff punches.'
                  : 'No biometric devices have been registered yet.'
              }
            />
          }
        >
          <DashboardTableViewport minWidth={960}>
            <DashboardTable>
              <thead className="bg-neutral-50 text-neutral-600">
                <tr>
                  <th className="px-3 py-2">Device</th>
                  <th className="px-3 py-2">Adapter</th>
                  <th className="px-3 py-2 col-center">State</th>
                  <th className="px-3 py-2 col-center">Connection</th>
                  <th className="px-3 py-2 col-center">Punches 24h / total</th>
                  <th className="px-3 py-2 col-center">Subjects</th>
                  <th className="px-3 py-2 col-center">Last seen</th>
                  {canManage ? <th className="px-3 py-2 col-center">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => {
                  const isBusy = busyId === device.id;
                  return (
                    <tr key={device.id} className="border-t border-neutral-100 align-top">
                      <td className="px-3 py-2">
                        <div className="font-medium text-[var(--dash-text)]">{device.name}</div>
                        <div className="text-xs text-neutral-500">
                          {device.host ? `${device.host}${device.port ? `:${device.port}` : ''}` : 'No host'}
                          {device.notes ? ` · ${device.notes}` : ''}
                        </div>
                      </td>
                      <td className="px-3 py-2">{adapterLabel(device.adapterKind)}</td>
                      <td className="px-3 py-2 col-center">
                        <span className={dashStatusChip(device.isActive ? 'success' : 'neutral')}>
                          {device.isActive ? 'Active' : 'Disabled'}
                        </span>
                      </td>
                      <td className="px-3 py-2 col-center">{connectionChip(device)}</td>
                      <td className="px-3 py-2 col-center tabular-nums">
                        {device.punches24h} / {device.punchCount}
                        {device.unmatchedPunchCount > 0 ? (
                          <span className="ml-1 text-amber-600">({device.unmatchedPunchCount}?)</span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 col-center tabular-nums">
                        {device.mappedSubjectCount} / {device.distinctSubjectCount}
                      </td>
                      <td className="px-3 py-2 col-center">
                        <div className="tabular-nums">{relativeTime(device.lastObservedAt)}</div>
                        {device.supportsConnection ? (
                          <div className="text-xs text-neutral-400">
                            poll {relativeTime(device.lastPollAt)}
                          </div>
                        ) : null}
                      </td>
                      {canManage ? (
                        <td className="px-3 py-2">
                          <DashboardTableActions>
                            {device.supportsConnection ? (
                              <DashboardTableActionButton
                                onClick={() => void testConnection(device)}
                                disabled={isBusy}
                                title="Test connection"
                              >
                                {isBusy && busyAction === 'test' ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Plug className="h-3.5 w-3.5" />
                                )}
                              </DashboardTableActionButton>
                            ) : null}
                            {device.supportsConnection ? (
                              <DashboardTableActionButton
                                onClick={() => void pollNow(device)}
                                disabled={isBusy}
                                title="Poll now"
                              >
                                {isBusy && busyAction === 'poll' ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <RefreshCcw className="h-3.5 w-3.5" />
                                )}
                              </DashboardTableActionButton>
                            ) : null}
                            <DashboardTableActionButton onClick={() => onEdit(device)} title="Edit">
                              <Pencil className="h-3.5 w-3.5" />
                            </DashboardTableActionButton>
                            <DashboardTableActionButton
                              onClick={() => void toggleActive(device)}
                              disabled={isBusy}
                              title={device.isActive ? 'Deactivate' : 'Activate'}
                            >
                              {isBusy && busyAction === 'toggle' ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Power className="h-3.5 w-3.5" />
                              )}
                            </DashboardTableActionButton>
                            <DashboardTableActionButton
                              onClick={() => setDeleteTarget(device)}
                              title="Delete"
                              className="text-red-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </DashboardTableActionButton>
                          </DashboardTableActions>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </DashboardTable>
          </DashboardTableViewport>
        </DashboardAsyncState>
      </DashboardTableCard>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Delete device?"
        description={
          deleteTarget ? (
            <>
              This permanently deletes <span className="font-medium">{deleteTarget.name}</span> and all{' '}
              {deleteTarget.punchCount} of its punches. This cannot be undone.
            </>
          ) : null
        }
        confirmLabel="Delete device"
        tone="danger"
        loading={deleting}
        onConfirm={() => void confirmDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </>
  );
}
