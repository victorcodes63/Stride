'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
 Briefcase,
 Plus,
 ArrowRight,
 ExternalLink,
 Pencil,
 Search,
 SlidersHorizontal,
 Loader2,
 Users,
} from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { JobListing } from '@/types/ats';

export default function DashboardJobsPage() {
 const [jobs, setJobs] = useState<JobListing[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [searchQuery, setSearchQuery] = useState('');
 const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
 const [togglingId, setTogglingId] = useState<string | null>(null);

 useEffect(() => {
 let cancelled = false;
 async function fetchJobs() {
 setLoading(true);
 setError(null);
 try {
 const res = await fetch('/api/jobs');
 if (!res.ok) throw new Error('Failed to load jobs');
 const data = await res.json();
 if (!cancelled) setJobs(Array.isArray(data) ? data : []);
 } catch (e) {
 if (!cancelled) {
 setError(e instanceof Error ? e.message : 'Failed to load jobs');
 setJobs([]);
 }
 } finally {
 if (!cancelled) setLoading(false);
 }
 }
 fetchJobs();
 return () => {
 cancelled = true;
 };
 }, []);

 const formatDate = (dateString: string) => {
 const d = new Date(dateString);
 return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
 };
 const formatDateTime = (dateString: string) => {
 const d = new Date(dateString);
 return d.toLocaleString('en-KE', {
 day: 'numeric',
 month: 'short',
 year: 'numeric',
 hour: 'numeric',
 minute: '2-digit',
 timeZone: 'Africa/Nairobi',
 });
 };

 const isJobExpired = (job: JobListing) =>
 !!job.applicationDeadline && new Date(job.applicationDeadline) < new Date();
 const getJobEffectiveStatus = (job: JobListing): 'active' | 'expired' | 'closed' => {
 if (isJobExpired(job)) return 'expired';
 if (!job.isActive) return 'closed';
 return 'active';
 };

 const filteredJobs = useMemo(() => {
 return jobs.filter((job) => {
 const q = searchQuery.trim().toLowerCase();
 if (q && !job.title.toLowerCase().includes(q) && !(job.referenceId ?? '').toLowerCase().includes(q))
 return false;
 const status = getJobEffectiveStatus(job);
 if (filterStatus === 'active' && status !== 'active') return false;
 if (filterStatus === 'inactive' && status === 'active') return false;
 return true;
 });
 }, [jobs, searchQuery, filterStatus]);

 const totalApplications = jobs.reduce((sum, j) => sum + (j.applicationCount ?? 0), 0);
 const activeCount = jobs.filter((j) => getJobEffectiveStatus(j) === 'active').length;
 const hasActiveFilters = !!(searchQuery.trim() || filterStatus !== 'all');

 const toggleJobStatus = async (job: JobListing) => {
 setTogglingId(job.id);
 try {
 const res = await fetch(`/api/jobs/${job.id}`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ isActive: !job.isActive }),
 });
 if (res.ok) {
 const updated = await res.json();
 setJobs((prev) => prev.map((j) => (j.id === job.id ? updated : j)));
 }
 } finally {
 setTogglingId(null);
 }
 };

 return (
 <DashboardPage>
 <DashboardPageHeader
 title="Job openings"
 description="Manage postings and publish roles to your careers page."
 actions={
 <Link
 href="/dashboard/jobs/new"
 className="inline-flex items-center justify-center gap-2 px-5 py-2.5 min-h-[44px] sm:min-h-0 bg-primary-900 text-white rounded-xl text-sm font-semibold shadow-sm shadow-primary-900/10 hover:bg-primary-800 transition-colors shrink-0"
 >
 <Plus className="w-5 h-5" strokeWidth={2.25} />
 Post a job
 </Link>
 }
 />

 {error && (
 <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-xl text-red-800 text-sm">
 {error}
 </div>
 )}

 {!loading && jobs.length > 0 && (
 <>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
 <div className="relative overflow-hidden dashboard-surface p-5 shadow-sm">
 <div className="absolute right-4 top-1/2 -translate-y-1/2 rounded-xl bg-primary-50 p-3 text-primary-700">
 <Briefcase className="w-5 h-5" strokeWidth={1.75} />
 </div>
 <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1">
 Open roles
 </p>
 <p className="text-3xl font-bold text-primary-900 tabular-nums">{activeCount}</p>
 <p className="text-xs text-neutral-500 mt-1">Accepting applications</p>
 </div>
 <div className="relative overflow-hidden dashboard-surface p-5 shadow-sm">
 <div className="absolute right-4 top-1/2 -translate-y-1/2 rounded-xl bg-emerald-50 p-3 text-emerald-700">
 <Users className="w-5 h-5" strokeWidth={1.75} />
 </div>
 <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-1">
 Total applications
 </p>
 <p className="text-3xl font-bold text-primary-900 tabular-nums">{totalApplications}</p>
 <p className="text-xs text-neutral-500 mt-1">Across all listings</p>
 </div>
 </div>

 <div className="dashboard-surface p-4 sm:p-5 shadow-sm mb-6">
 <div className="flex flex-col lg:flex-row lg:items-center gap-4">
 <div className="relative flex-1 min-w-0">
 <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
 <input
 type="search"
 placeholder="Search by title or job ID…"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="w-full pl-10 pr-4 py-2.5 border border-neutral-200 rounded-xl text-sm bg-neutral-50/50 focus:bg-white focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300 transition-colors"
 />
 </div>
 <div className="flex flex-wrap items-center gap-2 sm:gap-3">
 <span className="flex items-center gap-2 text-xs font-semibold text-neutral-500 uppercase tracking-wide shrink-0">
 <SlidersHorizontal className="w-3.5 h-3.5" />
 Filter
 </span>
 <select
 value={filterStatus}
 onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
 className="px-3 py-2.5 border border-neutral-200 rounded-xl text-sm bg-white text-neutral-800 focus:ring-2 focus:ring-primary-500/20 focus:border-primary-300"
 title="Filter by status"
 >
 <option value="all">All statuses</option>
 <option value="active">Active only</option>
 <option value="inactive">Not accepting</option>
 </select>
 </div>
 </div>
 </div>
 </>
 )}

 {loading ? (
 <div className="dashboard-surface p-10 sm:p-14">
 <div className="animate-pulse space-y-4 max-w-2xl mx-auto">
 <div className="h-7 bg-neutral-100 rounded-lg w-1/3" />
 <div className="h-4 bg-neutral-100 rounded-lg w-full" />
 <div className="h-4 bg-neutral-100 rounded-lg w-5/6" />
 <div className="h-32 bg-neutral-50 rounded-xl mt-6" />
 </div>
 </div>
 ) : jobs.length === 0 ? (
 <div className="dashboard-surface p-10 sm:p-14 text-center shadow-sm">
 <div className="inline-flex rounded-2xl bg-neutral-100 p-4 mb-5">
 <Briefcase className="w-10 h-10 text-neutral-400" strokeWidth={1.25} />
 </div>
 <p className="text-neutral-700 font-medium mb-1">No job postings yet</p>
 <p className="text-sm text-neutral-500 mb-6 max-w-md mx-auto">
 Post your first role to show it on the careers page.
 </p>
 <Link
 href="/dashboard/jobs/new"
 className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-900 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 transition-colors"
 >
 <Plus className="w-4 h-4" />
 Post a job
 </Link>
 <div className="mt-8 pt-6 border-t border-neutral-100">
 <Link
 href="/careers"
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-800 font-medium"
 >
 View job board
 <ArrowRight className="w-4 h-4" />
 </Link>
 </div>
 </div>
 ) : filteredJobs.length === 0 ? (
 <div className="dashboard-surface p-10 sm:p-12 text-center shadow-sm">
 <div className="inline-flex rounded-2xl bg-amber-50 p-4 mb-4 text-amber-700">
 <SlidersHorizontal className="w-8 h-8" />
 </div>
 <p className="text-neutral-800 font-medium mb-1">No matches</p>
 <p className="text-sm text-neutral-500 mb-5">Try adjusting search or filters.</p>
 <button
 type="button"
 onClick={() => {
 setSearchQuery('');
 setFilterStatus('all');
 }}
 className="inline-flex items-center gap-2 px-4 py-2.5 border border-neutral-200 rounded-xl text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors"
 >
 Clear filters
 </button>
 </div>
 ) : (
 <div className="dashboard-surface shadow-sm overflow-hidden min-w-0">
 <div className="overflow-x-auto">
 <table className="data-table dashboard-data-table w-full min-w-[720px] text-sm">
 <thead>
 <tr className="bg-neutral-50/95 border-b border-neutral-200">
 <th className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 px-4 sm:px-5 py-3.5 w-[7rem]">
 Job ID
 </th>
 <th className="text-[11px] font-bold uppercase tracking-widest text-neutral-500 px-4 sm:px-5 py-3.5 min-w-[12rem]">
 Role
 </th>
 <th className="col-center text-[11px] font-bold uppercase tracking-widest text-neutral-500 px-4 sm:px-5 py-3.5 min-w-[8rem]">
 Posted
 </th>
 <th className="col-center text-[11px] font-bold uppercase tracking-widest text-neutral-500 px-4 sm:px-5 py-3.5 whitespace-nowrap">
 Expires
 </th>
 <th className="col-center text-[11px] font-bold uppercase tracking-widest text-neutral-500 px-3 py-3.5 w-[5rem]">
 Apps
 </th>
 <th className="col-center text-[11px] font-bold uppercase tracking-widest text-neutral-500 px-4 sm:px-5 py-3.5 w-[8.5rem]">
 Status
 </th>
 <th className="col-right text-[11px] font-bold uppercase tracking-widest text-neutral-500 px-4 sm:px-5 py-3.5 w-[7.5rem]">
 Actions
 </th>
 </tr>
 </thead>
 <tbody>
 {filteredJobs.map((job) => (
 <tr key={job.id} className="group transition-colors">
 <td className="px-4 sm:px-5 py-3.5 text-neutral-500 font-mono text-xs whitespace-nowrap align-middle">
 {job.referenceId ?? '—'}
 </td>
 <td className="px-4 sm:px-5 py-3.5 align-middle max-w-[20rem]">
 <Link
 href={`/dashboard/jobs/${job.id}/edit`}
 className="font-semibold text-primary-800 hover:text-primary-600 hover:underline decoration-primary-300 underline-offset-2 line-clamp-2"
 >
 {job.title}
 </Link>
 </td>
 <td className="col-center px-4 sm:px-5 py-3.5 text-neutral-500 tabular-nums whitespace-nowrap align-middle text-xs sm:text-sm">
 {formatDate(job.postedDate)}
 </td>
 <td className="col-center px-4 sm:px-5 py-3.5 text-neutral-500 tabular-nums whitespace-nowrap align-middle text-xs sm:text-sm">
 {job.applicationDeadline ? (
 formatDateTime(job.applicationDeadline)
 ) : (
 <span className="text-neutral-300">—</span>
 )}
 </td>
 <td className="col-center px-3 py-3.5 tabular-nums font-medium text-neutral-700 align-middle">
 {job.applicationCount ?? 0}
 </td>
 <td className="col-center px-4 sm:px-5 py-3.5 align-middle">
 {getJobEffectiveStatus(job) === 'expired' ? (
 <span
 className="inline-flex px-2 py-1 rounded-lg text-[11px] font-semibold bg-neutral-100 text-neutral-600"
 title="Deadline passed"
 >
 Expired
 </span>
 ) : (
 <button
 type="button"
 onClick={() => toggleJobStatus(job)}
 disabled={!!togglingId}
 className={`inline-flex items-center justify-center gap-1.5 min-w-[5.5rem] px-2 py-1 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-60 ${
 job.isActive
 ? 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
 : 'bg-amber-50 text-amber-900 hover:bg-amber-100'
 }`}
 title={
 job.isActive
 ? 'Stop accepting applications'
 : 'Reopen for applications'
 }
 >
 {togglingId === job.id ? (
 <Loader2 className="w-3.5 h-3.5 animate-spin" />
 ) : null}
 {job.isActive ? 'Active' : 'Closed'}
 </button>
 )}
 </td>
 <td className="col-right px-4 sm:px-5 py-3.5 align-middle">
 <div className="flex items-center justify-end gap-1 opacity-90 group-hover:opacity-100">
 <Link
 href={`/dashboard/jobs/${job.id}/edit`}
 className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-600 hover:bg-white hover:text-primary-800 border border-transparent hover:border-neutral-200 transition-colors"
 >
 <Pencil className="w-3.5 h-3.5" />
 Edit
 </Link>
 <a
 href={`/careers/apply/${job.slug ?? job.id}`}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-primary-700 hover:bg-white border border-transparent hover:border-primary-100 transition-colors"
 >
 View
 <ExternalLink className="w-3.5 h-3.5" />
 </a>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 <div className="px-4 sm:px-5 py-3 border-t border-neutral-100 bg-neutral-50/50 flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-500">
 <span>
 Showing <strong className="text-neutral-700">{filteredJobs.length}</strong>
 {hasActiveFilters && jobs.length !== filteredJobs.length && (
 <> of {jobs.length} roles</>
 )}
 {!hasActiveFilters && <> role{filteredJobs.length !== 1 ? 's' : ''}</>}
 </span>
 <Link
 href="/careers"
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-1.5 font-medium text-primary-600 hover:text-primary-800"
 >
 Open careers page
 <ArrowRight className="w-3.5 h-3.5" />
 </Link>
 </div>
 </div>
 )}

 {!loading && jobs.length > 0 && filteredJobs.length > 0 && (
 <p className="mt-4 text-center text-xs text-neutral-400 sm:hidden">
 Swipe horizontally to see all columns
 </p>
 )}
 </DashboardPage>
 );
}
