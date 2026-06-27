'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, Plus, Shield, ListTodo } from 'lucide-react';
import { EntityContextBanner } from '@/components/EntityContextBanner';
import { DashboardAsyncState } from '@/components/dashboard/DashboardAsyncState';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableToolbar,
  DashboardTableViewport,
  dashboardTableSelectClass,
} from '@/components/dashboard/DashboardDataTable';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardStatCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';
import { toast } from '@/components/ui/toast';

type Tab = 'incidents' | 'actions';

type IncidentRow = {
  id: string;
  incidentNumber: string;
  title: string;
  description: string;
  incidentTypeLabel: string;
  severity: string;
  severityLabel: string;
  status: string;
  statusLabel: string;
  siteName: string | null;
  location: string | null;
  occurredAt: string;
  reportedBy: string | null;
  openActionCount: number;
};

type ActionRow = {
  id: string;
  title: string;
  status: string;
  statusLabel: string;
  dueDate: string | null;
  incident: { incidentNumber: string; title: string };
  assignee: { name: string } | null;
};

const SEVERITY_BADGE: Record<string, string> = {
  critical: 'bg-red-100 text-red-800',
  high: 'bg-orange-100 text-orange-800',
  medium: 'bg-primary-100 text-primary-800',
  low: 'bg-neutral-100 text-neutral-600',
};

const STATUS_BADGE: Record<string, string> = {
  open: 'bg-red-100 text-red-800',
  investigating: 'bg-primary-100 text-primary-800',
  resolved: 'bg-green-100 text-green-800',
  closed: 'bg-neutral-100 text-neutral-600',
  in_progress: 'bg-violet-50 text-violet-800',
  completed: 'bg-emerald-50 text-emerald-800',
  cancelled: 'bg-neutral-100 text-neutral-600',
};

const INCIDENT_TYPES = [
  { value: 'hazard', label: 'Hazard' },
  { value: 'near_miss', label: 'Near miss' },
  { value: 'injury', label: 'Personal injury' },
  { value: 'fire', label: 'Fire / explosion risk' },
  { value: 'equipment_failure', label: 'Equipment failure' },
  { value: 'environmental', label: 'Environmental' },
  { value: 'other', label: 'Other' },
];

