'use client';

import { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CalendarCheck, Users, Loader2, Search, X, Coffee, Plus } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import type { InterviewType, InterviewDurationMinutes } from '@/types/dashboard';
import { parseDateTimeAsNairobi, dateTimeNairobi, APP_TIMEZONE } from '@/lib/timezone';
import { computeBulkInterviewStartTimesWithCustom } from '@/lib/bulk-interview-schedule';
import type { ApplicationWithDetails } from '@/types/dashboard';

const DURATION_OPTIONS: { value: InterviewDurationMinutes; label: string }[] = [
 { value: 30, label: '30 min' },
 { value: 45, label: '45 min' },
 { value: 60, label: '1 hr' },
];

const MAX_BULK = 10;

type JobWithShortlisted = {
 id: string;
 title: string;
 company?: string;
 clientId?: string | null;
 clientName?: string | null;
 shortlistedCount: number;
 scheduledCount: number;
};

function extractApplicationsResponse(data: unknown): ApplicationWithDetails[] {
 if (Array.isArray(data)) return data as ApplicationWithDetails[];
 if (
 data &&
 typeof data === 'object' &&
 'applications' in data &&
 Array.isArray((data as { applications?: unknown }).applications)
 ) {
 return (data as { applications: ApplicationWithDetails[] }).applications;
 }
 return [];
}

