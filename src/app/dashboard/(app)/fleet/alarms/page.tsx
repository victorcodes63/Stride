'use client';

import { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
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

export default function FleetAlarmsPage() {
  const [rules, setRules] = useState<AlarmRule[]>([]);
  const [events, setEvents] = useState<TripEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
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

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Fleet & Logistics"
        title="Events & alarms"
        description="Customisable event rules and recent trip events — geofence breaches, speed, delays, and exceptions."
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
                  <DashboardTableEmpty title="No alarm rules" description="Create rules via POST /api/fleet/alarms." />
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
    </DashboardPage>
  );
}
