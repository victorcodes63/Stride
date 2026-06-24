'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BadgeCheck,
  BarChart3,
  Briefcase,
  CalendarOff,
  Clock3,
  Download,
  Eye,
  FileSpreadsheet,
  Landmark,
  Shield,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { DashboardAsyncState, DashboardInlineLoading } from '@/components/dashboard/DashboardAsyncState';
import { DashboardPage, DashboardPageSection } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardStatCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';

type GenericPayload = Record<string, unknown>;

type ReportsSummary = {
  generatedAt: string;
  people: { employees: number; departments: number; newHires30d: number; terminations30d: number };
  credentials: { total: number; expiring30: number; expired: number };
  time: {
    attendanceSummariesMonth: number;
    openAttendanceExceptions: number;
    pendingLeave: number;
    approvedLeaveMonth: number;
  };
  payroll: { runsThisMonth: number; runsTotal: number };
  compliance: { openDisciplinaryCases: number; openGrievances: number; activeOnboarding: number };
  recruitment: {
    activeJobs: number;
    totalApplications: number;
    pendingApplications: number;
    upcomingInterviews: number;
  };
  governance: { essUsers: number; auditEvents30d: number };
  finance: { invoicesOutstanding: number; vendorBillsOutstanding: number };
};

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function monthYm() {
  return new Date().toISOString().slice(0, 7);
}

const inputClass =
  'rounded-lg border border-neutral-300/90 bg-white/90 px-3 py-2 text-sm text-ink focus:border-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-500/20';

const ROW_KEYS = [
  'details',
  'byDepartment',
  'byEmployee',
  'byStatus',
  'byType',
  'byJob',
  'rows',
] as const;

const SUMMARY_KEYS = [
  'totalEmployees',
  'totalApplications',
  'totalGross',
  'totalNet',
  'totalHours',
  'totalOvertimeHours',
  'totalCredentials',
  'pending',
  'approved',
  'openDisciplinaryCases',
  'activeJobs',
  'conversionRate',
] as const;

function ActionButton({
  label,
  onClick,
  kind = 'primary',
}: {
  label: string;
  onClick: () => void;
  kind?: 'primary' | 'secondary';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        kind === 'primary'
          ? 'inline-flex items-center gap-1.5 rounded-full border border-primary-200 bg-primary-50 px-3 py-2 text-xs font-semibold text-primary-900 transition hover:bg-primary-100'
          : 'inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white/90 px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50'
      }
    >
      {kind === 'primary' ? <Eye className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
      {label}
    </button>
  );
}

function ReportCard({
  title,
  description,
  icon: Icon,
  controls,
  onView,
  onCsv,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  controls?: ReactNode;
  onView: () => void;
  onCsv: () => void;
}) {
  return (
    <section className="dashboard-surface flex flex-col gap-3 p-5 shadow-sm">
      <div className="flex items-center gap-2">
        <Icon className="h-5 w-5 text-primary-800" strokeWidth={1.75} />
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
      </div>
      <p className="text-sm text-neutral-500">{description}</p>
      {controls}
      <div className="flex flex-wrap gap-2">
        <ActionButton label="Preview" onClick={onView} />
        <ActionButton label="CSV" kind="secondary" onClick={onCsv} />
      </div>
    </section>
  );
}

