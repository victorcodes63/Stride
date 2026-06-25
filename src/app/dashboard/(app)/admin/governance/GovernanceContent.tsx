'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Landmark,
  Loader2,
  AlertCircle,
  Plus,
  CalendarDays,
  FileText,
  ListTodo,
} from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

type Tab = 'meetings' | 'resolutions' | 'actions';

type MeetingRow = {
  id: string;
  meetingCode: string;
  title: string;
  meetingDate: string;
  status: string;
  minutesSummary: string | null;
  resolutionCount?: number;
  actionCount?: number;
};

type ResolutionRow = {
  id: string;
  resolutionCode: string;
  title: string;
  status: string;
  effectiveDate: string | null;
  meeting?: { meetingCode: string; title: string } | null;
  actionCount?: number;
};

type ActionRow = {
  id: string;
  title: string;
  status: string;
  dueDate: string | null;
  assignee: { name: string } | null;
  resolution?: { resolutionCode: string; title: string } | null;
};

const MEETING_STATUS: Record<string, string> = {
  scheduled: 'bg-blue-50 text-blue-800',
  completed: 'bg-emerald-50 text-emerald-800',
  cancelled: 'bg-neutral-100 text-neutral-600',
};

const RESOLUTION_STATUS: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700',
  adopted: 'bg-emerald-50 text-emerald-800',
  rejected: 'bg-red-50 text-red-800',
  withdrawn: 'bg-neutral-100 text-neutral-600',
};

const ACTION_STATUS: Record<string, string> = {
  open: 'bg-blue-50 text-blue-800',
  in_progress: 'bg-violet-50 text-violet-800',
  done: 'bg-emerald-50 text-emerald-800',
  cancelled: 'bg-neutral-100 text-neutral-600',
};

