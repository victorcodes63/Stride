'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowUp, Search, TrendingUp } from 'lucide-react';
import { useEntity } from '@/components/EntitySwitcher';
import { EntityContextBanner } from '@/components/EntityContextBanner';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import {
 DashboardTableActionButton,
 DashboardTableActions,
 DashboardTableCard,
 DashboardTableCell,
 DashboardTableEmpty,
 DashboardTableHead,
 DashboardTableMeta,
 DashboardTableSearchInput,
 DashboardTableToolbar,
 DashboardTableViewport,
 DashboardTable,
 dashboardTableSelectClass,
} from '@/components/dashboard/DashboardDataTable';
import { stationBelongsToEntity, type EntityId } from '@/lib/entityConfig';
import { toast } from '@/components/ui/toast';

type ReviewStatus = 'Exceeds' | 'On Track' | 'Needs Improvement' | 'Not Reviewed';

type EmployeeKpiRow = {
 id: string;
 name: string;
 station: string;
 role: string;
 department: string;
 throughput: number;
 attendancePct: number;
 customerScore: number;
 overall: number;
 status: ReviewStatus;
};

const REVIEW_PERIODS = ['Q1 2025', 'Q2 2025', 'Q3 2025', 'Q4 2025'] as const;

const DEMO_EMPLOYEES: EmployeeKpiRow[] = [
 {
 id: '1',
 name: 'James Okello',
 station: 'Kampala Office',
 role: 'Operations Associate',
 department: 'Operations',
 throughput: 92,
 attendancePct: 98,
 customerScore: 4.8,
 overall: 91,
 status: 'Exceeds',
 },
 {
 id: '2',
 name: 'Mary Namukasa',
 station: 'Entebbe Hub',
 role: 'Operations Associate',
 department: 'Operations',
 throughput: 78,
 attendancePct: 94,
 customerScore: 4.2,
 overall: 82,
 status: 'On Track',
 },
 {
 id: '3',
 name: 'Peter Wanjala',
 station: 'Nairobi Office',
 role: 'Logistics Coordinator',
 department: 'Logistics',
 throughput: 88,
 attendancePct: 99,
 customerScore: 4.5,
 overall: 88,
 status: 'Exceeds',
 },
 {
 id: '4',
 name: 'Grace Akinyi',
 station: 'Mombasa Site',
 role: 'Sales Representative',
 department: 'Sales',
 throughput: 64,
 attendancePct: 86,
 customerScore: 3.9,
 overall: 71,
 status: 'Needs Improvement',
 },
 {
 id: '5',
 name: 'Ibrahim Ssemwogerere',
 station: 'Kampala Office',
 role: 'Operations Associate',
 department: 'Operations',
 throughput: 81,
 attendancePct: 91,
 customerScore: 4.4,
 overall: 84,
 status: 'On Track',
 },
 {
 id: '6',
 name: 'Diana Mutai',
 station: 'Nairobi Office',
 role: 'Team Supervisor',
 department: 'Operations',
 throughput: 90,
 attendancePct: 97,
 customerScore: 4.7,
 overall: 90,
 status: 'Exceeds',
 },
 {
 id: '7',
 name: 'Robert Kato',
 station: 'Entebbe Hub',
 role: 'Operations Associate',
 department: 'Operations',
 throughput: 0,
 attendancePct: 0,
 customerScore: 0,
 overall: 0,
 status: 'Not Reviewed',
 },
 {
 id: '8',
 name: 'Esther Mwikali',
 station: 'Mombasa Site',
 role: 'Warehouse Staff',
 department: 'Logistics',
 throughput: 55,
 attendancePct: 82,
 customerScore: 3.6,
 overall: 63,
 status: 'Needs Improvement',
 },
];

const STATION_LEADERBOARD = [
 { name: 'Kampala Office', score: 94 },
 { name: 'Nairobi Office', score: 89 },
 { name: 'Entebbe Hub', score: 84 },
 { name: 'Mombasa Site', score: 71 },
 { name: 'Jinja Site', score: 68 },
];

