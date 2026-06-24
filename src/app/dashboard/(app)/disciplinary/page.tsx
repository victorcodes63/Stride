'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { FileWarning, Scale } from 'lucide-react';
import { DashboardAsyncState } from '@/components/dashboard/DashboardAsyncState';
import {
  DashboardFilterBar,
  dashboardFilterSelectClass,
} from '@/components/dashboard/DashboardFilterBar';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableCell,
  DashboardTableEmpty,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardTabs } from '@/components/dashboard/DashboardTabs';
import { useDashboardTabParam } from '@/hooks/useDashboardTabParam';
import { DISCIPLINARY_STATUSES, GRIEVANCE_STATUSES } from '@/lib/east-africa-hr-policy';

type CaseRow = {
  id: string;
  caseNumber: string;
  type: string;
  severity: string;
  status: string;
  subject: string;
  createdAt: string;
  actionCount: number;
  laborJurisdiction?: string;
  employee: { firstName: string; lastName: string; employeeNumber: string | null };
};

type GrievanceRow = {
  id: string;
  grievanceNumber: string;
  status: string;
  category: string;
  subject: string;
  submittedAt: string;
  employee: { firstName: string; lastName: string };
};

const TABS = ['cases', 'grievances'] as const;
type DisciplinaryTab = (typeof TABS)[number];

export default function DisciplinaryPage() {
  return (
    <Suspense fallback={<div className="py-16 text-center text-sm text-neutral-500">Loading…</div>}>
      <DisciplinaryPageContent />
    </Suspense>
  );
}

