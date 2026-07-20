'use client';

import { useCallback, useEffect, useState } from 'react';
import { Bell, Plus } from 'lucide-react';
import { DashboardAsyncState } from '@/components/dashboard/DashboardAsyncState';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardMetricCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { StrideSelect } from '@/components/ui/stride-select';

type AlarmRule = {
  id: string;
  name: string;
  eventType: string;
  severity: string;
  isActive: boolean;
};

type TripEvent = {
  id: string;
  tripNumber: string;
  eventType: string;
  message: string;
  createdAt: string;
};

const EVENT_TYPES = [
  { value: 'geofence_entry', label: 'Geofence entry' },
  { value: 'geofence_exit', label: 'Geofence exit' },
  { value: 'speeding', label: 'Speeding' },
  { value: 'delay', label: 'Delay' },
  { value: 'idle', label: 'Idle' },
  { value: 'incident', label: 'Incident' },
  { value: 'custom', label: 'Custom' },
] as const;

const SEVERITIES = [
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
] as const;

export default function FleetAlarmsPage() {
  const [rules, setRules] = useState<AlarmRule[]>([]);
  const [events, setEvents] = useState<TripEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/fleet/alarms')
      .then(async (r) => {
        if (!r.ok) throw new Error('Unable to load alarms.');
        const json = (await r.json()) as { rules: AlarmRule[]; recentEvents: TripEvent[] };
        setRules(json.rules);
        setEvents(json.recentEvents);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Fleet & Logistics"
        title="Events & alarms"
        description="Customisable event rules and recent trip events — geofence breaches, speed, delays, and exceptions."
        actions={
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white"
          >
            <Plus className="h-4 w-4" /> Add rule
          </button>
        }
      />
      <DashboardAsyncState status={loading ? 'loading' : error ? 'error' : 'success'} error={error}>
        <>
          <DashboardStatGrid columns={3}>
            <DashboardMetricCard label="Active rules" value={rules.filter((r) => r.isActive).length} icon={Bell} />
            <DashboardMetricCard label="Total rules" value={rules.length} icon={Bell} />
            <DashboardMetricCard label="Recent events" value={events.length} icon={Bell} tone="primary" />
          </DashboardStatGrid>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <DashboardTableCard>
              <div className="border-b border-neutral-200 px-5 py-3">
                <h2 className="text-sm font-semibold">Alarm rules</h2>
              </div>
              <DashboardTableViewport>
                {rules.length === 0 ? (
                  <DashboardTableEmpty title="No alarm rules" description="Create rules for geofence, speed, and delay events.">
                    <button
                      type="button"
                      onClick={() => setCreateOpen(true)}
                      className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-[var(--stride-coral)] px-4 py-2 text-sm font-medium text-white"
                    >
                      <Plus className="h-4 w-4" /> Add rule
                    </button>
                  </DashboardTableEmpty>
                ) : (
                  <DashboardTable>
                    <thead>
                      <tr>
                        <th>Rule</th>
                        <th>Event</th>
                        <th>Severity</th>
                      </tr>
                    </thead>
                    <tbody>
                      {rules.map((r) => (
                        <tr key={r.id}>
                          <td className="col-primary font-medium">{r.name}</td>
                          <td className="font-mono text-xs">{r.eventType}</td>
                          <td className="capitalize">{r.severity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </DashboardTable>
                )}
              </DashboardTableViewport>
            </DashboardTableCard>

            <DashboardTableCard>
              <div className="border-b border-neutral-200 px-5 py-3">
                <h2 className="text-sm font-semibold">Recent trip events</h2>
              </div>
              <DashboardTableViewport>
                {events.length === 0 ? (
                  <DashboardTableEmpty title="No events yet" description="Events appear as trips progress through the workflow." />
                ) : (
                  <DashboardTable>
                    <thead>
                      <tr>
                        <th>Trip</th>
                        <th>Type</th>
                        <th>Message</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((e) => (
                        <tr key={e.id}>
                          <td className="font-medium">{e.tripNumber}</td>
                          <td className="font-mono text-xs">{e.eventType}</td>
                          <td className="col-muted max-w-xs truncate text-sm">{e.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </DashboardTable>
                )}
              </DashboardTableViewport>
            </DashboardTableCard>
          </div>
        </>
      </DashboardAsyncState>

      {createOpen ? (
        <CreateAlarmRuleModal
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            load();
          }}
        />
      ) : null}
    </DashboardPage>
  );
}

function CreateAlarmRuleModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState('');
  const [eventType, setEventType] = useState('geofence_entry');
  const [customEventType, setCustomEventType] = useState('');
  const [severity, setSeverity] = useState('warning');
  const [notifyEmail, setNotifyEmail] = useState('');
  const [notifySms, setNotifySms] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setErr(null);
    const resolvedEventType = eventType === 'custom' ? customEventType.trim() : eventType;
    if (!resolvedEventType) {
      setErr('Event type is required.');
      setSaving(false);
      return;
    }
    try {
      const r = await fetch('/api/fleet/alarms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          eventType: resolvedEventType,
          severity,
          notifyEmail: notifyEmail || undefined,
          notifySms: notifySms || undefined,
        }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || 'Create failed');
      onCreated();
    } catch (error) {
      setErr(error instanceof Error ? error.message : 'Create failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <form
        onSubmit={submit}
        className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-[var(--dash-border)] bg-[var(--dash-surface-solid)] p-5 shadow-xl"
      >
        <h2 className="flex items-center gap-2 text-lg font-semibold text-[var(--dash-text-strong)]">
          <Bell className="h-5 w-5 text-[var(--stride-coral)]" />
          New alarm rule
        </h2>
        <label className="mt-4 block text-xs text-[var(--dash-text-muted)]">
          Name
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Depot exit alert"
            className="dash-auth-input mt-1 w-full"
          />
        </label>
        <label className="mt-3 block text-xs text-[var(--dash-text-muted)]">
          Event type
          <StrideSelect
            value={eventType}
            onChange={(value) => setEventType(value)}
            options={EVENT_TYPES.map((t) => ({ value: t.value, label: t.label }))}
            ariaLabel="Event type"
            className="mt-1 w-full"
          />
        </label>
        {eventType === 'custom' ? (
          <label className="mt-3 block text-xs text-[var(--dash-text-muted)]">
            Custom event key
            <input
              required
              value={customEventType}
              onChange={(e) => setCustomEventType(e.target.value)}
              placeholder="e.g. fuel_theft"
              className="dash-auth-input mt-1 w-full"
            />
          </label>
        ) : null}
        <label className="mt-3 block text-xs text-[var(--dash-text-muted)]">
          Severity
          <StrideSelect
            value={severity}
            onChange={(value) => setSeverity(value)}
            options={SEVERITIES.map((s) => ({ value: s.value, label: s.label }))}
            ariaLabel="Severity"
            className="mt-1 w-full"
          />
        </label>
        <label className="mt-3 block text-xs text-[var(--dash-text-muted)]">
          Notify email
          <input
            type="email"
            value={notifyEmail}
            onChange={(e) => setNotifyEmail(e.target.value)}
            placeholder="ops@example.com"
            className="dash-auth-input mt-1 w-full"
          />
        </label>
        <label className="mt-3 block text-xs text-[var(--dash-text-muted)]">
          Notify SMS
          <input
            value={notifySms}
            onChange={(e) => setNotifySms(e.target.value)}
            placeholder="+2547…"
            className="dash-auth-input mt-1 w-full"
          />
        </label>
        {err ? <p className="mt-3 text-xs text-red-600">{err}</p> : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-3 py-2 text-sm">
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-[var(--stride-coral)] px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  );
}
