'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { DashboardModal } from '@/components/dashboard/DashboardModal';
import { StrideSelect } from '@/components/ui/stride-select';
import { toast } from '@/components/ui/toast';
import type { StaffBiometricDevice } from './types';

const INPUT_CLASS =
  'w-full rounded-lg border border-[var(--dash-border)] bg-[var(--dash-surface-raised)] px-3 py-2 text-sm text-[var(--dash-text)] focus:outline-none focus:ring-2 focus:ring-primary-500/30';

const ADAPTER_OPTIONS = [
  { value: 'hikvision_isapi', label: 'Hikvision ISAPI (network device)' },
  { value: 'csv', label: 'CSV / Manual import' },
];

type Props = {
  device?: StaffBiometricDevice | null;
  onClose: () => void;
  onSaved: () => void;
};

export function DeviceFormModal({ device, onClose, onSaved }: Props) {
  const isEdit = Boolean(device);
  const [name, setName] = useState(device?.name ?? '');
  const [adapterKind, setAdapterKind] = useState(device?.adapterKind ?? 'hikvision_isapi');
  const [host, setHost] = useState(device?.host ?? '');
  const [port, setPort] = useState(device?.port ? String(device.port) : '');
  const [useHttps, setUseHttps] = useState(device?.useHttps ?? false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [timezone, setTimezone] = useState(device?.timezone ?? '');
  const [notes, setNotes] = useState(device?.notes ?? '');
  const [isActive, setIsActive] = useState(device?.isActive ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isNetwork = adapterKind === 'hikvision_isapi';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Device name is required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload: Record<string, unknown> = {
        name: name.trim(),
        adapterKind,
        isActive,
        notes: notes.trim(),
      };
      if (isNetwork) {
        payload.host = host.trim();
        payload.port = port.trim();
        payload.useHttps = useHttps;
        payload.timezone = timezone.trim();
        if (username.trim()) payload.username = username.trim();
        if (password) payload.password = password;
      }

      const url = isEdit ? `/api/staff/biometric/devices/${device!.id}` : '/api/staff/biometric/devices';
      const res = await fetch(url, {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save device.');
      toast.success(isEdit ? 'Device updated.' : 'Device created.');
      onSaved();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save device.';
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardModal
      open
      onClose={onClose}
      title={isEdit ? 'Edit device' : 'Add biometric device'}
      description="Register a tenant-owned terminal for internal staff time & attendance."
      size="lg"
      dismissible={!saving}
      footer={
        <>
          <button type="button" onClick={onClose} disabled={saving} className="btn-secondary px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            type="submit"
            form="staff-device-form"
            disabled={saving || !name.trim()}
            className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isEdit ? 'Save changes' : 'Create device'}
          </button>
        </>
      }
    >
      <form id="staff-device-form" onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">
            {error}
          </div>
        ) : null}

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--dash-text)]">
            Device name <span className="text-red-600">*</span>
          </span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Head office entrance"
            maxLength={120}
            className={INPUT_CLASS}
            required
          />
        </label>

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--dash-text)]">Adapter</span>
          <StrideSelect
            value={adapterKind}
            onChange={setAdapterKind}
            options={ADAPTER_OPTIONS}
            ariaLabel="Adapter kind"
            className="w-full"
          />
          <span className="mt-1 block text-xs text-[var(--dash-text-muted)]">
            {isNetwork
              ? 'Polls the device over the network (Hikvision ISAPI, Digest auth).'
              : 'No live connection — punches are added via CSV import or on-device sync.'}
          </span>
        </label>

        {isNetwork ? (
          <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-muted)] p-4">
            <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Connection
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="block sm:col-span-2">
                <span className="mb-1 block text-sm font-medium text-[var(--dash-text)]">Host / IP</span>
                <input
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="192.168.1.64"
                  className={INPUT_CLASS}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[var(--dash-text)]">Port</span>
                <input
                  value={port}
                  onChange={(e) => setPort(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder="80"
                  inputMode="numeric"
                  className={INPUT_CLASS}
                />
              </label>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[var(--dash-text)]">Username</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={device?.hasCredentials ? '•••••• (unchanged)' : 'admin'}
                  autoComplete="off"
                  className={INPUT_CLASS}
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[var(--dash-text)]">Password</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={device?.hasCredentials ? '•••••• (leave blank to keep)' : '••••••'}
                  autoComplete="new-password"
                  className={INPUT_CLASS}
                />
              </label>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1 block text-sm font-medium text-[var(--dash-text)]">
                  Timezone <span className="text-xs font-normal text-[var(--dash-text-muted)]">(IANA)</span>
                </span>
                <input
                  value={timezone}
                  onChange={(e) => setTimezone(e.target.value)}
                  placeholder="Africa/Nairobi"
                  className={INPUT_CLASS}
                />
              </label>
              <label className="flex items-center gap-2 pt-7">
                <input
                  type="checkbox"
                  checked={useHttps}
                  onChange={(e) => setUseHttps(e.target.checked)}
                  className="h-4 w-4 rounded border-neutral-300"
                />
                <span className="text-sm text-[var(--dash-text)]">Use HTTPS</span>
              </label>
            </div>
          </div>
        ) : null}

        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--dash-text)]">Notes</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Location, model, or maintenance notes"
            className={`min-h-[64px] ${INPUT_CLASS}`}
          />
        </label>

        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="h-4 w-4 rounded border-neutral-300"
          />
          <span className="text-sm text-[var(--dash-text)]">Device is active (included in polling & health)</span>
        </label>
      </form>
    </DashboardModal>
  );
}
