'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
 Briefcase,
 Plus,
 ArrowRight,
 ExternalLink,
 Pencil,
 SlidersHorizontal,
 Loader2,
 Users,
} from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardMetricCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';
import {
  DashboardTable,
  DashboardTableActionButton,
  DashboardTableActions,
  DashboardTableCard,
  DashboardTableEmpty,
  DashboardTableFooter,
  DashboardTableSearchInput,
  DashboardTableToolbar,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';
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
 actions={[{ href: '/dashboard/jobs/new', label: 'Post a job', icon: Plus }]}
 />

 {error && (
 <div className="mb-6 rounded-lg border border-[var(--dash-danger-border)] bg-[var(--dash-danger-bg)] p-4 text-sm text-[var(--dash-danger-fg)]">
 {error}
 </div>
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
 <DashboardTableCard>
 <DashboardTableEmpty
 icon={<Briefcase className="mx-auto mb-3 h-10 w-10 text-neutral-400" strokeWidth={1.25} />}
 title="No job postings yet"
 description="Post your first role to show it on the careers page."
 />
 <div className="flex flex-col items-center gap-4 border-t border-neutral-200/80 px-4 py-5">
 <Link
 href="/dashboard/jobs/new"
 className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-900 text-white rounded-xl text-sm font-semibold hover:bg-primary-800 transition-colors"
 >
 <Plus className="w-4 h-4" />
 Post a job
 </Link>
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
 </DashboardTableCard>
 ) : (
 <>
 <DashboardStatGrid columns={2} className="mb-6 gap-4">
 <DashboardMetricCard label="Open roles" value={activeCount} hint="Accepting applications" icon={Briefcase} tone="primary" />
 <DashboardMetricCard label="Total applications" value={totalApplications} hint="Across all listings" icon={Users} tone="emerald" />
 </DashboardStatGrid>

 <DashboardTableCard>
 <DashboardTableToolbar label={null}>
 <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
 <DashboardTableSearchInput
 value={searchQuery}
 onChange={setSearchQuery}
 placeholder="Search by title or job ID…"
 className="flex-1"
 />
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
 </DashboardTableToolbar>

 {filteredJobs.length === 0 ? (
 <>
 <DashboardTableEmpty
 icon={<SlidersHorizontal className="mx-auto mb-3 h-10 w-10 text-amber-600" />}
 title="No matches"
 description="Try adjusting search or filters."
 />
 <div className="flex justify-center border-t border-neutral-200/80 px-4 py-4">
 <DashboardTableActionButton
 onClick={() => {
 setSearchQuery('');
 setFilterStatus('all');
 }}
 >
 Clear filters
 </DashboardTableActionButton>
 </div>
 </>
 ) : (
 <>
 <DashboardTableViewport minWidth={720}>
 <DashboardTable>
 <thead>
 <tr>
 <th className="w-[7rem]">Job ID</th>
 <th className="min-w-[12rem]">Role</th>
 <th className="col-center min-w-[8rem]">Posted</th>
 <th className="col-center whitespace-nowrap">Expires</th>
 <th className="col-center w-[5rem]">Apps</th>
 <th className="col-center w-[8.5rem]">Status</th>
 <th className="col-right w-[7.5rem]">Actions</th>
 </tr>
 </thead>
 <tbody>
 {filteredJobs.map((job) => (
 <tr key={job.id} className="group transition-colors">
 <td className="text-neutral-500 font-mono text-xs whitespace-nowrap align-middle">
 {job.referenceId ?? '—'}
 </td>
 <td className="align-middle max-w-[20rem]">
 <Link
 href={`/dashboard/jobs/${job.id}/edit`}
 className="font-semibold text-primary-800 hover:text-primary-600 hover:underline decoration-primary-300 underline-offset-2 line-clamp-2"
 >
 {job.title}
 </Link>
 </td>
 <td className="col-center text-neutral-500 tabular-nums whitespace-nowrap align-middle text-xs sm:text-sm">
 {formatDate(job.postedDate)}
 </td>
 <td className="col-center text-neutral-500 tabular-nums whitespace-nowrap align-middle text-xs sm:text-sm">
 {job.applicationDeadline ? (
 formatDateTime(job.applicationDeadline)
 ) : (
 <span className="text-neutral-300">—</span>
 )}
 </td>
 <td className="col-center tabular-nums font-medium text-neutral-700 align-middle">
 {job.applicationCount ?? 0}
 </td>
 <td className="col-center align-middle">
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
 <td className="col-right align-middle">
 <DashboardTableActions>
 <Link
 href={`/dashboard/jobs/${job.id}/edit`}
 className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 text-xs font-medium text-neutral-600 hover:bg-neutral-50 hover:text-primary-800"
 >
 <Pencil className="w-3.5 h-3.5" />
 Edit
 </Link>
 <a
 href={`/careers/apply/${job.slug ?? job.id}`}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex h-8 items-center gap-1 rounded-lg border border-transparent px-2.5 text-xs font-medium text-primary-700 hover:bg-white hover:border-primary-100"
 >
 View
 <ExternalLink className="w-3.5 h-3.5" />
 </a>
 </DashboardTableActions>
 </td>
 </tr>
 ))}
 </tbody>
 </DashboardTable>
 </DashboardTableViewport>
 <DashboardTableFooter>
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
 </DashboardTableFooter>
 </>
 )}
 </DashboardTableCard>

 {filteredJobs.length > 0 ? (
 <p className="mt-4 text-center text-xs text-neutral-400 sm:hidden">
 Swipe horizontally to see all columns
 </p>
 ) : null}
 </>
 )}
 </DashboardPage>
 );
}
