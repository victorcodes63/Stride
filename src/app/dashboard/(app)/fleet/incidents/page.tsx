'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardAsyncState } from '@/components/dashboard/DashboardAsyncState';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import {
  FLEET_INCIDENT_TYPES,
  FLEET_INCIDENT_TYPE_LABELS,
  fleetIncidentSeverityBadgeClass,
  fleetIncidentStatusBadgeClass,
} from '@/lib/fleet-incident';

type IncidentRow = {
  id: string;
  tripId: string;
  tripNumber: string;
  route: string;
  incidentTypeLabel: string;
  severity: string;
  severityLabel: string;
  status: string;
  statusLabel: string;
  title: string;
  description: string;
  reportedAt: string;
};

export default function FleetIncidentsPage() {
  const [rows, setRows] = useState<IncidentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/fleet/incidents');
      if (!res.ok) throw new Error('Unable to load incidents.');
      setRows((await res.json()) as IncidentRow[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to load incidents.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function updateStatus(id: string, status: string) {
    setSavingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/fleet/incidents/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error('Unable to update incident.');
      const updated = (await res.json()) as IncidentRow;
      setRows((prev) => prev.map((r) => (r.id === id ? updated : r)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to update incident.');
    } finally {
      setSavingId(null);
    }
  }

  const listStatus = loading ? 'loading' : error ? 'error' : 'success';

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Fleet & Logistics"
        title="Incidents"
        description="Breakdowns, accidents, delays, and disputes — escalation and resolution tracking."
      />

      <DashboardAsyncState status={listStatus} error={error} onRetry={() => void load()}>
        <DashboardTableCard>
          <DashboardTableViewport>
            {rows.length === 0 ? (
              <DashboardTableEmpty
                title="No incidents logged"
                description="Incidents are raised from trip exceptions or logged manually from trip detail."
              />
            ) : (
              <DashboardTable>
                <thead>
                  <tr>
                    <th>Incident</th>
                    <th>Trip</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th className="col-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td className="col-primary">
                        <p className="font-medium">{row.title}</p>
                        <p className="mt-0.5 text-xs text-neutral-500">{row.incidentTypeLabel}</p>
                      </td>
                      <td>
                        <Link
                          href={`/dashboard/fleet/trips/${row.tripId}`}
                          className="text-sm font-medium text-primary-600 hover:underline"
                        >
                          {row.tripNumber}
                        </Link>
                        <span className="mt-0.5 block text-xs text-neutral-500">{row.route}</span>
                      </td>
                      <td>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${fleetIncidentSeverityBadgeClass(row.severity as never)}`}
                        >
                          {row.severityLabel}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${fleetIncidentStatusBadgeClass(row.status as never)}`}
                        >
                          {row.statusLabel}
                        </span>
                      </td>
                      <td className="col-right">
                        {row.status === 'open' ? (
                          <button
                            type="button"
                            disabled={savingId === row.id}
                            onClick={() => void updateStatus(row.id, 'investigating')}
                            className="text-xs font-medium text-primary-600 hover:text-primary-700"
                          >
                            Investigate
                          </button>
                        ) : null}
                        {row.status === 'investigating' ? (
                          <button
                            type="button"
                            disabled={savingId === row.id}
                            onClick={() => void updateStatus(row.id, 'resolved')}
                            className="text-xs font-medium text-primary-600 hover:text-primary-700"
                          >
                            Resolve
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DashboardTable>
            )}
          </DashboardTableViewport>
        </DashboardTableCard>

        <section className="mt-6 rounded-xl border border-dashed border-neutral-200 bg-neutral-50/80 p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
            Incident types
          </p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {FLEET_INCIDENT_TYPES.map((type) => (
              <li
                key={type}
                className="rounded-full bg-white px-3 py-1 text-xs text-neutral-600 shadow-sm"
              >
                {FLEET_INCIDENT_TYPE_LABELS[type]}
              </li>
            ))}
          </ul>
        </section>
      </DashboardAsyncState>
    </DashboardPage>
  );
}
