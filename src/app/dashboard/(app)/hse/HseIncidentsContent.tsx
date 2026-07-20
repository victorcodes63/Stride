'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ClipboardList,
  FileText,
  ListTodo,
  Loader2,
  Paperclip,
  Plus,
  Search,
  Shield,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { EntityContextBanner } from '@/components/EntityContextBanner';
import { DashboardAsyncState, DashboardInlineLoading } from '@/components/dashboard/DashboardAsyncState';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableSearchInput,
  DashboardTableToolbar,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
import { DashboardDrawer } from '@/components/dashboard/DashboardDrawer';
import { DashboardModal } from '@/components/dashboard/DashboardModal';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardPagination } from '@/components/dashboard/DashboardPagination';
import { DashboardStatCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';
import { DashboardTabs } from '@/components/dashboard/DashboardTabs';
import { ExportButton } from '@/components/dashboard/ExportButton';
import { StrideSelect } from '@/components/ui/stride-select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { toast } from '@/components/ui/toast';
import { dashStatusChip, type DashStatusTone } from '@/lib/dashboard-status-chips';
import { apiFetch, useApiMutation, useApiResource } from '@/hooks/useApiResource';
import { useSortableTable } from '@/hooks/useSortableTable';

type IncidentRow = {
  id: string;
  incidentNumber: string;
  title: string;
  description: string;
  incidentType: string;
  incidentTypeLabel: string;
  severity: string;
  severityLabel: string;
  status: string;
  statusLabel: string;
  location: string | null;
  siteName: string | null;
  occurredAt: string;
  immediateAction: string | null;
  injuredParty: string | null;
  reportedAt: string;
  resolvedAt: string | null;
  closedAt: string | null;
  rootCause: string | null;
  rootCauseCategory: string | null;
  rootCauseCategoryLabel: string | null;
  witnessNames: string | null;
  reportableToAuthority: boolean;
  lostTimeInjury: boolean;
  lostTimeDays: number | null;
  reportedBy: string | null;
  openActionCount: number;
};

type ActionItem = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  statusLabel: string;
  dueDate: string | null;
  completedAt: string | null;
  assignee: { id: string; name: string; email: string } | null;
};

type Attachment = {
  id: string;
  fileName: string;
  fileUrl: string;
  contentType: string | null;
  fileSize: number | null;
  kind: string | null;
  uploadedByUserId: string | null;
  createdAt: string;
};

type IncidentDetail = IncidentRow & { actions: ActionItem[]; attachments: Attachment[] };

type Summary = {
  openCount: number;
  followUpCount: number;
  resolvedThisMonth: number;
  nearMissCount: number;
  daysSinceLast: number | null;
};

type IncidentsResponse = {
  items: IncidentRow[];
  incidents?: IncidentRow[];
  total: number;
  page: number;
  pageSize: number;
  summary: Summary;
};

type ActionRow = ActionItem & { incident: { id: string; incidentNumber: string; title: string } };

type AnalyticsResponse = {
  bySeverity: { key: string; label: string; count: number }[];
  byType: { key: string; label: string; count: number }[];
  monthlyTrend: { key: string; label: string; count: number }[];
};

type StaffResponse = { staff: { id: string; name: string; email: string }[] };

type Tab = 'incidents' | 'actions';
type SortKey = 'incidentNumber' | 'occurredAt' | 'siteName' | 'incidentType' | 'severity' | 'status';

const PAGE_SIZE = 20;

const INPUT =
  'w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-primary-500/30';

const INCIDENT_TYPES = [
  { value: 'hazard', label: 'Hazard' },
  { value: 'near_miss', label: 'Near miss' },
  { value: 'injury', label: 'Personal injury' },
  { value: 'fire', label: 'Fire / explosion risk' },
  { value: 'equipment_failure', label: 'Equipment failure' },
  { value: 'environmental', label: 'Environmental' },
  { value: 'other', label: 'Other' },
];

const SEVERITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' },
];

const ROOT_CAUSE_CATEGORIES = [
  { value: 'human_factor', label: 'Human factor' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'process', label: 'Process' },
  { value: 'environment', label: 'Environment' },
  { value: 'other', label: 'Other' },
];

const ACTION_STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'completed', label: 'Completed' },
  { value: 'cancelled', label: 'Cancelled' },
];

const SEVERITY_COLORS: Record<string, string> = {
  low: '#94a3b8',
  medium: '#38bdf8',
  high: '#f59e0b',
  critical: '#ef4444',
};

function severityTone(severity: string): DashStatusTone {
  switch (severity) {
    case 'critical':
      return 'danger';
    case 'high':
      return 'warning';
    case 'medium':
      return 'info';
    default:
      return 'neutral';
  }
}

function incidentStatusTone(status: string): DashStatusTone {
  switch (status) {
    case 'open':
      return 'danger';
    case 'investigating':
      return 'warning';
    case 'resolved':
      return 'success';
    case 'closed':
      return 'neutral';
    default:
      return 'neutral';
  }
}