function formatSummaryLabel(key: string): string {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

export default function ReportsPage() {
  const [headcountAsOf, setHeadcountAsOf] = useState(todayYmd());
  const [attendanceFrom, setAttendanceFrom] = useState(
    new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().slice(0, 10),
  );
  const [attendanceTo, setAttendanceTo] = useState(todayYmd());
  const [leaveFrom, setLeaveFrom] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
  );
  const [leaveTo, setLeaveTo] = useState(todayYmd());
  const [payrollPeriod, setPayrollPeriod] = useState(monthYm());
  const [previewTitle, setPreviewTitle] = useState<string | null>(null);
  const [previewRows, setPreviewRows] = useState<Array<Record<string, unknown>>>([]);
  const [previewSummary, setPreviewSummary] = useState<Array<{ label: string; value: string }>>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [summary, setSummary] = useState<ReportsSummary | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSummaryLoading(true);
    setSummaryError(null);
    fetch('/api/reports/summary', { cache: 'no-store' })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || 'Failed to load summary');
        return data as ReportsSummary;
      })
      .then((data) => {
        if (!cancelled) setSummary(data);
      })
      .catch((err: unknown) => {
        if (!cancelled) setSummaryError(err instanceof Error ? err.message : 'Failed to load summary');
      })
      .finally(() => {
        if (!cancelled) setSummaryLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const statutoryLinks = useMemo(
    () => [
      { label: 'P9 CSV', type: 'p9' },
      { label: 'P10 CSV', type: 'p10' },
      { label: 'NSSF CSV', type: 'nssf' },
      { label: 'SHIF CSV', type: 'shif' },
    ],
    [],
  );

  async function preview(endpoint: string, title: string) {
    setPreviewLoading(true);
    setPreviewTitle(title);
    setPreviewRows([]);
    setPreviewSummary([]);
    try {
      const res = await fetch(endpoint, { cache: 'no-store' });
      const data = (await res.json()) as GenericPayload;
      const firstRowKey = ROW_KEYS.find((k) => Array.isArray(data[k]));
      const tableRows = firstRowKey ? (data[firstRowKey] as Array<Record<string, unknown>>) : [];
      setPreviewRows(tableRows);

      const metrics: Array<{ label: string; value: string }> = [];
      for (const key of SUMMARY_KEYS) {
        const value = data[key];
        if (value !== undefined && value !== null && typeof value !== 'object') {
          metrics.push({ label: formatSummaryLabel(key), value: String(value) });
        }
      }
      for (const [key, value] of Object.entries(data)) {
        if (
          typeof value === 'number' &&
          !SUMMARY_KEYS.includes(key as (typeof SUMMARY_KEYS)[number]) &&
          !key.startsWith('total') &&
          metrics.length < 8
        ) {
          metrics.push({ label: formatSummaryLabel(key), value: String(value) });
        }
      }
      setPreviewSummary(metrics.slice(0, 8));
    } catch {
      setPreviewRows([]);
      setPreviewSummary([]);
    } finally {
      setPreviewLoading(false);
    }
  }

  function download(url: string) {
    window.open(url, '_blank');
  }

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Reports"
        description="Workforce, payroll, compliance, and recruitment exports."
      />

      <DashboardAsyncState
        status={summaryLoading ? 'loading' : summaryError ? 'error' : 'success'}
        error={summaryError}
        loading={<DashboardInlineLoading label="Loading platform snapshot…" />}
      >
        {summary ? (
          <>
            <DashboardStatGrid columns={4}>
              <DashboardStatCard label="Active employees" value={summary.people.employees} tone="primary" />
              <DashboardStatCard
                label="Pending leave"
                value={summary.time.pendingLeave}
                hint={summary.time.approvedLeaveMonth > 0 ? `${summary.time.approvedLeaveMonth} approved this month` : undefined}
                tone="sky"
              />
              <DashboardStatCard
                label="Credentials expiring"
                value={summary.credentials.expiring30}
                hint={summary.credentials.expired > 0 ? `${summary.credentials.expired} already expired` : undefined}
                tone={summary.credentials.expiring30 > 0 ? 'warning' : 'success'}
              />
              <DashboardStatCard
                label="Payroll runs (month)"
                value={summary.payroll.runsThisMonth}
                hint={`${summary.payroll.runsTotal} all time`}
                tone="violet"
              />
            </DashboardStatGrid>

            <DashboardStatGrid columns={4} className="mt-3">
              <DashboardStatCard
                label="Open compliance items"
                value={summary.compliance.openDisciplinaryCases + summary.compliance.openGrievances}
                hint={`${summary.compliance.activeOnboarding} onboarding in progress`}
                tone={summary.compliance.openDisciplinaryCases + summary.compliance.openGrievances > 0 ? 'warning' : 'success'}
              />
              <DashboardStatCard
                label="Attendance exceptions"
                value={summary.time.openAttendanceExceptions}
                hint={`${summary.time.attendanceSummariesMonth} day summaries this month`}
                tone={summary.time.openAttendanceExceptions > 0 ? 'warning' : 'primary'}
              />
              <DashboardStatCard
                label="Recruitment pipeline"
                value={summary.recruitment.pendingApplications}
                hint={`${summary.recruitment.activeJobs} active jobs · ${summary.recruitment.upcomingInterviews} interviews`}
                tone="primary"
              />
              <DashboardStatCard
                label="ESS portal users"
                value={summary.governance.essUsers}
                hint={`${summary.governance.auditEvents30d} audit events (30d)`}
                tone="sky"
              />
            </DashboardStatGrid>
          </>
        ) : null}
      </DashboardAsyncState>

      <DashboardPageSection title="People & workforce" className="mt-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <ReportCard
            title="Headcount"
            description="Active headcount by department, clinical mix, hires and exits."
            icon={Users}
            controls={
              <input
                type="date"
                value={headcountAsOf}
                onChange={(e) => setHeadcountAsOf(e.target.value)}
                className={inputClass}
                aria-label="Headcount as of date"
              />
            }
            onView={() => preview(`/api/reports/headcount?asOf=${headcountAsOf}`, 'Headcount report')}
            onCsv={() => download(`/api/reports/headcount?asOf=${headcountAsOf}&format=csv`)}
          />
          <ReportCard
            title="Credentials & licences"
            description="Validity status, 30/90-day expiry watchlist, and issuing bodies."
            icon={BadgeCheck}
            onView={() => preview('/api/reports/credentials', 'Credentials report')}
            onCsv={() => download('/api/reports/credentials?format=csv')}
          />
          <ReportCard
            title="Leave utilisation"
            description="Applications, days taken, and status breakdown by leave type."
            icon={CalendarOff}
            controls={
              <div className="flex flex-wrap gap-2">
                <input type="date" value={leaveFrom} onChange={(e) => setLeaveFrom(e.target.value)} className={inputClass} aria-label="Leave from" />
                <input type="date" value={leaveTo} onChange={(e) => setLeaveTo(e.target.value)} className={inputClass} aria-label="Leave to" />
              </div>
            }
            onView={() => preview(`/api/reports/leave?from=${leaveFrom}&to=${leaveTo}`, 'Leave report')}
            onCsv={() => download(`/api/reports/leave?from=${leaveFrom}&to=${leaveTo}&format=csv`)}
          />
        </div>
      </DashboardPageSection>

      <DashboardPageSection title="Time & attendance" className="mt-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <ReportCard
            title="Attendance summary"
            description="Hours worked, overtime, lateness, absences, and missed clock-outs."
            icon={Clock3}
            controls={
              <div className="flex flex-wrap gap-2">
                <input type="date" value={attendanceFrom} onChange={(e) => setAttendanceFrom(e.target.value)} className={inputClass} aria-label="Attendance from" />
                <input type="date" value={attendanceTo} onChange={(e) => setAttendanceTo(e.target.value)} className={inputClass} aria-label="Attendance to" />
              </div>
            }
            onView={() => preview(`/api/reports/attendance?from=${attendanceFrom}&to=${attendanceTo}`, 'Attendance report')}
            onCsv={() => download(`/api/reports/attendance?from=${attendanceFrom}&to=${attendanceTo}&format=csv`)}
          />
        </div>
      </DashboardPageSection>

      <DashboardPageSection title="Payroll & statutory" className="mt-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          <ReportCard
            title="Payroll cost"
            description="Gross, net, PAYE, NSSF, SHIF, and department totals for a period."
            icon={Landmark}
            controls={
              <input type="month" value={payrollPeriod} onChange={(e) => setPayrollPeriod(e.target.value)} className={inputClass} aria-label="Payroll period" />
            }
            onView={() => preview(`/api/reports/payroll-cost?period=${payrollPeriod}`, 'Payroll cost report')}
            onCsv={() => download(`/api/reports/payroll-cost?period=${payrollPeriod}&format=csv`)}
          />
          <section className="dashboard-surface flex flex-col gap-3 p-5 shadow-sm md:col-span-2">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-primary-800" strokeWidth={1.75} />
              <h3 className="text-sm font-semibold text-ink">Statutory returns</h3>
            </div>
            <p className="text-sm text-neutral-500">P9, P10, NSSF, and SHIF CSV files for submission portals.</p>
            <input type="month" value={payrollPeriod} onChange={(e) => setPayrollPeriod(e.target.value)} className={inputClass} aria-label="Statutory period" />
            <div className="flex flex-wrap gap-2">
              {statutoryLinks.map((item) => (
                <button
                  key={item.type}
                  type="button"
                  onClick={() => download(`/api/reports/statutory?period=${payrollPeriod}&type=${item.type}&format=csv`)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white/90 px-3 py-2 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50"
                >
                  <Download className="h-3.5 w-3.5" />
                  {item.label}
                </button>
              ))}
            </div>
          </section>
        </div>
      </DashboardPageSection>

      <DashboardPageSection title="Compliance & risk" className="mt-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <ReportCard
            title="Disciplinary, grievances & onboarding"
            description="Open cases, grievance queue, and active onboarding workflows."
            icon={Shield}
            onView={() => preview('/api/reports/compliance', 'Compliance report')}
            onCsv={() => download('/api/reports/compliance?format=csv')}
          />
        </div>
      </DashboardPageSection>

      <DashboardPageSection title="Recruitment" className="mt-6">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <ReportCard
            title="Hiring funnel"
            description="Applications by status, job pipeline, conversion rate, and upcoming interviews."
            icon={Briefcase}
            onView={() => preview('/api/reports/recruitment', 'Recruitment report')}
            onCsv={() => download('/api/reports/recruitment?format=csv')}
          />
        </div>
      </DashboardPageSection>

      {(summary?.finance.invoicesOutstanding ?? 0) > 0 || (summary?.finance.vendorBillsOutstanding ?? 0) > 0 ? (
        <DashboardPageSection title="Finance snapshot" className="mt-6">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DashboardStatCard
              label="Outstanding invoices"
              value={summary?.finance.invoicesOutstanding ?? 0}
              tone="warning"
            />
            <DashboardStatCard
              label="Outstanding vendor bills"
              value={summary?.finance.vendorBillsOutstanding ?? 0}
              tone="warning"
            />
          </div>
        </DashboardPageSection>
      ) : null}

      <DashboardTableCard className="mt-6">
        <div className="border-b border-neutral-200/80 px-5 py-4 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-ink">{previewTitle ?? 'Report preview'}</h3>
              <p className="mt-0.5 text-xs text-neutral-500">Select a report above and click Preview.</p>
            </div>
            {previewLoading ? (
              <span className="text-xs text-neutral-500">Loading…</span>
            ) : previewTitle ? (
              <BarChart3 className="h-4 w-4 text-primary-600" aria-hidden />
            ) : null}
          </div>
          {previewSummary.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {previewSummary.map((item) => (
                <span
                  key={item.label}
                  className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-2.5 py-1 text-xs text-neutral-700"
                >
                  <span className="font-medium text-ink">{item.value}</span>
                  <span className="text-neutral-500">{item.label}</span>
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <DashboardAsyncState
          status={previewLoading ? 'loading' : previewRows.length === 0 ? 'empty' : 'success'}
          loading={<DashboardInlineLoading label="Building preview…" />}
          empty={
            <DashboardTableEmpty
              title="No preview yet"
              description="Choose a report and click Preview to see tabular data here."
            />
          }
        >
          <DashboardTableViewport>
            <DashboardTable>
              <thead>
                <tr>
                  {previewRows[0] ? Object.keys(previewRows[0]).map((key) => <th key={key}>{key}</th>) : null}
                </tr>
              </thead>
              <tbody>
                {previewRows.slice(0, 100).map((row, i) => (
                  <tr key={`${previewTitle}-${i}`}>
                    {Object.values(row).map((value, idx) => (
                      <td key={idx} className="tabular-nums">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </DashboardTable>
            {previewRows.length > 100 ? (
              <DashboardTableEmpty
                title="Preview truncated"
                description={`Showing first 100 of ${previewRows.length} rows. Export CSV for the full dataset.`}
              />
            ) : null}
          </DashboardTableViewport>
        </DashboardAsyncState>
      </DashboardTableCard>
    </DashboardPage>
  );
}