function DisciplinaryPageContent() {
  const { tab, setTab } = useDashboardTabParam('tab', TABS, 'cases');
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [grievances, setGrievances] = useState<GrievanceRow[]>([]);
  const [caseStatusFilter, setCaseStatusFilter] = useState('');
  const [grievanceStatusFilter, setGrievanceStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [casesRes, grievancesRes] = await Promise.all([
        fetch(
          `/api/disciplinary/cases${caseStatusFilter ? `?status=${encodeURIComponent(caseStatusFilter)}` : ''}`,
        ),
        fetch(
          `/api/grievances${grievanceStatusFilter ? `?status=${encodeURIComponent(grievanceStatusFilter)}` : ''}`,
        ),
      ]);
      if (!casesRes.ok || !grievancesRes.ok) {
        throw new Error('Could not load disciplinary records.');
      }
      const [casesData, grievancesData] = await Promise.all([
        casesRes.json().catch(() => []),
        grievancesRes.json().catch(() => []),
      ]);
      setCases(Array.isArray(casesData) ? casesData : []);
      setGrievances(Array.isArray(grievancesData) ? grievancesData : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load disciplinary records.');
      setCases([]);
      setGrievances([]);
    } finally {
      setLoading(false);
    }
  }, [caseStatusFilter, grievanceStatusFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeRows = tab === 'cases' ? cases : grievances;
  const status = useMemo(() => {
    if (loading) return 'loading' as const;
    if (error) return 'error' as const;
    if (activeRows.length === 0) return 'empty' as const;
    return 'success' as const;
  }, [activeRows.length, error, loading]);

  const hasCaseFilter = caseStatusFilter !== '';
  const hasGrievanceFilter = grievanceStatusFilter !== '';

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Disciplinary & Grievance Management"
        description="Manage disciplinary cases and employee grievances."
        footer={
          <DashboardTabs
            embedded
            value={tab}
            onChange={setTab}
            items={[
              { value: 'cases', label: 'Cases', icon: Scale },
              { value: 'grievances', label: 'Grievances', icon: FileWarning },
            ]}
          />
        }
      />

      <DashboardTableCard>
        {tab === 'cases' ? (
          <DashboardFilterBar
            hasActiveFilters={hasCaseFilter}
            onClear={() => setCaseStatusFilter('')}
          >
            <label className="sr-only" htmlFor="case-status-filter">
              Case status
            </label>
            <select
              id="case-status-filter"
              className={dashboardFilterSelectClass}
              value={caseStatusFilter}
              onChange={(e) => setCaseStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              {DISCIPLINARY_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </DashboardFilterBar>
        ) : (
          <DashboardFilterBar
            hasActiveFilters={hasGrievanceFilter}
            onClear={() => setGrievanceStatusFilter('')}
          >
            <label className="sr-only" htmlFor="grievance-status-filter">
              Grievance status
            </label>
            <select
              id="grievance-status-filter"
              className={dashboardFilterSelectClass}
              value={grievanceStatusFilter}
              onChange={(e) => setGrievanceStatusFilter(e.target.value)}
            >
              <option value="">All statuses</option>
              {GRIEVANCE_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {item.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </DashboardFilterBar>
        )}

        <DashboardAsyncState
          status={status}
          error={error}
          onRetry={load}
          empty={
            <DashboardTableEmpty
              icon={<Scale className="h-8 w-8 text-neutral-300" aria-hidden />}
              title={tab === 'cases' ? 'No cases match this filter' : 'No grievances match this filter'}
              description="Try clearing the status filter or check back later."
            />
          }
        >
          {tab === 'cases' ? (
            <DashboardTableViewport minWidth={640}>
              <DashboardTable>
                <thead>
                  <tr className="text-left text-neutral-500">
                    <th className="pb-2 font-medium">Case</th>
                    <th className="pb-2 font-medium">Employee</th>
                    <th className="pb-2 font-medium">Type</th>
                    <th className="col-center pb-2 font-medium">Severity</th>
                    <th className="col-center pb-2 font-medium">Status</th>
                    <th className="col-right pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {cases.map((item) => (
                    <tr key={item.id} className="border-t border-neutral-100">
                      <DashboardTableCell className="py-2">
                        <Link
                          className="font-medium text-primary-800 hover:underline"
                          href={`/dashboard/disciplinary/cases/${item.id}`}
                        >
                          {item.caseNumber}
                        </Link>
                        <div className="text-xs text-neutral-500">{item.subject}</div>
                      </DashboardTableCell>
                      <DashboardTableCell>
                        {item.employee.firstName} {item.employee.lastName}
                      </DashboardTableCell>
                      <DashboardTableCell>{item.type.replaceAll('_', ' ')}</DashboardTableCell>
                      <DashboardTableCell className="col-center">
                        {item.severity.replaceAll('_', ' ')}
                      </DashboardTableCell>
                      <DashboardTableCell className="col-center">
                        {item.status.replaceAll('_', ' ')}
                      </DashboardTableCell>
                      <DashboardTableCell className="col-right">
                        <Link
                          className="text-primary-700 hover:underline"
                          href={`/dashboard/disciplinary/cases/${item.id}`}
                        >
                          View
                        </Link>
                      </DashboardTableCell>
                    </tr>
                  ))}
                </tbody>
              </DashboardTable>
            </DashboardTableViewport>
          ) : (
            <DashboardTableViewport minWidth={560}>
              <DashboardTable>
                <thead>
                  <tr className="text-left text-neutral-500">
                    <th className="pb-2 font-medium">Grievance</th>
                    <th className="pb-2 font-medium">Employee</th>
                    <th className="pb-2 font-medium">Category</th>
                    <th className="col-center pb-2 font-medium">Status</th>
                    <th className="col-center pb-2 font-medium">Date</th>
                    <th className="col-right pb-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {grievances.map((item) => (
                    <tr key={item.id} className="border-t border-neutral-100">
                      <DashboardTableCell className="py-2">
                        <span className="font-medium text-neutral-900">{item.grievanceNumber}</span>
                        <div className="text-xs text-neutral-500">{item.subject}</div>
                      </DashboardTableCell>
                      <DashboardTableCell>
                        {item.employee.firstName} {item.employee.lastName}
                      </DashboardTableCell>
                      <DashboardTableCell>{item.category.replaceAll('_', ' ')}</DashboardTableCell>
                      <DashboardTableCell className="col-center">
                        {item.status.replaceAll('_', ' ')}
                      </DashboardTableCell>
                      <DashboardTableCell className="col-center tabular-nums">
                        {new Date(item.submittedAt).toLocaleDateString()}
                      </DashboardTableCell>
                      <DashboardTableCell className="col-right">
                        <Link
                          className="text-primary-700 hover:underline"
                          href={`/dashboard/disciplinary/grievances/${item.id}`}
                        >
                          View
                        </Link>
                      </DashboardTableCell>
                    </tr>
                  ))}
                </tbody>
              </DashboardTable>
            </DashboardTableViewport>
          )}
        </DashboardAsyncState>
      </DashboardTableCard>
    </DashboardPage>
  );
}