function actionStatusTone(status: string): DashStatusTone {
  switch (status) {
    case 'open':
      return 'warning';
    case 'in_progress':
      return 'info';
    case 'completed':
      return 'success';
    case 'cancelled':
      return 'neutral';
    default:
      return 'neutral';
  }
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatBytes(bytes: number | null) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

const INCIDENTS_KEY = 'incidents';
const SUMMARY_KEY = 'summary';
const ACTIONS_KEY = 'actions';
const INCIDENT_KEY = 'incident';

export default function HseIncidentsContent() {
  const [tab, setTab] = useState<Tab>('incidents');
  const [statusFilter, setStatusFilter] = useState('');
  const [siteFilter, setSiteFilter] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const { sort, toggleSort, getSortDirection } = useSortableTable<SortKey>({
    key: 'occurredAt',
    direction: 'desc',
  });

  const [showLogForm, setShowLogForm] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  // Debounce the search box.
  useEffect(() => {
    const handle = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(handle);
  }, [searchInput]);

  // Reset to first page whenever filters/sorting change.
  useEffect(() => {
    setPage(1);
  }, [statusFilter, siteFilter, search, sort.key, sort.direction]);

  const incidentsUrl = useMemo(() => {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', String(PAGE_SIZE));
    params.set('sort', sort.key);
    params.set('dir', sort.direction);
    if (statusFilter) params.set('status', statusFilter);
    if (siteFilter) params.set('siteName', siteFilter);
    if (search) params.set('q', search);
    return `/api/hse/incidents?${params.toString()}`;
  }, [page, sort.key, sort.direction, statusFilter, siteFilter, search]);

  const incidentsQuery = useApiResource<IncidentsResponse>(
    [INCIDENTS_KEY, { page, pageSize: PAGE_SIZE, sort: sort.key, dir: sort.direction, statusFilter, siteFilter, search }],
    incidentsUrl,
    { placeholderData: (prev) => prev },
  );

  const summaryQuery = useApiResource<AnalyticsResponse>([SUMMARY_KEY], '/api/hse/summary?months=12');

  const actionsQuery = useApiResource<{ actions: ActionRow[] }>(
    [ACTIONS_KEY],
    '/api/hse/actions',
    { enabled: tab === 'actions' },
  );

  const staffQuery = useApiResource<StaffResponse>([INCIDENT_KEY, 'staff'], '/api/hse/staff');

  const detailQuery = useApiResource<{ incident: IncidentDetail }>(
    [INCIDENT_KEY, detailId],
    `/api/hse/incidents/${detailId}`,
    { enabled: !!detailId },
  );

  const incidents = incidentsQuery.data?.items ?? [];
  const total = incidentsQuery.data?.total ?? 0;
  const summary = incidentsQuery.data?.summary ?? {
    openCount: 0,
    followUpCount: 0,
    resolvedThisMonth: 0,
    nearMissCount: 0,
    daysSinceLast: null,
  };

  const staffOptions = useMemo(
    () => [
      { value: '', label: 'Unassigned' },
      ...(staffQuery.data?.staff ?? []).map((s) => ({ value: s.id, label: s.name })),
    ],
    [staffQuery.data],
  );

  const siteOptions = useMemo(() => {
    const sites = new Set<string>();
    for (const i of incidents) {
      const label = i.siteName || i.location;
      if (label) sites.add(label);
    }
    return [...sites].sort();
  }, [incidents]);

  const invalidateAll = [[INCIDENTS_KEY], [SUMMARY_KEY], [ACTIONS_KEY], [INCIDENT_KEY]] as const;

  const listStatus = incidentsQuery.isLoading
    ? 'loading'
    : incidentsQuery.isError
      ? 'error'
      : incidents.length
        ? 'success'
        : 'empty';

  const exportParams = useMemo(() => {
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (siteFilter) params.set('siteName', siteFilter);
    if (search) params.set('q', search);
    return params.toString();
  }, [statusFilter, siteFilter, search]);

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="HSE & Incident Management"
        icon={Shield}
        description="Log, investigate, and resolve safety incidents across sites."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ExportButton
              options={[
                {
                  format: 'csv',
                  label: 'Export CSV',
                  href: `/api/hse/incidents/export?format=csv${exportParams ? `&${exportParams}` : ''}`,
                },
                {
                  format: 'xlsx',
                  label: 'Export Excel',
                  href: `/api/hse/incidents/export?format=xlsx${exportParams ? `&${exportParams}` : ''}`,
                },
              ]}
            />
            <button
              type="button"
              className="btn-primary inline-flex items-center gap-2"
              onClick={() => setShowLogForm(true)}
            >
              <Plus className="h-4 w-4" />
              Log incident
            </button>
          </div>
        }
      />

      <EntityContextBanner />

      {summary.followUpCount > 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-amber-200/70 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span className="font-medium">
            {summary.followUpCount} incident{summary.followUpCount === 1 ? '' : 's'} require follow-up
          </span>
        </div>
      ) : null}

      <DashboardStatGrid>
        <DashboardStatCard label="Open incidents" value={summary.openCount} tone="warning" warn={summary.openCount > 0} />
        <DashboardStatCard label="Resolved this month" value={summary.resolvedThisMonth} tone="success" />
        <DashboardStatCard label="Near misses logged" value={summary.nearMissCount} tone="violet" />
        <DashboardStatCard label="Days since last incident" value={summary.daysSinceLast ?? '—'} tone="primary" />
      </DashboardStatGrid>

      <AnalyticsStrip query={summaryQuery} />

      <DashboardTabs
        value={tab}
        onChange={setTab}
        items={[
          { value: 'incidents', label: 'Incidents', icon: Shield },
          { value: 'actions', label: 'Follow-up actions', icon: ListTodo },
        ]}
      />

      {tab === 'incidents' ? (
        <DashboardTableCard>
          <DashboardTableToolbar label={null}>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-[220px] flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
                <DashboardTableSearchInput
                  value={searchInput}
                  onChange={setSearchInput}
                  placeholder="Search ref #, title, site…"
                />
              </div>
              <StrideSelect
                value={statusFilter}
                onChange={setStatusFilter}
                options={[
                  { value: '', label: 'All statuses' },
                  { value: 'open', label: 'Open' },
                  { value: 'investigating', label: 'Investigating' },
                  { value: 'resolved', label: 'Resolved' },
                  { value: 'closed', label: 'Closed' },
                ]}
                ariaLabel="Status"
                className="w-full sm:w-48"
              />
              <StrideSelect
                value={siteFilter}
                onChange={setSiteFilter}
                options={[
                  { value: '', label: 'All sites' },
                  ...siteOptions.map((s) => ({ value: s, label: s })),
                ]}
                ariaLabel="Site"
                className="w-full sm:w-48"
              />
            </div>
          </DashboardTableToolbar>

          <DashboardAsyncState
            status={listStatus}
            error={incidentsQuery.error?.message}
            onRetry={() => void incidentsQuery.refetch()}
            loading={<DashboardInlineLoading label="Loading incidents…" />}
            empty={
              <DashboardTableEmpty
                icon={<Shield className="h-8 w-8 text-neutral-300" aria-hidden />}
                title="No incidents found"
                description="Log an incident when a hazard or event occurs on site."
              />
            }
          >
            <DashboardTableViewport minWidth={1000}>
              <DashboardTable>
                <thead>
                  <tr>
                    <SortableHeader label="Ref #" sortKey="incidentNumber" sort={sort} getSortDirection={getSortDirection} onSort={toggleSort} />
                    <SortableHeader label="Date" sortKey="occurredAt" align="center" sort={sort} getSortDirection={getSortDirection} onSort={toggleSort} />
                    <SortableHeader label="Site" sortKey="siteName" sort={sort} getSortDirection={getSortDirection} onSort={toggleSort} />
                    <SortableHeader label="Type" sortKey="incidentType" sort={sort} getSortDirection={getSortDirection} onSort={toggleSort} />
                    <SortableHeader label="Severity" sortKey="severity" align="center" sort={sort} getSortDirection={getSortDirection} onSort={toggleSort} />
                    <th>Reported by</th>
                    <SortableHeader label="Status" sortKey="status" align="center" sort={sort} getSortDirection={getSortDirection} onSort={toggleSort} />
                    <th className="col-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {incidents.map((row) => (
                    <tr key={row.id} className="hover:bg-neutral-50/60">
                      <td className="font-medium text-neutral-900">{row.incidentNumber}</td>
                      <td className="col-center tabular-nums">{formatDateTime(row.occurredAt)}</td>
                      <td>{row.siteName || row.location || '—'}</td>
                      <td>{row.incidentTypeLabel}</td>
                      <td className="col-center">
                        <span className={dashStatusChip(severityTone(row.severity))}>{row.severityLabel}</span>
                      </td>
                      <td>{row.reportedBy ?? '—'}</td>
                      <td className="col-center">
                        <span className={dashStatusChip(incidentStatusTone(row.status))}>{row.statusLabel}</span>
                      </td>
                      <td className="col-right">
                        <button
                          type="button"
                          className="btn-secondary px-3 py-1.5 text-xs"
                          onClick={() => setDetailId(row.id)}
                        >
                          Investigate
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </DashboardTable>
            </DashboardTableViewport>
            <DashboardPagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={setPage}
              itemLabel="incidents"
            />
          </DashboardAsyncState>
        </DashboardTableCard>
      ) : (
        <ActionsTab
          query={actionsQuery}
          staffOptions={staffOptions}
          invalidateKeys={invalidateAll}
          onOpenIncident={setDetailId}
        />
      )}

      <LogIncidentModal
        open={showLogForm}
        onClose={() => setShowLogForm(false)}
        invalidateKeys={invalidateAll}
      />

      <IncidentDrawer
        detailId={detailId}
        onClose={() => setDetailId(null)}
        detail={detailQuery.data?.incident ?? null}
        isLoading={detailQuery.isLoading}
        staffOptions={staffOptions}
        invalidateKeys={invalidateAll}
      />
    </DashboardPage>
  );
}

