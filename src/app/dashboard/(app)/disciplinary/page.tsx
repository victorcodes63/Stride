'use client';

import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { FileWarning, Plus, Scale } from 'lucide-react';
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
import { DISCIPLINARY_STATUSES, GRIEVANCE_STATUSES, JURISDICTION_POLICIES } from '@/lib/east-africa-hr-policy';

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
  const [createOpen, setCreateOpen] = useState(false);
  const [grievanceCreateOpen, setGrievanceCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string; employeeNumber: string | null }>>([]);
  const [caseForm, setCaseForm] = useState({
    employeeId: '',
    subject: '',
    description: '',
    type: 'MISCONDUCT',
    severity: 'MINOR',
    incidentDate: new Date().toISOString().slice(0, 10),
    laborJurisdiction: 'KE',
  });
  const [grievanceForm, setGrievanceForm] = useState({
    employeeId: '',
    subject: '',
    description: '',
    category: 'OTHER',
  });

  const [sla, setSla] = useState<{
    openCases: number;
    overdueShowCause: number;
    hearingsNext7Days: number;
    pendingAcknowledgments: number;
    openGrievances: number;
  } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [casesRes, grievancesRes, slaRes] = await Promise.all([
        fetch(
          `/api/disciplinary/cases${caseStatusFilter ? `?status=${encodeURIComponent(caseStatusFilter)}` : ''}`,
        ),
        fetch(
          `/api/grievances${grievanceStatusFilter ? `?status=${encodeURIComponent(grievanceStatusFilter)}` : ''}`,
        ),
        fetch('/api/disciplinary/sla-summary'),
      ]);
      if (!casesRes.ok || !grievancesRes.ok) {
        throw new Error('Could not load disciplinary records.');
      }
      const [casesData, grievancesData, slaData] = await Promise.all([
        casesRes.json().catch(() => []),
        grievancesRes.json().catch(() => []),
        slaRes.ok ? slaRes.json().catch(() => null) : null,
      ]);
      setCases(Array.isArray(casesData) ? casesData : []);
      setGrievances(Array.isArray(grievancesData) ? grievancesData : []);
      setSla(slaData);
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

  useEffect(() => {
    if (!createOpen && !grievanceCreateOpen) return;
    void fetch('/api/outsourcing/employees')
      .then((r) => r.json())
      .then((data) => {
        if (!Array.isArray(data)) return;
        setEmployees(
          data.map((e: { id: string; firstName: string; lastName: string; employeeNumber: string | null }) => ({
            id: e.id,
            name: `${e.firstName} ${e.lastName}`.trim(),
            employeeNumber: e.employeeNumber,
          })),
        );
      })
      .catch(() => setEmployees([]));
  }, [createOpen, grievanceCreateOpen]);

  async function createCase() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/disciplinary/cases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(caseForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create case.');
      setCreateOpen(false);
      setCaseForm({
        employeeId: '',
        subject: '',
        description: '',
        type: 'MISCONDUCT',
        severity: 'MINOR',
        incidentDate: new Date().toISOString().slice(0, 10),
        laborJurisdiction: 'KE',
      });
      window.location.href = `/dashboard/disciplinary/cases/${data.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create case.');
    } finally {
      setCreating(false);
    }
  }

  async function createGrievance() {
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/grievances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(grievanceForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create grievance.');
      setGrievanceCreateOpen(false);
      setGrievanceForm({ employeeId: '', subject: '', description: '', category: 'OTHER' });
      window.location.href = `/dashboard/disciplinary/grievances/${data.id}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create grievance.');
    } finally {
      setCreating(false);
    }
  }

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
        actions={
          tab === 'cases' ? (
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="btn-primary inline-flex h-10 items-center gap-2 px-3"
            >
              <Plus className="h-4 w-4" />
              New case
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setGrievanceCreateOpen(true)}
              className="btn-primary inline-flex h-10 items-center gap-2 px-3"
            >
              <Plus className="h-4 w-4" />
              Log grievance
            </button>
          )
        }
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

      {sla ? (
        <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {[
            ['Open cases', sla.openCases],
            ['Overdue show-cause', sla.overdueShowCause],
            ['Hearings (7d)', sla.hearingsNext7Days],
            ['Pending ack', sla.pendingAcknowledgments],
            ['Open grievances', sla.openGrievances],
          ].map(([label, value]) => (
            <div key={String(label)} className="dashboard-stat-card shadow-sm">
              <p className="text-xs uppercase tracking-wide text-neutral-500">{label}</p>
              <p className="mt-1 text-2xl font-bold tabular-nums text-primary-900">{value}</p>
            </div>
          ))}
        </div>
      ) : null}

      {createOpen ? (
        <div className="mb-6 dashboard-surface shadow-sm p-4 sm:p-5 space-y-3">
          <h2 className="text-sm font-semibold text-neutral-900">Open disciplinary case</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              <span className="text-neutral-600">Employee</span>
              <select
                className={`${dashboardFilterSelectClass} mt-1 w-full`}
                value={caseForm.employeeId}
                onChange={(e) => setCaseForm((f) => ({ ...f, employeeId: e.target.value }))}
              >
                <option value="">Select employee…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                    {e.employeeNumber ? ` (${e.employeeNumber})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="text-neutral-600">Subject</span>
              <input
                className={`${dashboardFilterSelectClass} mt-1 w-full`}
                value={caseForm.subject}
                onChange={(e) => setCaseForm((f) => ({ ...f, subject: e.target.value }))}
                placeholder="Brief case title"
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="text-neutral-600">Allegation / description</span>
              <textarea
                className="mt-1 w-full rounded-lg border border-neutral-200 px-3 py-2 text-sm"
                rows={4}
                value={caseForm.description}
                onChange={(e) => setCaseForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Facts, witnesses, policy references…"
              />
            </label>
            <label className="text-sm">
              <span className="text-neutral-600">Type</span>
              <select
                className={`${dashboardFilterSelectClass} mt-1 w-full`}
                value={caseForm.type}
                onChange={(e) => setCaseForm((f) => ({ ...f, type: e.target.value }))}
              >
                {[
                  'MISCONDUCT',
                  'POOR_PERFORMANCE',
                  'POLICY_VIOLATION',
                  'INSUBORDINATION',
                  'ABSENTEEISM',
                  'HARASSMENT',
                  'NEGLIGENCE',
                  'OTHER',
                ].map((t) => (
                  <option key={t} value={t}>
                    {t.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="text-neutral-600">Severity</span>
              <select
                className={`${dashboardFilterSelectClass} mt-1 w-full`}
                value={caseForm.severity}
                onChange={(e) => setCaseForm((f) => ({ ...f, severity: e.target.value }))}
              >
                {['MINOR', 'MODERATE', 'SERIOUS', 'GROSS'].map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="text-neutral-600">Incident date</span>
              <input
                type="date"
                className={`${dashboardFilterSelectClass} mt-1 w-full`}
                value={caseForm.incidentDate}
                onChange={(e) => setCaseForm((f) => ({ ...f, incidentDate: e.target.value }))}
              />
            </label>
            <label className="text-sm">
              <span className="text-neutral-600">Jurisdiction</span>
              <select
                className={`${dashboardFilterSelectClass} mt-1 w-full`}
                value={caseForm.laborJurisdiction}
                onChange={(e) => setCaseForm((f) => ({ ...f, laborJurisdiction: e.target.value }))}
              >
                {(Object.keys(JURISDICTION_POLICIES) as Array<keyof typeof JURISDICTION_POLICIES>).map(
                  (code) => (
                    <option key={code} value={code}>
                      {JURISDICTION_POLICIES[code].label}
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={creating || !caseForm.employeeId || !caseForm.subject || !caseForm.description}
              className="btn-primary disabled:opacity-50"
              onClick={() => void createCase()}
            >
              {creating ? 'Creating…' : 'Create case'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {grievanceCreateOpen ? (
        <div className="dashboard-surface mb-4 space-y-4 p-4 shadow-sm">
          <h2 className="text-sm font-semibold text-neutral-900">Log grievance (on behalf of employee)</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              <span className="text-neutral-600">Employee</span>
              <select
                className={`${dashboardFilterSelectClass} mt-1 w-full`}
                value={grievanceForm.employeeId}
                onChange={(e) => setGrievanceForm((f) => ({ ...f, employeeId: e.target.value }))}
              >
                <option value="">Select employee…</option>
                {employees.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                    {e.employeeNumber ? ` (${e.employeeNumber})` : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="text-neutral-600">Subject</span>
              <input
                className={`${dashboardFilterSelectClass} mt-1 w-full`}
                value={grievanceForm.subject}
                onChange={(e) => setGrievanceForm((f) => ({ ...f, subject: e.target.value }))}
              />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="text-neutral-600">Description</span>
              <textarea
                className={`${dashboardFilterSelectClass} mt-1 w-full`}
                rows={4}
                value={grievanceForm.description}
                onChange={(e) => setGrievanceForm((f) => ({ ...f, description: e.target.value }))}
              />
            </label>
            <label className="text-sm">
              <span className="text-neutral-600">Category</span>
              <select
                className={`${dashboardFilterSelectClass} mt-1 w-full`}
                value={grievanceForm.category}
                onChange={(e) => setGrievanceForm((f) => ({ ...f, category: e.target.value }))}
              >
                {[
                  'WORKPLACE_SAFETY',
                  'HARASSMENT',
                  'DISCRIMINATION',
                  'WORKLOAD',
                  'MANAGEMENT',
                  'COMPENSATION',
                  'POLICY',
                  'OTHER',
                ].map((c) => (
                  <option key={c} value={c}>
                    {c.replaceAll('_', ' ')}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={
                creating ||
                !grievanceForm.employeeId ||
                !grievanceForm.subject ||
                !grievanceForm.description
              }
              className="btn-primary disabled:opacity-50"
              onClick={() => void createGrievance()}
            >
              {creating ? 'Creating…' : 'Create grievance'}
            </button>
            <button type="button" className="btn-secondary" onClick={() => setGrievanceCreateOpen(false)}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

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
