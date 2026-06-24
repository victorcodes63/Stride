'use client';

import { useEffect, useState } from 'react';
import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { EssPullRefresh } from '@/components/ess/EssPullRefresh';

type Row = {
  id: string;
  employeeName: string;
  leaveTypeName: string;
  startDate: string;
  endDate: string;
  days: number;
};

export default function EssTeamCalendarPage() {
  const [rows, setRows] = useState<Row[]>([]);

  async function load() {
    const res = await fetch('/api/ess/team/calendar');
    const data = await res.json().catch(() => ({}));
    setRows(Array.isArray(data.items) ? data.items : []);
  }

  useEffect(() => {
    load().catch(() => setRows([]));
  }, []);

  return (
    <EssPullRefresh onRefresh={load}>
      <EssPageHeader
        title="Team calendar"
        subtitle="Approved leave in the next 7 days"
        backHref="/ess/team"
      />
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="rounded-xl border border-neutral-200 bg-white p-4">
            <p className="font-semibold text-neutral-900">{row.employeeName}</p>
            <p className="text-sm text-neutral-600">{row.leaveTypeName}</p>
            <p className="mt-1 text-sm text-neutral-500">
              {new Date(row.startDate).toLocaleDateString()} – {new Date(row.endDate).toLocaleDateString()} ({row.days}d)
            </p>
          </div>
        ))}
        {!rows.length ? (
          <p className="rounded-xl border border-neutral-200 bg-white py-10 text-center text-sm text-neutral-500">
            No team leave scheduled this week.
          </p>
        ) : null}
      </div>
    </EssPullRefresh>
  );
}
