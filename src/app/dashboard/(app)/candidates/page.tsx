'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
 Users,
 Search,
 MapPin,
 FileText,
 Loader2,
 Eye,
 ChevronLeft,
 ChevronRight,
 X,
 Mail,
 Phone,
 Building2,
 ZoomIn,
 ZoomOut,
 User,
 Briefcase,
 GraduationCap,
 Award,
 Download,
 Calendar,
} from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import type { CandidateListItem } from '@/types/dashboard';
import type { CandidateWithDetails } from '@/app/api/candidates/[id]/route';
import { WorkExperienceTab, EducationTab, CertificationsTab } from '@/components/dashboard/CandidateDetailTabs';

const filterInputClass =
 'px-3 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors min-w-0';

type CandidateDetailTab = 'general' | 'experience' | 'education' | 'certifications';

const CANDIDATE_TABS: { id: CandidateDetailTab; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
 { id: 'general', label: 'General & CV', icon: User },
 { id: 'experience', label: 'Work experience', icon: Briefcase },
 { id: 'education', label: 'Education', icon: GraduationCap },
 { id: 'certifications', label: 'Certifications', icon: Award },
];

function formatDate(iso: string) {
 const d = new Date(iso);
 const now = new Date();
 const diffDays = Math.floor((now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24));
 if (diffDays === 0) return 'Today';
 if (diffDays === 1) return 'Yesterday';
 if (diffDays < 7) return `${diffDays} days ago`;
 return d.toLocaleDateString();
}

