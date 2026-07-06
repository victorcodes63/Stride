'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableCell,
  DashboardTableEmpty,
  DashboardTableHead,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';

type ScorecardRow = {
  id: string;
  title: string;
  grade: string | null;
  jobDescriptionVersion: number;
  resultsWeightPercent: number;
  competenciesWeightPercent: number;
  measureCount: number;
  competencyCount: number;
};

export function ScorecardLibraryContent() {
  const [rows, setRows] = useState<ScorecardRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/performance/scorecards', { credentials: 'include' });
      const data = await res.json();
      if (res.ok) setRows(data.templates ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="BSC scorecards"
        description="Scorecards generated from published job descriptions — results (KRAs/KPIs) + competencies with configurable blend weights."
        footer={
          <Link href="/dashboard/performance/jds" className="btn-secondary h-10 px-3">
            Job descriptions
          </Link>
        }
      />
      <DashboardTableCard>
        <DashboardTableViewport>
          {loading ? (
            <div className="flex justify-center py-16 text-sm text-zinc-500">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Loading scorecards…
            </div>
          ) : (
            <DashboardTable>
              <thead>
                <tr>
                  <DashboardTableHead>Role</DashboardTableHead>
                  <DashboardTableHead>JD version</DashboardTableHead>
                  <DashboardTableHead>Blend</DashboardTableHead>
                  <DashboardTableHead>Measures</DashboardTableHead>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <DashboardTableEmpty colSpan={4}>
                    Publish a JD and click &quot;Generate BSC scorecard&quot; to create a template.
                  </DashboardTableEmpty>
                ) : (
                  rows.map((row) => (
                    <tr key={row.id} className="border-t border-zinc-100">
                      <DashboardTableCell>
                        <Link href={`/dashboard/performance/scorecards/${row.id}`} className="font-medium text-primary-800 hover:underline">
                          {row.title}
                        </Link>
                        {row.grade ? <div className="text-xs text-zinc-500">{row.grade}</div> : null}
                      </DashboardTableCell>
                      <DashboardTableCell>v{row.jobDescriptionVersion}</DashboardTableCell>
                      <DashboardTableCell>
                        {row.resultsWeightPercent}% / {row.competenciesWeightPercent}%
                      </DashboardTableCell>
                      <DashboardTableCell>
                        {row.measureCount} KPIs · {row.competencyCount} competencies
                      </DashboardTableCell>
                    </tr>
                  ))
                )}
              </tbody>
            </DashboardTable>
          )}
        </DashboardTableViewport>
      </DashboardTableCard>
    </DashboardPage>
  );
}