function SortableHeader({
  label,
  sortKey,
  align,
  getSortDirection,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  align?: 'center' | 'right';
  sort: { key: SortKey; direction: 'asc' | 'desc' };
  getSortDirection: (key: SortKey) => 'asc' | 'desc' | null;
  onSort: (key: SortKey) => void;
}) {
  const dir = getSortDirection(sortKey);
  const alignClass = align === 'center' ? 'col-center' : align === 'right' ? 'col-right' : '';
  return (
    <th className={alignClass}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className="inline-flex items-center gap-1 font-semibold hover:text-primary-700"
      >
        {label}
        {dir === 'asc' ? (
          <ArrowUp className="h-3.5 w-3.5" />
        ) : dir === 'desc' ? (
          <ArrowDown className="h-3.5 w-3.5" />
        ) : (
          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />
        )}
      </button>
    </th>
  );
}

function AnalyticsStrip({
  query,
}: {
  query: ReturnType<typeof useApiResource<AnalyticsResponse>>;
}) {
  const data = query.data;
  const hasData =
    !!data &&
    (data.bySeverity.some((d) => d.count > 0) ||
      data.byType.some((d) => d.count > 0) ||
      data.monthlyTrend.some((d) => d.count > 0));

  if (query.isLoading) {
    return <DashboardInlineLoading label="Loading analytics…" />;
  }
  if (!hasData) return null;

  return (
    <div className="grid gap-3 lg:grid-cols-3">
      <ChartCard title="Incidents by severity">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data!.bySeverity} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="label" tick={{ fontSize: 11 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
              {data!.bySeverity.map((entry) => (
                <Cell key={entry.key} fill={SEVERITY_COLORS[entry.key] ?? '#38bdf8'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="Incidents by type">
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data!.byType} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-12} textAnchor="end" height={44} />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
            <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title="12-month trend">
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={data!.monthlyTrend} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis dataKey="label" tick={{ fontSize: 10 }} interval="preserveStartEnd" />
            <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Line type="monotone" dataKey="count" stroke="#0ea5e9" strokeWidth={2} dot={{ r: 2 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 shadow-sm">
      <h3 className="mb-2 text-sm font-semibold text-neutral-800">{title}</h3>
      {children}
    </div>
  );
}

function LogIncidentModal({
  open,
  onClose,
  invalidateKeys,
}: {
  open: boolean;
  onClose: () => void;
  invalidateKeys: readonly (readonly unknown[])[];
}) {
  const [form, setForm] = useState({
    title: '',
    description: '',
    incidentType: 'other',
    severity: 'medium',
    siteName: '',
    location: '',
    occurredAt: '',
    immediateAction: '',
    injuredParty: '',
    witnessNames: '',
    reportableToAuthority: false,
    lostTimeInjury: false,
  });

  useEffect(() => {
    if (open) {
      setForm({
        title: '',
        description: '',
        incidentType: 'other',
        severity: 'medium',
        siteName: '',
        location: '',
        occurredAt: '',
        immediateAction: '',
        injuredParty: '',
        witnessNames: '',
        reportableToAuthority: false,
        lostTimeInjury: false,
      });
    }
  }, [open]);

  const createMutation = useApiMutation(
    (body: Record<string, unknown>) =>
      apiFetch<{ incident: IncidentRow }>('/api/hse/incidents', {
        method: 'POST',
        body: JSON.stringify(body),
      }),
    {
      invalidateKeys,
      onSuccess: (data) => {
        toast.success(`Incident ${data.incident?.incidentNumber ?? ''} logged.`);
        onClose();
      },
      onError: (err) => toast.error(err.message),
    },
  );

  const submit = () => {
    if (!form.title.trim() || !form.description.trim()) {
      toast.error('Title and description are required.');
      return;
    }
    createMutation.mutate({
      title: form.title.trim(),
      description: form.description.trim(),
      incidentType: form.incidentType,
      severity: form.severity,
      siteName: form.siteName.trim() || undefined,
      location: form.location.trim() || undefined,
      occurredAt: form.occurredAt || new Date().toISOString(),
      immediateAction: form.immediateAction.trim() || undefined,
      injuredParty: form.injuredParty.trim() || undefined,
      witnessNames: form.witnessNames.trim() || undefined,
      reportableToAuthority: form.reportableToAuthority,
      lostTimeInjury: form.lostTimeInjury,
    });
  };

  return (
    <DashboardModal
      open={open}
      onClose={onClose}
      title="Log incident"
      icon={<Shield className="h-5 w-5" />}
      size="lg"
      dismissible={!createMutation.isPending}
      footer={
        <>
          <button type="button" className="btn-secondary" onClick={onClose} disabled={createMutation.isPending}>
            Cancel
          </button>
          <button
            type="button"
            className="btn-primary inline-flex items-center gap-2"
            onClick={submit}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Submit
          </button>
        </>
      }
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Title *" className="sm:col-span-2">
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            className={INPUT}
            placeholder="Short title"
          />
        </Field>
        <Field label="Type">
          <StrideSelect
            value={form.incidentType}
            onChange={(v) => setForm((f) => ({ ...f, incidentType: v }))}
            options={INCIDENT_TYPES}
            ariaLabel="Incident type"
            className="w-full"
          />
        </Field>
        <Field label="Severity">
          <StrideSelect
            value={form.severity}
            onChange={(v) => setForm((f) => ({ ...f, severity: v }))}
            options={SEVERITY_OPTIONS}
            ariaLabel="Severity"
            className="w-full"
          />
        </Field>
        <Field label="Occurred at">
          <input
            type="datetime-local"
            value={form.occurredAt}
            onChange={(e) => setForm((f) => ({ ...f, occurredAt: e.target.value }))}
            className={INPUT}
          />
        </Field>
        <Field label="Site">
          <input
            value={form.siteName}
            onChange={(e) => setForm((f) => ({ ...f, siteName: e.target.value }))}
            className={INPUT}
            placeholder="Site name"
          />
        </Field>
        <Field label="Location" className="sm:col-span-2">
          <input
            value={form.location}
            onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
            className={INPUT}
            placeholder="Specific location (optional)"
          />
        </Field>
        <Field label="Description *" className="sm:col-span-2">
          <textarea
            rows={3}
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
            className={INPUT}
            placeholder="What happened?"
          />
        </Field>
        <Field label="Immediate action taken" className="sm:col-span-2">
          <textarea
            rows={2}
            value={form.immediateAction}
            onChange={(e) => setForm((f) => ({ ...f, immediateAction: e.target.value }))}
            className={INPUT}
          />
        </Field>
        <Field label="Injured party">
          <input
            value={form.injuredParty}
            onChange={(e) => setForm((f) => ({ ...f, injuredParty: e.target.value }))}
            className={INPUT}
          />
        </Field>
        <Field label="Witnesses">
          <input
            value={form.witnessNames}
            onChange={(e) => setForm((f) => ({ ...f, witnessNames: e.target.value }))}
            className={INPUT}
            placeholder="Comma separated"
          />
        </Field>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={form.reportableToAuthority}
            onChange={(e) => setForm((f) => ({ ...f, reportableToAuthority: e.target.checked }))}
          />
          Reportable to authority
        </label>
        <label className="flex items-center gap-2 text-sm text-neutral-700">
          <input
            type="checkbox"
            checked={form.lostTimeInjury}
            onChange={(e) => setForm((f) => ({ ...f, lostTimeInjury: e.target.checked }))}
          />
          Lost-time injury
        </label>
      </div>
    </DashboardModal>
  );
}

function Field({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className ?? ''}`}>
      <span className="text-xs font-medium text-neutral-600">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function ActionsTab({
  query,
  staffOptions,
  invalidateKeys,
  onOpenIncident,
}: {
  query: ReturnType<typeof useApiResource<{ actions: ActionRow[] }>>;
  staffOptions: { value: string; label: string }[];
  invalidateKeys: readonly (readonly unknown[])[];
  onOpenIncident: (id: string) => void;
}) {
  const actions = query.data?.actions ?? [];
  const status = query.isLoading ? 'loading' : query.isError ? 'error' : actions.length ? 'success' : 'empty';

  const updateMutation = useApiMutation(
    ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiFetch(`/api/hse/actions/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    {
      invalidateKeys,
      onError: (err) => toast.error(err.message),
    },
  );

  return (
    <DashboardTableCard>
      <DashboardAsyncState
        status={status}
        error={query.error?.message}
        onRetry={() => void query.refetch()}
        loading={<DashboardInlineLoading label="Loading actions…" />}
        empty={
          <DashboardTableEmpty
            icon={<ListTodo className="h-8 w-8 text-neutral-300" aria-hidden />}
            title="No follow-up actions"
            description="Corrective actions created during investigations appear here."
          />
        }
      >
        <DashboardTableViewport minWidth={900}>
          <DashboardTable>
            <thead>
              <tr>
                <th>Action</th>
                <th>Incident</th>
                <th>Assignee</th>
                <th className="col-center">Due</th>
                <th className="col-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {actions.map((row) => (
                <tr key={row.id} className="hover:bg-neutral-50/60">
                  <td className="font-medium">{row.title}</td>
                  <td>
                    <button
                      type="button"
                      className="text-primary-700 hover:underline"
                      onClick={() => onOpenIncident(row.incident.id)}
                    >
                      {row.incident.incidentNumber}
                    </button>
                  </td>
                  <td>
                    <StrideSelect
                      value={row.assignee?.id ?? ''}
                      onChange={(v) => updateMutation.mutate({ id: row.id, body: { assigneeUserId: v || null } })}
                      options={staffOptions}
                      ariaLabel="Assignee"
                      className="w-40"
                    />
                  </td>
                  <td className="col-center tabular-nums">{row.dueDate ?? '—'}</td>
                  <td className="col-center">
                    <StrideSelect
                      value={row.status}
                      onChange={(v) => updateMutation.mutate({ id: row.id, body: { status: v } })}
                      options={ACTION_STATUS_OPTIONS}
                      ariaLabel="Status"
                      className="w-36"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </DashboardTable>
        </DashboardTableViewport>
      </DashboardAsyncState>
    </DashboardTableCard>
  );
}

function IncidentDrawer({
  detailId,
  onClose,
  detail,
  isLoading,
  staffOptions,
  invalidateKeys,
}: {
  detailId: string | null;
  onClose: () => void;
  detail: IncidentDetail | null;
  isLoading: boolean;
  staffOptions: { value: string; label: string }[];
  invalidateKeys: readonly (readonly unknown[])[];
}) {
  const [investigation, setInvestigation] = useState({
    rootCauseCategory: '',
    rootCause: '',
    witnessNames: '',
    reportableToAuthority: false,
    lostTimeInjury: false,
    lostTimeDays: '',
  });
  const [newActionTitle, setNewActionTitle] = useState('');
  const [newActionAssignee, setNewActionAssignee] = useState('');
  const [newActionDue, setNewActionDue] = useState('');
  const [pendingDelete, setPendingDelete] = useState<Attachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const syncedFor = useRef<string | null>(null);

  useEffect(() => {
    if (detail && syncedFor.current !== detail.id) {
      syncedFor.current = detail.id;
      setInvestigation({
        rootCauseCategory: detail.rootCauseCategory ?? '',
        rootCause: detail.rootCause ?? '',
        witnessNames: detail.witnessNames ?? '',
        reportableToAuthority: detail.reportableToAuthority,
        lostTimeInjury: detail.lostTimeInjury,
        lostTimeDays: detail.lostTimeDays != null ? String(detail.lostTimeDays) : '',
      });
    }
    if (!detailId) syncedFor.current = null;
  }, [detail, detailId]);

  const patchIncident = useApiMutation(
    (body: Record<string, unknown>) =>
      apiFetch(`/api/hse/incidents/${detailId}`, { method: 'PATCH', body: JSON.stringify(body) }),
    {
      invalidateKeys,
      onError: (err) => toast.error(err.message),
    },
  );

  const createAction = useApiMutation(
    (body: Record<string, unknown>) =>
      apiFetch('/api/hse/actions', { method: 'POST', body: JSON.stringify(body) }),
    {
      invalidateKeys,
      onSuccess: () => {
        toast.success('Corrective action added.');
        setNewActionTitle('');
        setNewActionAssignee('');
        setNewActionDue('');
      },
      onError: (err) => toast.error(err.message),
    },
  );

  const updateAction = useApiMutation(
    ({ id, body }: { id: string; body: Record<string, unknown> }) =>
      apiFetch(`/api/hse/actions/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
    { invalidateKeys, onError: (err) => toast.error(err.message) },
  );

  const deleteAttachment = useApiMutation(
    (attachmentId: string) =>
      apiFetch(`/api/hse/incidents/${detailId}/attachments/${attachmentId}`, { method: 'DELETE' }),
    {
      invalidateKeys,
      onSuccess: () => {
        toast.success('Evidence removed.');
        setPendingDelete(null);
      },
      onError: (err) => toast.error(err.message),
    },
  );

  const uploadAttachment = useApiMutation(
    async (file: File) => {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', file.type.startsWith('image/') ? 'photo' : 'evidence');
      const res = await fetch(`/api/hse/incidents/${detailId}/attachments`, {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body.error || 'Upload failed');
      return body;
    },
    {
      invalidateKeys,
      onSuccess: () => toast.success('Evidence uploaded.'),
      onError: (err) => toast.error(err instanceof Error ? err.message : 'Upload failed'),
    },
  );

  const saveInvestigation = () => {
    patchIncident.mutate(
      {
        rootCauseCategory: investigation.rootCauseCategory || null,
        rootCause: investigation.rootCause,
        witnessNames: investigation.witnessNames,
        reportableToAuthority: investigation.reportableToAuthority,
        lostTimeInjury: investigation.lostTimeInjury,
        lostTimeDays: investigation.lostTimeDays.trim() ? Number(investigation.lostTimeDays) : null,
      },
      { onSuccess: () => toast.success('Investigation saved.') },
    );
  };

  const nextStatusButton = () => {
    if (!detail) return null;
    if (detail.status === 'open') {
      return { label: 'Start investigation', status: 'investigating' };
    }
    if (detail.status === 'investigating') {
      return { label: 'Mark resolved', status: 'resolved' };
    }
    if (detail.status === 'resolved') {
      return { label: 'Close incident', status: 'closed' };
    }
    return null;
  };

  const step = nextStatusButton();

  return (
    <>
      <DashboardDrawer
        open={!!detailId}
        onClose={onClose}
        eyebrow={detail?.incidentNumber}
        title={detail?.title ?? 'Incident'}
        icon={<Shield className="h-5 w-5" />}
        width="lg"
        headerAside={
          detail ? (
            <span className={dashStatusChip(incidentStatusTone(detail.status))}>{detail.statusLabel}</span>
          ) : null
        }
        footer={
          detail ? (
            <div className="flex w-full flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap gap-2">
                {step ? (
                  <button
                    type="button"
                    className="btn-primary inline-flex items-center gap-2 text-sm"
                    disabled={patchIncident.isPending}
                    onClick={() => patchIncident.mutate({ status: step.status }, { onSuccess: () => toast.success('Incident updated.') })}
                  >
                    {patchIncident.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {step.label}
                  </button>
                ) : null}
                {detail.status !== 'open' && detail.status !== 'closed' ? (
                  <button
                    type="button"
                    className="btn-secondary text-sm"
                    disabled={patchIncident.isPending}
                    onClick={() => patchIncident.mutate({ status: 'open' }, { onSuccess: () => toast.success('Incident reopened.') })}
                  >
                    Reopen
                  </button>
                ) : null}
              </div>
              <button type="button" className="btn-secondary text-sm" onClick={onClose}>
                Close
              </button>
            </div>
          ) : null
        }
      >
        {isLoading && !detail ? (
          <DashboardInlineLoading label="Loading incident…" />
        ) : detail ? (
          <div className="space-y-6">
            <section className="grid grid-cols-2 gap-3 text-sm">
              <Meta label="Type" value={detail.incidentTypeLabel} />
              <Meta
                label="Severity"
                value={<span className={dashStatusChip(severityTone(detail.severity))}>{detail.severityLabel}</span>}
              />
              <Meta label="Occurred" value={formatDateTime(detail.occurredAt)} />
              <Meta label="Site" value={detail.siteName || detail.location || '—'} />
              <Meta label="Reported by" value={detail.reportedBy ?? '—'} />
              <Meta label="Open actions" value={String(detail.openActionCount)} />
            </section>

            <section>
              <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-neutral-500">Description</h4>
              <p className="whitespace-pre-wrap text-sm text-neutral-800">{detail.description}</p>
              {detail.immediateAction ? (
                <>
                  <h4 className="mb-1 mt-3 text-xs font-semibold uppercase tracking-wide text-neutral-500">
                    Immediate action
                  </h4>
                  <p className="whitespace-pre-wrap text-sm text-neutral-800">{detail.immediateAction}</p>
                </>
              ) : null}
            </section>

            {/* Investigation */}
            <section className="rounded-lg border border-neutral-200 p-4">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-900">
                <ClipboardList className="h-4 w-4" /> Root cause & investigation
              </h4>
              <div className="grid gap-3">
                <Field label="Root cause category">
                  <StrideSelect
                    value={investigation.rootCauseCategory}
                    onChange={(v) => setInvestigation((s) => ({ ...s, rootCauseCategory: v }))}
                    options={[{ value: '', label: 'Not set' }, ...ROOT_CAUSE_CATEGORIES]}
                    ariaLabel="Root cause category"
                    className="w-full"
                  />
                </Field>
                <Field label="Root cause narrative">
                  <textarea
                    rows={3}
                    value={investigation.rootCause}
                    onChange={(e) => setInvestigation((s) => ({ ...s, rootCause: e.target.value }))}
                    className={INPUT}
                    placeholder="What was the underlying cause?"
                  />
                </Field>
                <Field label="Witnesses">
                  <textarea
                    rows={2}
                    value={investigation.witnessNames}
                    onChange={(e) => setInvestigation((s) => ({ ...s, witnessNames: e.target.value }))}
                    className={INPUT}
                    placeholder="Names of witnesses"
                  />
                </Field>
                <div className="flex flex-wrap items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      checked={investigation.reportableToAuthority}
                      onChange={(e) => setInvestigation((s) => ({ ...s, reportableToAuthority: e.target.checked }))}
                    />
                    Reportable to authority
                  </label>
                  <label className="flex items-center gap-2 text-sm text-neutral-700">
                    <input
                      type="checkbox"
                      checked={investigation.lostTimeInjury}
                      onChange={(e) => setInvestigation((s) => ({ ...s, lostTimeInjury: e.target.checked }))}
                    />
                    Lost-time injury
                  </label>
                  {investigation.lostTimeInjury ? (
                    <label className="flex items-center gap-2 text-sm text-neutral-700">
                      Lost days
                      <input
                        type="number"
                        min={0}
                        value={investigation.lostTimeDays}
                        onChange={(e) => setInvestigation((s) => ({ ...s, lostTimeDays: e.target.value }))}
                        className={`${INPUT} w-20`}
                      />
                    </label>
                  ) : null}
                </div>
                <div>
                  <button
                    type="button"
                    className="btn-secondary inline-flex items-center gap-2 text-sm"
                    onClick={saveInvestigation}
                    disabled={patchIncident.isPending}
                  >
                    {patchIncident.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Save investigation
                  </button>
                </div>
              </div>
            </section>

            {/* Evidence */}
            <section className="rounded-lg border border-neutral-200 p-4">
              <div className="mb-3 flex items-center justify-between">
                <h4 className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
                  <Paperclip className="h-4 w-4" /> Evidence ({detail.attachments.length})
                </h4>
                <button
                  type="button"
                  className="btn-secondary inline-flex items-center gap-2 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadAttachment.isPending}
                >
                  {uploadAttachment.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  Upload
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf,image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) uploadAttachment.mutate(file);
                    e.target.value = '';
                  }}
                />
              </div>
              {detail.attachments.length ? (
                <ul className="space-y-2">
                  {detail.attachments.map((att) => (
                    <li
                      key={att.id}
                      className="flex items-center justify-between gap-3 rounded-md bg-neutral-50 px-3 py-2 text-sm"
                    >
                      <a
                        href={att.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-w-0 items-center gap-2 text-primary-700 hover:underline"
                      >
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="truncate">{att.fileName}</span>
                        {att.fileSize ? (
                          <span className="shrink-0 text-xs text-neutral-400">{formatBytes(att.fileSize)}</span>
                        ) : null}
                      </a>
                      <button
                        type="button"
                        className="rounded-md p-1.5 text-neutral-400 hover:bg-red-50 hover:text-red-600"
                        onClick={() => setPendingDelete(att)}
                        aria-label="Delete evidence"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-neutral-500">No evidence attached yet.</p>
              )}
            </section>

            {/* CAPA */}
            <section className="rounded-lg border border-neutral-200 p-4">
              <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-900">
                <ListTodo className="h-4 w-4" /> Corrective actions (CAPA)
              </h4>
              {detail.actions.length ? (
                <ul className="space-y-3">
                  {detail.actions.map((action) => (
                    <li key={action.id} className="rounded-md border border-neutral-100 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium text-neutral-900">{action.title}</p>
                        <span className={dashStatusChip(actionStatusTone(action.status))}>{action.statusLabel}</span>
                      </div>
                      <div className="mt-2 grid gap-2 sm:grid-cols-3">
                        <StrideSelect
                          value={action.assignee?.id ?? ''}
                          onChange={(v) => updateAction.mutate({ id: action.id, body: { assigneeUserId: v || null } })}
                          options={staffOptions}
                          ariaLabel="Assignee"
                          className="w-full"
                        />
                        <input
                          type="date"
                          defaultValue={action.dueDate ?? ''}
                          onChange={(e) => updateAction.mutate({ id: action.id, body: { dueDate: e.target.value || null } })}
                          className={INPUT}
                        />
                        <StrideSelect
                          value={action.status}
                          onChange={(v) => updateAction.mutate({ id: action.id, body: { status: v } })}
                          options={ACTION_STATUS_OPTIONS}
                          ariaLabel="Status"
                          className="w-full"
                        />
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-neutral-500">No corrective actions yet.</p>
              )}

              <div className="mt-4 grid gap-2 border-t border-neutral-100 pt-4 sm:grid-cols-[1fr_auto_auto_auto]">
                <input
                  value={newActionTitle}
                  onChange={(e) => setNewActionTitle(e.target.value)}
                  placeholder="New corrective action"
                  className={INPUT}
                />
                <StrideSelect
                  value={newActionAssignee}
                  onChange={setNewActionAssignee}
                  options={staffOptions}
                  ariaLabel="Assignee"
                  className="w-full sm:w-40"
                />
                <input
                  type="date"
                  value={newActionDue}
                  onChange={(e) => setNewActionDue(e.target.value)}
                  className={INPUT}
                />
                <button
                  type="button"
                  className="btn-secondary inline-flex items-center gap-2 whitespace-nowrap text-sm"
                  disabled={!newActionTitle.trim() || createAction.isPending}
                  onClick={() =>
                    createAction.mutate({
                      incidentId: detailId,
                      title: newActionTitle.trim(),
                      assigneeUserId: newActionAssignee || undefined,
                      dueDate: newActionDue || undefined,
                    })
                  }
                >
                  {createAction.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Add
                </button>
              </div>
            </section>
          </div>
        ) : null}
      </DashboardDrawer>

      <ConfirmDialog
        open={!!pendingDelete}
        title="Delete evidence"
        description={pendingDelete ? `Remove “${pendingDelete.fileName}”? This cannot be undone.` : ''}
        confirmLabel="Delete"
        tone="danger"
        loading={deleteAttachment.isPending}
        onConfirm={() => pendingDelete && deleteAttachment.mutate(pendingDelete.id)}
        onCancel={() => setPendingDelete(null)}
      />
    </>
  );
}

function Meta({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">{label}</p>
      <p className="mt-0.5 text-neutral-800">{value}</p>
    </div>
  );
}