export default function DashboardCandidatesPage() {
 const [searchQuery, setSearchQuery] = useState('');
 const [debouncedSearch, setDebouncedSearch] = useState('');
 const [jobFilter, setJobFilter] = useState('');
 const [minExperience, setMinExperience] = useState('');
 const [maxExperience, setMaxExperience] = useState('');
 const [educationFilter, setEducationFilter] = useState('');
 const [employerCompanyFilter, setEmployerCompanyFilter] = useState('');
 const [candidates, setCandidates] = useState<CandidateListItem[]>([]);
 const [jobOptions, setJobOptions] = useState<{ id: string; title: string }[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [selectedCandidate, setSelectedCandidate] = useState<CandidateListItem | null>(null);
 const [candidateDetails, setCandidateDetails] = useState<CandidateWithDetails | null>(null);
 const [loadingDetails, setLoadingDetails] = useState(false);
 const [detailTab, setDetailTab] = useState<CandidateDetailTab>('general');
 const [pdfZoom, setPdfZoom] = useState(100);
 const [page, setPage] = useState(1);
 const [totalPages, setTotalPages] = useState(1);
 const [totalCandidates, setTotalCandidates] = useState(0);
 const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
 const [downloadingResumes, setDownloadingResumes] = useState(false);
 const [bulkResult, setBulkResult] = useState<string | null>(null);
 const [dbStats, setDbStats] = useState<{
 total: number;
 withResume: number;
 avgExperienceYears: number;
 addedLast30Days: number;
 withLocation: number;
 } | null>(null);

 useEffect(() => {
 let cancelled = false;
 fetch('/api/candidates/stats')
 .then((r) => (r.ok ? r.json() : null))
 .then((data) => {
 if (!cancelled && data && typeof data.total === 'number') setDbStats(data);
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
 if (jobFilter) params.set('jobId', jobFilter);
 if (minExperience.trim()) params.set('minExperience', minExperience.trim());
 if (maxExperience.trim()) params.set('maxExperience', maxExperience.trim());
 if (educationFilter.trim()) params.set('education', educationFilter.trim());
 if (employerCompanyFilter.trim()) params.set('employerCompany', employerCompanyFilter.trim());
 if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
 params.set('page', String(page));
 params.set('limit', '25');
 Promise.all([
 fetch(`/api/candidates?${params}`).then((r) => r.json()),
 fetch('/api/jobs').then((r) => r.json()),
 ])
 .then(([data, jobs]) => {
 if (!cancelled) {
 const cands = data?.candidates ?? (Array.isArray(data) ? data : []);
 setCandidates(Array.isArray(cands) ? cands : []);
 setTotalCandidates(data?.total ?? cands.length);
 setTotalPages(data?.totalPages ?? 1);
 setJobOptions(Array.isArray(jobs) ? jobs.map((j: { id: string; title: string }) => ({ id: j.id, title: j.title })) : []);
 }
 })
 .catch(() => {
 if (!cancelled) setError('Failed to load candidates.');
 })
 .finally(() => {
 if (!cancelled) setLoading(false);
 });
 return () => { cancelled = true; };
 }, [jobFilter, minExperience, maxExperience, educationFilter, employerCompanyFilter, debouncedSearch, page]);

 useEffect(() => {
 setPage(1);
 }, [jobFilter, minExperience, maxExperience, educationFilter, employerCompanyFilter, debouncedSearch]);

 useEffect(() => {
 if (!selectedCandidate) {
 setCandidateDetails(null);
 return;
 }
 setDetailTab('general');
 setLoadingDetails(true);
 fetch(`/api/candidates/${selectedCandidate.id}`)
 .then((r) => (r.ok ? r.json() : null))
 .then((data) => setCandidateDetails(data as CandidateWithDetails | null))
 .catch(() => setCandidateDetails(null))
 .finally(() => setLoadingDetails(false));
 }, [selectedCandidate?.id]);

 const filtered = candidates;
 const selectedWithResume = filtered.filter(
 (c) => selectedIds.has(c.id) && c.resumePath
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
 if (selectedIds.size === filtered.length) {
 setSelectedIds(new Set());
 } else {
 setSelectedIds(new Set(filtered.map((c) => c.id)));
 }
 setBulkResult(null);
 };

 const handleBulkDownloadResumes = async () => {
 if (selectedWithResume.length === 0) return;
 setDownloadingResumes(true);
 setBulkResult(null);
 try {
 const res = await fetch('/api/candidates/bulk-download-resumes', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 candidateIds: selectedWithResume.map((c) => c.id),
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
 a.download = `candidate-resumes-${new Date().toISOString().slice(0, 10)}.zip`;
 a.click();
 URL.revokeObjectURL(url);
 setBulkResult(`Downloaded ${selectedWithResume.length} resume(s).`);
 setSelectedIds(new Set());
 } catch {
 setBulkResult('Download failed.');
 } finally {
 setDownloadingResumes(false);
 }
 };

 const hasActiveFilters =
 !!searchQuery.trim() ||
 !!jobFilter ||
 !!minExperience.trim() ||
 !!maxExperience.trim() ||
 !!educationFilter.trim() ||
 !!employerCompanyFilter.trim();
 const clearFilters = () => {
 setSearchQuery('');
 setJobFilter('');
 setMinExperience('');
 setMaxExperience('');
 setEducationFilter('');
 setEmployerCompanyFilter('');
 };

 return (
 <DashboardPage>
 <DashboardPageHeader
 title="Candidates"
 description="Applicant database: totals below are for everyone stored; the table respects your filters."
 />

 {dbStats && (
 <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 sm:gap-4 mb-6">
 <div className="relative overflow-hidden dashboard-surface p-4 sm:p-5 shadow-sm min-w-0">
 <div className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-primary-50 p-2.5 text-primary-700 hidden sm:block">
 <Users className="w-4 h-4" strokeWidth={1.75} />
 </div>
 <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Total profiles</p>
 <p className="text-2xl sm:text-3xl font-bold text-primary-900 tabular-nums">{dbStats.total}</p>
 <p className="text-[11px] text-neutral-500 mt-1 leading-tight">In database</p>
 </div>
 <div className="relative overflow-hidden dashboard-surface p-4 sm:p-5 shadow-sm min-w-0">
 <div className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-indigo-50 p-2.5 text-indigo-700 hidden sm:block">
 <FileText className="w-4 h-4" strokeWidth={1.75} />
 </div>
 <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1">With resume</p>
 <p className="text-2xl sm:text-3xl font-bold text-indigo-700 tabular-nums">{dbStats.withResume}</p>
 <p className="text-[11px] text-neutral-500 mt-1 leading-tight">
 {dbStats.total ? `${Math.round((dbStats.withResume / dbStats.total) * 100)}%` : '—'} uploaded CV
 </p>
 </div>
 <div className="relative overflow-hidden dashboard-surface p-4 sm:p-5 shadow-sm min-w-0">
 <div className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-amber-50 p-2.5 text-amber-700 hidden sm:block">
 <Briefcase className="w-4 h-4" strokeWidth={1.75} />
 </div>
 <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1">Avg experience</p>
 <p className="text-2xl sm:text-3xl font-bold text-amber-700 tabular-nums">{dbStats.avgExperienceYears}</p>
 <p className="text-[11px] text-neutral-500 mt-1 leading-tight">Years (profile)</p>
 </div>
 <div className="relative overflow-hidden dashboard-surface p-4 sm:p-5 shadow-sm min-w-0">
 <div className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-emerald-50 p-2.5 text-emerald-700 hidden sm:block">
 <MapPin className="w-4 h-4" strokeWidth={1.75} />
 </div>
 <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1">With location</p>
 <p className="text-2xl sm:text-3xl font-bold text-emerald-700 tabular-nums">{dbStats.withLocation}</p>
 <p className="text-[11px] text-neutral-500 mt-1 leading-tight">Listed city/area</p>
 </div>
 <div className="relative overflow-hidden dashboard-surface p-4 sm:p-5 shadow-sm min-w-0">
 <div className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-sky-50 p-2.5 text-sky-700 hidden sm:block">
 <Calendar className="w-4 h-4" strokeWidth={1.75} />
 </div>
 <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1">New (30 days)</p>
 <p className="text-2xl sm:text-3xl font-bold text-sky-700 tabular-nums">{dbStats.addedLast30Days}</p>
 <p className="text-[11px] text-neutral-500 mt-1 leading-tight">Profiles added</p>
 </div>
 <div className="relative overflow-hidden rounded-2xl border border-primary-200/80 bg-primary-50/30 p-4 sm:p-5 shadow-sm min-w-0 ring-1 ring-primary-100/50">
 <div className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg bg-white/90 p-2.5 text-primary-800 hidden sm:block">
 <Eye className="w-4 h-4" strokeWidth={1.75} />
 </div>
 <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-primary-800/90 mb-1">In table</p>
 <p className="text-2xl sm:text-3xl font-bold text-primary-900 tabular-nums">{loading ? '—' : filtered.length}</p>
 <p className="text-[11px] text-primary-800/80 mt-1 leading-tight">
 {hasActiveFilters ? 'After filters' : 'Same as total'}
 </p>
 </div>
 </div>
 )}

 <div className="dashboard-surface shadow-sm overflow-hidden mb-6">
 <div className="p-4 sm:p-5 border-b border-neutral-100 bg-gradient-to-b from-white to-neutral-50/40">
 <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-4">
 <div>
 <p className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-0.5">
 Search &amp; job
 </p>
 <p className="text-xs text-neutral-500">Find by name or email, optionally limit to one role.</p>
 </div>
 {hasActiveFilters && (
 <button
 type="button"
 onClick={clearFilters}
 className="inline-flex items-center px-3 py-2 dashboard-surface text-neutral-600 hover:bg-neutral-50 text-sm font-medium transition-colors shrink-0 self-start sm:self-auto"
 >
 Clear filters
 </button>
 )}
 </div>
 <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
 <div className="flex-1 relative min-w-0 max-w-xl">
 <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
 <input
 type="text"
 placeholder="Search by name or email…"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 rounded-xl text-sm bg-neutral-50/80 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
 aria-label="Search candidates"
 />
 </div>
 <select
 value={jobFilter}
 onChange={(e) => setJobFilter(e.target.value)}
 className={`${filterInputClass} lg:min-w-[200px] lg:max-w-xs truncate py-2.5`}
 aria-label="Filter by job"
 >
 <option value="">All jobs</option>
 {jobOptions.map((j) => (
 <option key={j.id} value={j.id}>
 {j.title}
 </option>
 ))}
 </select>
 </div>
 {selectedIds.size > 0 && (
 <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-neutral-100/80">
 <span className="text-sm font-medium text-neutral-700">{selectedIds.size} selected</span>
 {selectedWithResume.length > 0 && (
 <button
 type="button"
 onClick={handleBulkDownloadResumes}
 disabled={downloadingResumes}
 className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100 text-sm font-medium transition-colors disabled:opacity-50"
 title="Download resumes for selected candidates"
 >
 {downloadingResumes ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
 Download resumes ({selectedWithResume.length})
 </button>
 )}
 <button
 type="button"
 onClick={() => { setSelectedIds(new Set()); setBulkResult(null); }}
 className="inline-flex items-center px-3 py-2 dashboard-surface text-neutral-600 hover:bg-neutral-50 text-sm font-medium transition-colors"
 >
 Clear selection
 </button>
 {bulkResult && (
 <span className="text-sm text-neutral-600">{bulkResult}</span>
 )}
 </div>
 )}
 </div>

 <div className="p-4 sm:p-5 bg-primary-50/25 border-t border-primary-100/50">
 <p className="text-[11px] font-bold uppercase tracking-widest text-primary-800/80 mb-1">
 Experience &amp; education
 </p>
 <p className="text-xs text-neutral-600 mb-4 max-w-2xl">
 Narrow by years of experience, education keywords, or past employer.
 </p>
 <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
 <input
 type="number"
 placeholder="Min years exp"
 value={minExperience}
 onChange={(e) => setMinExperience(e.target.value)}
 min={0}
 className={filterInputClass}
 aria-label="Minimum experience in years"
 />
 <input
 type="number"
 placeholder="Max years exp"
 value={maxExperience}
 onChange={(e) => setMaxExperience(e.target.value)}
 min={0}
 className={filterInputClass}
 aria-label="Maximum experience in years"
 />
 <input
 type="text"
 placeholder="Education (e.g. MBA, B.Com)"
 value={educationFilter}
 onChange={(e) => setEducationFilter(e.target.value)}
 title="Filter by education field"
 className={filterInputClass}
 aria-label="Filter by education"
 />
 <input
 type="text"
 placeholder="Worked at firm (e.g. Safaricom)"
 value={employerCompanyFilter}
 onChange={(e) => setEmployerCompanyFilter(e.target.value)}
 title="Filter by employer company name from employment history"
 className={`${filterInputClass} lg:col-span-1 sm:col-span-2`}
 aria-label="Filter by employer company"
 />
 </div>
 </div>
 </div>

 {loading ? (
 <div className="dashboard-surface p-14 flex flex-col items-center justify-center gap-4 shadow-sm">
 <Loader2 className="w-9 h-9 text-primary-600 animate-spin" />
 <p className="text-sm text-neutral-500">Loading candidates…</p>
 </div>
 ) : error ? (
 <div className="rounded-2xl border border-red-100 bg-red-50/50 p-8 sm:p-10 text-center shadow-sm">
 <p className="text-red-800 font-medium">{error}</p>
 </div>
 ) : candidates.length === 0 ? (
 <div className="dashboard-surface p-10 sm:p-14 text-center shadow-sm">
 <div className="inline-flex rounded-2xl bg-neutral-100 p-4 mb-5">
 <Users className="w-10 h-10 text-neutral-400" strokeWidth={1.25} />
 </div>
 <p className="text-neutral-800 font-medium mb-1">
 {hasActiveFilters ? 'No matches' : 'No candidates yet'}
 </p>
 <p className="text-sm text-neutral-500 mb-6 max-w-md mx-auto">
 {hasActiveFilters
 ? 'Try clearing filters or broadening search.'
 : 'Candidates appear here after people apply.'}
 </p>
 {hasActiveFilters ? (
 <button
 type="button"
 onClick={clearFilters}
 className="inline-flex items-center px-4 py-2.5 rounded-xl border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
 >
 Clear filters
 </button>
 ) : (
 <Link
 href="/dashboard/applications"
 className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-900 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 transition-colors shadow-sm shadow-primary-900/10"
 >
 View applications
 </Link>
 )}
 </div>
 ) : (
 <div className="dashboard-surface shadow-sm overflow-hidden min-w-0">
 <div className="overflow-x-auto">
 <table className="data-table dashboard-data-table w-full min-w-[760px] text-sm">
 <thead>
 <tr className="bg-neutral-50/95 border-b border-neutral-200">
 <th className="w-10 px-4 sm:px-5 py-3.5">
 <input
 type="checkbox"
 checked={filtered.length > 0 && selectedIds.size === filtered.length}
 onChange={toggleSelectAll}
 className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
 aria-label="Select all"
 />
 </th>
 <th className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 px-4 sm:px-5 py-3.5">
 Candidate
 </th>
 <th className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 px-4 sm:px-5 py-3.5">
 Email
 </th>
 <th className="col-center text-[11px] font-bold uppercase tracking-widest text-neutral-500 px-4 sm:px-5 py-3.5">
 Experience
 </th>
 <th className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 px-4 sm:px-5 py-3.5">
 Education
 </th>
 <th className="col-right text-[11px] font-bold uppercase tracking-widest text-neutral-500 px-4 sm:px-5 py-3.5">
 Actions
 </th>
 </tr>
 </thead>
 <tbody>
 {filtered.map((candidate) => (
 <tr key={candidate.id} className="group transition-colors">
 <td className="px-4 sm:px-5 py-3.5 align-middle">
 <input
 type="checkbox"
 checked={selectedIds.has(candidate.id)}
 onChange={() => toggleSelect(candidate.id)}
 className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
 aria-label={`Select ${candidate.firstName} ${candidate.lastName}`}
 />
 </td>
 <td className="px-4 sm:px-5 py-3.5 align-middle">
 <div className="flex items-center gap-3">
 <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 ring-2 ring-white shadow-sm">
 <span className="text-sm font-semibold text-primary-800">
 {candidate.firstName[0]}
 {candidate.lastName[0]}
 </span>
 </div>
 <div className="min-w-0">
 <p className="font-semibold text-primary-900 text-sm truncate">
 {candidate.firstName} {candidate.lastName}
 </p>
 {candidate.location && (
 <p className="text-xs text-neutral-500 flex items-center gap-1 truncate">
 <MapPin className="w-3 h-3 shrink-0" />
 {candidate.location}
 </p>
 )}
 </div>
 </div>
 </td>
 <td className="px-4 sm:px-5 py-3.5 text-neutral-600 text-xs sm:text-sm align-middle">
 <span className="truncate max-w-[200px] block">{candidate.email}</span>
 </td>
 <td className="col-center px-4 sm:px-5 py-3.5 text-neutral-700 tabular-nums font-medium align-middle">
 {candidate.experience} yrs
 </td>
 <td className="px-4 sm:px-5 py-3.5 text-neutral-600 align-middle max-w-[14rem]">
 {candidate.education ? (
 <span className="line-clamp-2 text-xs sm:text-sm">{candidate.education}</span>
 ) : (
 <span className="text-neutral-300">—</span>
 )}
 </td>
 <td className="col-right px-4 sm:px-5 py-3.5 align-middle">
 <div className="flex items-center justify-end gap-1 opacity-90 group-hover:opacity-100">
 <button
 type="button"
 onClick={() => setSelectedCandidate(candidate)}
 className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-primary-700 hover:bg-white border border-transparent hover:border-primary-100 transition-colors"
 >
 <Eye className="w-3.5 h-3.5" />
 View
 </button>
 {candidate.resumePath && (
 <a
 href={candidate.resumePath}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-primary-700 hover:bg-white border border-transparent hover:border-primary-100 transition-colors"
 >
 <FileText className="w-3.5 h-3.5" />
 Resume
 </a>
 )}
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-t border-neutral-100 bg-neutral-50/50">
 <p className="text-xs text-neutral-500">
 Page {page} of {totalPages} · {totalCandidates} total
 </p>
 {totalPages > 1 && (
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
 )}
 </div>
 </div>
 )}

 {selectedCandidate && (() => {
 const currentIndex = filtered.findIndex((c) => c.id === selectedCandidate.id);
 const total = filtered.length;
 const hasPrev = currentIndex > 0;
 const hasNext = currentIndex >= 0 && currentIndex < total - 1;
 const prevCand = hasPrev ? filtered[currentIndex - 1] : null;
 const nextCand = hasNext ? filtered[currentIndex + 1] : null;
 const details = candidateDetails;
 const resumeUrl = details?.resumePath || selectedCandidate.resumePath || '';

 return (
 <>
 <div
 className="fixed inset-0 bg-neutral-900/20 z-40"
 onClick={() => setSelectedCandidate(null)}
 aria-hidden
 />
 <div className="fixed right-0 top-0 bottom-0 w-[66.666vw] min-w-[24rem] max-w-[56rem] bg-white border-l border-neutral-200 shadow-sm z-50 flex flex-col rounded-l-xl">
 <div className="sticky top-0 z-10 bg-white border-b border-neutral-200 rounded-tl-xl">
 <div className="px-4 py-3 flex items-center justify-between gap-2">
 <h2 className="text-base font-semibold text-primary-900 truncate min-w-0">
 Candidate profile
 </h2>
 <div className="flex items-center gap-1 shrink-0">
 <button
 type="button"
 onClick={() => prevCand && setSelectedCandidate(prevCand)}
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
 onClick={() => nextCand && setSelectedCandidate(nextCand)}
 disabled={!hasNext}
 className="p-2 rounded-lg text-neutral-600 hover:bg-neutral-100 hover:text-primary-700 disabled:opacity-40 disabled:pointer-events-none transition-colors"
 aria-label="Next candidate"
 >
 <ChevronRight className="w-5 h-5" />
 </button>
 <button
 type="button"
 onClick={() => setSelectedCandidate(null)}
 className="p-2 text-neutral-500 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors"
 aria-label="Close"
 >
 <X className="w-5 h-5" />
 </button>
 </div>
 </div>
 <div className="flex border-t border-neutral-100">
 {CANDIDATE_TABS.map(({ id, label, icon: Icon }) => (
 <button
 key={id}
 type="button"
 onClick={() => setDetailTab(id)}
 className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-2 text-xs font-medium transition-colors border-b-2 ${
 detailTab === id
 ? 'border-transparent text-neutral-900'
 : 'border-transparent text-neutral-500 hover:text-neutral-700 hover:bg-neutral-50'
 }`}
 >
 <Icon className="w-3.5 h-3.5 shrink-0" />
 <span className="hidden sm:inline truncate">{label}</span>
 </button>
 ))}
 </div>
 </div>
 <div className="flex-1 overflow-y-auto p-5">
 {loadingDetails ? (
 <div className="flex items-center justify-center py-16">
 <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
 </div>
 ) : detailTab === 'general' && details ? (
 <div className="space-y-5">
 <div>
 <h3 className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-2">
 Candidate
 </h3>
 <p className="text-xl font-semibold text-primary-900">
 {details.firstName} {details.lastName}
 </p>
 <div className="mt-2 space-y-1 text-sm text-neutral-600">
 <p className="flex items-center gap-2">
 <Mail className="w-4 h-4 text-neutral-400 shrink-0" />
 {details.email}
 </p>
 {details.phone && (
 <p className="flex items-center gap-2">
 <Phone className="w-4 h-4 text-neutral-400 shrink-0" />
 {details.phone}
 </p>
 )}
 {details.location && (
 <p className="flex items-center gap-2">
 <MapPin className="w-4 h-4 text-neutral-400 shrink-0" />
 {details.location}
 </p>
 )}
 {details.nationality && <p>Nationality: {details.nationality}</p>}
 {details.homeCounty && <p>Home county: {details.homeCounty}</p>}
 {details.formData?.gender && <p>Gender: {details.formData.gender}</p>}
 <p>
 {details.experience} years experience
 {details.education && ` · ${details.education}`}
 </p>
 </div>
 </div>

 {resumeUrl && (
 <div className="pt-4 border-t border-neutral-100">
 <div className="flex items-center justify-between mb-2">
 <h3 className="text-sm font-medium text-neutral-500 uppercase tracking-wider">
 Resume
 </h3>
 {/\.pdf($|\?)/i.test(resumeUrl) && (
 <div className="flex items-center gap-1">
 <button
 type="button"
 onClick={() => setPdfZoom((z) => Math.max(50, z - 25))}
 className="p-1.5 rounded-md text-neutral-500 hover:text-primary-600 hover:bg-neutral-100 transition-colors"
 title="Zoom out"
 aria-label="Zoom out"
 >
 <ZoomOut className="w-4 h-4" />
 </button>
 <span className="text-xs text-neutral-500 min-w-[2.5rem] text-center tabular-nums">
 {pdfZoom}%
 </span>
 <button
 type="button"
 onClick={() => setPdfZoom((z) => Math.min(200, z + 25))}
 className="p-1.5 rounded-md text-neutral-500 hover:text-primary-600 hover:bg-neutral-100 transition-colors"
 title="Zoom in"
 aria-label="Zoom in"
 >
 <ZoomIn className="w-4 h-4" />
 </button>
 </div>
 )}
 </div>
 <div className="rounded-lg border border-neutral-200 bg-neutral-50 overflow-auto min-h-[280px] h-[45vh] max-h-[380px]">
 {/\.pdf($|\?)/i.test(resumeUrl) ? (
 <div
 className="origin-top-left"
 style={{
 transform: `scale(${pdfZoom / 100})`,
 width: `${(100 * 100) / pdfZoom}%`,
 height: `${(360 * 100) / pdfZoom}px`,
 minHeight: `${(280 * 100) / pdfZoom}px`,
 }}
 >
 <iframe
 title="Resume preview"
 src={resumeUrl}
 className="w-full border-0 min-h-[280px] h-[360px]"
 />
 </div>
 ) : (
 <div className="flex flex-col items-center justify-center h-full min-h-[280px] p-6 text-center">
 <FileText className="w-12 h-12 text-neutral-300 mb-3" />
 <p className="text-sm text-neutral-600 mb-1">Preview not available for this file type.</p>
 <a
 href={resumeUrl}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-2 px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-lg hover:bg-primary-700"
 >
 <FileText className="w-4 h-4" />
 Download resume
 </a>
 </div>
 )}
 </div>
 <a
 href={resumeUrl}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-2 mt-2 text-sm font-medium text-primary-600 hover:text-primary-800"
 >
 <FileText className="w-4 h-4" />
 View resume in new tab
 </a>
 </div>
 )}

 {details.previousApplications && details.previousApplications.length > 0 && (
 <div className="pt-4 border-t border-neutral-100">
 <h3 className="text-sm font-medium text-neutral-500 uppercase tracking-wider mb-2">
 Previous applications
 </h3>
 <p className="text-xs text-neutral-500 mb-3">
 Roles this candidate has applied to previously — useful when reaching out for urgent roles.
 </p>
 <ul className="space-y-2">
 {details.previousApplications.map((app) => (
 <li
 key={app.id}
 className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg bg-neutral-50 border border-neutral-100"
 >
 <div>
 <p className="font-medium text-primary-900 text-sm">{app.jobTitle}</p>
 <p className="text-xs text-neutral-600 flex items-center gap-1">
 <Building2 className="w-3 h-3" />
 {app.company} · Applied {formatDate(app.appliedDate)}
 </p>
 </div>
 <span className="text-xs px-2 py-0.5 rounded bg-neutral-200 text-neutral-700">
 {app.status}
 </span>
 </li>
 ))}
 </ul>
 <Link
 href="/dashboard/applications"
 className="inline-flex items-center gap-2 mt-2 text-sm font-medium text-primary-600 hover:text-primary-800"
 >
 View in Applications
 </Link>
 </div>
 )}
 </div>
 ) : detailTab === 'experience' && details ? (
 <WorkExperienceTab formData={details.formData} />
 ) : detailTab === 'education' && details ? (
 <EducationTab formData={details.formData} />
 ) : detailTab === 'certifications' && details ? (
 <CertificationsTab formData={details.formData} />
 ) : null}
 </div>
 </div>
 </>
 );
 })()}
 </DashboardPage>
 );
}
