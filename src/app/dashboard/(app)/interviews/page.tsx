'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { CalendarCheck, Plus, Loader2, FileDown, Send, Filter, Pencil, Trash2, X, Video, ExternalLink, Search, Coffee } from 'lucide-react';
import type {
 InterviewWithDetails,
 InterviewStatus,
 InterviewType,
 InterviewDurationMinutes,
 InterviewScheduleBreak,
} from '@/types/dashboard';
import { formatInNairobi, parseDateTimeAsNairobi, toDateTimeLocalNairobi } from '@/lib/timezone';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import type { UserSummary } from '@/types/dashboard';

const TYPE_LABELS: Record<InterviewType, string> = {
 phone: 'Phone',
 video: 'Video',
 onsite: 'On-site',
};

const DURATION_OPTIONS: { value: InterviewDurationMinutes; label: string }[] = [
 { value: 30, label: '30 min' },
 { value: 45, label: '45 min' },
 { value: 60, label: '1 hr' },
];

const STATUS_STYLES: Record<InterviewStatus, string> = {
 scheduled: 'bg-indigo-50 text-indigo-700',
 completed: 'bg-emerald-50 text-emerald-700',
 cancelled: 'bg-neutral-100 text-neutral-600',
};

const CONFIRM_STYLES: Record<string, string> = {
 pending: 'bg-amber-50 text-amber-700',
 confirmed: 'bg-emerald-50 text-emerald-700',
 declined: 'bg-red-50 text-red-700',
 reschedule_requested: 'bg-sky-50 text-sky-700',
 withdrawn: 'bg-red-100 text-red-800',
};

function formatDateTime(iso: string) {
 return formatInNairobi(new Date(iso), { dateStyle: 'medium', timeStyle: 'short' });
}

