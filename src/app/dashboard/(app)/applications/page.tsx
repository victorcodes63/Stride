'use client';

import { motion } from 'framer-motion';
import { useState, useMemo, useEffect } from 'react';
import {
 Users,
 Search,
 Eye,
 ChevronDown,
 ChevronLeft,
 ChevronRight,
 Mail,
 Phone,
 MapPin,
 FileText,
 X,
 Building2,
 Calendar,
 FileSpreadsheet,
 User,
 Briefcase,
 GraduationCap,
 Award,
 ExternalLink,
 Download,
 Send,
 Loader2,
} from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import type {
 ApplicationWithDetails,
 ApplicationListItem,
 ApplicationStatus,
 ApplicationFormData,
} from '@/types/dashboard';
import { sortEmploymentByRecency, yearsBetweenEmploymentDates } from '@/lib/employment-sort';

/** Bundled demo PDF — used when an application has no uploaded CV yet. */
const STANDARD_DEMO_CV_URL = '/uploads/resumes/amara_njoroge_cv.pdf';

function normalizeResumeUrl(raw: string) {
 const t = raw.trim();
 if (!t) return '';
 if (t.startsWith('http://') || t.startsWith('https://') || t.startsWith('/')) return t;
 return `/${t.replace(/^\/+/, '')}`;
}

function resolveResumePreview(candidatePath: string | null | undefined, applicationPath: string | null | undefined) {
 const url = normalizeResumeUrl(applicationPath || '') || normalizeResumeUrl(candidatePath || '');
 if (url) return { url, isPlaceholder: false as const };
 return { url: STANDARD_DEMO_CV_URL, isPlaceholder: true as const };
}

function StatusBadge({ status }: { status: ApplicationStatus }) {
 const styles: Record<ApplicationStatus, string> = {
 pending: 'bg-amber-50 text-amber-700',
 reviewed: 'bg-blue-50 text-blue-700',
 shortlisted: 'bg-indigo-50 text-indigo-700',
 rejected: 'bg-red-50 text-red-700',
 hired: 'bg-emerald-50 text-emerald-700',
 };
 return (
 <span
 className={`inline-flex px-2 py-0.5 rounded-md text-xs font-medium ${styles[status]}`}
 >
 {status}
 </span>
 );
}