function ScheduleInterviewsPageContent() {
 const router = useRouter();
 const searchParams = useSearchParams();
 const appliedFromUrlRef = useRef(false);
 const shouldPreselectBulkRef = useRef(false);
 const [jobs, setJobs] = useState<{ id: string; title: string }[]>([]);
 const [jobsWithShortlisted, setJobsWithShortlisted] = useState<JobWithShortlisted[]>([]);
 const [jobsWithShortlistedLoading, setJobsWithShortlistedLoading] = useState(true);
 const [bulkSearch, setBulkSearch] = useState('');
 const [shortlistedApps, setShortlistedApps] = useState<ApplicationWithDetails[]>([]);
 const [shortlistedLoading, setShortlistedLoading] = useState(false);
 const [submitting, setSubmitting] = useState(false);
 const [bulkSubmitting, setBulkSubmitting] = useState(false);
 const [formError, setFormError] = useState<string | null>(null);
 const [bulkFormError, setBulkFormError] = useState<string | null>(null);

 const [form, setForm] = useState({
 applicationId: '',
 scheduledAt: '',
 durationMinutes: 45 as InterviewDurationMinutes,
 type: 'onsite' as InterviewType,
 locationOrLink: '',
 notes: '',
 });

 const [bulkJobId, setBulkJobId] = useState('');
 const [singleSearch, setSingleSearch] = useState('');
 const [singleJobId, setSingleJobId] = useState('');
 const [singleShortlistedApps, setSingleShortlistedApps] = useState<ApplicationWithDetails[]>([]);
 const [singleShortlistedLoading, setSingleShortlistedLoading] = useState(false);
 const [bulkDate, setBulkDate] = useState(() => new Date().toISOString().slice(0, 10));
 const [bulkStartTime, setBulkStartTime] = useState('09:00');
 const [bulkDuration, setBulkDuration] = useState<InterviewDurationMinutes>(45);
 const [bulkType, setBulkType] = useState<InterviewType>('onsite');
 const [bulkLocation, setBulkLocation] = useState('');
 const [bulkNotes, setBulkNotes] = useState('');
 const [bulkSelectedAppIds, setBulkSelectedAppIds] = useState<Set<string>>(new Set());
 /** Per-candidate interview type when bulk scheduling (default follows bulkType when ticked) */
 const [bulkTypesByApp, setBulkTypesByApp] = useState<Record<string, InterviewType>>({});
 /** Per-candidate start time HH:mm — empty = follow chain from global start / previous end */
 const [bulkTimesByApp, setBulkTimesByApp] = useState<Record<string, string>>({});
 /** Draft breaks same day as bulkDate — saved with bulk submit */
 const [bulkBreakDrafts, setBulkBreakDrafts] = useState<
 { id: string; time: string; durationMinutes: number; label: string }[]
 >([]);

 useEffect(() => {
 const now = new Date();
 const fmt = new Intl.DateTimeFormat('en-CA', {
 timeZone: 'Africa/Nairobi',
 year: 'numeric',
 month: '2-digit',
 day: '2-digit',
 hour: '2-digit',
 minute: '2-digit',
 hour12: false,
 });
 const parts = fmt.formatToParts(now);
 const y = parts.find((p) => p.type === 'year')?.value ?? '';
 const m = parts.find((p) => p.type === 'month')?.value ?? '';
 const d = parts.find((p) => p.type === 'day')?.value ?? '';
 const h = parts.find((p) => p.type === 'hour')?.value ?? '';
 const min = parts.find((p) => p.type === 'minute')?.value ?? '';
 setForm((f) => ({ ...f, scheduledAt: `${y}-${m}-${d}T${h}:${min}` }));
 }, []);

 useEffect(() => {
 let cancelled = false;
 fetch('/api/jobs')
 .then((r) => r.json())
 .then((data) => {
 if (!cancelled && Array.isArray(data)) setJobs(data.map((j: { id: string; title: string }) => ({ id: j.id, title: j.title })));
 })
 .catch(() => {});
 return () => { cancelled = true; };
 }, []);

 useEffect(() => {
 let cancelled = false;
 setJobsWithShortlistedLoading(true);
 fetch('/api/interviews/jobs-with-shortlisted')
 .then((r) => r.json())
 .then((data) => {
 if (!cancelled && Array.isArray(data)) setJobsWithShortlisted(data);
 })
 .catch(() => { if (!cancelled) setJobsWithShortlisted([]); })
 .finally(() => { if (!cancelled) setJobsWithShortlistedLoading(false); });
 return () => { cancelled = true; };
 }, []);

 /** Deep link: ?jobId=&preselect=1 from Interview management job cards */
 useEffect(() => {
 if (appliedFromUrlRef.current || jobsWithShortlistedLoading) return;
 const jobId = searchParams.get('jobId')?.trim();
 if (!jobId) return;
 const job = jobsWithShortlisted.find((j) => j.id === jobId);
 if (!job) return;
 appliedFromUrlRef.current = true;
 setBulkJobId(jobId);
 if (searchParams.get('preselect') === '1') shouldPreselectBulkRef.current = true;
 }, [jobsWithShortlistedLoading, jobsWithShortlisted, searchParams]);

 const bulkJobFilterOptions = useMemo(() => {
 let list = jobsWithShortlisted;
 const q = bulkSearch.trim().toLowerCase();
 if (q) {
 list = list.filter(
 (j) =>
 j.title.toLowerCase().includes(q) ||
 (j.company ?? '').toLowerCase().includes(q) ||
 (j.clientName ?? '').toLowerCase().includes(q)
 );
 }
 return list;
 }, [jobsWithShortlisted, bulkSearch]);

 useEffect(() => {
 if (bulkJobId && !bulkJobFilterOptions.some((j) => j.id === bulkJobId)) {
 setBulkJobId('');
 }
 }, [bulkJobId, bulkJobFilterOptions]);

 const singleJobFilterOptions = useMemo(() => {
 let list = jobsWithShortlisted;
 const q = singleSearch.trim().toLowerCase();
 if (q) {
 list = list.filter(
 (j) =>
 j.title.toLowerCase().includes(q) ||
 (j.company ?? '').toLowerCase().includes(q) ||
 (j.clientName ?? '').toLowerCase().includes(q)
 );
 }
 return list;
 }, [jobsWithShortlisted, singleSearch]);

 useEffect(() => {
 if (singleJobId && !singleJobFilterOptions.some((j) => j.id === singleJobId)) {
 setSingleJobId('');
 setForm((f) => ({ ...f, applicationId: '' }));
 }
 }, [singleJobId, singleJobFilterOptions]);

 useEffect(() => {
 if (!singleJobId) {
 setSingleShortlistedApps([]);
 setForm((f) => ({ ...f, applicationId: '' }));
 return;
 }
 setSingleShortlistedLoading(true);
 fetch(`/api/applications?jobId=${encodeURIComponent(singleJobId)}&status=shortlisted`)
 .then((r) => r.json())
 .then((data) => {
 setSingleShortlistedApps(extractApplicationsResponse(data));
 setForm((f) => ({ ...f, applicationId: '' }));
 })
 .catch(() => setSingleShortlistedApps([]))
 .finally(() => setSingleShortlistedLoading(false));
 }, [singleJobId]);

 useEffect(() => {
 if (!bulkJobId) {
 setShortlistedApps([]);
 return;
 }
 setShortlistedLoading(true);
 fetch(`/api/applications?jobId=${encodeURIComponent(bulkJobId)}&status=shortlisted`)
 .then((r) => r.json())
 .then((data) => {
 const apps = extractApplicationsResponse(data);
 setShortlistedApps(apps);
 if (shouldPreselectBulkRef.current) {
 shouldPreselectBulkRef.current = false;
 const ids = apps.slice(0, MAX_BULK).map((a: ApplicationWithDetails) => a.id);
 setBulkSelectedAppIds(new Set(ids));
 setBulkTypesByApp((prev) => {
 const next = { ...prev };
 for (const id of ids) if (next[id] == null) next[id] = bulkType;
 return next;
 });
 } else {
 setBulkSelectedAppIds(new Set());
 }
 })
 .catch(() => setShortlistedApps([]))
 .finally(() => setShortlistedLoading(false));
 }, [bulkJobId]);

 const toggleBulkApp = (appId: string) => {
 setBulkSelectedAppIds((prev) => {
 const next = new Set(prev);
 if (next.has(appId)) {
 next.delete(appId);
 setBulkTypesByApp((m) => {
 const { [appId]: _, ...rest } = m;
 return rest;
 });
 setBulkTimesByApp((m) => {
 const { [appId]: _, ...rest } = m;
 return rest;
 });
 } else if (next.size < MAX_BULK) {
 next.add(appId);
 setBulkTypesByApp((m) => ({ ...m, [appId]: m[appId] ?? bulkType }));
 }
 return next;
 });
 };

 const setBulkTypeForApp = (appId: string, t: InterviewType) => {
 setBulkTypesByApp((m) => ({ ...m, [appId]: t }));
 };

 const setBulkTimeForApp = (appId: string, time: string) => {
 setBulkTimesByApp((m) => {
 if (!time.trim()) {
 const { [appId]: _, ...rest } = m;
 return rest;
 }
 return { ...m, [appId]: time.trim() };
 });
 };

 /** Keep “Start time” in schedule details = earliest interview start (same anchor pills + preview use). */
 useEffect(() => {
 const selectedOrder = Array.from(bulkSelectedAppIds);
 if (selectedOrder.length === 0) return;
 const breaksPayload = bulkBreakDrafts
 .filter((r) => r.time?.trim() && /^\d{1,2}:\d{2}$/.test(r.time.trim()))
 .map((r) => ({ time: r.time.trim(), durationMinutes: r.durationMinutes }));
 const starts = computeBulkInterviewStartTimesWithCustom(
 bulkDate,
 bulkStartTime || '09:00',
 bulkDuration,
 selectedOrder,
 breaksPayload,
 bulkTimesByApp
 );
 const minMs = Math.min(...starts.map((d) => d.getTime()));
 const hhmm = new Date(minMs).toLocaleTimeString('en-GB', {
 hour: '2-digit',
 minute: '2-digit',
 hour12: false,
 timeZone: APP_TIMEZONE,
 });
 setBulkStartTime((prev) => (prev === hhmm ? prev : hhmm));
 }, [
 bulkSelectedAppIds,
 bulkDate,
 bulkDuration,
 bulkBreakDrafts,
 bulkTimesByApp,
 bulkStartTime,
 shortlistedApps.length,
 ]);

 /** Selected candidates with resolved slots, sorted by start time for the card + same times as preview/API */
 const bulkCandidateSlots = useMemo(() => {
 const fmt = (d: Date) =>
 d.toLocaleTimeString('en-KE', {
 hour: '2-digit',
 minute: '2-digit',
 timeZone: APP_TIMEZONE,
 });
 const appById = new Map(shortlistedApps.map((a) => [a.id, a]));
 const selectedOrder = Array.from(bulkSelectedAppIds);
 const breaksPayload = bulkBreakDrafts
 .filter((r) => r.time?.trim() && /^\d{1,2}:\d{2}$/.test(r.time.trim()))
 .map((r) => ({ time: r.time.trim(), durationMinutes: r.durationMinutes }));
 const starts =
 selectedOrder.length > 0
 ? computeBulkInterviewStartTimesWithCustom(
 bulkDate,
 bulkStartTime || '09:00',
 bulkDuration,
 selectedOrder,
 breaksPayload,
 bulkTimesByApp
 )
 : [];
 const durMs = bulkDuration * 60 * 1000;
 const withSlots = selectedOrder.map((appId, i) => {
 const app = appById.get(appId);
 if (!app) return null;
 const start = starts[i];
 const end = new Date(start.getTime() + durMs);
 return {
 appId,
 app,
 start,
 end,
 hasCustomTime: !!bulkTimesByApp[appId]?.trim(),
 };
 });
 const sortedSelected = withSlots.filter(Boolean) as NonNullable<(typeof withSlots)[0]>[];
 sortedSelected.sort((a, b) => a.start.getTime() - b.start.getTime());
 const unselected = shortlistedApps.filter((a) => !bulkSelectedAppIds.has(a.id));
 return { sortedSelected, unselected };
 }, [
 shortlistedApps,
 bulkSelectedAppIds,
 bulkDate,
 bulkStartTime,
 bulkDuration,
 bulkBreakDrafts,
 bulkTimesByApp,
 ]);

 const bulkSchedulePreview = useMemo(() => {
 type Block = {
 id: string;
 kind: 'interview' | 'break';
 start: Date;
 end: Date;
 title: string;
 subtitle?: string;
 };
 const blocks: Block[] = [];
 const appById = new Map(shortlistedApps.map((a) => [a.id, a]));
 const selectedOrder = Array.from(bulkSelectedAppIds);
 const breaksPayload = bulkBreakDrafts
 .filter((r) => r.time?.trim() && /^\d{1,2}:\d{2}$/.test(r.time.trim()))
 .map((r) => ({ time: r.time.trim(), durationMinutes: r.durationMinutes }));
 const interviewStarts = computeBulkInterviewStartTimesWithCustom(
 bulkDate,
 bulkStartTime || '09:00',
 bulkDuration,
 selectedOrder,
 breaksPayload,
 bulkTimesByApp
 );
 selectedOrder.forEach((appId, i) => {
 const app = appById.get(appId);
 const name = app
 ? `${app.candidate.firstName} ${app.candidate.lastName}`
 : 'Candidate';
 const start = interviewStarts[i];
 const end = new Date(start.getTime() + bulkDuration * 60 * 1000);
 blocks.push({
 id: `int-${appId}`,
 kind: 'interview',
 start: new Date(start.getTime()),
 end,
 title: name,
 subtitle: `${bulkDuration} min · ${bulkTypesByApp[appId] ?? bulkType}${
 bulkTimesByApp[appId]?.trim() ? ' · set time' : ''
 }`,
 });
 });
 for (const br of bulkBreakDrafts) {
 if (!br.time?.trim() || !/^\d{1,2}:\d{2}$/.test(br.time.trim())) continue;
 const start = dateTimeNairobi(bulkDate, br.time.trim());
 if (Number.isNaN(start.getTime())) continue;
 const end = new Date(start.getTime() + br.durationMinutes * 60 * 1000);
 blocks.push({
 id: br.id,
 kind: 'break',
 start,
 end,
 title: br.label.trim() || 'Break',
 subtitle: `${br.durationMinutes} min`,
 });
 }
 blocks.sort((a, b) => a.start.getTime() - b.start.getTime());
 const overlaps: string[] = [];
 for (let i = 0; i < blocks.length; i++) {
 for (let j = i + 1; j < blocks.length; j++) {
 const A = blocks[i];
 const B = blocks[j];
 if (A.start.getTime() < B.end.getTime() && B.start.getTime() < A.end.getTime()) {
 overlaps.push(`${A.title} overlaps ${B.title}`);
 }
 }
 }
 const fmtTime = (d: Date) =>
 d.toLocaleTimeString('en-KE', {
 hour: '2-digit',
 minute: '2-digit',
 timeZone: APP_TIMEZONE,
 });
 const fmtDate = (d: Date) =>
 d.toLocaleDateString('en-KE', {
 weekday: 'short',
 month: 'short',
 day: 'numeric',
 year: 'numeric',
 timeZone: APP_TIMEZONE,
 });
 /** Single label for schedule day (avoids duplicate ISO + locale quirks) */
 const scheduleDayLabel = fmtDate(dateTimeNairobi(bulkDate, '12:00'));
 let windowStart = 0;
 let windowEnd = 0;
 const barSegments: { id: string; kind: 'interview' | 'break'; leftPct: number; widthPct: number }[] = [];
 if (blocks.length > 0) {
 const padMs = 15 * 60 * 1000;
 windowStart = Math.min(...blocks.map((b) => b.start.getTime())) - padMs;
 windowEnd = Math.max(...blocks.map((b) => b.end.getTime())) + padMs;
 const span = Math.max(windowEnd - windowStart, 30 * 60 * 1000);
 for (const b of blocks) {
 const leftPct = ((b.start.getTime() - windowStart) / span) * 100;
 const widthPct = Math.max(((b.end.getTime() - b.start.getTime()) / span) * 100, 1.2);
 barSegments.push({
 id: b.id,
 kind: b.kind,
 leftPct,
 widthPct: Math.min(widthPct, 100 - leftPct),
 });
 }
 }
 const windowStartFmt = fmtTime(new Date(windowStart));
 const windowEndFmt = fmtTime(new Date(windowEnd));
 return {
 blocks,
 overlaps,
 fmtTime,
 fmtDate,
 scheduleDayLabel,
 barSegments,
 windowStartFmt,
 windowEndFmt,
 hasBar: barSegments.length > 0,
 };
 }, [
 bulkDate,
 bulkStartTime,
 bulkDuration,
 bulkType,
 bulkTypesByApp,
 bulkTimesByApp,
 bulkSelectedAppIds,
 bulkBreakDrafts,
 shortlistedApps,
 ]);

 const handleSubmitSingle = async (e: React.FormEvent) => {
 e.preventDefault();
 setFormError(null);
 if (!form.applicationId.trim()) {
 setFormError('Please select a candidate.');
 return;
 }
 if (!form.locationOrLink.trim()) {
 setFormError('Location or meeting link is required so applicants know where to attend.');
 return;
 }
 const scheduledAt = parseDateTimeAsNairobi(form.scheduledAt);
 if (Number.isNaN(scheduledAt.getTime())) {
 setFormError('Please set a valid date and time.');
 return;
 }
 setSubmitting(true);
 try {
 const res = await fetch('/api/interviews', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 applicationId: form.applicationId,
 scheduledAt: scheduledAt.toISOString(),
 durationMinutes: form.durationMinutes,
 type: form.type,
 locationOrLink: form.locationOrLink.trim(),
 notes: form.notes.trim() || undefined,
 }),
 });
 const data = await res.json();
 if (!res.ok) {
 setFormError(data.error || 'Failed to create interview.');
 return;
 }
 router.push('/dashboard/interviews');
 router.refresh();
 } catch {
 setFormError('Failed to create interview.');
 } finally {
 setSubmitting(false);
 }
 };

 const handleBulkCreate = async (e: React.FormEvent) => {
 e.preventDefault();
 setBulkFormError(null);
 if (!bulkJobId.trim()) {
 setBulkFormError('Select a job.');
 return;
 }
 if (bulkSelectedAppIds.size === 0) {
 setBulkFormError('Select at least one application (max 10).');
 return;
 }
 if (!bulkLocation.trim()) {
 setBulkFormError('Location or meeting link is required so applicants know where to attend.');
 return;
 }
 setBulkSubmitting(true);
 try {
 const breaksPayload = bulkBreakDrafts
 .filter((r) => r.time.trim())
 .map((r) => ({
 time: r.time.trim(),
 durationMinutes: r.durationMinutes,
 label: r.label.trim() || 'Break',
 }));
 const res = await fetch('/api/interviews/bulk', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 jobId: bulkJobId,
 date: bulkDate,
 startTime: bulkStartTime,
 durationMinutes: bulkDuration,
 type: bulkType,
 typesByApplication: Object.fromEntries(
 Array.from(bulkSelectedAppIds).map((id) => [id, bulkTypesByApp[id] ?? bulkType])
 ),
 timesByApplication: Object.fromEntries(
 Array.from(bulkSelectedAppIds)
 .filter((id) => /^\d{1,2}:\d{2}$/.test((bulkTimesByApp[id] ?? '').trim()))
 .map((id) => [id, bulkTimesByApp[id].trim()])
 ),
 applicationIds: Array.from(bulkSelectedAppIds),
 locationOrLink: bulkLocation.trim(),
 notes: bulkNotes.trim() || undefined,
 breaks: breaksPayload.length ? breaksPayload : undefined,
 }),
 });
 const data = await res.json();
 if (!res.ok) {
 setBulkFormError(data.error || 'Failed to create interviews.');
 return;
 }
 router.push('/dashboard/interviews');
 router.refresh();
 } catch {
 setBulkFormError('Failed to create interviews.');
 } finally {
 setBulkSubmitting(false);
 }
 };

 const inputClass = 'w-full min-w-0 px-4 py-2.5 sm:py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-base';

 return (
 <DashboardPage>
 <nav className="mb-4 sm:mb-5" aria-label="Breadcrumb">
 <ol className="flex items-center gap-1.5 text-sm text-neutral-500">
 <li>
 <Link href="/dashboard/interviews" className="hover:text-primary-700 transition-colors">
 Interview management
 </Link>
 </li>
 <li aria-hidden="true">/</li>
 <li className="text-primary-900 font-medium" aria-current="page">
 Schedule interviews
 </li>
 </ol>
 </nav>

 <DashboardPageHeader
 title="Schedule interviews"
 description="Bulk schedule up to 10 interviews from a shortlisted job. Add optional breaks (lunch, buffers) on the same day—they are saved together with the interviews. Times are auto-spaced for candidates; breaks use the times you set."
 className="mb-6 sm:mb-8"
 />

 <div className="space-y-6 sm:space-y-8">
 {/* Bulk schedule (max 10) */}
 <div className="dashboard-surface shadow-sm p-5 sm:p-6 lg:p-8">
 <h2 className="text-base sm:text-lg font-semibold text-primary-900 flex items-center gap-2 mb-5 sm:mb-6">
 <Users className="w-5 h-5 shrink-0" />
 Bulk schedule (max 10)
 </h2>

 {/* Step 1: Search + job (only jobs with shortlisted candidates) */}
 <div className="bg-neutral-50 rounded-lg border border-neutral-200 p-4 mb-6">
 <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">1. Select a job</p>
 <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
 <div className="relative flex-1 min-w-0 sm:min-w-[200px]">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
 <input
 type="text"
 placeholder="Search by job title or company..."
 value={bulkSearch}
 onChange={(e) => setBulkSearch(e.target.value)}
 className="w-full pl-9 pr-3 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm bg-white"
 aria-label="Search jobs"
 />
 </div>
 <div className="flex-1 min-w-0 sm:min-w-[240px]">
 <select
 id="bulk-job"
 value={bulkJobId}
 onChange={(e) => setBulkJobId(e.target.value)}
 className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm bg-white"
 aria-label="Select job"
 >
 <option value="">Select job (shortlisted only)</option>
 {jobsWithShortlistedLoading ? (
 <option value="" disabled>Loading…</option>
 ) : (
 bulkJobFilterOptions.map((j) => (
 <option key={j.id} value={j.id}>
 {j.title} {j.company ? `· ${j.company}` : ''} ({j.shortlistedCount} shortlisted)
 </option>
 ))
 )}
 </select>
 </div>
 {(bulkSearch || bulkJobId) && (
 <button
 type="button"
 onClick={() => {
 setBulkSearch('');
 setBulkJobId('');
 }}
 className="shrink-0 px-3 py-2.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors flex items-center gap-1.5"
 aria-label="Clear filters"
 >
 <X className="w-4 h-4" />
 Clear
 </button>
 )}
 </div>
 <p className="mt-2 text-xs text-neutral-500">
 {jobsWithShortlistedLoading ? 'Loading…' : jobsWithShortlisted.length === 0
 ? 'No jobs have shortlisted candidates yet. Shortlist applicants from the Applications page first.'
 : 'Only jobs with shortlisted candidates are shown.'}
 </p>
 </div>

 <form
 id="bulk-schedule-form"
 onSubmit={handleBulkCreate}
 className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1.2fr] lg:gap-6 xl:gap-8 lg:items-start"
 >
 {/* Schedule + breaks */}
 <div className="min-w-0 space-y-3 dashboard-surface rounded-lg p-4 lg:border-0 lg:bg-transparent lg:p-0">
 <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">2. Set schedule details</p>
 {bulkFormError && (
 <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
 {bulkFormError}
 </div>
 )}
 <div className="space-y-3">
 <div>
 <label htmlFor="bulk-date" className="block text-sm font-medium text-primary-900 mb-1.5">
 Date <span className="text-red-600">*</span>
 </label>
 <input
 id="bulk-date"
 type="date"
 value={bulkDate}
 onChange={(e) => setBulkDate(e.target.value)}
 className={inputClass}
 required
 />
 </div>
 <div>
 <label htmlFor="bulk-time" className="block text-sm font-medium text-primary-900 mb-1.5">
 Start time
 </label>
 <p className="text-[10px] text-neutral-500 mb-1">
 Matches the <strong className="text-neutral-600">earliest</strong> interview start. Changing a pill
 updates this; changing here recenters the auto chain (earliest slot still wins if someone is earlier).
 </p>
 <input
 id="bulk-time"
 type="time"
 value={bulkStartTime}
 onChange={(e) => setBulkStartTime(e.target.value)}
 className={inputClass}
 />
 </div>
 <div>
 <label htmlFor="bulk-duration" className="block text-sm font-medium text-primary-900 mb-1.5">
 Duration
 </label>
 <select
 id="bulk-duration"
 value={bulkDuration}
 onChange={(e) => setBulkDuration(Number(e.target.value) as InterviewDurationMinutes)}
 className={inputClass}
 >
 {DURATION_OPTIONS.map((opt) => (
 <option key={opt.value} value={opt.value}>{opt.label}</option>
 ))}
 </select>
 </div>
 <div>
 <label htmlFor="bulk-type" className="block text-sm font-medium text-primary-900 mb-1.5">
 Default type
 </label>
 <select
 id="bulk-type"
 value={bulkType}
 onChange={(e) => setBulkType(e.target.value as InterviewType)}
 className={inputClass}
 >
 <option value="onsite">On-site</option>
 <option value="video">Video</option>
 <option value="phone">Phone</option>
 </select>
 <p className="mt-1 text-[11px] text-neutral-500">
 Newly ticked candidates use this. Override per person in the list →
 </p>
 </div>
 </div>
 <div>
 <label htmlFor="bulk-location" className="block text-sm font-medium text-primary-900 mb-1.5">
 Location / link <span className="text-red-600">*</span>
 </label>
 <input
 id="bulk-location"
 type="text"
 value={bulkLocation}
 onChange={(e) => setBulkLocation(e.target.value)}
 placeholder="e.g. Zoom link or office address"
 className={inputClass}
 required
 />
 </div>
 <div>
 <label htmlFor="bulk-notes" className="block text-sm font-medium text-primary-900 mb-1.5">
 Notes
 </label>
 <textarea
 id="bulk-notes"
 value={bulkNotes}
 onChange={(e) => setBulkNotes(e.target.value)}
 placeholder="e.g. Please bring ID, certificates, or other documents. These notes will be included in the invite email."
 rows={2}
 className={inputClass + ' resize-y'}
 />
 </div>

 <div className="rounded-lg border border-secondary-200 bg-secondary-50/80 p-3 space-y-2">
 <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
 <p className="text-[10px] font-semibold text-secondary-900 uppercase tracking-wider flex items-center gap-1.5">
 <Coffee className="w-3.5 h-3.5 shrink-0" />
 Breaks (optional)
 </p>
 <button
 type="button"
 onClick={() =>
 setBulkBreakDrafts((prev) => [
 ...prev,
 {
 id: `b-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
 time: '12:00',
 durationMinutes: 60,
 label: 'Lunch',
 },
 ])
 }
 className="text-xs font-medium text-secondary-800 hover:text-secondary-950 inline-flex items-center gap-1 px-2 py-1 rounded-md bg-white border border-secondary-200"
 >
 <Plus className="w-3.5 h-3.5" />
 Add break
 </button>
 </div>
 <p className="text-[10px] leading-snug text-secondary-800/90">
 Same day as date above. Interview slots <strong className="font-semibold">pause during breaks</strong>—no
 overlap. Set break start (e.g. 12:00 lunch); next interview resumes after the break ends.
 </p>
 {bulkBreakDrafts.length === 0 ? (
 <p className="text-xs text-secondary-700/80 italic">No breaks—add one if you need lunch or a buffer.</p>
 ) : (
 <ul className="space-y-2">
 {bulkBreakDrafts.map((row, idx) => (
 <li
 key={row.id}
 className="flex flex-wrap items-end gap-2 p-2 bg-white rounded-lg border border-secondary-100"
 >
 <div className="min-w-[100px]">
 <label className="block text-[10px] font-medium text-secondary-900 mb-0.5">Start time</label>
 <input
 type="time"
 value={row.time}
 onChange={(e) =>
 setBulkBreakDrafts((prev) =>
 prev.map((r) => (r.id === row.id ? { ...r, time: e.target.value } : r))
 )
 }
 className="w-full px-2 py-1.5 border border-neutral-300 rounded text-sm"
 />
 </div>
 <div className="min-w-[90px]">
 <label className="block text-[10px] font-medium text-secondary-900 mb-0.5">Minutes</label>
 <select
 value={row.durationMinutes}
 onChange={(e) =>
 setBulkBreakDrafts((prev) =>
 prev.map((r) =>
 r.id === row.id
 ? { ...r, durationMinutes: parseInt(e.target.value, 10) }
 : r
 )
 )
 }
 className="w-full px-2 py-1.5 border border-neutral-300 rounded text-sm bg-white"
 >
 {[15, 30, 45, 60, 90, 120].map((m) => (
 <option key={m} value={m}>
 {m} min
 </option>
 ))}
 </select>
 </div>
 <div className="flex-1 min-w-[120px]">
 <label className="block text-[10px] font-medium text-secondary-900 mb-0.5">Label</label>
 <input
 type="text"
 value={row.label}
 onChange={(e) =>
 setBulkBreakDrafts((prev) =>
 prev.map((r) => (r.id === row.id ? { ...r, label: e.target.value } : r))
 )
 }
 placeholder="Lunch"
 className="w-full px-2 py-1.5 border border-neutral-300 rounded text-sm"
 />
 </div>
 <button
 type="button"
 onClick={() => setBulkBreakDrafts((prev) => prev.filter((r) => r.id !== row.id))}
 className="text-xs text-red-600 hover:text-red-800 px-2 py-1.5"
 aria-label={`Remove break ${idx + 1}`}
 >
 Remove
 </button>
 </li>
 ))}
 </ul>
 )}
 </div>
 </div>
 {/* Candidates */}
 <div className="min-w-0 mt-6 lg:mt-0 dashboard-surface rounded-lg p-4 lg:border-0 lg:bg-transparent lg:p-0">
 <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">3. Select candidates</p>
 <label className="block text-sm font-medium text-primary-900 mb-2">
 Shortlisted candidates (max 10)
 </label>
 <p className="text-[11px] text-neutral-500 mb-2">
 <strong className="text-neutral-600">Start time</strong> per row (tap for wheel). Duration + order fill the
 rest. Type per row.
 </p>
 {shortlistedLoading ? (
 <p className="text-sm text-neutral-500 py-8">Loading…</p>
 ) : shortlistedApps.length === 0 ? (
 <div className="border border-dashed border-neutral-200 rounded-lg p-8 text-center">
 <p className="text-sm text-neutral-500">
 {bulkJobId ? 'No shortlisted candidates for this job.' : 'Select a job above to see shortlisted candidates.'}
 </p>
 </div>
 ) : (
 <ul
 className="border border-neutral-200 rounded-lg divide-y divide-neutral-100 max-h-[min(85vh,28rem)] overflow-y-auto overflow-x-hidden bg-white pr-1"
 style={{ scrollbarGutter: 'stable' }}
 >
 {bulkCandidateSlots.sortedSelected.length > 0 && (
 <li className="px-2 py-1.5 bg-primary-900/10 text-[10px] font-semibold uppercase tracking-wider text-primary-800 border-b border-primary-900/10">
 Scheduled (by time)
 </li>
 )}
 {bulkCandidateSlots.sortedSelected.map(({ appId, app, start, hasCustomTime }) => {
 const startVal =
 bulkTimesByApp[appId]?.trim() ||
 start.toLocaleTimeString('en-GB', {
 hour: '2-digit',
 minute: '2-digit',
 hour12: false,
 timeZone: APP_TIMEZONE,
 });
 return (
 <li
 key={appId}
 className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-x-3 gap-y-1 px-2 py-2.5 lg:px-3 hover:bg-neutral-50/80"
 >
 <input
 type="checkbox"
 checked
 onChange={() => toggleBulkApp(appId)}
 className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500 shrink-0"
 aria-label={`Deselect ${app.candidate.firstName}`}
 />
 <span className="text-sm font-medium text-neutral-900 min-w-0 truncate">
 {app.candidate.firstName} {app.candidate.lastName}
 </span>
 <div
 className={`relative inline-flex items-center justify-center rounded-lg bg-primary-900 text-white shadow-sm shrink-0 min-h-[2.25rem] min-w-[4.75rem] px-1 ${
 hasCustomTime ? 'ring-2 ring-secondary-400/90 ring-offset-1' : ''
 }`}
 title="Start time (Nairobi) — tap for wheel"
 >
 <input
 type="time"
 step={60}
 value={startVal}
 onChange={(e) => setBulkTimeForApp(appId, e.target.value)}
 aria-label={`Start time for ${app.candidate.firstName}`}
 className="relative z-[1] w-full min-w-[4.25rem] bg-transparent py-1.5 px-2 text-center text-[11px] font-bold tabular-nums text-white outline-none focus:ring-0 cursor-pointer [color-scheme:dark] min-h-[2.25rem] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0"
 />
 </div>
 <select
 aria-label={`Type for ${app.candidate.firstName}`}
 value={bulkTypesByApp[appId] ?? bulkType}
 onChange={(e) => setBulkTypeForApp(appId, e.target.value as InterviewType)}
 className="text-xs border border-neutral-300 rounded-md px-1.5 py-1 bg-white max-w-[6.5rem] justify-self-end"
 >
 <option value="onsite">On-site</option>
 <option value="video">Video</option>
 <option value="phone">Phone</option>
 </select>
 </li>
 );
 })}
 {bulkCandidateSlots.unselected.length > 0 && (
 <li className="px-2 py-1.5 bg-neutral-100 text-[10px] font-semibold uppercase tracking-wider text-neutral-600 border-y border-neutral-200">
 Not selected — tick to add (slots after current day chain)
 </li>
 )}
 {bulkCandidateSlots.unselected.map((app) => (
 <li
 key={app.id}
 className="flex flex-wrap items-center gap-2 px-2 py-2 lg:px-3 hover:bg-neutral-50/50 opacity-90"
 >
 <input
 type="checkbox"
 checked={false}
 onChange={() => toggleBulkApp(app.id)}
 disabled={bulkSelectedAppIds.size >= MAX_BULK}
 className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500 shrink-0"
 />
 <span className="text-sm text-neutral-700 min-w-0 flex-1">
 {app.candidate.firstName} {app.candidate.lastName}
 </span>
 </li>
 ))}
 </ul>
 )}
 {bulkSelectedAppIds.size > 0 && (
 <p className="mt-2 text-xs text-neutral-500">
 {bulkSelectedAppIds.size} selected (max {MAX_BULK}) · order in this list is by time, not tick order
 </p>
 )}
 </div>

 {/* Day preview — ~1.2fr so a bit wider, not half the page */}
 <aside
 id="day-preview"
 className="w-full min-w-0 mt-8 pt-8 border-t border-neutral-200 lg:mt-0 lg:pt-0 lg:border-t-0 lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-5rem)] lg:overflow-y-auto lg:overflow-x-hidden lg:overscroll-contain"
 >
 <p className="lg:hidden text-xs text-neutral-500 mb-3">
 Day preview is below on small screens. On a wider window it stays fixed on the right while you edit.
 </p>
 <div className="rounded-2xl border border-neutral-200/80 bg-gradient-to-b from-neutral-50/90 to-white overflow-hidden shadow-sm">
 <div className="px-3 sm:px-4 py-3 sm:py-4 border-b border-neutral-100 bg-white/80">
 <div className="flex flex-col gap-2">
 <div className="min-w-0">
 <h3 className="text-sm font-semibold text-primary-950 flex items-center gap-2 tracking-tight">
 <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary-900 text-white shadow-sm">
 <CalendarCheck className="w-3.5 h-3.5" aria-hidden />
 </span>
 Day preview
 </h3>
 <p className="text-[11px] text-neutral-500 mt-1 leading-relaxed">
 Auto slots follow selection order; custom start times can reorder the day. List sorted by
 clock time (same as export). Overlaps warn in yellow.
 </p>
 </div>
 {bulkJobId ? (
 <div className="flex flex-wrap items-center gap-2 shrink-0">
 <span className="inline-flex items-center rounded-full border border-neutral-200 bg-white px-3 py-1.5 text-xs font-medium text-primary-900 shadow-sm">
 {bulkSchedulePreview.scheduleDayLabel}
 </span>
 {bulkSchedulePreview.blocks.length > 0 && (
 <span className="text-xs text-neutral-500">
 {bulkSchedulePreview.blocks.filter((b) => b.kind === 'interview').length} interview
 {bulkSchedulePreview.blocks.filter((b) => b.kind === 'interview').length !== 1 ? 's' : ''}
 {bulkSchedulePreview.blocks.some((b) => b.kind === 'break') &&
 ` · ${bulkSchedulePreview.blocks.filter((b) => b.kind === 'break').length} break`}
 </span>
 )}
 </div>
 ) : null}
 </div>
 </div>

 <div className="px-4 sm:px-6 py-4 sm:py-5 space-y-5">
 {bulkSchedulePreview.overlaps.length > 0 && (
 <div className="rounded-xl bg-secondary-50 border border-secondary-200/80 px-3 py-2.5 text-secondary-950 text-xs">
 <strong className="font-semibold">Overlaps</strong> — adjust start time, duration, or breaks.
 <ul className="mt-1 space-y-0.5 opacity-95">
 {bulkSchedulePreview.overlaps.slice(0, 5).map((o, i) => (
 <li key={i} className="flex gap-1.5">
 <span className="text-secondary-600 shrink-0">↯</span>
 <span>{o}</span>
 </li>
 ))}
 </ul>
 </div>
 )}

 {!bulkJobId ? (
 <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/60 py-10 text-center text-sm text-neutral-500">
 Select a job to see the day preview.
 </div>
 ) : bulkSchedulePreview.blocks.length === 0 ? (
 <div className="rounded-xl border border-dashed border-neutral-200 bg-neutral-50/60 py-10 text-center px-4">
 <p className="text-sm font-medium text-neutral-700">Timeline empty</p>
 <p className="text-xs text-neutral-500 mt-1 max-w-sm mx-auto">
 Tick candidates (order = slot order) or add a break to populate the bar and list.
 </p>
 </div>
 ) : (
 <>
 {/* Proportional day strip */}
 <div className="space-y-2 min-w-0">
 <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-2 items-center text-[10px] font-medium uppercase tracking-wider text-neutral-400 tabular-nums">
 <span className="whitespace-nowrap shrink-0">{bulkSchedulePreview.windowStartFmt}</span>
 <span className="text-center text-neutral-300 min-w-0 truncate">—</span>
 <span className="whitespace-nowrap shrink-0 text-right">{bulkSchedulePreview.windowEndFmt}</span>
 </div>
 <div
 className="relative h-8 sm:h-9 rounded-lg bg-neutral-100/90 border border-neutral-200/80 overflow-hidden"
 role="img"
 aria-label="Schedule blocks by time"
 >
 {bulkSchedulePreview.barSegments.map((seg) => (
 <div
 key={seg.id}
 className={`absolute top-1.5 bottom-1.5 rounded-md shadow-sm border border-white/25 ${
 seg.kind === 'break'
 ? 'bg-gradient-to-b from-secondary-400 to-secondary-600'
 : 'bg-gradient-to-b from-primary-700 to-primary-900'
 }`}
 style={{
 left: `${seg.leftPct}%`,
 width: `${seg.widthPct}%`,
 minWidth: 4,
 }}
 title={seg.kind === 'break' ? 'Break' : 'Interview'}
 />
 ))}
 </div>
 <div className="flex flex-wrap gap-3 text-[11px] text-neutral-500">
 <span className="inline-flex items-center gap-1.5">
 <span className="h-2 w-2 rounded-sm bg-primary-900" />
 Interview
 </span>
 <span className="inline-flex items-center gap-1.5">
 <span className="h-2 w-2 rounded-sm bg-secondary-500" />
 Break
 </span>
 </div>
 </div>

 {/* Vertical timeline list */}
 <div className="relative sm:pl-2">
 <div
 className="absolute left-[15px] top-3 bottom-3 w-px bg-neutral-200 hidden sm:block rounded-full"
 aria-hidden
 />
 <ul className="space-y-3">
 {bulkSchedulePreview.blocks.map((b, idx) => (
 <li key={b.id + idx} className="relative sm:pl-8">
 <span
 className={`absolute left-[9px] top-4 hidden sm:flex h-3.5 w-3.5 rounded-full border-2 border-white shadow-md ring-1 ring-neutral-200/80 ${
 b.kind === 'break' ? 'bg-secondary-500' : 'bg-primary-900'
 }`}
 aria-hidden
 />
 <div
 className={`rounded-xl border px-3.5 py-3 sm:px-4 sm:py-3.5 ${
 b.kind === 'break'
 ? 'border-secondary-200/90 bg-secondary-50/70'
 : 'border-neutral-200/90 bg-white shadow-sm'
 }`}
 >
 <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
 <p className="text-xs font-semibold tabular-nums text-primary-950 tracking-tight">
 {bulkSchedulePreview.fmtTime(b.start)}
 <span className="text-neutral-300 font-normal mx-1">→</span>
 {bulkSchedulePreview.fmtTime(b.end)}
 </p>
 <span
 className={`text-[10px] font-bold uppercase tracking-widest ${
 b.kind === 'break' ? 'text-secondary-800' : 'text-primary-700'
 }`}
 >
 {b.kind === 'break' ? 'Break' : 'Interview'}
 </span>
 </div>
 <div className="mt-1.5 flex items-start gap-2">
 {b.kind === 'break' ? (
 <Coffee className="w-4 h-4 text-secondary-600 mt-0.5 shrink-0" aria-hidden />
 ) : (
 <Users className="w-4 h-4 text-primary-600 mt-0.5 shrink-0" aria-hidden />
 )}
 <div className="min-w-0">
 <p
 className={`text-sm font-semibold leading-snug ${
 b.kind === 'break' ? 'text-secondary-950' : 'text-primary-950'
 }`}
 >
 {b.title}
 </p>
 {b.subtitle && (
 <p className="text-xs text-neutral-500 mt-0.5">{b.subtitle}</p>
 )}
 </div>
 </div>
 </div>
 </li>
 ))}
 </ul>
 </div>

 <p className="text-[11px] text-neutral-400 text-center sm:text-left border-t border-neutral-100 pt-3">
 First selected candidate gets the first slot; PDF/export use this same order by time.
 </p>
 </>
 )}
 </div>
 </div>
 </aside>
 </form>
 <div className="pt-6 mt-6 border-t border-neutral-200 flex flex-col-reverse sm:flex-row sm:justify-end sm:items-center gap-3 sm:gap-4">
 <Link
 href="/dashboard/interviews"
 className="w-full sm:w-auto order-2 sm:order-1 px-6 py-3 min-h-[44px] sm:min-h-0 border border-neutral-300 text-neutral-700 rounded-lg font-medium hover:bg-neutral-50 transition-colors inline-flex items-center justify-center"
 >
 Cancel
 </Link>
 <button
 type="submit"
 form="bulk-schedule-form"
 disabled={bulkSubmitting || bulkSelectedAppIds.size === 0}
 className="w-full sm:w-auto order-1 sm:order-2 px-6 py-3 min-h-[44px] sm:min-h-0 bg-primary-900 text-white rounded-lg font-semibold hover:bg-primary-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
 >
 {bulkSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
 {bulkSubmitting
 ? 'Saving…'
 : bulkBreakDrafts.filter((r) => r.time.trim()).length
 ? `Schedule ${bulkSelectedAppIds.size} interview(s) + ${bulkBreakDrafts.filter((r) => r.time.trim()).length} break(s)`
 : `Add ${bulkSelectedAppIds.size} interview(s)`}
 </button>
 </div>
 </div>

 {/* Add single interview */}
 <div className="dashboard-surface shadow-sm p-5 sm:p-6 lg:p-8">
 <h2 className="text-base sm:text-lg font-semibold text-primary-900 flex items-center gap-2 mb-5 sm:mb-6">
 <CalendarCheck className="w-5 h-5 shrink-0" />
 Add single interview
 </h2>

 {/* Step 1: Search + job */}
 <div className="bg-neutral-50 rounded-lg border border-neutral-200 p-4 mb-6">
 <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">1. Select a job</p>
 <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
 <div className="relative flex-1 min-w-0 sm:min-w-[200px]">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
 <input
 type="text"
 placeholder="Search by job title or company..."
 value={singleSearch}
 onChange={(e) => setSingleSearch(e.target.value)}
 className="w-full pl-9 pr-3 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm bg-white"
 aria-label="Search jobs"
 />
 </div>
 <div className="flex-1 min-w-0 sm:min-w-[240px]">
 <select
 value={singleJobId}
 onChange={(e) => setSingleJobId(e.target.value)}
 className="w-full px-3 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm bg-white"
 aria-label="Select job"
 >
 <option value="">Select job (shortlisted only)</option>
 {jobsWithShortlistedLoading ? (
 <option value="" disabled>Loading…</option>
 ) : (
 singleJobFilterOptions.map((j) => (
 <option key={j.id} value={j.id}>
 {j.title} {j.company ? `· ${j.company}` : ''} ({j.shortlistedCount} shortlisted)
 </option>
 ))
 )}
 </select>
 </div>
 {(singleSearch || singleJobId) && (
 <button
 type="button"
 onClick={() => {
 setSingleSearch('');
 setSingleJobId('');
 }}
 className="shrink-0 px-3 py-2.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors flex items-center gap-1.5"
 aria-label="Clear filters"
 >
 <X className="w-4 h-4" />
 Clear
 </button>
 )}
 </div>
 <p className="mt-2 text-xs text-neutral-500">
 {jobsWithShortlistedLoading ? 'Loading…' : jobsWithShortlisted.length === 0
 ? 'No jobs have shortlisted candidates yet. Shortlist applicants from the Applications page first.'
 : 'Only jobs with shortlisted candidates are shown.'}
 </p>
 </div>

 <form onSubmit={handleSubmitSingle} className="space-y-6">
 {formError && (
 <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
 {formError}
 </div>
 )}

 {/* Step 2: Select candidate */}
 <div>
 <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-2">2. Select candidate</p>
 <label htmlFor="single-application" className="block text-sm font-medium text-primary-900 mb-1.5">
 Candidate <span className="text-red-600">*</span>
 </label>
 <select
 id="single-application"
 value={form.applicationId}
 onChange={(e) => setForm((f) => ({ ...f, applicationId: e.target.value }))}
 className={inputClass}
 required
 disabled={singleShortlistedLoading}
 >
 <option value="">
 {!singleJobId ? 'Select a job above first' : singleShortlistedLoading ? 'Loading…' : 'Select candidate'}
 </option>
 {singleShortlistedApps.map((a) => (
 <option key={a.id} value={a.id}>
 {a.candidate.firstName} {a.candidate.lastName}
 </option>
 ))}
 </select>
 </div>

 {/* Step 3: Schedule details */}
 <div>
 <p className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-3">3. Set schedule details</p>
 <div className="space-y-4">
 <div>
 <label htmlFor="single-datetime" className="block text-sm font-medium text-primary-900 mb-1.5">
 Date & time <span className="text-red-600">*</span>
 </label>
 <input
 id="single-datetime"
 type="datetime-local"
 value={form.scheduledAt}
 onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))}
 className={inputClass}
 required
 />
 </div>
 <div>
 <label htmlFor="single-duration" className="block text-sm font-medium text-primary-900 mb-1.5">
 Duration
 </label>
 <select
 id="single-duration"
 value={form.durationMinutes}
 onChange={(e) => setForm((f) => ({ ...f, durationMinutes: Number(e.target.value) as InterviewDurationMinutes }))}
 className={inputClass}
 >
 {DURATION_OPTIONS.map((opt) => (
 <option key={opt.value} value={opt.value}>{opt.label}</option>
 ))}
 </select>
 </div>
 <div>
 <label htmlFor="single-type" className="block text-sm font-medium text-primary-900 mb-1.5">
 Type
 </label>
 <select
 id="single-type"
 value={form.type}
 onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as InterviewType }))}
 className={inputClass}
 >
 <option value="onsite">On-site</option>
 <option value="video">Video</option>
 <option value="phone">Phone</option>
 </select>
 </div>
 <div>
 <label htmlFor="single-location" className="block text-sm font-medium text-primary-900 mb-1.5">
 Location or meeting link <span className="text-red-600">*</span>
 </label>
 <input
 id="single-location"
 type="text"
 value={form.locationOrLink}
 onChange={(e) => setForm((f) => ({ ...f, locationOrLink: e.target.value }))}
 placeholder="e.g. Zoom link or office address"
 className={inputClass}
 required
 />
 </div>
 <div>
 <label htmlFor="single-notes" className="block text-sm font-medium text-primary-900 mb-1.5">
 Notes (optional)
 </label>
 <textarea
 id="single-notes"
 value={form.notes}
 onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
 rows={3}
 className={`${inputClass} resize-y`}
 />
 </div>
 </div>
 </div>

 <div className="pt-4 border-t border-neutral-200 flex flex-col-reverse sm:flex-row sm:justify-end sm:items-center gap-3 sm:gap-4">
 <Link
 href="/dashboard/interviews"
 className="w-full sm:w-auto order-2 sm:order-1 px-6 py-3 min-h-[44px] sm:min-h-0 border border-neutral-300 text-neutral-700 rounded-lg font-medium hover:bg-neutral-50 transition-colors inline-flex items-center justify-center"
 >
 Cancel
 </Link>
 <button
 type="submit"
 disabled={submitting}
 className="w-full sm:w-auto order-1 sm:order-2 px-6 py-3 min-h-[44px] sm:min-h-0 bg-primary-900 text-white rounded-lg font-semibold hover:bg-primary-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
 >
 {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
 {submitting ? 'Scheduling…' : 'Schedule interview'}
 </button>
 </div>
 </form>
 </div>
 </div>
 </DashboardPage>
 );
}

export default function ScheduleInterviewsPage() {
 return (
 <Suspense
 fallback={
 <div className="w-full flex items-center justify-center py-24">
 <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
 </div>
 }
 >
 <ScheduleInterviewsPageContent />
 </Suspense>
 );
}