export default function GovernanceContent() {
  const [tab, setTab] = useState<Tab>('meetings');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState({ totalMeetings: 0, openActions: 0, adoptedResolutions: 0 });

  const [meetings, setMeetings] = useState<MeetingRow[]>([]);
  const [resolutions, setResolutions] = useState<ResolutionRow[]>([]);
  const [actions, setActions] = useState<ActionRow[]>([]);

  const [showMeetingForm, setShowMeetingForm] = useState(false);
  const [showResolutionForm, setShowResolutionForm] = useState(false);
  const [showActionForm, setShowActionForm] = useState(false);

  const [meetingTitle, setMeetingTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState('');
  const [meetingLocation, setMeetingLocation] = useState('');
  const [meetingMinutes, setMeetingMinutes] = useState('');

  const [resolutionTitle, setResolutionTitle] = useState('');
  const [resolutionMeetingId, setResolutionMeetingId] = useState('');
  const [resolutionDesc, setResolutionDesc] = useState('');

  const [actionTitle, setActionTitle] = useState('');
  const [actionResolutionId, setActionResolutionId] = useState('');
  const [actionDueDate, setActionDueDate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [meetingsRes, resolutionsRes, actionsRes] = await Promise.all([
        fetch('/api/governance/meetings').then(async (r) => {
          const data = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(data.error || 'Failed to load meetings');
          return data;
        }),
        fetch('/api/governance/resolutions').then(async (r) => {
          const data = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(data.error || 'Failed to load resolutions');
          return data;
        }),
        fetch('/api/governance/actions').then(async (r) => {
          const data = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(data.error || 'Failed to load actions');
          return data;
        }),
      ]);
      setMeetings(meetingsRes.meetings ?? []);
      setSummary(meetingsRes.summary ?? { totalMeetings: 0, openActions: 0, adoptedResolutions: 0 });
      setResolutions(resolutionsRes.resolutions ?? []);
      setActions(actionsRes.actions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function createMeeting(e: React.FormEvent) {
    e.preventDefault();
    if (!meetingTitle.trim() || !meetingDate) return;
    setSaving(true);
    try {
      const r = await fetch('/api/governance/meetings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: meetingTitle.trim(),
          meetingDate,
          location: meetingLocation.trim() || undefined,
          minutesSummary: meetingMinutes.trim() || undefined,
          status: meetingMinutes.trim() ? 'completed' : 'scheduled',
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Failed to create');
      setMeetingTitle('');
      setMeetingDate('');
      setMeetingLocation('');
      setMeetingMinutes('');
      setShowMeetingForm(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  }

  async function createResolution(e: React.FormEvent) {
    e.preventDefault();
    if (!resolutionTitle.trim()) return;
    setSaving(true);
    try {
      const r = await fetch('/api/governance/resolutions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: resolutionTitle.trim(),
          meetingId: resolutionMeetingId || undefined,
          description: resolutionDesc.trim() || undefined,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Failed to create');
      setResolutionTitle('');
      setResolutionDesc('');
      setShowResolutionForm(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  }

  async function createAction(e: React.FormEvent) {
    e.preventDefault();
    if (!actionTitle.trim()) return;
    setSaving(true);
    try {
      const r = await fetch('/api/governance/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: actionTitle.trim(),
          resolutionId: actionResolutionId || undefined,
          dueDate: actionDueDate || undefined,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Failed to create');
      setActionTitle('');
      setActionDueDate('');
      setShowActionForm(false);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  }

  async function adoptResolution(id: string) {
    setSaving(true);
    try {
      const r = await fetch(`/api/governance/resolutions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'adopted' }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Update failed');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  async function updateActionStatus(id: string, status: string) {
    setSaving(true);
    try {
      const r = await fetch(`/api/governance/actions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Update failed');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  const openActions = actions.filter((a) => a.status === 'open' || a.status === 'in_progress');

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Board & governance"
        description="Meeting minutes, resolution register, and board action tracking."
        icon={Landmark}
      />

      <div className="mb-4 grid grid-cols-3 gap-3 sm:max-w-lg">
        <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-3">
          <p className="text-[10px] font-semibold uppercase text-[var(--dash-text-muted)]">Meetings</p>
          <p className="text-lg font-bold">{summary.totalMeetings}</p>
        </div>
        <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-3">
          <p className="text-[10px] font-semibold uppercase text-[var(--dash-text-muted)]">Adopted</p>
          <p className="text-lg font-bold text-emerald-700">{summary.adoptedResolutions}</p>
        </div>
        <div className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-3">
          <p className="text-[10px] font-semibold uppercase text-[var(--dash-text-muted)]">Open actions</p>
          <p className="text-lg font-bold">{summary.openActions}</p>
        </div>
      </div>

      {error ? (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : null}

      <div className="mb-4 flex flex-wrap gap-2 border-b border-[var(--dash-border)] pb-2">
        {(
          [
            { key: 'meetings' as const, label: 'Meetings', icon: CalendarDays },
            { key: 'resolutions' as const, label: 'Resolutions', icon: FileText },
            { key: 'actions' as const, label: 'Actions', icon: ListTodo },
          ] as const
        ).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === key
                ? 'bg-[var(--brand-primary)] text-white'
                : 'text-[var(--dash-text-muted)] hover:bg-[var(--dash-hover)]'
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16 text-[var(--dash-text-muted)]">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
          Loading…
        </div>
      ) : tab === 'meetings' ? (
        <div>
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={() => setShowMeetingForm((v) => !v)}
              className="dash-auth-submit flex max-w-none items-center gap-1.5 px-4 py-2 text-sm"
            >
              <Plus className="h-4 w-4" />
              Record meeting
            </button>
          </div>
          {showMeetingForm ? (
            <form onSubmit={createMeeting} className="mb-4 space-y-3 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-4">
              <input value={meetingTitle} onChange={(e) => setMeetingTitle(e.target.value)} placeholder="Meeting title" className="dash-auth-input w-full" required />
              <div className="flex flex-wrap gap-2">
                <input type="date" value={meetingDate} onChange={(e) => setMeetingDate(e.target.value)} className="dash-auth-input" required />
                <input value={meetingLocation} onChange={(e) => setMeetingLocation(e.target.value)} placeholder="Location" className="dash-auth-input min-w-[12rem]" />
              </div>
              <textarea
                value={meetingMinutes}
                onChange={(e) => setMeetingMinutes(e.target.value)}
                placeholder="Minutes summary (optional)"
                rows={3}
                className="dash-auth-input w-full resize-y"
              />
              <button type="submit" disabled={saving} className="dash-auth-submit max-w-[8rem]">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </form>
          ) : null}
          {!meetings.length ? (
            <p className="text-sm text-[var(--dash-text-muted)]">No board meetings recorded yet.</p>
          ) : (
            <ul className="space-y-2">
              {meetings.map((m) => (
                <li key={m.id} className="rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-[var(--dash-text-strong)]">
                        <span className="font-mono text-xs text-[var(--dash-text-muted)]">{m.meetingCode}</span>
                        {' · '}
                        {m.title}
                      </p>
                      <p className="text-xs text-[var(--dash-text-muted)]">
                        {m.meetingDate}
                        {m.resolutionCount != null ? ` · ${m.resolutionCount} resolutions` : ''}
                      </p>
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${MEETING_STATUS[m.status] ?? ''}`}>
                      {m.status}
                    </span>
                  </div>
                  {m.minutesSummary ? (
                    <p className="mt-2 text-sm text-[var(--dash-text-muted)] line-clamp-2">{m.minutesSummary}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : tab === 'resolutions' ? (
        <div>
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={() => setShowResolutionForm((v) => !v)}
              className="dash-auth-submit flex max-w-none items-center gap-1.5 px-4 py-2 text-sm"
            >
              <Plus className="h-4 w-4" />
              Add resolution
            </button>
          </div>
          {showResolutionForm ? (
            <form onSubmit={createResolution} className="mb-4 space-y-3 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-4">
              <input value={resolutionTitle} onChange={(e) => setResolutionTitle(e.target.value)} placeholder="Resolution title" className="dash-auth-input w-full" required />
              <select value={resolutionMeetingId} onChange={(e) => setResolutionMeetingId(e.target.value)} className="dash-auth-input w-full">
                <option value="">Link to meeting (optional)</option>
                {meetings.map((m) => (
                  <option key={m.id} value={m.id}>{m.meetingCode} — {m.title}</option>
                ))}
              </select>
              <textarea value={resolutionDesc} onChange={(e) => setResolutionDesc(e.target.value)} placeholder="Description" rows={2} className="dash-auth-input w-full resize-y" />
              <button type="submit" disabled={saving} className="dash-auth-submit max-w-[8rem]">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </form>
          ) : null}
          {!resolutions.length ? (
            <p className="text-sm text-[var(--dash-text-muted)]">No resolutions in the register.</p>
          ) : (
            <ul className="space-y-2">
              {resolutions.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] px-4 py-3">
                  <div>
                    <p className="font-medium text-[var(--dash-text-strong)]">
                      <span className="font-mono text-xs text-[var(--dash-text-muted)]">{r.resolutionCode}</span>
                      {' · '}
                      {r.title}
                    </p>
                    <p className="text-xs text-[var(--dash-text-muted)]">
                      {r.meeting ? `${r.meeting.meetingCode} — ${r.meeting.title}` : 'Standalone'}
                      {r.actionCount != null ? ` · ${r.actionCount} actions` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${RESOLUTION_STATUS[r.status] ?? ''}`}>
                      {r.status}
                    </span>
                    {r.status === 'draft' ? (
                      <button type="button" disabled={saving} onClick={() => adoptResolution(r.id)} className="text-xs text-[var(--brand-primary)] hover:underline">
                        Adopt
                      </button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div>
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={() => setShowActionForm((v) => !v)}
              disabled={!resolutions.length}
              className="dash-auth-submit flex max-w-none items-center gap-1.5 px-4 py-2 text-sm disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              Add action
            </button>
          </div>
          {showActionForm ? (
            <form onSubmit={createAction} className="mb-4 space-y-3 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-4">
              <input value={actionTitle} onChange={(e) => setActionTitle(e.target.value)} placeholder="Action title" className="dash-auth-input w-full" required />
              <div className="flex flex-wrap gap-2">
                <select value={actionResolutionId} onChange={(e) => setActionResolutionId(e.target.value)} className="dash-auth-input min-w-[14rem]">
                  <option value="">Link to resolution (optional)</option>
                  {resolutions.map((r) => (
                    <option key={r.id} value={r.id}>{r.resolutionCode} — {r.title}</option>
                  ))}
                </select>
                <input type="date" value={actionDueDate} onChange={(e) => setActionDueDate(e.target.value)} className="dash-auth-input" />
              </div>
              <button type="submit" disabled={saving} className="dash-auth-submit max-w-[8rem]">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </form>
          ) : null}
          {!openActions.length ? (
            <p className="text-sm text-[var(--dash-text-muted)]">No open board actions.</p>
          ) : (
            <ul className="space-y-2">
              {openActions.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] px-4 py-3">
                  <div>
                    <p className="font-medium text-[var(--dash-text-strong)]">{a.title}</p>
                    <p className="text-xs text-[var(--dash-text-muted)]">
                      {a.resolution ? `${a.resolution.resolutionCode} — ${a.resolution.title}` : 'Unlinked'}
                      {a.dueDate ? ` · due ${a.dueDate}` : ''}
                      {a.assignee ? ` · ${a.assignee.name}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ACTION_STATUS[a.status] ?? ''}`}>
                      {a.status.replace('_', ' ')}
                    </span>
                    {a.status === 'open' ? (
                      <button type="button" disabled={saving} onClick={() => updateActionStatus(a.id, 'in_progress')} className="text-xs text-[var(--brand-primary)] hover:underline">
                        Start
                      </button>
                    ) : (
                      <button type="button" disabled={saving} onClick={() => updateActionStatus(a.id, 'done')} className="text-xs text-[var(--brand-primary)] hover:underline">
                        Done
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </DashboardPage>
  );
}
