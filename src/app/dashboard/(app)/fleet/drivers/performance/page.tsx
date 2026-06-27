'use client';

import { useEffect, useState } from 'react';
import { UserCheck } from 'lucide-react';
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

type DriverSummary = {
  driverId: string;
  driverName: string;
  avgOverall: number | null;
  avgSafety: number | null;
  evaluationCount: number;
};

type Evaluation = {
  id: string;
  driverName: string;
  tripNumber: string | null;
  scoreOverall: number;
  scoreSafety: number | null;
  scorePunctuality: number | null;
  evaluatedAt: string;
};

export default function FleetDriverPerformancePage() {
  const [summaries, setSummaries] = useState<DriverSummary[]>([]);
  const [evaluations, setEvaluations] = useState<Evaluation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/fleet/driver-evaluations')
      .then(async (r) => {
        if (!r.ok) throw new Error('Unable to load driver performance.');
        const json = (await r.json()) as {
          driverSummaries: DriverSummary[];
          evaluations: Evaluation[];
        };
        setSummaries(json.driverSummaries);
        setEvaluations(json.evaluations);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Error'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <DashboardPage>
      <DashboardPageHeader
        eyebrow="Fleet & Logistics"
        title="Driver performance"
        description="Driver evaluation scores — safety, punctuality, fuel efficiency, and customer feedback. Linked to HR via employee records."
      />
      <DashboardAsyncState status={loading ? 'loading' : error ? 'error' : 'success'} error={error}>
        <>
          <DashboardStatGrid>
            <DashboardMetricCard label="Drivers rated" value={summaries.length} icon={UserCheck} />
            <DashboardMetricCard label="Evaluations" value={evaluations.length} icon={UserCheck} />
          </DashboardStatGrid>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <DashboardTableCard>
              <div className="border-b border-neutral-200 px-5 py-3">
                <h2 className="text-sm font-semibold">Driver scorecard</h2>
              </div>
              <DashboardTableViewport>
                {summaries.length === 0 ? (
                  <DashboardTableEmpty title="No evaluations yet" description="Score drivers after trip completion." />
                ) : (
                  <DashboardTable>
                    <thead>
                      <tr>
                        <th>Driver</th>
                        <th>Overall</th>
                        <th>Safety</th>
                        <th>Reviews</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summaries.map((s) => (
                        <tr key={s.driverId}>
                          <td className="col-primary font-medium">{s.driverName}</td>
                          <td>{s.avgOverall ?? '—'}</td>
                          <td>{s.avgSafety ?? '—'}</td>
                          <td>{s.evaluationCount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </DashboardTable>
                )}
              </DashboardTableViewport>
            </DashboardTableCard>

            <DashboardTableCard>
              <div className="border-b border-neutral-200 px-5 py-3">
                <h2 className="text-sm font-semibold">Recent evaluations</h2>
              </div>
              <DashboardTableViewport>
                {evaluations.length === 0 ? (
                  <DashboardTableEmpty title="No recent evaluations" />
                ) : (
                  <DashboardTable>
                    <thead>
                      <tr>
                        <th>Driver</th>
                        <th>Trip</th>
                        <th>Score</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {evaluations.slice(0, 15).map((e) => (
                        <tr key={e.id}>
                          <td className="font-medium">{e.driverName}</td>
                          <td>{e.tripNumber ?? '—'}</td>
                          <td>{e.scoreOverall}/100</td>
                          <td className="col-muted text-sm">{new Date(e.evaluatedAt).toLocaleDateString()}</td>
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