export default function HseIncidentsContent() {
  const [tab, setTab] = useState<Tab>('incidents');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [siteFilter, setSiteFilter] = useState('');

  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [actions, setActions] = useState<ActionRow[]>([]);
  const [summary, setSummary] = useState({
    openCount: 0,
    followUpCount: 0,
    resolvedThisMonth: 0,
    nearMissCount: 0,
    daysSinceLast: null as number | null,
  });

  const [showLogForm, setShowLogForm] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{
    incident: IncidentRow & {
      immediateAction: string | null;
      injuredParty: string | null;
      actions: { id: string; title: string; status: string; dueDate: string | null }[];
    };
  } | null>(null);

  const [logTitle, setLogTitle] = useState('');
  const [logDescription, setLogDescription] = useState('');
  const [logType, setLogType] = useState('other');
  const [logSeverity, setLogSeverity] = useState('medium');
  const [logSite, setLogSite] = useState('');
  const [logOccurredAt, setLogOccurredAt] = useState('');
  const [logImmediateAction, setLogImmediateAction] = useState('');
  const [logInjuredParty, setLogInjuredParty] = useState('');

  const [actionTitle, setActionTitle] = useState('');
  const [actionDueDate, setActionDueDate] = useState('');

  const siteOptions = useMemo(() => {
    const sites = new Set<string>();
    for (const i of incidents) {
      const label = i.siteName || i.location;
      if (label) sites.add(label);
    }
    return [...sites].sort();
  }, [incidents]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (siteFilter) params.set('siteName', siteFilter);

      const [incidentsRes, actionsRes] = await Promise.all([
        fetch(`/api/hse/incidents?${params}`).then(async (r) => {
          const data = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(data.error || 'Failed to load incidents');
          return data;
        }),
        fetch('/api/hse/actions').then(async (r) => {
          const data = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(data.error || 'Failed to load actions');
          return data;
        }),
      ]);

      setIncidents(incidentsRes.incidents ?? []);
      setSummary(
        incidentsRes.summary ?? {
          openCount: 0,
          followUpCount: 0,
          resolvedThisMonth: 0,
          nearMissCount: 0,
          daysSinceLast: null,
        },
      );
      setActions(actionsRes.actions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, siteFilter]);

  useEffect(() => {
    load();
  }, [load]);

  async function loadDetail(id: string) {
    setDetailId(id);
    try {
      const r = await fetch(`/api/hse/incidents/${id}`);
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Failed to load incident');
      setDetail(data);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to load incident');
      setDetailId(null);
    }
  }

  async function createIncident(e: React.FormEvent) {
    e.preventDefault();
    if (!logTitle.trim() || !logDescription.trim()) return;
    setSaving(true);
    try {
      const r = await fetch('/api/hse/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: logTitle.trim(),
          description: logDescription.trim(),
          incidentType: logType,
          severity: logSeverity,
          siteName: logSite.trim() || undefined,
          occurredAt: logOccurredAt || new Date().toISOString(),
          immediateAction: logImmediateAction.trim() || undefined,
          injuredParty: logInjuredParty.trim() || undefined,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Failed to log incident');
      setShowLogForm(false);
      setLogTitle('');
      setLogDescription('');
      setLogImmediateAction('');
      setLogInjuredParty('');
      toast.success(`Incident ${data.incident?.incidentNumber ?? ''} logged.`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to log incident');
    } finally {
      setSaving(false);
    }
  }

  async function updateIncidentStatus(status: string) {
    if (!detailId) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/hse/incidents/${detailId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Failed to update');
      await loadDetail(detailId);
      await load();
      toast.success('Incident updated.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to update');
    } finally {
      setSaving(false);
    }
  }

  async function createAction(e: React.FormEvent) {
    e.preventDefault();
    if (!detailId || !actionTitle.trim()) return;
    setSaving(true);
    try {
      const r = await fetch('/api/hse/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          incidentId: detailId,
          title: actionTitle.trim(),
          dueDate: actionDueDate || undefined,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Failed to add action');
      setActionTitle('');
      setActionDueDate('');
      await loadDetail(detailId);
      await load();
      toast.success('Follow-up action added.');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to add action');
    } finally {
      setSaving(false);
    }
  }

  const listStatus = loading ? 'loading' : error ? 'error' : incidents.length ? 'success' : 'empty';

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="HSE & Incident Management"
        description="Log, investigate, and resolve safety incidents across sites."
        actions={
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-2"
            onClick={() => setShowLogForm(true)}
          >
            Log incident
          </button>
        }
      />

      <EntityContextBanner />

      {summary.followUpCount > 0 ? (
        <div className="rounded-lg border border-primary-200/70 bg-primary-50 px-4 py-3 text-sm text-primary-900 shadow-sm">
          <span className="font-medium">
            {summary.followUpCount} incident{summary.followUpCount === 1 ? '' : 's'} require follow-up
          </span>
        </div>
      ) : null}

      <DashboardStatGrid>
        <DashboardStatCard label="Open incidents" value={summary.openCount} tone="warning" warn={summary.openCount > 0} />
        <DashboardStatCard label="Resolved this month" value={summary.resolvedThisMonth} tone="success" />
        <DashboardStatCard label="Near misses logged" value={summary.nearMissCount} tone="violet" />
        <DashboardStatCard
          label="Days since last incident"
          value={summary.daysSinceLast ?? '—'}
          tone="primary"
        />
      </DashboardStatGrid>

      <div className="flex flex-wrap gap-2 border-b border-neutral-200 pb-2">
        <button
          type="button"
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === 'incidents' ? 'bg-primary-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}
          onClick={() => setTab('incidents')}
        >
          Incidents
        </button>
        <button
          type="button"
          className={`rounded-md px-3 py-1.5 text-sm font-medium ${tab === 'actions' ? 'bg-primary-900 text-white' : 'text-neutral-600 hover:bg-neutral-100'}`}
          onClick={() => setTab('actions')}
        >
          Follow-up actions
        </button>
      </div>

      {error ? (
        <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      {tab === 'incidents' ? (
        <DashboardTableCard>
          <DashboardTableToolbar label={null}>
            <div className="flex flex-wrap gap-3">
              <div>
                <label htmlFor="hse-status-filter" className="mr-2 text-sm text-neutral-600">
                  Status
                </label>
                <select
                  id="hse-status-filter"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className={dashboardTableSelectClass}
                >
                  <option value="">All</option>
                  <option value="open">Open</option>
                  <option value="investigating">Investigating</option>
                  <option value="resolved">Resolved</option>
                  <option value="closed">Closed</option>
                </select>
              </div>
              <div>
                <label htmlFor="hse-site-filter" className="mr-2 text-sm text-neutral-600">
                  Site
                </label>
                <select
                  id="hse-site-filter"
                  value={siteFilter}
                  onChange={(e) => setSiteFilter(e.target.value)}
                  className={dashboardTableSelectClass}
                >
                  <option value="">All sites</option>
                  {siteOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </DashboardTableToolbar>

          <DashboardAsyncState
            status={listStatus}
            empty={
              <DashboardTableEmpty
                icon={<Shield className="h-8 w-8 text-neutral-300" aria-hidden />}
                title="No incidents found"
                description="Log an incident when a hazard or event occurs on site."
              />
            }
          >
            <DashboardTableViewport minWidth={1000}>
              <DashboardTable>
                <thead>
                  <tr>
                    <th>Ref #</th>
                    <th className="col-center">Date</th>
                    <th>Site</th>
                    <th>Type</th>
                    <th className="col-center">Severity</th>
                    <th>Reported by</th>
                    <th className="col-center">Status</th>
                    <th className="col-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.map((row) => (
                    <tr key={row.id}>
                      <td className="font-medium text-neutral-900">{row.incidentNumber}</td>
                      <td className="col-center tabular-nums">
                        {new Date(row.occurredAt).toLocaleString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td>{row.siteName || row.location || '—'}</td>
                      <td>{row.incidentTypeLabel}</td>
                      <td className="col-center">
                        <span className={`badge-status ${SEVERITY_BADGE[row.severity] ?? SEVERITY_BADGE.medium}`}>
                          {row.severityLabel}
                        </span>
                      </td>
                      <td>{row.reportedBy ?? '—'}</td>
                      <td className="col-center">
                        <span className={`badge-status ${STATUS_BADGE[row.status] ?? ''}`}>{row.statusLabel}</span>
                      </td>
                      <td className="col-right">
                        <button
                          type="button"
                          className="btn-secondary px-3 py-1.5 text-xs"
                          onClick={() => loadDetail(row.id)}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DashboardTable>
            </DashboardTableViewport>
          </DashboardAsyncState>
        </DashboardTableCard>
      ) : (
        <DashboardTableCard>
          <DashboardAsyncState
            status={loading ? 'loading' : actions.length ? 'success' : 'empty'}
            empty={
              <DashboardTableEmpty
                icon={<ListTodo className="h-8 w-8 text-neutral-300" aria-hidden />}
                title="No follow-up actions"
                description="Actions created during incident investigations appear here."
              />
            }
          >
            <DashboardTableViewport minWidth={800}>
              <DashboardTable>
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Incident</th>
                    <th>Assignee</th>
                    <th className="col-center">Due</th>
                    <th className="col-center">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {actions.map((row) => (
                    <tr key={row.id}>
                      <td className="font-medium">{row.title}</td>
                      <td>{row.incident.incidentNumber}</td>
                      <td>{row.assignee?.name ?? '—'}</td>
                      <td className="col-center tabular-nums">{row.dueDate ?? '—'}</td>
                      <td className="col-center">
                        <span className={`badge-status ${STATUS_BADGE[row.status] ?? ''}`}>{row.statusLabel}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DashboardTable>
            </DashboardTableViewport>
          </DashboardAsyncState>
        </DashboardTableCard>
      )}

      {showLogForm ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setShowLogForm(false)}
        >
          <div
            className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-primary-900">Log incident</h3>
            <form className="mt-4 space-y-3" onSubmit={createIncident}>
              <input
                required
                placeholder="Short title"
                value={logTitle}
                onChange={(e) => setLogTitle(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <select
                  value={logType}
                  onChange={(e) => setLogType(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                >
                  {INCIDENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <select
                  value={logSeverity}
                  onChange={(e) => setLogSeverity(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <input
                type="datetime-local"
                value={logOccurredAt}
                onChange={(e) => setLogOccurredAt(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Site name (optional)"
                value={logSite}
                onChange={(e) => setLogSite(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
              <textarea
                required
                rows={4}
                placeholder="Description"
                value={logDescription}
                onChange={(e) => setLogDescription(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
              <textarea
                rows={2}
                placeholder="Immediate action taken (optional)"
                value={logImmediateAction}
                onChange={(e) => setLogImmediateAction(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
              <input
                placeholder="Injured party (optional)"
                value={logInjuredParty}
                onChange={(e) => setLogInjuredParty(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
              />
              <div className="flex gap-2 pt-2">
                <button type="button" className="btn-secondary" onClick={() => setShowLogForm(false)}>
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-md bg-primary-900 px-4 py-2 text-sm font-medium text-white"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Submit
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {detailId && detail?.incident ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setDetailId(null);
            setDetail(null);
          }}
        >
          <div
            className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold text-primary-900">{detail.incident.incidentNumber}</h3>
            <p className="mt-1 text-sm text-neutral-600">{detail.incident.title}</p>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between gap-4 border-b py-2">
                <dt className="text-neutral-500">Status</dt>
                <dd>
                  <span className={`badge-status ${STATUS_BADGE[detail.incident.status] ?? ''}`}>
                    {detail.incident.statusLabel}
                  </span>
                </dd>
              </div>
              <div className="py-2">
                <dt className="text-neutral-500">Description</dt>
                <dd className="mt-1 text-neutral-800">{detail.incident.description}</dd>
              </div>
            </dl>

            <div className="mt-4 flex flex-wrap gap-2">
              {detail.incident.status === 'open' ? (
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  disabled={saving}
                  onClick={() => updateIncidentStatus('investigating')}
                >
                  Start investigation
                </button>
              ) : null}
              {detail.incident.status === 'investigating' ? (
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  disabled={saving}
                  onClick={() => updateIncidentStatus('resolved')}
                >
                  Mark resolved
                </button>
              ) : null}
              {detail.incident.status === 'resolved' ? (
                <button
                  type="button"
                  className="btn-secondary text-xs"
                  disabled={saving}
                  onClick={() => updateIncidentStatus('closed')}
                >
                  Close incident
                </button>
              ) : null}
            </div>

            <div className="mt-6 border-t pt-4">
              <h4 className="text-sm font-semibold text-neutral-900">Follow-up actions</h4>
              {detail.incident.actions.length ? (
                <ul className="mt-2 space-y-2 text-sm">
                  {detail.incident.actions.map((a) => (
                    <li key={a.id} className="flex items-center justify-between rounded-md bg-neutral-50 px-3 py-2">
                      <span>{a.title}</span>
                      <span className={`badge-status text-xs ${STATUS_BADGE[a.status] ?? ''}`}>{a.status}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-sm text-neutral-500">No actions yet.</p>
              )}

              {detail.incident.status !== 'closed' ? (
                <form className="mt-4 flex flex-col gap-2 sm:flex-row" onSubmit={createAction}>
                  <input
                    required
                    placeholder="New action title"
                    value={actionTitle}
                    onChange={(e) => setActionTitle(e.target.value)}
                    className="flex-1 rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  />
                  <input
                    type="date"
                    value={actionDueDate}
                    onChange={(e) => setActionDueDate(e.target.value)}
                    className="rounded-lg border border-neutral-300 px-3 py-2 text-sm"
                  />
                  <button type="submit" disabled={saving} className="btn-secondary whitespace-nowrap text-xs">
                    Add action
                  </button>
                </form>
              ) : null}
            </div>

            <button
              type="button"
              className="btn-secondary mt-6"
              onClick={() => {
                setDetailId(null);
                setDetail(null);
              }}
            >
              Close
            </button>
          </div>
        </div>
      ) : null}
    </DashboardPage>
  );
}