export default function DashboardInterviewsPage() {
 const [interviews, setInterviews] = useState<InterviewWithDetails[]>([]);
 const [jobs, setJobs] = useState<{ id: string; title: string }[]>([]);
 const [currentUser, setCurrentUser] = useState<UserSummary | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
 const [sendingInvites, setSendingInvites] = useState(false);
 const [inviteResult, setInviteResult] = useState<string | null>(null);
 const [editOpen, setEditOpen] = useState(false);
 const [editInterview, setEditInterview] = useState<InterviewWithDetails | null>(null);
 const [editIds, setEditIds] = useState<string[]>([]);
 const [editForm, setEditForm] = useState<{
 scheduledAt: string;
 durationMinutes: InterviewDurationMinutes;
 type: InterviewType;
 locationOrLink: string;
 notes: string;
 status: InterviewStatus;
 }>({
 scheduledAt: '',
 durationMinutes: 45,
 type: 'onsite',
 locationOrLink: '',
 notes: '',
 status: 'scheduled',
 });
 const [editError, setEditError] = useState<string | null>(null);
 const [editSaving, setEditSaving] = useState(false);
 const [deleteConfirm, setDeleteConfirm] = useState<{ single: string } | { bulk: number } | null>(null);
 const [deleteDeleting, setDeleteDeleting] = useState(false);
 const [creatingMeetingId, setCreatingMeetingId] = useState<string | null>(null);

 /** Job-first view: '' = none selected (show picker), 'all' = all jobs, or jobId */
 const [selectedJobView, setSelectedJobView] = useState<string>('');
 const [jobsWithShortlisted, setJobsWithShortlisted] = useState<{ id: string; title: string; company?: string; clientId?: string | null; clientName?: string | null; shortlistedCount: number; scheduledCount: number }[]>([]);
 const [jobsWithShortlistedLoading, setJobsWithShortlistedLoading] = useState(true);
 const [jobCardsSearch, setJobCardsSearch] = useState('');
 const [jobCardsJobFilter, setJobCardsJobFilter] = useState('');
 const [filterDateFrom, setFilterDateFrom] = useState('');
 const [filterDateTo, setFilterDateTo] = useState('');
 const [filterStatus, setFilterStatus] = useState('');
 const [filterInviteSent, setFilterInviteSent] = useState('');
 const [exportDate, setExportDate] = useState(() => new Date().toISOString().slice(0, 10));
 const [exportDownloading, setExportDownloading] = useState<'date' | 'selected' | null>(null);
 const [exportPreviewing, setExportPreviewing] = useState<'date' | 'selected' | null>(null);
 const [scheduleBreaks, setScheduleBreaks] = useState<InterviewScheduleBreak[]>([]);
 const [breaksLoading, setBreaksLoading] = useState(false);
 const [breakModal, setBreakModal] = useState<'add' | InterviewScheduleBreak | null>(null);
 const [breakForm, setBreakForm] = useState({
 scheduledAt: '',
 durationMinutes: 30,
 label: 'Break',
 notes: '',
 });
 const [breakSaving, setBreakSaving] = useState(false);

 const queryString = useMemo(() => {
 const p = new URLSearchParams();
 if (selectedJobView && selectedJobView !== 'all') p.set('jobId', selectedJobView);
 if (filterDateFrom) p.set('dateFrom', filterDateFrom);
 if (filterDateTo) p.set('dateTo', filterDateTo);
 if (filterStatus) p.set('status', filterStatus);
 if (filterInviteSent === 'yes') p.set('inviteSent', 'true');
 if (filterInviteSent === 'no') p.set('inviteSent', 'false');
 return p.toString();
 }, [selectedJobView, filterDateFrom, filterDateTo, filterStatus, filterInviteSent]);

 const selectedJobTitle = useMemo(
 () => (selectedJobView && selectedJobView !== 'all' ? jobs.find((j) => j.id === selectedJobView)?.title : null),
 [selectedJobView, jobs]
 );

 const scheduleUrlForJob = (jobId: string) => {
 const p = new URLSearchParams();
 p.set('jobId', jobId);
 p.set('preselect', '1');
 return `/dashboard/interviews/schedule?${p.toString()}`;
 };

 const scheduleUrlCurrentJob = useMemo(() => {
 if (!selectedJobView || selectedJobView === 'all') return '/dashboard/interviews/schedule';
 return scheduleUrlForJob(selectedJobView);
 }, [selectedJobView]);

 useEffect(() => {
 if (selectedJobView === '') {
 setLoading(false);
 setInterviews([]);
 setError(null);
 return;
 }
 let cancelled = false;
 setLoading(true);
 setError(null);
 fetch(`/api/interviews${queryString ? `?${queryString}` : ''}`)
 .then((r) => {
 if (!r.ok) throw new Error('Failed to load');
 return r.json();
 })
 .then((data) => {
 if (!cancelled) setInterviews(Array.isArray(data) ? data : []);
 })
 .catch(() => {
 if (!cancelled) setError('Failed to load interviews.');
 })
 .finally(() => {
 if (!cancelled) setLoading(false);
 });
 return () => { cancelled = true; };
 }, [selectedJobView, queryString]);

 const breaksQueryString = useMemo(() => {
 if (!selectedJobView || selectedJobView === 'all') return '';
 const p = new URLSearchParams();
 p.set('jobId', selectedJobView);
 if (filterDateFrom) p.set('dateFrom', filterDateFrom);
 if (filterDateTo) p.set('dateTo', filterDateTo);
 return p.toString();
 }, [selectedJobView, filterDateFrom, filterDateTo]);

 useEffect(() => {
 if (!breaksQueryString) {
 setScheduleBreaks([]);
 return;
 }
 let cancelled = false;
 setBreaksLoading(true);
 fetch(`/api/interviews/schedule-breaks?${breaksQueryString}`)
 .then((r) => r.json())
 .then((data) => {
 if (!cancelled) setScheduleBreaks(Array.isArray(data) ? data : []);
 })
 .catch(() => {
 if (!cancelled) setScheduleBreaks([]);
 })
 .finally(() => {
 if (!cancelled) setBreaksLoading(false);
 });
 return () => { cancelled = true; };
 }, [breaksQueryString]);

 const scheduleTimeline = useMemo(() => {
 type Row =
 | { kind: 'interview'; i: InterviewWithDetails }
 | { kind: 'break'; b: InterviewScheduleBreak };
 const rows: Row[] = [
 ...interviews.map((i) => ({ kind: 'interview' as const, i })),
 ...scheduleBreaks.map((b) => ({ kind: 'break' as const, b })),
 ];
 rows.sort((a, b) => {
 const ta = a.kind === 'interview' ? new Date(a.i.scheduledAt).getTime() : new Date(a.b.scheduledAt).getTime();
 const tb = b.kind === 'interview' ? new Date(b.i.scheduledAt).getTime() : new Date(b.b.scheduledAt).getTime();
 return ta - tb;
 });
 return rows;
 }, [interviews, scheduleBreaks]);

 useEffect(() => {
 let cancelled = false;
 fetch('/api/auth/me')
 .then((r) => (r.ok ? r.json() : null))
 .then((data) => { if (!cancelled && data) setCurrentUser(data as UserSummary); })
 .catch(() => {});
 return () => { cancelled = true; };
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

 const selectableForInvite = useMemo(() =>
 interviews.filter((i) => i.status === 'scheduled' && !i.inviteSentAt),
 [interviews]
 );
 const selectedForInvite = selectableForInvite.filter((i) => selectedIds.has(i.id));
 const selectedCount = selectedIds.size;
 const toggleSelect = (id: string) => {
 setSelectedIds((prev) => {
 const next = new Set(prev);
 if (next.has(id)) next.delete(id);
 else next.add(id);
 return next;
 });
 };
 const toggleSelectAll = () => {
 if (selectedIds.size === interviews.length) setSelectedIds(new Set());
 else setSelectedIds(new Set(interviews.map((i) => i.id)));
 };

 const refetchList = () => {
 fetch(`/api/interviews${queryString ? `?${queryString}` : ''}`)
 .then((r) => (r.ok ? r.json() : []))
 .then((data) => setInterviews(Array.isArray(data) ? data : []))
 .catch(() => {});
 };

 const openEditSingle = (i: InterviewWithDetails) => {
 setEditForm({
 scheduledAt: toDateTimeLocalNairobi(i.scheduledAt),
 durationMinutes: (i.durationMinutes ?? 45) as InterviewDurationMinutes,
 type: i.type,
 locationOrLink: i.locationOrLink ?? '',
 notes: i.notes ?? '',
 status: i.status,
 });
 setEditInterview(i);
 setEditIds([]);
 setEditError(null);
 setEditOpen(true);
 };

 const openEditBulk = () => {
 const ids = Array.from(selectedIds);
 if (ids.length === 0) return;
 setEditForm({
 scheduledAt: '',
 durationMinutes: 45,
 type: 'onsite',
 locationOrLink: '',
 notes: '',
 status: 'scheduled',
 });
 setEditInterview(null);
 setEditIds(ids);
 setEditError(null);
 setEditOpen(true);
 };

 const handleEditSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setEditError(null);
 if (!editForm.locationOrLink.trim()) {
 setEditError('Location or meeting link is required so applicants know where to attend.');
 return;
 }
 setEditSaving(true);
 try {
 if (editInterview) {
 const body: Record<string, unknown> = {
 scheduledAt: parseDateTimeAsNairobi(editForm.scheduledAt).toISOString(),
 durationMinutes: editForm.durationMinutes,
 type: editForm.type,
 locationOrLink: editForm.locationOrLink.trim(),
 notes: editForm.notes.trim() || null,
 status: editForm.status,
 };
 const res = await fetch(`/api/interviews/${editInterview.id}`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(body),
 });
 const data = await res.json();
 if (!res.ok) {
 setEditError(data.error || 'Failed to update.');
 return;
 }
 } else {
 const body: Record<string, unknown> = { interviewIds: editIds };
 if (editForm.scheduledAt) {
 const d = parseDateTimeAsNairobi(editForm.scheduledAt);
 if (!Number.isNaN(d.getTime())) body.scheduledAt = d.toISOString();
 }
 body.durationMinutes = editForm.durationMinutes;
 body.type = editForm.type;
 body.locationOrLink = editForm.locationOrLink.trim();
 body.notes = editForm.notes.trim() || null;
 body.status = editForm.status;
 const res = await fetch('/api/interviews/bulk-update', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(body),
 });
 const data = await res.json();
 if (!res.ok) {
 setEditError(data.error || 'Failed to update.');
 return;
 }
 }
 setEditOpen(false);
 setSelectedIds(new Set());
 refetchList();
 } catch {
 setEditError('Failed to save.');
 } finally {
 setEditSaving(false);
 }
 };

 const handleDeleteConfirm = async () => {
 if (!deleteConfirm) return;
 setDeleteDeleting(true);
 try {
 if ('single' in deleteConfirm) {
 const res = await fetch(`/api/interviews/${deleteConfirm.single}`, { method: 'DELETE' });
 if (!res.ok) {
 const data = await res.json().catch(() => ({}));
 setInviteResult(data.error || 'Failed to delete.');
 return;
 }
 } else {
 const ids = Array.from(selectedIds);
 const res = await fetch('/api/interviews/bulk-delete', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ interviewIds: ids }),
 });
 const data = await res.json();
 if (!res.ok) {
 setInviteResult(data.error || 'Failed to delete.');
 return;
 }
 setSelectedIds(new Set());
 }
 setDeleteConfirm(null);
 refetchList();
 } catch {
 setInviteResult('Failed to delete.');
 } finally {
 setDeleteDeleting(false);
 }
 };

 const handleBulkSendInvites = async () => {
 if (selectedForInvite.length === 0) return;
 setInviteResult(null);
 setSendingInvites(true);
 try {
 const res = await fetch('/api/interviews/send-invite', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 interviewIds: selectedForInvite.map((i) => i.id),
 ccEmail: currentUser?.email || undefined,
 }),
 });
 const data = await res.json();
 if (!res.ok) {
 setInviteResult(data.error || 'Failed to send invites.');
 return;
 }
 const results = data.results as { interviewId: string; sent: boolean; error?: string }[];
 const sent = results.filter((r) => r.sent).length;
 const failed = results.filter((r) => !r.sent);
 setInviteResult(failed.length > 0 ? `Sent ${sent}. Failed: ${failed.map((f) => f.error).join('; ')}` : `Sent ${sent} invite(s).`);
 setSelectedIds(new Set());
 const listRes = await fetch(`/api/interviews${queryString ? `?${queryString}` : ''}`);
 const list = await listRes.json();
 if (Array.isArray(list)) setInterviews(list);
 } catch {
 setInviteResult('Failed to send invites.');
 } finally {
 setSendingInvites(false);
 }
 };

 const handleCreateTeamsMeeting = async (interview: InterviewWithDetails) => {
 if (interview.type !== 'video') return;
 setInviteResult(null);
 setCreatingMeetingId(interview.id);
 try {
 const res = await fetch(`/api/interviews/${interview.id}/create-teams-meeting`, { method: 'POST' });
 const data = await res.json();
 if (!res.ok) {
 setInviteResult(data.error || 'Failed to create Teams meeting.');
 return;
 }
 setInviteResult('Teams meeting created. Candidate will receive a calendar invite with Accept/Decline.');
 refetchList();
 } catch {
 setInviteResult('Failed to create Teams meeting.');
 } finally {
 setCreatingMeetingId(null);
 }
 };

 const handleSendSingleInvite = async (interview: InterviewWithDetails) => {
 if (interview.inviteSentAt || interview.status !== 'scheduled') return;
 setSendingInvites(true);
 setInviteResult(null);
 try {
 const res = await fetch('/api/interviews/send-invite', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 interviewIds: [interview.id],
 ccEmail: currentUser?.email || undefined,
 }),
 });
 const data = await res.json();
 if (!res.ok) {
 setInviteResult(data.error || 'Failed to send invite.');
 return;
 }
 const results = data.results as { sent: boolean; error?: string }[];
 if (results[0]?.sent) {
 setInviteResult('Invite sent.');
 const listRes = await fetch(`/api/interviews${queryString ? `?${queryString}` : ''}`);
 const list = await listRes.json();
 if (Array.isArray(list)) setInterviews(list);
 } else {
 setInviteResult(results[0]?.error || 'Failed to send.');
 }
 } catch {
 setInviteResult('Failed to send invite.');
 } finally {
 setSendingInvites(false);
 }
 };

 const filteredJobCards = useMemo(() => {
 let list = jobsWithShortlisted;
 const q = jobCardsSearch.trim().toLowerCase();
 if (q) {
 list = list.filter(
 (j) =>
 j.title.toLowerCase().includes(q) ||
 (j.company ?? '').toLowerCase().includes(q) ||
 (j.clientName ?? '').toLowerCase().includes(q)
 );
 }
 if (jobCardsJobFilter) {
 list = list.filter((j) => j.id === jobCardsJobFilter);
 }
 return list;
 }, [jobsWithShortlisted, jobCardsSearch, jobCardsJobFilter]);

 const jobFilterOptions = useMemo(() => {
 let list = jobsWithShortlisted;
 const q = jobCardsSearch.trim().toLowerCase();
 if (q) {
 list = list.filter(
 (j) =>
 j.title.toLowerCase().includes(q) ||
 (j.company ?? '').toLowerCase().includes(q) ||
 (j.clientName ?? '').toLowerCase().includes(q)
 );
 }
 return list;
 }, [jobsWithShortlisted, jobCardsSearch]);

 useEffect(() => {
 if (jobCardsJobFilter && !jobFilterOptions.some((j) => j.id === jobCardsJobFilter)) {
 setJobCardsJobFilter('');
 }
 }, [jobCardsJobFilter, jobFilterOptions]);

 const exportScheduleUrl = `/api/interviews/export-schedule?date=${exportDate}${selectedJobView && selectedJobView !== 'all' ? `&jobId=${encodeURIComponent(selectedJobView)}` : ''}`;
 const exportSelectedUrl = selectedCount > 0
 ? `/api/interviews/export-schedule?ids=${Array.from(selectedIds).join(',')}`
 : null;

 const handlePreviewPdf = async (url: string, type: 'date' | 'selected') => {
 setExportPreviewing(type);
 try {
 const sep = url.includes('?') ? '&' : '?';
 const res = await fetch(`${url}${sep}format=pdf`);
 if (!res.ok) throw new Error('Preview failed');
 const blob = await res.blob();
 const blobUrl = URL.createObjectURL(blob);
 window.open(blobUrl, '_blank', 'noopener,noreferrer');
 setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
 } catch {
 window.open(url, '_blank', 'noopener,noreferrer');
 } finally {
 setExportPreviewing(null);
 }
 };

 const handleDownloadPdf = async (url: string, type: 'date' | 'selected') => {
 setExportDownloading(type);
 try {
 const sep = url.includes('?') ? '&' : '?';
 const res = await fetch(`${url}${sep}format=pdf`);
 if (!res.ok) throw new Error('Download failed');
 const blob = await res.blob();
 const disposition = res.headers.get('Content-Disposition');
 const match = disposition?.match(/filename="?([^";\n]+)"?/);
 const filename = match?.[1] ?? `interview-schedule-${exportDate}.pdf`;
 const a = document.createElement('a');
 a.href = URL.createObjectURL(blob);
 a.download = filename;
 a.click();
 URL.revokeObjectURL(a.href);
 } catch {
 window.open(url, '_blank', 'noopener,noreferrer');
 } finally {
 setExportDownloading(null);
 }
 };

 return (
 <DashboardPage>
 <DashboardPageHeader
 title={selectedJobTitle ? selectedJobTitle : 'Interview management'}
 description={
 selectedJobTitle
 ? 'Schedule and invites for this position.'
 : 'Your central hub for scheduling, invites, and all interview-related content.'
 }
 actions={
 <Link
 href={scheduleUrlCurrentJob}
 className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-primary-900 text-white rounded-lg hover:bg-primary-800 focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 text-sm font-medium"
 >
 <Plus className="w-4 h-4" />
 Schedule interviews
 </Link>
 }
 />

 {inviteResult && (
 <div className="mb-4 p-3 rounded-lg text-sm bg-neutral-100 text-neutral-800">
 {inviteResult}
 </div>
 )}

 {/* Job selector: cards when no job selected, dropdown when viewing a schedule */}
 {selectedJobView === '' ? (
 <div className="mb-6">
 <h2 className="text-base font-semibold text-primary-900 mb-3">Select a vacancy to schedule interviews</h2>
 <p className="text-sm text-neutral-600 mb-4">
 Jobs with shortlisted candidates are listed below. Select one to view its schedule and manage invites.
 </p>
 {!jobsWithShortlistedLoading && jobsWithShortlisted.length > 0 && (
 <div className="dashboard-surface shadow-sm p-4 mb-4">
 <div className="flex flex-col sm:flex-row gap-3">
 <div className="relative flex-1 min-w-0">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
 <input
 type="text"
 placeholder="Search by job title or company..."
 value={jobCardsSearch}
 onChange={(e) => setJobCardsSearch(e.target.value)}
 className="w-full pl-9 pr-3 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
 aria-label="Search vacancies"
 />
 </div>
 <select
 value={jobCardsJobFilter}
 onChange={(e) => setJobCardsJobFilter(e.target.value)}
 className="flex-1 min-w-0 px-3 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm bg-white"
 aria-label="Filter by job"
 >
 <option value="">All jobs</option>
 {jobFilterOptions.map((j) => (
 <option key={j.id} value={j.id}>{j.title}</option>
 ))}
 </select>
 {(jobCardsSearch || jobCardsJobFilter) && (
 <button
 type="button"
 onClick={() => {
 setJobCardsSearch('');
 setJobCardsJobFilter('');
 }}
 className="shrink-0 px-3 py-2.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors flex items-center gap-1.5"
 aria-label="Clear all filters"
 >
 <X className="w-4 h-4" />
 Clear filters
 </button>
 )}
 </div>
 </div>
 )}
 {jobsWithShortlistedLoading ? (
 <div className="flex items-center justify-center py-12">
 <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
 </div>
 ) : jobsWithShortlisted.length === 0 ? (
 <div className="dashboard-surface shadow-sm p-8 sm:p-12 text-center">
 <CalendarCheck className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
 <p className="text-neutral-600 mb-4">
 No vacancies have shortlisted candidates yet. Shortlist applicants from the Applications page first.
 </p>
 <Link
 href="/dashboard/applications"
 className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
 >
 Go to Applications
 </Link>
 </div>
 ) : (
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
 {filteredJobCards.length === 0 ? (
 <p className="col-span-full text-sm text-neutral-500 py-8 text-center">
 No vacancies match your search or filters.
 </p>
 ) : null}
 {filteredJobCards.map((j) => (
 <motion.div
 key={j.id}
 className="text-left dashboard-surface shadow-sm hover:shadow-md hover:border-primary-300 transition-all group flex flex-col"
 whileHover={{ y: -2 }}
 >
 <button
 type="button"
 onClick={() => setSelectedJobView(j.id)}
 className="text-left p-4 sm:p-5 pb-3 w-full rounded-t-xl hover:bg-neutral-50/80 transition-colors"
 >
 <h3 className="font-semibold text-primary-900 group-hover:text-primary-700 truncate">
 {j.title}
 </h3>
 {j.company && (
 <p className="text-sm text-neutral-600 mt-0.5 truncate">{j.company}</p>
 )}
 <div className="flex items-center gap-4 mt-3 text-sm">
 <span className="inline-flex items-center gap-1.5 text-indigo-700 font-medium">
 <span>{j.shortlistedCount}</span>
 <span>shortlisted</span>
 </span>
 {j.scheduledCount > 0 && (
 <span className="text-neutral-500">
 {j.scheduledCount} scheduled
 </span>
 )}
 </div>
 <p className="mt-2 text-xs text-primary-600 font-medium">
 {j.scheduledCount > 0 ? 'View schedule & invites' : 'Open job workspace'} →
 </p>
 </button>
 <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0">
 <Link
 href={scheduleUrlForJob(j.id)}
 className="inline-flex items-center justify-center w-full gap-2 px-3 py-2.5 bg-primary-900 text-white rounded-lg hover:bg-primary-800 text-sm font-medium"
 >
 <Plus className="w-4 h-4 shrink-0" />
 Schedule interviews
 </Link>
 </div>
 </motion.div>
 ))}
 </div>
 )}
 </div>
 ) : (
 <div className="mb-6 space-y-4">
 {/* Filters + export by day (single toolbar) */}
 <div className="dashboard-surface shadow-sm overflow-hidden">
 <div className="p-4 sm:p-5 border-b border-neutral-100">
 <h3 className="text-sm font-semibold text-primary-900 mb-4">Filters</h3>
 <div className="flex flex-col sm:flex-row sm:items-end gap-4">
 <div className="min-w-0 flex-1 sm:max-w-[280px]">
 <label htmlFor="interview-job-view" className="block text-sm font-medium text-primary-900 mb-1.5">
 Job
 </label>
 <select
 id="interview-job-view"
 value={selectedJobView}
 onChange={(e) => setSelectedJobView(e.target.value)}
 className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 >
 <option value="">← Back to job list</option>
 <option value="all">All jobs</option>
 {jobs.map((j) => (
 <option key={j.id} value={j.id}>{j.title}</option>
 ))}
 </select>
 </div>
 <div className="flex flex-wrap items-end gap-3 flex-1">
 <div className="flex items-center gap-2">
 <Filter className="w-4 h-4 text-neutral-500 shrink-0" aria-hidden />
 <div>
 <label htmlFor="filter-date-from" className="sr-only">Date from</label>
 <input
 id="filter-date-from"
 type="date"
 value={filterDateFrom}
 onChange={(e) => setFilterDateFrom(e.target.value)}
 className="px-3 py-2.5 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 aria-label="Date from"
 />
 </div>
 </div>
 <span className="text-neutral-400 text-sm hidden sm:inline">to</span>
 <div>
 <label htmlFor="filter-date-to" className="sr-only">Date to</label>
 <input
 id="filter-date-to"
 type="date"
 value={filterDateTo}
 onChange={(e) => setFilterDateTo(e.target.value)}
 className="px-3 py-2.5 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 aria-label="Date to"
 />
 </div>
 <select
 value={filterStatus}
 onChange={(e) => setFilterStatus(e.target.value)}
 className="px-3 py-2.5 border border-neutral-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 aria-label="Filter by status"
 >
 <option value="">All statuses</option>
 <option value="scheduled">Scheduled</option>
 <option value="completed">Completed</option>
 <option value="cancelled">Cancelled</option>
 </select>
 <select
 value={filterInviteSent}
 onChange={(e) => setFilterInviteSent(e.target.value)}
 className="px-3 py-2.5 border border-neutral-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 aria-label="Filter by invite sent"
 >
 <option value="">Invite sent: any</option>
 <option value="yes">Yes</option>
 <option value="no">No</option>
 </select>
 {(filterDateFrom || filterDateTo || filterStatus || filterInviteSent) && (
 <button
 type="button"
 onClick={() => {
 setFilterDateFrom('');
 setFilterDateTo('');
 setFilterStatus('');
 setFilterInviteSent('');
 }}
 className="px-3 py-2.5 text-sm font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors flex items-center gap-1.5 shrink-0"
 aria-label="Clear filters"
 >
 <X className="w-4 h-4" />
 Clear filters
 </button>
 )}
 </div>
 </div>
 </div>
 {/* Export by day — same card, below filters */}
 <div className="px-4 sm:px-5 py-4 bg-neutral-50/80">
 <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 sm:gap-4">
 <div className="min-w-0">
 <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1.5">Export by day</h3>
 <p className="text-xs text-neutral-500 hidden sm:block">PDF for everything scheduled on that date (current job filter).</p>
 </div>
 <div className="flex flex-wrap items-center gap-2 sm:ml-auto">
 <label htmlFor="export-date" className="sr-only">Date for export</label>
 <input
 id="export-date"
 type="date"
 value={exportDate}
 onChange={(e) => setExportDate(e.target.value)}
 className="px-3 py-2 border border-neutral-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
 aria-label="Date for export"
 />
 <button
 type="button"
 onClick={() => handlePreviewPdf(exportScheduleUrl, 'date')}
 disabled={!!exportPreviewing || !!exportDownloading}
 className="inline-flex items-center gap-2 px-3 py-2 border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
 >
 {exportPreviewing === 'date' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
 Preview
 </button>
 <button
 type="button"
 onClick={() => handleDownloadPdf(exportScheduleUrl, 'date')}
 disabled={!!exportDownloading || !!exportPreviewing}
 className="inline-flex items-center gap-2 px-3 py-2 bg-primary-900 text-white rounded-lg text-sm font-medium hover:bg-primary-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
 >
 {exportDownloading === 'date' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
 Download PDF
 </button>
 </div>
 </div>
 </div>
 </div>
 </div>
 )}

 {selectedJobView !== '' &&
 !loading &&
 (interviews.length > 0 || (selectedJobView !== 'all' && scheduleBreaks.length > 0)) && (
 <>
 {/* Single bar: everything for current table selection */}
 {selectedCount > 0 && exportSelectedUrl && (
 <div className="mb-4 rounded-xl border border-primary-200 bg-primary-50/40 shadow-sm overflow-hidden">
 <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-primary-100/80 flex flex-wrap items-center gap-2 justify-between gap-y-2">
 <div>
 <h3 className="text-sm font-semibold text-primary-900">Selected in table</h3>
 <p className="text-xs text-neutral-600 mt-0.5">
 {selectedCount} interview{selectedCount !== 1 ? 's' : ''} — PDF, edit, delete, or send invites
 </p>
 </div>
 </div>
 <div className="px-4 py-3 sm:px-5 sm:py-4 flex flex-wrap items-center gap-2 bg-white/70">
 <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400 w-full sm:w-auto sm:mr-1">PDF</span>
 <button
 type="button"
 onClick={() => handlePreviewPdf(exportSelectedUrl, 'selected')}
 disabled={!!exportPreviewing || !!exportDownloading}
 className="inline-flex items-center gap-2 px-3 py-2 border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
 >
 {exportPreviewing === 'selected' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
 Preview PDF
 </button>
 <button
 type="button"
 onClick={() => handleDownloadPdf(exportSelectedUrl, 'selected')}
 disabled={!!exportDownloading || !!exportPreviewing}
 className="inline-flex items-center gap-2 px-3 py-2 border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
 >
 {exportDownloading === 'selected' ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
 Download PDF ({selectedCount})
 </button>
 <span className="hidden sm:inline w-px h-6 bg-neutral-200 mx-1 self-center" aria-hidden />
 <span className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400 w-full sm:w-auto sm:ml-2 sm:mr-1">Actions</span>
 <button
 type="button"
 onClick={openEditBulk}
 className="inline-flex items-center gap-2 px-3 py-2 border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 bg-white hover:bg-neutral-50 transition-colors"
 >
 <Pencil className="w-4 h-4" />
 Edit
 </button>
 <button
 type="button"
 onClick={() => setDeleteConfirm({ bulk: selectedCount })}
 className="inline-flex items-center gap-2 px-3 py-2 border border-red-200 rounded-lg text-sm font-medium text-red-700 bg-white hover:bg-red-50 transition-colors"
 >
 <Trash2 className="w-4 h-4" />
 Delete
 </button>
 {selectedForInvite.length > 0 && (
 <button
 type="button"
 onClick={handleBulkSendInvites}
 disabled={sendingInvites}
 className="inline-flex items-center gap-2 px-4 py-2 bg-primary-900 text-white rounded-lg text-sm font-medium hover:bg-primary-800 disabled:opacity-50 transition-colors sm:ml-auto"
 >
 {sendingInvites ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
 Send {selectedForInvite.length} invite{selectedForInvite.length !== 1 ? 's' : ''}
 </button>
 )}
 </div>
 </div>
 )}
 </>
 )}

 {selectedJobView !== '' && loading && (
 <div className="flex items-center justify-center py-16">
 <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
 </div>
 )}

 {selectedJobView !== '' && !loading && error && (
 <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-800 text-sm">
 {error}
 </div>
 )}

 {selectedJobView !== '' &&
 !loading &&
 !error &&
 interviews.length === 0 &&
 scheduleBreaks.length === 0 &&
 !breaksLoading && (
 <motion.div
 className="dashboard-surface shadow-sm p-8 sm:p-12 text-center"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 >
 <CalendarCheck className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
 <p className="text-neutral-600 text-sm sm:text-base mb-4">
 {selectedJobView === 'all'
 ? 'No interviews scheduled across any job.'
 : 'No interviews scheduled for this job.'}
 </p>
 <div className="flex flex-wrap gap-3 justify-center">
 {selectedJobView !== 'all' && (
 <button
 type="button"
 onClick={() => {
 setBreakForm({
 scheduledAt: toDateTimeLocalNairobi(new Date().toISOString()),
 durationMinutes: 30,
 label: 'Break',
 notes: '',
 });
 setBreakModal('add');
 }}
 className="inline-flex items-center gap-2 px-4 py-2.5 border border-amber-300 bg-amber-50 text-amber-900 rounded-lg hover:bg-amber-100 text-sm font-medium"
 >
 <Coffee className="w-4 h-4" />
 Add schedule break
 </button>
 )}
 <Link
 href={scheduleUrlCurrentJob}
 className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:ring-2 focus:ring-primary-500 text-sm font-medium"
 >
 <Plus className="w-4 h-4" />
 Schedule interviews
 </Link>
 </div>
 </motion.div>
 )}

 {selectedJobView !== '' && !loading && !error && scheduleTimeline.length > 0 && (
 <motion.div
 className="dashboard-surface shadow-sm overflow-hidden"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 >
 <div className="overflow-x-auto">
 <table className="data-table dashboard-data-table w-full text-left">
 <thead>
 <tr className="dashboard-toolbar">
 <th className="px-4 py-3 w-10">
 <input
 type="checkbox"
 checked={
 interviews.length > 0 && selectedIds.size === interviews.length
 }
 onChange={toggleSelectAll}
 className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
 aria-label="Select all interviews"
 />
 </th>
 <th className="col-center px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
 Date & time
 </th>
 <th className="col-center px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
 Duration
 </th>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
 Candidate
 </th>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
 Job
 </th>
 <th className="col-center px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
 Type
 </th>
 <th className="col-center px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
 Status
 </th>
 <th className="col-center px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
 Invite sent
 </th>
 <th className="col-center px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
 Confirmation
 </th>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
 Location / link
 </th>
 <th className="col-right px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider">
 Actions
 </th>
 </tr>
 </thead>
 <tbody>
 {scheduleTimeline.map((row) =>
 row.kind === 'break' ? (
 <tr
 key={`break-${row.b.id}`}
 className="border-b border-amber-100 bg-amber-50/80 hover:bg-amber-50"
 >
 <td className="px-4 py-3 w-10 align-middle">
 <Coffee className="w-4 h-4 text-amber-700" aria-hidden />
 </td>
 <td className="px-4 py-3 text-sm text-amber-900 font-medium whitespace-nowrap">
 {formatDateTime(row.b.scheduledAt)}
 </td>
 <td className="px-4 py-3 text-sm text-amber-800">{row.b.durationMinutes} min</td>
 <td className="px-4 py-3 text-sm text-amber-900 font-semibold" colSpan={1}>
 {row.b.label}
 </td>
 <td className="px-4 py-3 text-sm text-amber-800">—</td>
 <td className="px-4 py-3 text-sm text-amber-700">Break</td>
 <td className="px-4 py-3">
 <span className="inline-flex px-2 py-0.5 rounded-md text-xs font-medium bg-amber-100 text-amber-800">
 break
 </span>
 </td>
 <td className="px-4 py-3 text-neutral-400">—</td>
 <td className="px-4 py-3 text-neutral-400">—</td>
 <td className="px-4 py-3 text-sm text-amber-800 max-w-[180px] truncate" title={row.b.notes ?? ''}>
 {row.b.notes || '—'}
 </td>
 <td className="px-4 py-3 flex flex-wrap items-center gap-2">
 <button
 type="button"
 onClick={() => {
 setBreakForm({
 scheduledAt: toDateTimeLocalNairobi(row.b.scheduledAt),
 durationMinutes: row.b.durationMinutes,
 label: row.b.label,
 notes: row.b.notes ?? '',
 });
 setBreakModal(row.b);
 }}
 className="text-xs font-medium text-amber-800 hover:text-amber-950 inline-flex items-center gap-1"
 >
 <Pencil className="w-3.5 h-3.5" />
 Edit
 </button>
 <button
 type="button"
 onClick={async () => {
 if (!confirm('Remove this break from the schedule?')) return;
 await fetch(`/api/interviews/schedule-breaks/${row.b.id}`, { method: 'DELETE' });
 setScheduleBreaks((prev) => prev.filter((x) => x.id !== row.b.id));
 }}
 className="text-xs font-medium text-red-600 hover:text-red-800 inline-flex items-center gap-1"
 >
 <Trash2 className="w-3.5 h-3.5" />
 Delete
 </button>
 </td>
 </tr>
 ) : (
 (() => {
 const i = row.i;
 return (
 <tr key={i.id} className="border-b border-neutral-100 hover:bg-neutral-50/50">
 <td className="px-4 py-3 w-10">
 <input
 type="checkbox"
 checked={selectedIds.has(i.id)}
 onChange={() => toggleSelect(i.id)}
 className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
 aria-label={`Select ${i.application.candidate.firstName}`}
 />
 </td>
 <td className="col-center px-4 py-3 text-sm text-neutral-900 tabular-nums whitespace-nowrap">
 {formatDateTime(i.scheduledAt)}
 </td>
 <td className="col-center px-4 py-3 text-sm text-neutral-700 tabular-nums">
 {i.durationMinutes ?? 45} min
 </td>
 <td className="px-4 py-3 text-sm text-neutral-900">
 {i.application.candidate.firstName} {i.application.candidate.lastName}
 </td>
 <td className="px-4 py-3 text-sm text-neutral-700">
 {i.application.job.title}
 </td>
 <td className="col-center px-4 py-3 text-sm text-neutral-700 capitalize">
 {TYPE_LABELS[i.type]}
 </td>
 <td className="col-center px-4 py-3">
 <span
 className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${STATUS_STYLES[i.status]}`}
 >
 {i.status}
 </span>
 </td>
 <td className="col-center px-4 py-3 text-sm text-neutral-600 tabular-nums">
 {i.inviteSentAt
 ? formatInNairobi(new Date(i.inviteSentAt), { dateStyle: 'short' })
 : '—'}
 </td>
 <td className="col-center px-4 py-3">
 {i.inviteSentAt ? (
 <span
 className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${CONFIRM_STYLES[i.confirmationStatus ?? 'pending'] ?? CONFIRM_STYLES.pending}`}
 title={i.confirmationNotes ? `Notes: ${i.confirmationNotes}` : undefined}
 >
 {(i.confirmationStatus ?? 'pending').replace(/_/g, ' ')}
 </span>
 ) : (
 <span className="text-neutral-400">—</span>
 )}
 </td>
 <td className="px-4 py-3 text-sm text-neutral-600 max-w-[180px] truncate">
 {i.locationOrLink || '—'}
 </td>
 <td className="col-right px-4 py-3 flex flex-wrap items-center gap-2">
 <button
 type="button"
 onClick={() => openEditSingle(i)}
 className="text-xs font-medium text-neutral-600 hover:text-primary-700 inline-flex items-center gap-1"
 aria-label="Edit"
 >
 <Pencil className="w-3.5 h-3.5" />
 Edit
 </button>
 <button
 type="button"
 onClick={() => setDeleteConfirm({ single: i.id })}
 className="text-xs font-medium text-red-600 hover:text-red-800 inline-flex items-center gap-1"
 aria-label="Delete"
 >
 <Trash2 className="w-3.5 h-3.5" />
 Delete
 </button>
 {i.type === 'video' && (
 i.locationOrLink ? (
 <a
 href={i.locationOrLink}
 target="_blank"
 rel="noopener noreferrer"
 className="text-xs font-medium text-primary-600 hover:text-primary-800 inline-flex items-center gap-1"
 >
 <ExternalLink className="w-3.5 h-3.5" />
 Join
 </a>
 ) : (
 <button
 type="button"
 onClick={() => handleCreateTeamsMeeting(i)}
 disabled={!!creatingMeetingId}
 className="text-xs font-medium text-primary-600 hover:text-primary-800 disabled:opacity-50 inline-flex items-center gap-1"
 >
 {creatingMeetingId === i.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Video className="w-3.5 h-3.5" />}
 Create Teams meeting
 </button>
 )
 )}
 {i.status === 'scheduled' && !i.inviteSentAt && (
 <button
 type="button"
 onClick={() => handleSendSingleInvite(i)}
 disabled={sendingInvites}
 className="text-xs font-medium text-primary-600 hover:text-primary-800 disabled:opacity-50 inline-flex items-center gap-1"
 >
 <Send className="w-3.5 h-3.5" />
 Send invite
 </button>
 )}
 </td>
 </tr>
 );
 })()
 )
 )}
 </tbody>
 </table>
 </div>
 </motion.div>
 )}

 {/* Add / edit schedule break */}
 <AnimatePresence>
 {breakModal && selectedJobView && selectedJobView !== 'all' && (
 <motion.div
 className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 onClick={() => !breakSaving && setBreakModal(null)}
 >
 <motion.div
 className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-neutral-200"
 initial={{ scale: 0.95 }}
 animate={{ scale: 1 }}
 exit={{ scale: 0.95 }}
 onClick={(e) => e.stopPropagation()}
 >
 <h3 className="text-lg font-semibold text-primary-900 mb-4 flex items-center gap-2">
 <Coffee className="w-5 h-5 text-amber-600" />
 {breakModal === 'add' ? 'Add schedule break' : 'Edit break'}
 </h3>
 <p className="text-sm text-neutral-600 mb-4">
 Breaks appear in the timetable and on PDF/HTML exports (lunch, buffers, etc.). Times are Nairobi.
 </p>
 <div className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-primary-900 mb-1">Start</label>
 <input
 type="datetime-local"
 value={breakForm.scheduledAt}
 onChange={(e) => setBreakForm((f) => ({ ...f, scheduledAt: e.target.value }))}
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-primary-900 mb-1">Duration (minutes)</label>
 <select
 value={breakForm.durationMinutes}
 onChange={(e) =>
 setBreakForm((f) => ({ ...f, durationMinutes: parseInt(e.target.value, 10) }))
 }
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm bg-white"
 >
 {[15, 30, 45, 60, 90, 120].map((m) => (
 <option key={m} value={m}>
 {m} min
 </option>
 ))}
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-primary-900 mb-1">Label</label>
 <input
 type="text"
 value={breakForm.label}
 onChange={(e) => setBreakForm((f) => ({ ...f, label: e.target.value }))}
 placeholder="e.g. Lunch, Coffee break"
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-primary-900 mb-1">Notes (optional)</label>
 <textarea
 value={breakForm.notes}
 onChange={(e) => setBreakForm((f) => ({ ...f, notes: e.target.value }))}
 rows={2}
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm resize-y"
 />
 </div>
 </div>
 <div className="flex justify-end gap-2 mt-6">
 <button
 type="button"
 disabled={breakSaving}
 onClick={() => setBreakModal(null)}
 className="px-4 py-2 text-sm font-medium border border-neutral-300 rounded-lg hover:bg-neutral-50"
 >
 Cancel
 </button>
 <button
 type="button"
 disabled={breakSaving || !breakForm.scheduledAt.trim()}
 onClick={async () => {
 setBreakSaving(true);
 try {
 if (breakModal === 'add') {
 const res = await fetch('/api/interviews/schedule-breaks', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 jobId: selectedJobView,
 scheduledAt: breakForm.scheduledAt,
 durationMinutes: breakForm.durationMinutes,
 label: breakForm.label,
 notes: breakForm.notes || undefined,
 }),
 });
 const data = await res.json();
 if (!res.ok) throw new Error(data.error || 'Failed');
 setScheduleBreaks((prev) => [...prev, data].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt)));
 } else {
 const res = await fetch(`/api/interviews/schedule-breaks/${breakModal.id}`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 scheduledAt: breakForm.scheduledAt,
 durationMinutes: breakForm.durationMinutes,
 label: breakForm.label,
 notes: breakForm.notes || null,
 }),
 });
 const data = await res.json();
 if (!res.ok) throw new Error(data.error || 'Failed');
 setScheduleBreaks((prev) =>
 prev.map((x) => (x.id === breakModal.id ? data : x)).sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt))
 );
 }
 setBreakModal(null);
 } catch {
 alert('Could not save break.');
 } finally {
 setBreakSaving(false);
 }
 }}
 className="px-4 py-2 text-sm font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50"
 >
 {breakSaving ? 'Saving…' : 'Save'}
 </button>
 </div>
 </motion.div>
 </motion.div>
 )}
 </AnimatePresence>

 {/* Edit modal (single or bulk) */}
 <AnimatePresence>
 {editOpen && (
 <motion.div
 className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 onClick={() => !editSaving && setEditOpen(false)}
 >
 <motion.div
 className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
 initial={{ scale: 0.95, opacity: 0 }}
 animate={{ scale: 1, opacity: 1 }}
 exit={{ scale: 0.95, opacity: 0 }}
 onClick={(e) => e.stopPropagation()}
 >
 <div className="flex items-center justify-between p-4 border-b border-neutral-200">
 <h2 className="text-lg font-semibold text-primary-900">
 {editInterview ? 'Edit interview' : `Edit ${editIds.length} interviews`}
 </h2>
 <button
 type="button"
 onClick={() => !editSaving && setEditOpen(false)}
 className="p-1 rounded-lg text-neutral-500 hover:bg-neutral-100"
 aria-label="Close"
 >
 <X className="w-5 h-5" />
 </button>
 </div>
 <form onSubmit={handleEditSubmit} className="p-4 space-y-4">
 {editError && (
 <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{editError}</p>
 )}
 {!editInterview && (
 <p className="text-sm text-neutral-600">Set the same values for all selected interviews. Leave date empty to keep current times.</p>
 )}
 <div>
 <label className="block text-sm font-medium text-neutral-700 mb-1">Date & time</label>
 <input
 type="datetime-local"
 value={editForm.scheduledAt}
 onChange={(e) => setEditForm((f) => ({ ...f, scheduledAt: e.target.value }))}
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
 required={!!editInterview}
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-neutral-700 mb-1">Duration</label>
 <select
 value={editForm.durationMinutes}
 onChange={(e) => setEditForm((f) => ({ ...f, durationMinutes: Number(e.target.value) as InterviewDurationMinutes }))}
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
 >
 {DURATION_OPTIONS.map((opt) => (
 <option key={opt.value} value={opt.value}>{opt.label}</option>
 ))}
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-neutral-700 mb-1">Type</label>
 <select
 value={editForm.type}
 onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value as InterviewType }))}
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
 >
 <option value="phone">Phone</option>
 <option value="video">Video</option>
 <option value="onsite">On-site</option>
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-neutral-700 mb-1">Status</label>
 <select
 value={editForm.status}
 onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value as InterviewStatus }))}
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
 >
 <option value="scheduled">Scheduled</option>
 <option value="completed">Completed</option>
 <option value="cancelled">Cancelled</option>
 </select>
 </div>
 <div>
 <label className="block text-sm font-medium text-neutral-700 mb-1">Location / link <span className="text-red-600">*</span></label>
 <input
 type="text"
 value={editForm.locationOrLink}
 onChange={(e) => setEditForm((f) => ({ ...f, locationOrLink: e.target.value }))}
 placeholder="e.g. Zoom link or office address"
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm"
 required
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-neutral-700 mb-1">Notes (optional)</label>
 <textarea
 value={editForm.notes}
 onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))}
 rows={2}
 className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm resize-none"
 />
 </div>
 <div className="flex gap-3 pt-2">
 <button
 type="button"
 onClick={() => !editSaving && setEditOpen(false)}
 className="flex-1 px-4 py-2.5 border border-neutral-300 rounded-lg text-neutral-700 hover:bg-neutral-50 text-sm font-medium"
 >
 Cancel
 </button>
 <button
 type="submit"
 disabled={editSaving}
 className="flex-1 px-4 py-2.5 bg-primary-900 text-white rounded-lg hover:bg-primary-800 disabled:opacity-50 text-sm font-medium inline-flex items-center justify-center gap-2"
 >
 {editSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
 {editSaving ? 'Saving…' : 'Save'}
 </button>
 </div>
 </form>
 </motion.div>
 </motion.div>
 )}
 </AnimatePresence>

 {/* Delete confirmation */}
 <AnimatePresence>
 {deleteConfirm && (
 <motion.div
 className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 exit={{ opacity: 0 }}
 >
 <motion.div
 className="bg-white rounded-xl shadow-xl w-full max-w-sm p-6"
 initial={{ scale: 0.95 }}
 animate={{ scale: 1 }}
 exit={{ scale: 0.95 }}
 >
 <h3 className="text-lg font-semibold text-primary-900 mb-2">Delete interview(s)?</h3>
 <p className="text-sm text-neutral-600 mb-6">
 {'single' in deleteConfirm
 ? 'This interview will be permanently removed.'
 : `${deleteConfirm.bulk} interview(s) will be permanently removed.`}
 </p>
 <div className="flex gap-3 justify-end">
 <button
 type="button"
 onClick={() => !deleteDeleting && setDeleteConfirm(null)}
 disabled={deleteDeleting}
 className="px-4 py-2.5 border border-neutral-300 rounded-lg text-neutral-700 hover:bg-neutral-50 text-sm font-medium disabled:opacity-50"
 >
 Cancel
 </button>
 <button
 type="button"
 onClick={handleDeleteConfirm}
 disabled={deleteDeleting}
 className="px-4 py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 text-sm font-medium inline-flex items-center justify-center gap-2 disabled:opacity-50"
 >
 {deleteDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
 {deleteDeleting ? 'Deleting…' : 'Delete'}
 </button>
 </div>
 </motion.div>
 </motion.div>
 )}
 </AnimatePresence>
 </DashboardPage>
 );
}