function formatDate(iso: string) {
 const d = new Date(iso);
 const now = new Date();
 const diffDays = Math.floor(
 (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
 );
 if (diffDays === 0) return 'Today';
 if (diffDays === 1) return 'Yesterday';
 if (diffDays < 7) return `${diffDays} days ago`;
 return d.toLocaleDateString();
}

function formatDateRange(start: string, end: string) {
 if (!start?.trim()) return '—';
 const endStr = (end || '').trim().toLowerCase();
 const endLabel = !endStr || endStr === 'present' || endStr === 'current' ? 'Present' : end;
 return `${start} – ${endLabel}`;
}

type ApplicantDetailTab = 'general' | 'preview' | 'experience' | 'education' | 'certifications';

const APPLICANT_TABS: { id: ApplicantDetailTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
 { id: 'general', label: 'General', icon: User },
 { id: 'preview', label: 'CV preview', icon: Eye },
 { id: 'experience', label: 'Work experience', icon: Briefcase },
 { id: 'education', label: 'Education', icon: GraduationCap },
 { id: 'certifications', label: 'Certifications', icon: Award },
];

function WorkExperienceTab({ formData }: { formData: ApplicationFormData | null }) {
 const raw = formData?.employmentHistory?.filter(
 (e) => e.jobTitle?.trim() || e.companyName?.trim()
 ) ?? [];
 const entries = sortEmploymentByRecency(raw);
 const totalYears = entries.reduce(
 (sum, e) => {
 const end = e.isCurrentJob ? 'Present' : (e.endDate ?? '');
 return sum + yearsBetweenEmploymentDates(e.startDate ?? '', end);
 },
 0
 );
 return (
 <div className="space-y-4">
 {entries.length > 0 && (
 <div className="rounded-lg bg-primary-50/50 border border-primary-100 px-3 py-2">
 <p className="text-sm font-medium text-primary-900">
 Total relevant experience: <span className="tabular-nums">{totalYears}</span> years
 </p>
 </div>
 )}
 {entries.length === 0 ? (
 <p className="text-sm text-neutral-500">No work experience provided.</p>
 ) : (
 <ul className="space-y-4">
 {entries.map((e, i) => (
 <li key={i} className="border border-neutral-200 rounded-lg p-4 bg-neutral-50/50">
 <p className="font-medium text-primary-900">{e.jobTitle || '—'}</p>
 <p className="text-sm text-neutral-600">{e.companyName || '—'}</p>
 <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-neutral-500">
 <span>{e.industry || '—'}</span>
 <span>{e.employmentType}</span>
 <span className="tabular-nums">
 {formatDateRange(e.startDate, e.isCurrentJob ? 'Present' : (e.endDate || ''))}
 {' · '}
 {yearsBetweenEmploymentDates(e.startDate ?? '', e.isCurrentJob ? 'Present' : (e.endDate ?? ''))} yrs
 </span>
 {e.isCurrentJob && <span className="text-primary-600">Current job</span>}
 </div>
 </li>
 ))}
 </ul>
 )}
 </div>
 );
}

function EducationTab({ formData }: { formData: ApplicationFormData | null }) {
 const entries = formData?.education?.filter(
 (e) => e.institution?.trim() || e.grade?.trim() || (e.discipline ?? '').trim() || e.level
 ) ?? [];
 const levelLabel = (level: string) =>
 level.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
 return (
 <div className="space-y-4">
 {entries.length === 0 ? (
 <p className="text-sm text-neutral-500">No education details provided.</p>
 ) : (
 <ul className="space-y-4">
 {entries.map((e, i) => (
 <li key={i} className="border border-neutral-200 rounded-lg p-4 bg-neutral-50/50">
 <p className="font-medium text-primary-900">{levelLabel(e.level)}</p>
 <p className="text-sm text-neutral-600">{e.institution || '—'}</p>
 {e.grade && (
 <p className="text-sm text-neutral-600 mt-0.5">Grade: {e.grade}</p>
 )}
 {(e.discipline ?? '').trim() && (
 <p className="text-sm text-neutral-600 mt-0.5">Discipline: {e.discipline}</p>
 )}
 {e.certificatePath && (
 <div className="mt-2">
 <a
 href={e.certificatePath}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 hover:text-primary-800"
 >
 <FileText className="w-4 h-4" />
 View certificate
 </a>
 <div className="mt-2 rounded border border-neutral-200 bg-white overflow-hidden min-h-[200px] max-h-[320px]">
 <iframe
 title={`Certificate ${e.level}`}
 src={e.certificatePath}
 className="w-full h-[280px] border-0"
 />
 </div>
 </div>
 )}
 </li>
 ))}
 </ul>
 )}
 </div>
 );
}

function CertificationsTab({ formData }: { formData: ApplicationFormData | null }) {
 const list = formData?.professionalCertificationsList ?? [];
 const memberships = formData?.professionalMemberships ?? [];
 const hasList = list.length > 0;
 const hasMemberships = memberships.length > 0;
 const hasAny = hasList || hasMemberships;
 return (
 <div className="space-y-4">
 {!hasAny ? (
 <p className="text-sm text-neutral-500">No professional certifications or memberships provided.</p>
 ) : (
 <>
 {list.length > 0 && (
 <div>
 <h3 className="text-sm font-medium text-neutral-700 mb-2">Professional certifications</h3>
 <ul className="space-y-3">
 {list.map((c, i) => (
 <li key={i} className="rounded-lg bg-neutral-50 p-4 border border-neutral-200">
 <p className="font-medium text-neutral-800">{c.name}</p>
 {c.certificatePath && (
 <a
 href={c.certificatePath}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:underline mt-2"
 >
 <ExternalLink className="w-4 h-4" />
 View certificate
 </a>
 )}
 </li>
 ))}
 </ul>
 </div>
 )}
 {memberships.length > 0 && (
 <div>
 <h3 className="text-sm font-medium text-neutral-700 mb-2">Professional memberships</h3>
 <ul className="space-y-3">
 {memberships.map((m, i) => (
 <li key={i} className="rounded-lg bg-neutral-50 p-4 border border-neutral-200">
 <p className="font-medium text-neutral-800">{m.name || '—'}</p>
 <p className="text-sm text-neutral-600">Membership no.: {m.membershipNo || '—'}</p>
 {m.certificatePath && (
 <a
 href={m.certificatePath}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:underline mt-2"
 >
 <ExternalLink className="w-4 h-4" />
 View certificate
 </a>
 )}
 </li>
 ))}
 </ul>
 </div>
 )}
 </>
 )}
 </div>
 );
}

const EDUCATION_LEVEL_OPTIONS = [
 { value: '', label: 'All education levels' },
 { value: 'high_school', label: 'High School' },
 { value: 'certificate', label: 'Certificate' },
 { value: 'diploma', label: 'Diploma' },
 { value: 'undergraduate', label: 'Undergraduate' },
 { value: 'masters', label: 'Masters' },
 { value: 'phd', label: 'PhD / Doctorate' },
];

const EMPLOYMENT_TYPE_OPTIONS = [
 { value: '', label: 'All employment types' },
 { value: 'Full-time', label: 'Full-time' },
 { value: 'Contract', label: 'Contract' },
 { value: 'Freelance', label: 'Freelance' },
];

const STATUS_OPTIONS: { value: 'all' | ApplicationStatus; label: string }[] = [
 { value: 'all', label: 'All statuses' },
 { value: 'pending', label: 'Pending' },
 { value: 'reviewed', label: 'Reviewed' },
 { value: 'shortlisted', label: 'Shortlisted' },
 { value: 'rejected', label: 'Rejected' },
 { value: 'hired', label: 'Hired' },
];

type JobOption = {
 id: string;
 title: string;
 company: string;
 clientId?: string | null;
 postedDate?: string;
};

export default function DashboardApplicationsPage() {
 const [jobs, setJobs] = useState<JobOption[]>([]);
 const [statusFilter, setStatusFilter] = useState<string>('all');
 const [jobFilter, setJobFilter] = useState('');
 const [nationalityFilter, setNationalityFilter] = useState('');
 const [homeCountyFilter, setHomeCountyFilter] = useState('');
 const [educationLevelFilter, setEducationLevelFilter] = useState('');
 const [disciplineFilter, setDisciplineFilter] = useState('');
 const [certificateFilter, setCertificateFilter] = useState('');
 const [membershipFilter, setMembershipFilter] = useState('');
 const [employmentTypeFilter, setEmploymentTypeFilter] = useState('');
 const [minExperienceFilter, setMinExperienceFilter] = useState('');
 const [maxExperienceFilter, setMaxExperienceFilter] = useState('');
 const [employerCompanyFilter, setEmployerCompanyFilter] = useState('');
 const [searchQuery, setSearchQuery] = useState('');
 const [debouncedSearch, setDebouncedSearch] = useState('');
 const [selectedApp, setSelectedApp] = useState<ApplicationWithDetails | null>(
 null
 );
 const [loadingDetails, setLoadingDetails] = useState(false);
 const [statusDropdownOpen, setStatusDropdownOpen] = useState<string | null>(
 null
 );
 const [applicantDetailTab, setApplicantDetailTab] = useState<ApplicantDetailTab>('general');
 const [notesDraft, setNotesDraft] = useState('');
 const [applications, setApplications] = useState<ApplicationListItem[]>([]);
 const [listStats, setListStats] = useState({
 total: 0,
 pending: 0,
 shortlisted: 0,
 hired: 0,
 });
 const [page, setPage] = useState(1);
 const [totalPages, setTotalPages] = useState(1);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [refreshNonce, setRefreshNonce] = useState(0);
 const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
 const [downloadingCvs, setDownloadingCvs] = useState(false);
 const [sendingRejections, setSendingRejections] = useState(false);
 const [bulkResult, setBulkResult] = useState<string | null>(null);
 const [qualificationsExpanded, setQualificationsExpanded] = useState(false);

 const markAsViewed = (appId: string) => {
 setApplications((prev) =>
 prev.map((a) => (a.id === appId ? { ...a, viewedByMe: true } : a))
 );
 fetch(`/api/applications/${appId}/view`, { method: 'POST' }).catch(() => {});
 };

 useEffect(() => {
 let cancelled = false;
 fetch('/api/jobs')
 .then((r) => r.json())
 .then((jobsData) => {
 if (!cancelled && Array.isArray(jobsData)) {
 setJobs(
 jobsData.map((j: { id: string; title: string; company: string; clientId?: string | null; postedDate?: string }) => ({
 id: j.id,
 title: j.title,
 company: j.company,
 clientId: j.clientId ?? null,
 postedDate: j.postedDate,
 }))
 );
 }
 })
 .catch(() => {});
 return () => { cancelled = true; };
 }, []);

 useEffect(() => {
 const t = setTimeout(() => setDebouncedSearch(searchQuery), 300);
 return () => clearTimeout(t);
 }, [searchQuery]);

 useEffect(() => {
 let cancelled = false;
 const params = new URLSearchParams();
 if (statusFilter && statusFilter !== 'all') params.set('status', statusFilter);
 if (jobFilter.trim()) params.set('jobId', jobFilter.trim());
 if (nationalityFilter.trim()) params.set('nationality', nationalityFilter.trim());
 if (homeCountyFilter.trim()) params.set('homeCounty', homeCountyFilter.trim());
 if (educationLevelFilter.trim()) params.set('educationLevel', educationLevelFilter.trim());
 if (disciplineFilter.trim()) params.set('discipline', disciplineFilter.trim());
 if (certificateFilter.trim()) params.set('certificate', certificateFilter.trim());
 if (membershipFilter.trim()) params.set('membership', membershipFilter.trim());
 if (employmentTypeFilter.trim()) params.set('employmentType', employmentTypeFilter.trim());
 if (minExperienceFilter.trim()) params.set('minExperience', minExperienceFilter.trim());
 if (maxExperienceFilter.trim()) params.set('maxExperience', maxExperienceFilter.trim());
 if (employerCompanyFilter.trim()) params.set('employerCompany', employerCompanyFilter.trim());
 if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
 params.set('page', String(page));
 params.set('limit', '25');
 fetch(`/api/applications?${params}`)
 .then((r) => r.json())
 .then((data) => {
 if (cancelled) return;
 if (data?.applications && Array.isArray(data.applications)) {
 setApplications(data.applications);
 setListStats({
 total: data.total ?? 0,
 pending: data.pending ?? 0,
 shortlisted: data.shortlisted ?? 0,
 hired: data.hired ?? 0,
 });
 const limit = 25;
 setTotalPages(Math.max(1, Math.ceil((data.total ?? 0) / limit)));
 } else {
 setApplications([]);
 }
 })
 .catch(() => {
 if (!cancelled) setError('Failed to load applications.');
 })
 .finally(() => {
 if (!cancelled) setLoading(false);
 });
 return () => { cancelled = true; };
 }, [
 statusFilter,
 jobFilter,
 nationalityFilter,
 homeCountyFilter,
 educationLevelFilter,
 disciplineFilter,
 certificateFilter,
 membershipFilter,
 employmentTypeFilter,
 minExperienceFilter,
 maxExperienceFilter,
 employerCompanyFilter,
 debouncedSearch,
 page,
 refreshNonce,
 ]);

 useEffect(() => {
 if (selectedApp) setApplicantDetailTab('general');
 }, [selectedApp?.id]);

 const filteredJobOptions = useMemo(() => {
 return [...jobs].sort((a, b) => {
 const aTime = a.postedDate ? new Date(a.postedDate).getTime() : 0;
 const bTime = b.postedDate ? new Date(b.postedDate).getTime() : 0;
 return bTime - aTime;
 });
 }, [jobs]);

 useEffect(() => {
 setNotesDraft(selectedApp?.notes ?? '');
 }, [selectedApp?.id, selectedApp?.notes]);

 const saveNotesIfDirty = async () => {
 if (!selectedApp) return;
 const current = selectedApp.notes ?? '';
 if (notesDraft === current) return;
 try {
 const res = await fetch(`/api/applications/${selectedApp.id}`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ notes: notesDraft }),
 });
 if (!res.ok) return;
 const updated = await res.json();
 setApplications((prev) =>
 prev.map((a) => (a.id === selectedApp.id ? { ...a, notes: updated.notes } : a))
 );
 setSelectedApp((prev) =>
 prev && prev.id === selectedApp.id ? { ...prev, notes: updated.notes } : prev
 );
 } catch {
 // keep draft on error
 }
 };

 const filteredApplications = applications;

 useEffect(() => {
 setPage(1);
 }, [
 statusFilter,
 jobFilter,
 nationalityFilter,
 homeCountyFilter,
 educationLevelFilter,
 disciplineFilter,
 certificateFilter,
 membershipFilter,
 employmentTypeFilter,
 minExperienceFilter,
 maxExperienceFilter,
 employerCompanyFilter,
 debouncedSearch,
 ]);

 const extraQualificationFiltersActive =
 !!membershipFilter.trim() ||
 !!nationalityFilter.trim() ||
 !!homeCountyFilter.trim() ||
 !!employmentTypeFilter.trim() ||
 !!minExperienceFilter.trim() ||
 !!maxExperienceFilter.trim() ||
 !!employerCompanyFilter.trim();

 const hasActiveFilters =
 statusFilter !== 'all' ||
 !!jobFilter.trim() ||
 !!nationalityFilter.trim() ||
 !!homeCountyFilter.trim() ||
 !!educationLevelFilter.trim() ||
 !!disciplineFilter.trim() ||
 !!certificateFilter.trim() ||
 !!membershipFilter.trim() ||
 !!employmentTypeFilter.trim() ||
 !!minExperienceFilter.trim() ||
 !!maxExperienceFilter.trim() ||
 !!employerCompanyFilter.trim();

 const clearFilters = () => {
 setStatusFilter('all');
 setJobFilter('');
 setNationalityFilter('');
 setHomeCountyFilter('');
 setEducationLevelFilter('');
 setDisciplineFilter('');
 setCertificateFilter('');
 setMembershipFilter('');
 setEmploymentTypeFilter('');
 setMinExperienceFilter('');
 setMaxExperienceFilter('');
 setEmployerCompanyFilter('');
 };

 const exportParams = useMemo(
 () =>
 new URLSearchParams({
 ...(statusFilter && statusFilter !== 'all' && { status: statusFilter }),
 ...(jobFilter.trim() && { jobId: jobFilter.trim() }),
 ...(nationalityFilter.trim() && { nationality: nationalityFilter.trim() }),
 ...(homeCountyFilter.trim() && { homeCounty: homeCountyFilter.trim() }),
 ...(educationLevelFilter.trim() && { educationLevel: educationLevelFilter.trim() }),
 ...(disciplineFilter.trim() && { discipline: disciplineFilter.trim() }),
 ...(certificateFilter.trim() && { certificate: certificateFilter.trim() }),
 ...(membershipFilter.trim() && { membership: membershipFilter.trim() }),
 ...(employmentTypeFilter.trim() && { employmentType: employmentTypeFilter.trim() }),
 ...(minExperienceFilter.trim() && { minExperience: minExperienceFilter.trim() }),
 ...(maxExperienceFilter.trim() && { maxExperience: maxExperienceFilter.trim() }),
 ...(employerCompanyFilter.trim() && { employerCompany: employerCompanyFilter.trim() }),
 }).toString(),
 [
 statusFilter,
 jobFilter,
 nationalityFilter,
 homeCountyFilter,
 educationLevelFilter,
 disciplineFilter,
 certificateFilter,
 membershipFilter,
 employmentTypeFilter,
 minExperienceFilter,
 maxExperienceFilter,
 employerCompanyFilter,
 ]
 );

 const stats = listStats;

 const selectedApplications = useMemo(
 () => filteredApplications.filter((a) => selectedIds.has(a.id)),
 [filteredApplications, selectedIds]
 );
 const selectedForDownload = useMemo(
 () =>
 selectedApplications.filter(
 (a) =>
 a.status === 'shortlisted' &&
 (a.resumePath || a.candidate.resumePath)
 ),
 [selectedApplications]
 );
 const selectedForRejection = useMemo(
 () => selectedApplications.filter((a) => a.status === 'rejected'),
 [selectedApplications]
 );

 const toggleSelect = (id: string) => {
 setSelectedIds((prev) => {
 const next = new Set(prev);
 if (next.has(id)) next.delete(id);
 else next.add(id);
 return next;
 });
 setBulkResult(null);
 };
 const toggleSelectAll = () => {
 if (selectedIds.size === filteredApplications.length) {
 setSelectedIds(new Set());
 } else {
 setSelectedIds(new Set(filteredApplications.map((a) => a.id)));
 }
 setBulkResult(null);
 };

 const handleBulkDownloadCvs = async () => {
 if (selectedForDownload.length === 0) return;
 setDownloadingCvs(true);
 setBulkResult(null);
 try {
 const res = await fetch('/api/applications/bulk-download-cvs', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 applicationIds: selectedForDownload.map((a) => a.id),
 }),
 });
 if (!res.ok) {
 const data = await res.json().catch(() => ({}));
 setBulkResult(data.error || 'Download failed.');
 return;
 }
 const blob = await res.blob();
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = `shortlisted-cvs-${new Date().toISOString().slice(0, 10)}.zip`;
 a.click();
 URL.revokeObjectURL(url);
 setBulkResult(`Downloaded ${selectedForDownload.length} CV(s).`);
 setSelectedIds(new Set());
 } catch {
 setBulkResult('Download failed.');
 } finally {
 setDownloadingCvs(false);
 }
 };

 const handleBulkSendRejections = async () => {
 if (selectedForRejection.length === 0) return;
 setSendingRejections(true);
 setBulkResult(null);
 try {
 const res = await fetch('/api/applications/bulk-send-rejections', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 applicationIds: selectedForRejection.map((a) => a.id),
 }),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) {
 setBulkResult(data.error || 'Failed to send rejection emails.');
 return;
 }
 setBulkResult(`Sent ${data.sent} rejection email(s).${data.failed ? ` ${data.failed} failed.` : ''}`);
 setSelectedIds(new Set());
 setRefreshNonce((n) => n + 1);
 } catch {
 setBulkResult('Failed to send rejection emails.');
 } finally {
 setSendingRejections(false);
 }
 };

 const handleStatusChange = async (
 applicationId: string,
 newStatus: ApplicationStatus
 ) => {
 setStatusDropdownOpen(null);
 try {
 const res = await fetch(`/api/applications/${applicationId}`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ status: newStatus }),
 });
 if (!res.ok) return;
 const updated = await res.json();
 setApplications((prev) =>
 prev.map((a) => (a.id === applicationId ? { ...a, status: updated.status } : a))
 );
 setSelectedApp((prev) =>
 prev && prev.id === applicationId
 ? { ...prev, status: newStatus }
 : prev
 );
 // Force a fast re-fetch so counters and filtered list stay accurate.
 setRefreshNonce((n) => n + 1);
 } catch (_e) {
 // keep UI state
 }
 };

 const filterInputClass =
 'w-full px-3 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors';

 return (
 <DashboardPage>
 <DashboardPageHeader
 title="Applications"
 description="Review and manage job applications. Status updates can notify applicants by email."
 />

 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
 <motion.div
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 className="relative overflow-hidden dashboard-surface p-5 shadow-sm min-w-0"
 >
 <div className="absolute right-4 top-1/2 -translate-y-1/2 rounded-xl bg-primary-50 p-3 text-primary-700">
 <Users className="w-5 h-5" strokeWidth={1.75} />
 </div>
 <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Total</p>
 <p className="text-3xl font-bold text-primary-900 tabular-nums">{stats.total}</p>
 <p className="text-xs text-neutral-500 mt-1">All applications</p>
 </motion.div>
 <motion.div
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.05 }}
 className="relative overflow-hidden dashboard-surface p-5 shadow-sm min-w-0"
 >
 <div className="absolute right-4 top-1/2 -translate-y-1/2 rounded-xl bg-amber-50 p-3 text-amber-700">
 <Calendar className="w-5 h-5" strokeWidth={1.75} />
 </div>
 <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Pending</p>
 <p className="text-3xl font-bold text-amber-600 tabular-nums">{stats.pending}</p>
 <p className="text-xs text-neutral-500 mt-1">Awaiting review</p>
 </motion.div>
 <motion.div
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.1 }}
 className="relative overflow-hidden dashboard-surface p-5 shadow-sm min-w-0"
 >
 <div className="absolute right-4 top-1/2 -translate-y-1/2 rounded-xl bg-indigo-50 p-3 text-indigo-700">
 <Eye className="w-5 h-5" strokeWidth={1.75} />
 </div>
 <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Shortlisted</p>
 <p className="text-3xl font-bold text-indigo-600 tabular-nums">{stats.shortlisted}</p>
 <p className="text-xs text-neutral-500 mt-1">In pipeline</p>
 </motion.div>
 <motion.div
 initial={{ opacity: 0, y: 10 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.15 }}
 className="relative overflow-hidden dashboard-surface p-5 shadow-sm min-w-0"
 >
 <div className="absolute right-4 top-1/2 -translate-y-1/2 rounded-xl bg-emerald-50 p-3 text-emerald-700">
 <Briefcase className="w-5 h-5" strokeWidth={1.75} />
 </div>
 <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Hired</p>
 <p className="text-3xl font-bold text-emerald-600 tabular-nums">{stats.hired}</p>
 <p className="text-xs text-neutral-500 mt-1">Placed</p>
 </motion.div>
 </div>

 <div className="dashboard-surface shadow-sm overflow-visible mb-6">
 {/* Search & application filters */}
 <div className="p-4 sm:p-5 border-b border-neutral-100 bg-gradient-to-b from-white to-neutral-50/40">
 <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
 <div>
 <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-0.5">
 Search &amp; application
 </p>
 <p className="text-xs text-neutral-500">Find rows and narrow by status and job.</p>
 </div>
 <a
 href={exportParams ? `/api/applications/export?${exportParams}` : '/api/applications/export'}
 className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary-900 text-white text-sm font-semibold shadow-sm shadow-primary-900/15 hover:bg-primary-800 transition-colors shrink-0"
 download
 title="Export applications (current filters)"
 >
 <FileSpreadsheet className="w-4 h-4" />
 Export
 </a>
 </div>
 <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
 <div className="relative lg:col-span-5">
 <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
 <input
 type="text"
 placeholder="Search by name, email, or job title…"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 rounded-xl text-sm bg-neutral-50/80 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
 aria-label="Search applications"
 />
 </div>
 <select
 value={statusFilter}
 onChange={(e) => setStatusFilter(e.target.value)}
 className={`${filterInputClass} lg:col-span-2`}
 aria-label="Status"
 >
 {STATUS_OPTIONS.map((o) => (
 <option key={o.value} value={o.value}>
 {o.label}
 </option>
 ))}
 </select>
 <select
 value={jobFilter}
 onChange={(e) => setJobFilter(e.target.value)}
 className={`${filterInputClass} lg:col-span-5 truncate min-w-0`}
 aria-label="Job"
 >
 <option value="">All jobs</option>
 {filteredJobOptions.map((j) => (
 <option key={j.id} value={j.id}>
 {j.title} · {j.company}
 </option>
 ))}
 </select>
 </div>
 <div className="flex flex-wrap justify-end items-center gap-2 mt-4 pt-3 border-t border-neutral-100/80">
 {hasActiveFilters && (
 <button
 type="button"
 onClick={clearFilters}
 className="inline-flex items-center px-3 py-2 dashboard-surface text-neutral-600 hover:bg-neutral-50 text-sm font-medium transition-colors"
 >
 Clear filters
 </button>
 )}
 {selectedIds.size > 0 && (
 <>
 <span className="text-sm text-neutral-600">{selectedIds.size} selected</span>
 {selectedForDownload.length > 0 && (
 <button
 type="button"
 onClick={handleBulkDownloadCvs}
 disabled={downloadingCvs}
 className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 text-sm font-medium transition-colors disabled:opacity-50"
 title="Download CVs for shortlisted candidates"
 >
 {downloadingCvs ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
 Download CVs ({selectedForDownload.length})
 </button>
 )}
 {selectedForRejection.length > 0 && (
 <button
 type="button"
 onClick={handleBulkSendRejections}
 disabled={sendingRejections}
 className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 bg-red-50 text-red-800 hover:bg-red-100 text-sm font-medium transition-colors disabled:opacity-50"
 title="Send rejection emails to rejected applicants"
 >
 {sendingRejections ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
 Send rejection emails ({selectedForRejection.length})
 </button>
 )}
 <button
 type="button"
 onClick={() => { setSelectedIds(new Set()); setBulkResult(null); }}
 className="inline-flex items-center px-3 py-2 rounded-lg border border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50 text-sm font-medium transition-colors"
 >
 Clear selection
 </button>
 </>
 )}
 {bulkResult && (
 <span className="text-sm text-neutral-600">{bulkResult}</span>
 )}
 </div>
 </div>

 {/* Candidate & qualifications — first row always; rest expandable */}
 <div className="p-4 sm:p-5 bg-primary-50/25 border-t border-primary-100/50">
 <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
 <div>
 <p className="text-[11px] font-bold uppercase tracking-widest text-primary-800/80 mb-1">
 Candidate &amp; qualifications
 </p>
 <p className="text-xs text-neutral-600 max-w-3xl">
 Start with education and credentials. Open more filters for location, experience, and employer.
 </p>
 </div>
 {!qualificationsExpanded && extraQualificationFiltersActive && (
 <span className="text-[11px] font-semibold text-primary-700 bg-primary-100/80 px-2 py-1 rounded-lg shrink-0 self-start">
 Extra filters active
 </span>
 )}
 </div>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
 <select
 value={educationLevelFilter}
 onChange={(e) => setEducationLevelFilter(e.target.value)}
 className={filterInputClass}
 aria-label="Education level"
 title="Education level (e.g. Masters)"
 >
 {EDUCATION_LEVEL_OPTIONS.map((o) => (
 <option key={o.value} value={o.value}>
 {o.label}
 </option>
 ))}
 </select>
 <input
 type="text"
 value={disciplineFilter}
 onChange={(e) => setDisciplineFilter(e.target.value)}
 placeholder="Discipline (e.g. Nursing)"
 className={filterInputClass}
 aria-label="Education discipline"
 />
 <input
 type="text"
 value={certificateFilter}
 onChange={(e) => setCertificateFilter(e.target.value)}
 placeholder="Certificate (e.g. BioHacking)"
 className={filterInputClass}
 aria-label="Professional certificate name"
 />
 </div>
 <div className="mt-3 flex justify-end">
 <button
 type="button"
 onClick={() => setQualificationsExpanded((e) => !e)}
 className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-800 hover:text-primary-600 py-1.5 px-2 rounded-lg hover:bg-primary-100/50 transition-colors"
 aria-expanded={qualificationsExpanded}
 aria-controls="qualifications-extra-filters"
 >
 <ChevronDown
 className={`w-4 h-4 shrink-0 transition-transform ${qualificationsExpanded ? 'rotate-180' : ''}`}
 aria-hidden
 />
 {qualificationsExpanded ? 'Hide extra filters' : 'More filters — location, experience, employer'}
 </button>
 </div>
 {qualificationsExpanded && (
 <div
 id="qualifications-extra-filters"
 className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 pt-2 mt-2 border-t border-primary-100/60"
 >
 <input
 type="text"
 value={membershipFilter}
 onChange={(e) => setMembershipFilter(e.target.value)}
 placeholder="Membership (e.g. KPMDU)"
 className={filterInputClass}
 aria-label="Professional membership name"
 />
 <input
 type="text"
 value={nationalityFilter}
 onChange={(e) => setNationalityFilter(e.target.value)}
 placeholder="Nationality"
 className={filterInputClass}
 aria-label="Nationality"
 />
 <input
 type="text"
 value={homeCountyFilter}
 onChange={(e) => setHomeCountyFilter(e.target.value)}
 placeholder="Home county"
 className={filterInputClass}
 aria-label="Home county"
 />
 <select
 value={employmentTypeFilter}
 onChange={(e) => setEmploymentTypeFilter(e.target.value)}
 className={filterInputClass}
 aria-label="Employment type"
 >
 {EMPLOYMENT_TYPE_OPTIONS.map((o) => (
 <option key={o.value} value={o.value}>
 {o.label}
 </option>
 ))}
 </select>
 <input
 type="number"
 value={minExperienceFilter}
 onChange={(e) => setMinExperienceFilter(e.target.value)}
 min={0}
 placeholder="Min years exp"
 className={filterInputClass}
 aria-label="Minimum work experience years"
 />
 <input
 type="number"
 value={maxExperienceFilter}
 onChange={(e) => setMaxExperienceFilter(e.target.value)}
 min={0}
 placeholder="Max years exp"
 className={filterInputClass}
 aria-label="Maximum work experience years"
 />
 <input
 type="text"
 value={employerCompanyFilter}
 onChange={(e) => setEmployerCompanyFilter(e.target.value)}
 placeholder="Worked at firm (e.g. Safaricom)"
 className={`${filterInputClass} xl:col-span-2`}
 aria-label="Employer company name"
 />
 </div>
 )}
 </div>
 </div>

 {loading ? (
 <div className="dashboard-surface shadow-sm p-8 sm:p-12 text-center">
 <p className="text-neutral-600">Loading applications...</p>
 </div>
 ) : error ? (
 <div className="dashboard-surface shadow-sm p-8 sm:p-12 text-center">
 <p className="text-red-600">{error}</p>
 </div>
 ) : filteredApplications.length === 0 ? (
 <div className="dashboard-surface shadow-sm p-8 sm:p-12 text-center">
 <Users className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
 <p className="text-neutral-600">
 No applications match your filters.
 </p>
 </div>
 ) : (
 <div className="dashboard-surface shadow-sm overflow-visible min-w-0">
 <div className="overflow-x-auto">
 <table className="data-table dashboard-data-table w-full min-w-[720px]">
 <thead>
 <tr className="dashboard-toolbar">
 <th className="w-10 px-5 py-3">
 <input
 type="checkbox"
 checked={filteredApplications.length > 0 && selectedIds.size === filteredApplications.length}
 onChange={toggleSelectAll}
 className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
 aria-label="Select all"
 />
 </th>
 <th className="text-xs font-semibold uppercase tracking-wider text-neutral-500 px-5 py-3">
 Candidate
 </th>
 <th className="text-xs font-semibold uppercase tracking-wider text-neutral-500 px-5 py-3">
 Job
 </th>
 <th className="col-center text-xs font-semibold uppercase tracking-wider text-neutral-500 px-5 py-3">
 Applied
 </th>
 <th className="col-center text-xs font-semibold uppercase tracking-wider text-neutral-500 px-5 py-3">
 Status
 </th>
 <th className="col-right text-xs font-semibold uppercase tracking-wider text-neutral-500 px-5 py-3">
 Actions
 </th>
 </tr>
 </thead>
 <tbody className="divide-y divide-neutral-100">
 {filteredApplications.map((app) => {
 const isUnread = app.viewedByMe === false;
 return (
 <motion.tr
 key={app.id}
 initial={{ opacity: 0 }}
 animate={{ opacity: 1 }}
 className={`transition-colors ${
 isUnread
 ? 'bg-primary-50 hover:bg-primary-100/60 border-l-2 border-l-primary-500'
 : 'hover:bg-neutral-50/70 border-l-2 border-l-transparent'
 }`}
 >
 <td className="px-5 py-3">
 <input
 type="checkbox"
 checked={selectedIds.has(app.id)}
 onChange={() => toggleSelect(app.id)}
 className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
 aria-label={`Select ${app.candidate.firstName} ${app.candidate.lastName}`}
 />
 </td>
 <td className="px-5 py-3">
 <div className="flex items-center gap-3">
 <div className="relative">
 <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${isUnread ? 'bg-primary-600' : 'bg-primary-100'}`}>
 <span className={`font-semibold text-sm ${isUnread ? 'text-white' : 'text-primary-700'}`}>
 {app.candidate.firstName[0]}
 {app.candidate.lastName[0]}
 </span>
 </div>
 {isUnread && (
 <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-amber-400 rounded-full border-2 border-white" />
 )}
 </div>
 <div>
 <p className={`text-sm ${isUnread ? 'font-bold text-primary-900' : 'font-medium text-neutral-600'}`}>
 {app.candidate.firstName} {app.candidate.lastName}
 </p>
 <p className={`text-xs ${isUnread ? 'text-primary-700' : 'text-neutral-400'}`}>
 {app.candidate.email}
 </p>
 </div>
 </div>
 </td>
 <td className="px-5 py-3">
 <div>
 <p className={`text-sm ${isUnread ? 'font-semibold text-primary-900' : 'font-medium text-neutral-600'}`}>
 {app.job.title}
 </p>
 <p className={`text-xs ${isUnread ? 'text-neutral-500' : 'text-neutral-400'}`}>
 {app.job.company} · {app.job.location}
 </p>
 </div>
 </td>
 <td className={`col-center px-5 py-3 text-sm tabular-nums ${isUnread ? 'text-neutral-700 font-medium' : 'text-neutral-400'}`}>
 {formatDate(app.appliedDate)}
 </td>
 <td className="col-center px-5 py-3">
 <div className="relative">
 <button
 type="button"
 onClick={() =>
 setStatusDropdownOpen(
 statusDropdownOpen === app.id ? null : app.id
 )
 }
 className="inline-flex items-center gap-1"
 >
 <StatusBadge status={app.status} />
 <ChevronDown className="w-4 h-4 text-neutral-400" />
 </button>
 {statusDropdownOpen === app.id && (
 <div className="absolute left-0 top-full mt-1 py-1 bg-white border border-neutral-200 rounded-lg shadow-lg z-10 min-w-[140px]">
 {(
 STATUS_OPTIONS.filter(
 (o) => o.value !== 'all'
 ) as { value: ApplicationStatus; label: string }[]
 ).map((o) => (
 <button
 key={o.value}
 type="button"
 onClick={() =>
 handleStatusChange(app.id, o.value)
 }
 className="block w-full text-left px-4 py-2 text-sm hover:bg-neutral-100"
 >
 {o.label}
 </button>
 ))}
 </div>
 )}
 </div>
 </td>
 <td className="col-right px-5 py-3">
 <button
 type="button"
 onClick={async () => {
 if (isUnread) markAsViewed(app.id);
 setLoadingDetails(true);
 try {
 const res = await fetch(`/api/applications/${app.id}`);
 if (res.ok) {
 const full = await res.json();
 setSelectedApp(full);
 }
 } finally {
 setLoadingDetails(false);
 }
 }}
 className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 transition-colors"
 >
 <Eye className="w-3.5 h-3.5" />
 View
 </button>
 </td>
 </motion.tr>
 );})}
 </tbody>
 </table>
 </div>
 {totalPages > 1 && (
 <div className="flex items-center justify-between px-5 py-4 border-t border-neutral-200 bg-neutral-50/50">
 <p className="text-sm text-neutral-600">
 Page {page} of {totalPages} · {stats.total} total
 </p>
 <div className="flex items-center gap-2">
 <button
 type="button"
 onClick={() => setPage((p) => Math.max(1, p - 1))}
 disabled={page <= 1}
 className="inline-flex items-center gap-1 px-3 py-2 dashboard-surface rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
 >
 <ChevronLeft className="w-4 h-4" />
 Previous
 </button>
 <button
 type="button"
 onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
 disabled={page >= totalPages}
 className="inline-flex items-center gap-1 px-3 py-2 dashboard-surface rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
 >
 Next
 <ChevronRight className="w-4 h-4" />
 </button>
 </div>
 </div>
 )}
 </div>
 )}

 {selectedApp && (() => {
 const currentIndex = filteredApplications.findIndex((a) => a.id === selectedApp.id);
 const total = filteredApplications.length;
 const hasPrev = currentIndex > 0;
 const hasNext = currentIndex >= 0 && currentIndex < total - 1;
 const prevApp = hasPrev ? filteredApplications[currentIndex - 1] : null;
 const nextApp = hasNext ? filteredApplications[currentIndex + 1] : null;
 return (
 <>
 <div
 className="fixed inset-0 bg-neutral-900/20 z-40"
 onClick={() => setSelectedApp(null)}
 aria-hidden
 />
 <div
 className="fixed right-0 top-0 bottom-0 h-screen max-h-dvh w-[66.666vw] min-w-[24rem] max-w-[56rem] bg-white border-l border-neutral-200 shadow-sm z-50 flex flex-col min-h-0 rounded-l-xl"
 >
 <div className="sticky top-0 z-10 bg-white border-b border-neutral-200 rounded-tl-xl">
 <div className="px-4 py-3 flex items-center justify-between gap-2">
 <h2 className="text-base font-semibold text-primary-900 truncate min-w-0">
 Application details
 </h2>
 <div className="flex items-center gap-1 shrink-0">
 <button
 type="button"
 onClick={async () => {
 await saveNotesIfDirty();
 if (prevApp) {
 setLoadingDetails(true);
 try {
 const res = await fetch(`/api/applications/${prevApp.id}`);
 if (res.ok) setSelectedApp(await res.json());
 } finally {
 setLoadingDetails(false);
 }
 }
 }}
 disabled={!hasPrev}
 className="p-2 rounded-lg text-neutral-600 hover:bg-neutral-100 hover:text-primary-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
 aria-label="Previous candidate"
 >
 <ChevronLeft className="w-5 h-5" />
 </button>
 <span className="text-xs text-neutral-500 tabular-nums min-w-[4rem] text-center">
 {currentIndex + 1} of {total}
 </span>
 <button
 type="button"
 onClick={async () => {
 await saveNotesIfDirty();
 if (nextApp) {
 setLoadingDetails(true);
 try {
 const res = await fetch(`/api/applications/${nextApp.id}`);
 if (res.ok) setSelectedApp(await res.json());
 } finally {
 setLoadingDetails(false);
 }
 }
 }}
 disabled={!hasNext}
 className="p-2 rounded-lg text-neutral-600 hover:bg-neutral-100 hover:text-primary-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
 aria-label="Next candidate"
 >
 <ChevronRight className="w-5 h-5" />
 </button>
 <button
 type="button"
 onClick={async () => {
 await saveNotesIfDirty();
 setSelectedApp(null);
 }}
 className="p-2 text-neutral-500 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors"
 aria-label="Close"
 >
 <X className="w-5 h-5" />
 </button>
 </div>
 </div>
 <div className="flex border-t border-neutral-100">
 {APPLICANT_TABS.map(({ id, label, icon: Icon }) => (
 <button
 key={id}
 type="button"
 onClick={async () => {
 if (applicantDetailTab === 'general') await saveNotesIfDirty();
 setApplicantDetailTab(id);
 }}
 className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 text-xs font-medium transition-colors border-b-2 min-w-0 ${
 applicantDetailTab === id
 ? 'border-primary-600 text-primary-900'
 : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
 }`}
 >
 <Icon className="w-3.5 h-3.5 shrink-0" />
 <span className="hidden sm:inline truncate">{label}</span>
 </button>
 ))}
 </div>
 </div>
 <div
 className={
 applicantDetailTab === 'preview'
 ? 'flex-1 flex flex-col min-h-0 overflow-hidden px-5 pb-4 pt-1'
 : 'flex-1 overflow-y-auto p-5 min-h-0'
 }
 >
 {loadingDetails ? (
 <div className="flex items-center justify-center py-12">
 <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
 </div>
 ) : (
 <>
 {applicantDetailTab === 'general' && (
 <div className="space-y-5">
 <div>
 <h3 className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-2">
 Candidate
 </h3>
 <p className="text-xl font-semibold text-primary-900">
 {selectedApp.candidate.firstName}{' '}
 {selectedApp.candidate.lastName}
 </p>
 <div className="mt-2 space-y-1 text-sm text-neutral-600">
 <p className="flex items-center gap-2">
 <Mail className="w-4 h-4 text-neutral-400 shrink-0" />
 {selectedApp.candidate.email}
 </p>
 {selectedApp.candidate.phone && (
 <p className="flex items-center gap-2">
 <Phone className="w-4 h-4 text-neutral-400 shrink-0" />
 {selectedApp.candidate.phone}
 </p>
 )}
 {selectedApp.candidate.location && (
 <p className="flex items-center gap-2">
 <MapPin className="w-4 h-4 text-neutral-400 shrink-0" />
 {selectedApp.candidate.location}
 </p>
 )}
 {selectedApp.candidate.nationality && (
 <p>Nationality: {selectedApp.candidate.nationality}</p>
 )}
 {selectedApp.candidate.homeCounty && (
 <p>Home county: {selectedApp.candidate.homeCounty}</p>
 )}
 {selectedApp.formData?.gender && (
 <p>Gender: {selectedApp.formData.gender}</p>
 )}
 <p>
 {selectedApp.candidate.experience} years experience
 {selectedApp.candidate.education &&
 ` · ${selectedApp.candidate.education}`}
 </p>
 {selectedApp.salaryExpectations && (
 <p>
 <span className="font-medium text-neutral-500">Minimum expected salary:</span>{' '}
 {selectedApp.salaryExpectations}
 </p>
 )}
 </div>
 </div>

 <div>
 <h3 className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-2">
 Minimum qualifications for this role
 </h3>
 <ul className="space-y-2 text-sm text-neutral-700">
 <li>
 <span className="font-medium text-neutral-500">Experience:</span>{' '}
 {selectedApp.job.minYearsExperience != null
 ? `Minimum ${selectedApp.job.minYearsExperience} years`
 : 'Not specified'}
 </li>
 <li>
 <span className="font-medium text-neutral-500">Education:</span>{' '}
 {selectedApp.job.educationLevel?.trim() || selectedApp.job.educationQualification?.trim()
 ? [selectedApp.job.educationLevel, selectedApp.job.educationQualification].filter(Boolean).join(' · ')
 : 'Not specified'}
 </li>
 <li>
 <span className="font-medium text-neutral-500">Certifications:</span>{' '}
 {selectedApp.job.requiredCertifications?.trim() || 'Not specified'}
 </li>
 </ul>
 <p className="text-sm text-neutral-500 flex items-center gap-1 mt-3 pt-3 border-t border-neutral-100">
 <Building2 className="w-4 h-4 shrink-0" />
 Applied to {selectedApp.job.title} · {selectedApp.job.company}
 </p>
 <p className="text-sm text-neutral-500 flex items-center gap-1 mt-1">
 <Calendar className="w-4 h-4" />
 Applied {formatDate(selectedApp.appliedDate)}
 </p>
 <div className="mt-2">
 <StatusBadge status={selectedApp.status} />
 </div>
 </div>

 <div>
 <h3 className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-2">
 Cover letter
 </h3>
 <p className="text-sm text-neutral-700 whitespace-pre-wrap bg-neutral-50 p-4 rounded-lg min-h-[4rem]">
 {selectedApp.coverLetter?.trim() || (
 <span className="text-neutral-400 italic">No cover letter provided.</span>
 )}
 </p>
 </div>

 <div>
 <h3 className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-2">
 Internal notes
 </h3>
 <textarea
 value={notesDraft}
 onChange={(e) => setNotesDraft(e.target.value)}
 placeholder="Add internal notes (saves when you switch tab or candidate)..."
 rows={4}
 className="w-full text-sm text-neutral-700 bg-amber-50/50 p-4 rounded-lg border border-amber-100 focus:ring-2 focus:ring-amber-200 focus:border-amber-300 resize-y min-h-[6rem]"
 />
 </div>

 <div className="pt-4 border-t border-neutral-200">
 <p className="text-xs text-neutral-500 mb-3">
 Update status
 </p>
 <div className="flex flex-wrap gap-2">
 {(STATUS_OPTIONS.filter(
 (o) => o.value !== 'all'
 ) as { value: ApplicationStatus; label: string }[]).map(
 (o) => (
 <button
 key={o.value}
 type="button"
 onClick={() => {
 handleStatusChange(selectedApp.id, o.value);
 setSelectedApp({
 ...selectedApp,
 status: o.value,
 });
 }}
 className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
 selectedApp.status === o.value
 ? 'bg-primary-900 text-white'
 : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
 }`}
 >
 {o.label}
 </button>
 )
 )}
 </div>
 </div>
 </div>
 )}

 {applicantDetailTab === 'preview' && (() => {
 const { url, isPlaceholder } = resolveResumePreview(
 selectedApp.candidate.resumePath,
 selectedApp.resumePath,
 );
 const isPdf = /\.pdf($|\?|#)/i.test(url);
 const basePdf = url.split('#')[0] ?? url;
 const iframeSrc = isPdf
 ? `${basePdf}#view=FitH&toolbar=1&navpanes=0`
 : url;
 return (
 <div className="flex flex-1 flex-col min-h-0 gap-3">
 {isPlaceholder ? (
 <p className="shrink-0 text-xs leading-relaxed text-neutral-700 rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
 <span className="font-medium text-neutral-900">Demo preview.</span> No résumé on file —
 showing a sample CV. Use tabs above for structured application data.
 </p>
 ) : (
 <p
 className="shrink-0 text-xs text-neutral-500 truncate"
 title={url}
 >
 File: <span className="font-mono text-neutral-700">{url}</span>
 </p>
 )}
 <div className="flex shrink-0 items-center justify-between gap-3 border-b border-neutral-100 pb-2">
 <span className="text-xs font-medium uppercase tracking-wide text-neutral-500">
 Document
 </span>
 {isPdf ? (
 <span className="text-[11px] text-neutral-400">
 Use the viewer toolbar to zoom and page through the PDF.
 </span>
 ) : null}
 </div>
 <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-neutral-300 bg-[#525659] shadow-inner ring-1 ring-black/10">
 {isPdf ? (
 <iframe
 title="CV preview"
 src={iframeSrc}
 className="block w-full border-0 bg-neutral-800"
 style={{
 height: 'clamp(440px, calc(100dvh - 12.25rem), 920px)',
 }}
 />
 ) : (
 <div className="flex flex-col items-center justify-center min-h-[280px] flex-1 p-8 text-center bg-white">
 <FileText className="w-12 h-12 text-neutral-300 mb-3" />
 <p className="text-sm text-neutral-600 mb-1">Preview is not available for this file type.</p>
 <p className="text-xs text-neutral-500 mb-4">Open or download the file to view it.</p>
 <a
 href={url}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
 >
 <ExternalLink className="w-4 h-4" />
 Open file
 </a>
 </div>
 )}
 </div>
 <div className="flex shrink-0 flex-wrap gap-x-4 gap-y-2 border-t border-neutral-100 pt-3 text-sm">
 <a
 href={url}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-2 font-medium text-primary-600 hover:text-primary-800"
 >
 <ExternalLink className="w-4 h-4" />
 {isPdf ? 'Open in new tab' : 'Open in new tab'}
 </a>
 <a
 href={url}
 download={
 isPdf ? (url.split('/').pop()?.split('?')[0] || 'resume.pdf') : undefined
 }
 className="inline-flex items-center gap-2 font-medium text-primary-600 hover:text-primary-800"
 >
 <Download className="w-4 h-4" />
 Download
 </a>
 </div>
 </div>
 );
 })()}

 {applicantDetailTab === 'experience' && (
 <WorkExperienceTab formData={selectedApp.formData} />
 )}

 {applicantDetailTab === 'education' && (
 <EducationTab formData={selectedApp.formData} />
 )}

 {applicantDetailTab === 'certifications' && (
 <CertificationsTab formData={selectedApp.formData} />
 )}
 </>
 )}
 </div>
 </div>
 </>
 );
 })()}
 </DashboardPage>
 );
}
