'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, UserCheck } from 'lucide-react';
import { DashboardModal } from '@/components/dashboard/DashboardModal';
import { StrideSelect } from '@/components/ui/stride-select';
import { toast } from '@/components/ui/toast';
import type { StaffOption } from './types';

type Props = {
  deviceId: string;
  deviceName: string;
  rawSubjectId: string;
  currentUserId?: string | null;
  onClose: () => void;
  onSaved: () => void;
};

export function SubjectMapModal({
  deviceId,
  deviceName,
  rawSubjectId,
  currentUserId,
  onClose,
  onSaved,
}: Props) {
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [userId, setUserId] = useState(currentUserId ?? '');
  const [loadingStaff, setLoadingStaff] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/staff/biometric/staff', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!cancelled) setStaff(Array.isArray(data.staff) ? data.staff : []);
      } catch {
        if (!cancelled) setStaff([]);
      } finally {
        if (!cancelled) setLoadingStaff(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const options = useMemo(
    () => [
      { value: '', label: 'Select a staff member…' },
      ...staff.map((s) => ({
        value: s.id,
        label: s.department ? `${s.name} · ${s.department}` : s.name,
      })),
    ],
    [staff],
  );

  async function submit(unmap: boolean) {
    if (!unmap && !userId) {
      setError('Choose a staff member to map this subject to.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/staff/biometric/devices/${deviceId}/subject-map`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rawSubjectId, userId: unmap ? null : userId }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Failed to save mapping.');
      if (unmap) {
        toast.success('Mapping removed.');
      } else {
        toast.success(
          data.backfilled > 0
            ? `Mapped subject and backfilled ${data.backfilled} punch(es).`
            : 'Subject mapped.',
        );
      }
      onSaved();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save mapping.';
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
      title="Map subject to staff"
      description={
        <>
          Assign device subject <span className="font-mono font-semibold">{rawSubjectId}</span> on{' '}
          <span className="font-medium">{deviceName}</span> to an internal staff member.
        </>
      }
      icon={<UserCheck className="h-5 w-5" />}
      size="md"
      dismissible={!saving}
      footer={
        <>
          {currentUserId ? (
            <button
              type="button"
              onClick={() => void submit(true)}
              disabled={saving}
              className="btn-secondary mr-auto px-4 py-2 text-sm text-red-600 disabled:opacity-50"
            >
              Remove mapping
            </button>
          ) : null}
          <button type="button" onClick={onClose} disabled={saving} className="btn-secondary px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void submit(false)}
            disabled={saving || loadingStaff || !userId}
            className="btn-primary inline-flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Map & backfill
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-100">
            {error}
          </div>
        ) : null}
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-[var(--dash-text)]">Staff member</span>
          <StrideSelect
            value={userId}
            onChange={setUserId}
            options={options}
            disabled={loadingStaff}
            placeholder={loadingStaff ? 'Loading staff…' : 'Select a staff member…'}
            ariaLabel="Staff member"
            className="w-full"
          />
        </label>
        <p className="text-xs text-[var(--dash-text-muted)]">
          Existing unmatched punches for this subject will be linked to the selected staff member,
          attendance events created, and their day summaries reconciled.
        </p>
      </div>
    </DashboardModal>
  );
}