const UPCOMING_REVIEWS = [
 { name: 'Robert Kato', station: 'Entebbe Hub', due: '2026-05-12' },
 { name: 'Esther Mwikali', station: 'Mombasa Site', due: '2026-05-14' },
 { name: 'Grace Akinyi', station: 'Mombasa Site', due: '2026-05-18' },
];

const PAST_REVIEWS: Record<string, { period: string; score: number; reviewer: string }[]> = {
 default: [
 { period: 'Q4 2024', score: 86, reviewer: 'Patience N. (HR BP)' },
 { period: 'Q3 2024', score: 82, reviewer: 'Patience N. (HR BP)' },
 ],
};

function statusBadgeClass(status: ReviewStatus) {
 switch (status) {
 case 'Exceeds':
 return 'bg-green-100 text-green-800';
 case 'On Track':
 return 'bg-amber-100 text-amber-900';
 case 'Needs Improvement':
 return 'bg-red-100 text-red-800';
 default:
 return 'bg-neutral-100 text-neutral-600';
 }
}

function KpiBarChartSvg(props: { throughput: number; attendance: number; complaints: number; compliance: number }) {
 const { throughput, attendance, complaints, compliance } = props;
 const max = 100;
 const w = 280;
 const h = 160;
 const barW = 48;
 const gap = 16;
 const baseY = h - 24;
 const scale = (v: number) => (v / max) * (h - 40);
 const bars = [
 { label: 'Throughput', value: throughput, x: 20 },
 { label: 'Attendance', value: attendance, x: 20 + barW + gap },
 { label: 'Complaints', value: complaints, x: 20 + 2 * (barW + gap) },
 { label: 'Compliance', value: compliance, x: 20 + 3 * (barW + gap) },
 ];
 return (
 <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-[320px] h-auto" aria-hidden>
 {bars.map((b) => {
 const bh = scale(b.value);
 return (
 <g key={b.label}>
 <rect
 x={b.x}
 y={baseY - bh}
 width={barW}
 height={Math.max(bh, 2)}
 rx={4}
 className="fill-amber-400"
 />
 <text x={b.x + barW / 2} y={h - 4} textAnchor="middle" className="fill-neutral-600 text-[10px] font-medium">
 {b.label.split(' ')[0]}
 </text>
 </g>
 );
 })}
 </svg>
 );
}

