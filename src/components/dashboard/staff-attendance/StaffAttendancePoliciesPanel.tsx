'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, ShieldCheck, Star, Trash2, UserPlus } from 'lucide-react';
import { toast } from '@/components/ui/toast';
import { StrideSelect } from '@/components/ui/stride-select';
import { dashStatusChip } from '@/lib/dashboard-status-chips';
import { DashboardInlineLoading } from '@/components/dashboard/DashboardAsyncState';
import type { AttendancePolicy, PolicyAssignment, Subject } from './types';

const MODE_OPTIONS = [
  { value: 'hybrid_override', label: 'Hybrid (biometric + manual override)' },
  { value: 'biometric_primary', label: 'Biometric primary' },
  { value: 'manual_primary', label: 'Manual primary' },
];

export function StaffAttendancePoliciesPanel({
  subjects,
  canManage,
}: {
  subjects: Subject[];
  canManage: boolean;
}) {
  const [policies, setPolicies] = useState<AttendancePolicy[]>([]);
  const [assignments, setAssignments] = useState<PolicyAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [assignUserId, setAssignUserId] = useState('');
  const [assignPolicyId, setAssignPolicyId] = useState('');
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/staff/attendance/policies', { cache: 'no-store' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load policies');
      setPolicies(data.policies ?? []);
      setAssignments(data.assignments ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load policies');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function createPolicy() {
    setBusy(true);
    try {
      const res = await fetch('/api/staff/attendance/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Policy ${policies.length + 1}`,
          mode: 'hybrid_override',
          graceInMinutes: 10,
          graceOutMinutes: 10,
          isDefault: policies.length === 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Policy created');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to create policy');
    } finally {
      setBusy(false);
    }
  }

  async function updatePolicy(id: string, patch: Partial<AttendancePolicy>) {
    const res = await fetch(`/api/staff/attendance/policies/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    if (res.ok) {
      await load();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || 'Update failed');
    }
  }

  async function deletePolicy(id: string) {
    if (!window.confirm('Delete this policy and its assignments?')) return;
    const res = await fetch(`/api/staff/attendance/policies/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Policy deleted');
      await load();
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || 'Delete failed');
    }
  }

  async function assign() {
    if (!assignUserId || !assignPolicyId) {
      toast.error('Select a staff member and a policy.');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/staff/attendance/policies/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: assignUserId,
          staffAttendancePolicyId: assignPolicyId,
          effectiveFrom,
          isPrimary: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      toast.success('Policy assigned');
      setAssignUserId('');
      setAssignPolicyId('');
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to assign policy');
    } finally {
      setBusy(false);
    }
  }

  async function unassign(id: string) {
    const res = await fetch(`/api/staff/attendance/policies/assignments?id=${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      toast.success('Assignment removed');
      await load();
    } else {
      toast.error('Failed to remove assignment');
    }
  }

  if (loading) return <DashboardInlineLoading label="Loading policies…" />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-[var(--dash-text-muted)]" aria-hidden />
          <h2 className="text-sm font-semibold text-[var(--dash-text-strong)]">Attendance policies</h2>
        </div>
        {canManage ? (
          <button
            type="button"
            onClick={createPolicy}
            disabled={busy}
            className="btn-primary inline-flex items-center gap-2 text-sm disabled:opacity-60"
          >
            <Plus className="h-4 w-4" />
            New policy
          </button>
        ) : null}
      </div>

      {policies.length === 0 ? (
        <p className="dashboard-surface p-6 text-center text-sm text-[var(--dash-text-muted)]">
          No policies yet. {canManage ? 'Create one to define grace periods, workday length, and geofencing.' : ''}
        </p>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {policies.map((p) => (
            <div key={p.id} className="dashboard-surface p-4 shadow-sm">
              <div className="mb-3 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <input
                    defaultValue={p.name}
                    disabled={!canManage}
                    onBlur={(e) => e.target.value !== p.name && updatePolicy(p.id, { name: e.target.value })}
                    className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-sm font-semibold text-[var(--dash-text-strong)] hover:border-[var(--dash-border)] focus:border-[var(--dash-border)] focus:outline-none"
                  />
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {p.isDefault ? <span className={dashStatusChip('primary')}>Default</span> : null}
                    <span className={p.isActive ? dashStatusChip('success') : dashStatusChip('neutral')}>
                      {p.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <span className="text-xs text-[var(--dash-text-muted)]">{p.assignedCount} assigned</span>
                  </div>
                </div>
                {canManage ? (
                  <div className="flex shrink-0 items-center gap-1">
                    {!p.isDefault ? (
                      <button
                        type="button"
                        onClick={() => updatePolicy(p.id, { isDefault: true })}
                        className="rounded-md p-1.5 text-amber-600 hover:bg-amber-50"
                        title="Set as default"
                      >
                        <Star className="h-4 w-4" />
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => deletePolicy(p.id)}
                      className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}
              </div>

              <div className="mb-3">
                <label className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[var(--dash-text-muted)]">
                  Mode
                </label>
                <StrideSelect
                  value={p.mode}
                  onChange={(value) => updatePolicy(p.id, { mode: value as AttendancePolicy['mode'] })}
                  options={MODE_OPTIONS}
                  ariaLabel="Policy mode"
                  size="sm"
                  disabled={!canManage}
                />
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <NumField label="Grace in (min)" value={p.graceInMinutes} disabled={!canManage} onSave={(v) => updatePolicy(p.id, { graceInMinutes: v })} />
                <NumField label="Grace out (min)" value={p.graceOutMinutes} disabled={!canManage} onSave={(v) => updatePolicy(p.id, { graceOutMinutes: v })} />
                <NumField label="Half-day (min)" value={p.minHalfDayMinutes} disabled={!canManage} onSave={(v) => updatePolicy(p.id, { minHalfDayMinutes: v })} />
                <NumField label="Full-day (min)" value={p.fullDayMinutes} disabled={!canManage} onSave={(v) => updatePolicy(p.id, { fullDayMinutes: v })} />
              </div>

              <div className="mt-3 flex flex-wrap gap-4 text-xs">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={p.requireManualApproval}
                    disabled={!canManage}
                    onChange={(e) => updatePolicy(p.id, { requireManualApproval: e.target.checked })}
                  />
                  Require manual approval
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={p.mobileGeofenceEnabled}
                    disabled={!canManage}
                    onChange={(e) => updatePolicy(p.id, { mobileGeofenceEnabled: e.target.checked })}
                  />
                  Geofence
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={p.rejectOutsideGeofence}
                    disabled={!canManage}
                    onChange={(e) => updatePolicy(p.id, { rejectOutsideGeofence: e.target.checked })}
                  />
                  Reject outside fence
                </label>
                {p.isActive ? (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={p.isActive}
                      disabled={!canManage}
                      onChange={(e) => updatePolicy(p.id, { isActive: e.target.checked })}
                    />
                    Active
                  </label>
                ) : (
                  <button
                    type="button"
                    disabled={!canManage}
                    onClick={() => updatePolicy(p.id, { isActive: true })}
                    className="text-primary-700 hover:underline"
                  >
                    Reactivate
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="dashboard-surface p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <UserPlus className="h-4 w-4 text-[var(--dash-text-muted)]" aria-hidden />
          <h3 className="text-sm font-semibold text-[var(--dash-text-strong)]">Policy assignments</h3>
        </div>

        {canManage ? (
          <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <StrideSelect
              value={assignUserId}
              onChange={setAssignUserId}
              options={[
                { value: '', label: 'Select staff…' },
                ...subjects.map((s) => ({ value: s.id, label: `${s.name}${s.department ? ` · ${s.department}` : ''}` })),
              ]}
              ariaLabel="Staff member"
              size="sm"
            />
            <StrideSelect
              value={assignPolicyId}
              onChange={setAssignPolicyId}
              options={[
                { value: '', label: 'Select policy…' },
                ...policies.map((p) => ({ value: p.id, label: p.name })),
              ]}
              ariaLabel="Policy"
              size="sm"
            />
            <input
              type="date"
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              className="dash-filter-select h-9 rounded-lg border px-3 text-sm"
              aria-label="Effective from"
            />
            <button
              type="button"
              onClick={assign}
              disabled={busy}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-lg bg-primary-900 px-3 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-60"
            >
              <UserPlus className="h-4 w-4" />
              Assign (primary)
            </button>
          </div>
        ) : null}

        {assignments.length === 0 ? (
          <p className="text-xs text-[var(--dash-text-muted)]">No policy assignments yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="data-table dashboard-data-table w-full text-sm">
              <thead>
                <tr>
                  <th className="px-3 py-2">Staff</th>
                  <th className="px-3 py-2">Policy</th>
                  <th className="px-3 py-2">Effective from</th>
                  <th className="px-3 py-2 col-center">Primary</th>
                  {canManage ? <th className="px-3 py-2 col-center">Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id}>
                    <td className="px-3 py-2">
                      <div className="font-medium text-[var(--dash-text-strong)]">{a.user?.name ?? 'Unknown'}</div>
                      <div className="text-xs text-[var(--dash-text-muted)]">{a.user?.department ?? ''}</div>
                    </td>
                    <td className="px-3 py-2">{a.policyName ?? '—'}</td>
                    <td className="px-3 py-2 tabular-nums">{a.effectiveFrom}</td>
                    <td className="px-3 py-2 col-center">
                      {a.isPrimary ? <span className={dashStatusChip('primary')}>Primary</span> : '—'}
                    </td>
                    {canManage ? (
                      <td className="px-3 py-2 col-center">
                        <button
                          type="button"
                          onClick={() => unassign(a.id)}
                          className="rounded-md p-1.5 text-red-600 hover:bg-red-50"
                          title="Remove assignment"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    ) : null}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function NumField({
  label,
  value,
  disabled,
  onSave,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onSave: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-[var(--dash-text-muted)]">
        {label}
      </span>
      <input
        type="number"
        defaultValue={value}
        disabled={disabled}
        onBlur={(e) => {
          const next = parseInt(e.target.value, 10);
          if (!Number.isNaN(next) && next !== value) onSave(next);
        }}
        className="dash-filter-select h-9 w-full rounded-lg border px-3 text-sm"
      />
    </label>
  );
}