export default function PerformanceManagementPage() {
 const { activeEntity } = useEntity();
 const entityId = activeEntity.id as EntityId;

 const [search, setSearch] = useState('');
 const [department, setDepartment] = useState('');
 const [station, setStation] = useState('');
 const [period, setPeriod] = useState<(typeof REVIEW_PERIODS)[number]>('Q2 2025');
 const [viewEmployee, setViewEmployee] = useState<EmployeeKpiRow | null>(null);
 const [reviewEmployee, setReviewEmployee] = useState<EmployeeKpiRow | null>(null);
 const [reviewForm, setReviewForm] = useState({
 reviewPeriod: 'Q2 2025',
 throughput: 75,
 attendance: 75,
 complaints: 75,
 compliance: 75,
 comments: '',
 });

 const entityEmployees = useMemo(
 () => DEMO_EMPLOYEES.filter((e) => stationBelongsToEntity(e.station, entityId)),
 [entityId],
 );

 const departments = useMemo(() => {
 const s = new Set(entityEmployees.map((e) => e.department));
 return [...s].sort();
 }, [entityEmployees]);
 const stations = useMemo(() => {
 const s = new Set(entityEmployees.map((e) => e.station));
 return [...s].sort();
 }, [entityEmployees]);

 useEffect(() => {
 if (department && !departments.includes(department)) setDepartment('');
 }, [department, departments]);
 useEffect(() => {
 if (station && !stations.includes(station)) setStation('');
 }, [station, stations]);

 const filteredRows = useMemo(() => {
 return entityEmployees.filter((row) => {
 const q = search.trim().toLowerCase();
 if (q && !row.name.toLowerCase().includes(q) && !row.role.toLowerCase().includes(q)) return false;
 if (department && row.department !== department) return false;
 if (station && row.station !== station) return false;
 return true;
 });
 }, [search, department, station, entityEmployees]);

 const leaderboardForEntity = useMemo(
 () => STATION_LEADERBOARD.filter((s) => stationBelongsToEntity(s.name, entityId)),
 [entityId],
 );
 const upcomingForEntity = useMemo(
 () => UPCOMING_REVIEWS.filter((u) => stationBelongsToEntity(u.station, entityId)),
 [entityId],
 );

 const reviewsDue = entityEmployees.filter((e) => e.status === 'Not Reviewed' || e.status === 'Needs Improvement').length;
 const reviewedEmployees = entityEmployees.filter((e) => e.status !== 'Not Reviewed');
 const avgTeamScore =
 reviewedEmployees.length === 0
 ? 0
 : Math.round(reviewedEmployees.reduce((a, e) => a + e.overall, 0) / reviewedEmployees.length);
 const overdueAppraisals = entityEmployees.filter((e) => e.status === 'Not Reviewed').length;
 const topStation = leaderboardForEntity[0]?.name ?? '—';

 const openStartReview = (row: EmployeeKpiRow) => {
 setReviewForm((f) => ({ ...f, reviewPeriod: period }));
 setReviewEmployee(row);
 };

 const submitReview = (e: React.FormEvent) => {
 e.preventDefault();
 setReviewEmployee(null);
 toast.success('Review submitted successfully');
 };

 return (
 <DashboardPage>
 <DashboardPageHeader
 title="Performance Management"
 description="Track KPIs, appraisals and team scores by site"
 />

 <EntityContextBanner />

 {/* Summary KPIs — single visual band */}
 <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
 <article className="flex min-h-[108px] flex-col justify-between dashboard-stat-card shadow-sm">
 <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Reviews due</p>
 <div className="flex items-end justify-between gap-2">
 <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-amber-100 text-base font-semibold text-amber-950 tabular-nums">
 {reviewsDue}
 </span>
 </div>
 </article>
 <article className="flex min-h-[108px] flex-col justify-between dashboard-stat-card shadow-sm">
 <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Avg team score</p>
 <div className="flex flex-wrap items-end gap-2">
 <p className="text-3xl font-semibold leading-none tracking-tight text-ink tabular-nums">{avgTeamScore}%</p>
 <span className="mb-0.5 inline-flex items-center gap-0.5 text-xs font-semibold text-green-700">
 <ArrowUp className="h-3.5 w-3.5" aria-hidden />
 3%
 </span>
 </div>
 </article>
 <article className="flex min-h-[108px] flex-col justify-between dashboard-stat-card shadow-sm">
 <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Overdue appraisals</p>
 <span className="flex h-11 w-11 items-center justify-center rounded-full bg-red-100 text-base font-semibold text-red-800 tabular-nums">
 {overdueAppraisals}
 </span>
 </article>
 <article className="col-span-2 flex min-h-[108px] flex-col justify-between dashboard-stat-card shadow-sm lg:col-span-1">
 <p className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">Top site</p>
 <p className="truncate text-sm font-semibold leading-snug text-secondary-700">{topStation}</p>
 </article>
 </section>

 <div className="space-y-5 sm:space-y-6">
 {/* Station performance + upcoming reviews — above employee table, equal split */}
 <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-6">
 <div className="min-w-0 dashboard-stat-card shadow-sm sm:p-5">
 <h2 className="text-sm font-semibold text-ink">Site performance</h2>
 <p className="mt-0.5 text-xs text-neutral-500">Composite score by department / site</p>
 <ul className="mt-4 divide-y divide-neutral-100 border-t border-neutral-100">
 {leaderboardForEntity.map((s, idx) => {
 const isTop = idx === 0;
 return (
 <li key={s.name} className={`py-3 first:pt-3 ${isTop ? '-mx-1 rounded-lg bg-amber-50/90 px-3 ring-1 ring-amber-100' : ''}`}>
 <div className="flex items-center justify-between gap-2 text-sm">
 <span className={`min-w-0 truncate font-medium ${isTop ? 'text-amber-950' : 'text-neutral-800'}`}>{s.name}</span>
 <span className="shrink-0 tabular-nums text-xs font-medium text-neutral-600">{s.score}/100</span>
 </div>
 <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200/90">
 <div
 className={`h-full rounded-full ${isTop ? 'bg-amber-500' : 'bg-neutral-400'}`}
 style={{ width: `${s.score}%` }}
 />
 </div>
 </li>
 );
 })}
 </ul>
 </div>

 <div className="min-w-0 dashboard-stat-card shadow-sm sm:p-5">
 <h2 className="text-sm font-semibold text-ink">Upcoming reviews</h2>
 <p className="mt-0.5 text-xs text-neutral-500">Next appraisal deadlines</p>
 <ul className="mt-3 divide-y divide-neutral-100 border-t border-neutral-100">
 {upcomingForEntity.map((u) => (
 <li key={u.name} className="flex items-start justify-between gap-3 py-3 first:pt-3">
 <div className="min-w-0 text-sm">
 <p className="font-medium text-neutral-900">{u.name}</p>
 <p className="mt-0.5 text-xs text-neutral-500">{u.station}</p>
 <p className="text-xs text-neutral-500">
 Due {new Date(u.due).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
 </p>
 </div>
 <button type="button" className="btn-secondary mt-0.5 shrink-0 px-3 py-1.5 text-xs whitespace-nowrap">
 Schedule
 </button>
 </li>
 ))}
 </ul>
 </div>
 </div>

 {/* Employee KPIs — full content width */}
 <DashboardTableCard>
 <DashboardTableToolbar>
 <div className="space-y-3">
 <div className="relative">
 <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
 <DashboardTableSearchInput
 value={search}
 onChange={setSearch}
 placeholder="Search employee or role…"
 />
 </div>
 <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
 <select
 value={department}
 onChange={(e) => setDepartment(e.target.value)}
 className={dashboardTableSelectClass}
 >
 <option value="">All departments</option>
 {departments.map((d) => (
 <option key={d} value={d}>
 {d}
 </option>
 ))}
 </select>
 <select
 value={station}
 onChange={(e) => setStation(e.target.value)}
 className={dashboardTableSelectClass}
 >
 <option value="">All stations</option>
 {stations.map((s) => (
 <option key={s} value={s}>
 {s}
 </option>
 ))}
 </select>
 <select
 value={period}
 onChange={(e) => setPeriod(e.target.value as (typeof REVIEW_PERIODS)[number])}
 className={dashboardTableSelectClass}
 >
 {REVIEW_PERIODS.map((p) => (
 <option key={p} value={p}>
 {p}
 </option>
 ))}
 </select>
 </div>
 </div>
 </DashboardTableToolbar>

 <DashboardTableMeta
 title="Employee KPIs"
 description={`${filteredRows.length} employee${filteredRows.length === 1 ? '' : 's'} · ${period}`}
 />

 {filteredRows.length === 0 ? (
 <DashboardTableEmpty
 icon={<TrendingUp className="h-10 w-10 text-neutral-300" aria-hidden />}
 title="No employees match these filters"
 description="Try clearing search or widening station / department."
 />
 ) : (
 <DashboardTableViewport minWidth={1040}>
 <DashboardTable>
 <thead>
 <tr>
 <DashboardTableHead>Employee</DashboardTableHead>
 <DashboardTableHead>Station</DashboardTableHead>
 <DashboardTableHead>Role</DashboardTableHead>
 <DashboardTableHead>Throughput</DashboardTableHead>
 <DashboardTableHead>Attendance</DashboardTableHead>
 <DashboardTableHead>Customer</DashboardTableHead>
 <DashboardTableHead>Overall</DashboardTableHead>
 <DashboardTableHead className="col-center">Status</DashboardTableHead>
 <DashboardTableHead className="col-actions">
 Actions
 </DashboardTableHead>
 </tr>
 </thead>
 <tbody>
 {filteredRows.map((row) => (
 <tr key={row.id}>
 <DashboardTableCell className="col-primary">{row.name}</DashboardTableCell>
 <DashboardTableCell className="col-muted max-w-[10rem] truncate">{row.station}</DashboardTableCell>
 <DashboardTableCell className="col-muted max-w-[9rem] truncate">{row.role}</DashboardTableCell>
 <DashboardTableCell numeric>
 {row.status === 'Not Reviewed' ? '—' : row.throughput}
 </DashboardTableCell>
 <DashboardTableCell numeric>
 {row.status === 'Not Reviewed' ? '—' : `${row.attendancePct}%`}
 </DashboardTableCell>
 <DashboardTableCell numeric>
 {row.status === 'Not Reviewed' ? '—' : row.customerScore.toFixed(1)}
 </DashboardTableCell>
 <DashboardTableCell numeric className="font-medium text-ink">
 {row.status === 'Not Reviewed' ? '—' : row.overall}
 </DashboardTableCell>
 <DashboardTableCell className="col-center">
 <span className={`badge-status whitespace-nowrap ${statusBadgeClass(row.status)}`}>
 {row.status}
 </span>
 </DashboardTableCell>
 <DashboardTableCell className="col-actions">
 <DashboardTableActions>
 <DashboardTableActionButton onClick={() => setViewEmployee(row)}>View</DashboardTableActionButton>
 {(row.status === 'Not Reviewed' || row.status === 'Needs Improvement') && (
 <DashboardTableActionButton variant="accent" onClick={() => openStartReview(row)}>
 Review
 </DashboardTableActionButton>
 )}
 </DashboardTableActions>
 </DashboardTableCell>
 </tr>
 ))}
 </tbody>
 </DashboardTable>
 </DashboardTableViewport>
 )}
 </DashboardTableCard>
 </div>

 {viewEmployee && (
 <div
 className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
 role="dialog"
 aria-modal="true"
 aria-labelledby="perf-view-title"
 onClick={() => setViewEmployee(null)}
 >
 <div
 className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl md:max-w-2xl md:p-8"
 onClick={(e) => e.stopPropagation()}
 >
 <h3 id="perf-view-title" className="text-lg font-semibold text-primary-900">
 {viewEmployee.name}
 </h3>
 <p className="mt-1 text-sm text-neutral-600">
 {viewEmployee.role} · {viewEmployee.station} · {period}
 </p>

 <div className="mt-6 rounded-lg border border-neutral-200 bg-neutral-50 p-4">
 <p className="text-xs font-medium uppercase tracking-wide text-neutral-500">KPI breakdown</p>
 <div className="mt-2 flex justify-center">
 <KpiBarChartSvg
 throughput={viewEmployee.status === 'Not Reviewed' ? 0 : viewEmployee.throughput}
 attendance={viewEmployee.status === 'Not Reviewed' ? 0 : viewEmployee.attendancePct}
 complaints={viewEmployee.status === 'Not Reviewed' ? 0 : Math.max(0, 100 - viewEmployee.customerScore * 20)}
 compliance={viewEmployee.status === 'Not Reviewed' ? 0 : Math.min(100, viewEmployee.overall + 4)}
 />
 </div>
 </div>

 <div className="mt-6">
 <p className="text-sm font-medium text-ink">Review history</p>
 <div className="mt-2 overflow-hidden rounded-lg border border-neutral-200">
 <table className="data-table dashboard-data-table w-full text-sm">
 <thead className="bg-neutral-50 text-left text-xs font-medium uppercase tracking-wide text-neutral-500">
 <tr>
 <th className="px-3 py-2">Period</th>
 <th className="px-3 py-2">Score</th>
 <th className="px-3 py-2">Reviewer</th>
 </tr>
 </thead>
 <tbody>
 {(PAST_REVIEWS[viewEmployee.id] ?? PAST_REVIEWS.default).map((r) => (
 <tr key={r.period} className="border-t border-neutral-100">
 <td className="px-3 py-2 text-neutral-800">{r.period}</td>
 <td className="px-3 py-2 tabular-nums">{r.score}</td>
 <td className="px-3 py-2 text-neutral-600">{r.reviewer}</td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>

 <div className="mt-6 flex flex-wrap gap-3">
 <button type="button" className="btn-secondary" onClick={() => setViewEmployee(null)}>
 Close
 </button>
 <button
 type="button"
 className="rounded-md bg-amber-400 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-amber-500"
 onClick={() => {
 setViewEmployee(null);
 openStartReview(viewEmployee);
 }}
 >
 Start Appraisal
 </button>
 </div>
 </div>
 </div>
 )}

 {reviewEmployee && (
 <div
 className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
 role="dialog"
 aria-modal="true"
 aria-labelledby="perf-review-title"
 onClick={() => setReviewEmployee(null)}
 >
 <div
 className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl md:p-8"
 onClick={(e) => e.stopPropagation()}
 >
 <h3 id="perf-review-title" className="text-lg font-semibold text-primary-900">
 Start review — {reviewEmployee.name}
 </h3>
 <form className="mt-6 space-y-5" onSubmit={submitReview}>
 <div>
 <label className="mb-1 block text-xs font-medium text-neutral-600">Review period</label>
 <select
 required
 value={reviewForm.reviewPeriod}
 onChange={(e) => setReviewForm((f) => ({ ...f, reviewPeriod: e.target.value }))}
 className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
 >
 {REVIEW_PERIODS.map((p) => (
 <option key={p} value={p}>
 {p}
 </option>
 ))}
 </select>
 </div>
 <div>
 <label className="mb-1 block text-xs font-medium text-neutral-600">Reviewer</label>
 <input readOnly value="You (signed-in HR user)" className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-2 text-sm text-neutral-700" />
 </div>
 {(
 [
 ['throughput', 'Throughput (0–100)'],
 ['attendance', 'Attendance (0–100)'],
 ['complaints', 'Complaints / service recovery (0–100)'],
 ['compliance', 'Shift compliance (0–100)'],
 ] as const
 ).map(([key, label]) => (
 <div key={key}>
 <label className="mb-1 flex justify-between text-xs font-medium text-neutral-600">
 <span>{label}</span>
 <span className="tabular-nums text-neutral-800">{reviewForm[key]}</span>
 </label>
 <input
 type="range"
 min={0}
 max={100}
 value={reviewForm[key]}
 onChange={(e) => setReviewForm((f) => ({ ...f, [key]: Number(e.target.value) }))}
 className="w-full accent-amber-500"
 />
 </div>
 ))}
 <div>
 <label className="mb-1 block text-xs font-medium text-neutral-600">Overall comments</label>
 <textarea
 required
 rows={4}
 value={reviewForm.comments}
 onChange={(e) => setReviewForm((f) => ({ ...f, comments: e.target.value }))}
 className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm"
 placeholder="Strengths, development areas, station context…"
 />
 </div>
 <div className="flex flex-wrap gap-3 pt-2">
 <button type="button" className="btn-secondary" onClick={() => setReviewEmployee(null)}>
 Cancel
 </button>
 <button type="submit" className="rounded-md bg-amber-400 px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-amber-500">
 Submit
 </button>
 </div>
 </form>
 </div>
 </div>
 )}
 </DashboardPage>
 );
}
