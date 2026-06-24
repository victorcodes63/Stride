'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  MagnifyingGlass,
  MapPin,
  Clock,
  Funnel,
  CaretRight,
  ListBullets,
  SquaresFour,
  SlidersHorizontal,
  X,
  WarningCircle,
  ArrowClockwise,
  CalendarBlank,
} from '@phosphor-icons/react';
import { JobListing, JobSearchFilters } from '@/types/ats';
import { useATS } from '@/lib/use-ats';
import { usePublicBrand } from '@/components/BrandProvider';

interface DynamicJobListingsProps {
  initialFilters?: JobSearchFilters;
  showSearch?: boolean;
  limit?: number;
}

const DEFAULT_CATEGORY_OPTIONS = [
  'Executive',
  'Sales & Marketing',
  'Education & Training',
  'Technology',
  'Operations',
  'Finance & Accounting',
];

const TYPE_OPTIONS = ['Full Time', 'Part Time', 'Contract', 'Remote'];
const TIME_OPTIONS = [
  { label: 'Any time', value: '' },
  { label: 'Last 24 hours', value: '24h' },
  { label: 'Last 7 days', value: '7d' },
  { label: 'Last 30 days', value: '30d' },
];

const INPUT_CLASS =
  'h-10 w-full rounded-md border border-pub-border bg-white text-sm text-pub-ink placeholder:text-pub-ink-subtle focus:border-pub-primary focus:outline-none focus:ring-2 focus:ring-pub-primary/12';

function formatDate(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - date.getTime()) / 86400000);
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`;
  }
  return date.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDeadline(dateString: string) {
  return new Date(dateString).toLocaleString('en-KE', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Africa/Nairobi',
  });
}

function isNew(dateString: string) {
  return Math.floor((Date.now() - new Date(dateString).getTime()) / 86400000) <= 3;
}

function isClosingSoon(dateString: string) {
  const days = Math.floor((new Date(dateString).getTime() - Date.now()) / 86400000);
  return days >= 0 && days <= 7;
}

function formatSalary(job: JobListing) {
  if (!job.salary) return null;
  const { currency, min, max } = job.salary;
  return `${currency} ${min.toLocaleString()}–${max.toLocaleString()}`;
}

function JobBadge({ children, variant = 'default' }: { children: React.ReactNode; variant?: 'default' | 'new' }) {
  if (variant === 'new') {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full border border-pub-primary/20 bg-pub-primary-subtle px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-pub-primary">
        {children}
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-pub-border bg-pub-surface-muted px-2.5 py-0.5 text-xs font-medium text-pub-ink-muted">
      {children}
    </span>
  );
}

const SkeletonRow = () => (
  <div className="flex animate-pulse items-center gap-4 border-b border-pub-border px-4 py-4 last:border-b-0 sm:px-5">
    <div className="min-w-0 flex-1 space-y-2">
      <div className="h-4 w-2/3 rounded bg-pub-border" />
      <div className="h-3 w-1/2 rounded bg-pub-surface-muted" />
    </div>
  </div>
);

export default function DynamicJobListings({
  initialFilters = {},
  showSearch = true,
  limit,
}: DynamicJobListingsProps) {
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [view, setView] = useState<'list' | 'grid'>('list');
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [searchKeyword, setSearchKeyword] = useState(initialFilters.keyword || '');
  const [selectedLocation, setSelectedLocation] = useState(initialFilters.location || '');
  const [selectedCategory, setSelectedCategory] = useState(initialFilters.category || '');
  const [selectedType, setSelectedType] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [appliedFilters, setAppliedFilters] = useState<JobSearchFilters>(initialFilters);

  const [categoryOptions, setCategoryOptions] = useState<string[]>(DEFAULT_CATEGORY_OPTIONS);
  const { orgName } = usePublicBrand();
  const { getJobListings } = useATS();

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    setFetchError(false);
    try {
      const jobData = await getJobListings({
        ...appliedFilters,
        type: selectedType || undefined,
        postedWithin: selectedTime || undefined,
      });
      setJobs(limit ? jobData.slice(0, limit) : jobData);
    } catch {
      setJobs([]);
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [getJobListings, appliedFilters, selectedType, selectedTime, limit]);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const sync = () => {
      if (mq.matches) setView('list');
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    setAppliedFilters(initialFilters);
    setSearchKeyword(initialFilters.keyword || '');
    setSelectedLocation(initialFilters.location || '');
    setSelectedCategory(initialFilters.category || '');
  }, [initialFilters]);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/jobs/categories')
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled && Array.isArray(data)) {
          const merged = [...new Set([...DEFAULT_CATEGORY_OPTIONS, ...data])]
            .filter(Boolean)
            .sort((a: unknown, b: unknown) => String(a).localeCompare(String(b)));
          setCategoryOptions(merged as string[]);
        }
      })
      .catch(() => {
        if (!cancelled) setCategoryOptions(DEFAULT_CATEGORY_OPTIONS);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSearch = () => {
    setAppliedFilters({
      keyword: searchKeyword,
      location: selectedLocation,
      category: selectedCategory,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const clearFilter = (key: 'keyword' | 'location' | 'category' | 'type' | 'time') => {
    if (key === 'keyword') {
      setSearchKeyword('');
      setAppliedFilters((p) => ({ ...p, keyword: '' }));
    }
    if (key === 'location') {
      setSelectedLocation('');
      setAppliedFilters((p) => ({ ...p, location: '' }));
    }
    if (key === 'category') {
      setSelectedCategory('');
      setAppliedFilters((p) => ({ ...p, category: '' }));
    }
    if (key === 'type') setSelectedType('');
    if (key === 'time') setSelectedTime('');
  };

  const activeChips = [
    appliedFilters.keyword && { key: 'keyword' as const, label: appliedFilters.keyword },
    appliedFilters.location && { key: 'location' as const, label: appliedFilters.location },
    appliedFilters.category && { key: 'category' as const, label: appliedFilters.category },
    selectedType && { key: 'type' as const, label: selectedType },
    selectedTime && {
      key: 'time' as const,
      label: TIME_OPTIONS.find((t) => t.value === selectedTime)?.label || selectedTime,
    },
  ].filter(Boolean) as { key: 'keyword' | 'location' | 'category' | 'type' | 'time'; label: string }[];

  return (
    <div className="w-full">
      {showSearch && (
        <div className="rounded-xl border border-pub-border bg-white p-3 shadow-sm sm:p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative min-w-0 flex-1">
              <MagnifyingGlass
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-pub-ink-subtle"
                size={16}
                weight="bold"
              />
              <input
                type="text"
                placeholder="Job title, specialty, or keyword"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                onKeyDown={handleKeyDown}
                className={`${INPUT_CLASS} pl-10 pr-3`}
              />
            </div>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={handleSearch}
                className="pub-btn-primary pub-btn-primary--sm inline-flex h-10 flex-1 items-center justify-center px-5 sm:flex-none"
              >
                Search
              </button>
              <button
                type="button"
                onClick={() => setFiltersOpen((v) => !v)}
                className={`inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-md border px-3 text-sm font-medium transition-colors sm:flex-none ${
                  filtersOpen || activeChips.length > 0
                    ? 'border-pub-primary/30 bg-pub-primary-subtle text-pub-primary'
                    : 'border-pub-border bg-white text-pub-ink-muted hover:bg-pub-surface-muted'
                }`}
              >
                <SlidersHorizontal size={16} weight="bold" />
                <span>Filters</span>
                {activeChips.length > 0 && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-pub-primary text-[10px] font-bold text-white">
                    {activeChips.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {filtersOpen && (
            <div className="mt-3 grid grid-cols-1 gap-2 border-t border-pub-border pt-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="relative">
                <MapPin
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-pub-ink-subtle"
                  size={16}
                  weight="bold"
                />
                <select
                  value={selectedLocation}
                  onChange={(e) => setSelectedLocation(e.target.value)}
                  className={`${INPUT_CLASS} appearance-none pl-9 pr-3`}
                >
                  <option value="">All locations</option>
                  <option value="Nairobi">Nairobi</option>
                  <option value="Parklands">Parklands</option>
                  <option value="Hybrid">Hybrid</option>
                </select>
              </div>
              <div className="relative">
                <Funnel
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-pub-ink-subtle"
                  size={16}
                  weight="bold"
                />
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className={`${INPUT_CLASS} appearance-none pl-9 pr-3`}
                >
                  <option value="">All categories</option>
                  {categoryOptions.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="relative">
                <ListBullets
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-pub-ink-subtle"
                  size={16}
                  weight="bold"
                />
                <select
                  value={selectedType}
                  onChange={(e) => setSelectedType(e.target.value)}
                  className={`${INPUT_CLASS} appearance-none pl-9 pr-3`}
                >
                  <option value="">All types</option>
                  {TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div className="relative">
                <CalendarBlank
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-pub-ink-subtle"
                  size={16}
                  weight="bold"
                />
                <select
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className={`${INPUT_CLASS} appearance-none pl-9 pr-3`}
                >
                  {TIME_OPTIONS.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {activeChips.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-pub-border pt-3">
              {activeChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={() => clearFilter(chip.key)}
                  className="inline-flex items-center gap-1 rounded-full border border-pub-primary/15 bg-pub-primary-subtle px-2.5 py-1 text-xs font-medium text-pub-primary hover:bg-pub-primary-muted"
                >
                  {chip.label}
                  <X size={12} weight="bold" />
                </button>
              ))}
              <button
                type="button"
                onClick={() => {
                  setSearchKeyword('');
                  setSelectedLocation('');
                  setSelectedCategory('');
                  setSelectedType('');
                  setSelectedTime('');
                  setAppliedFilters({});
                }}
                className="text-xs text-pub-ink-subtle underline-offset-2 hover:text-pub-ink-muted hover:underline"
              >
                Clear all
              </button>
            </div>
          )}

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-pub-border pt-3">
            <p className="text-sm text-pub-ink-subtle">
              {loading ? (
                'Loading…'
              ) : (
                <>
                  <span className="font-semibold text-pub-ink">{jobs.length}</span> job
                  {jobs.length !== 1 ? 's' : ''} found
                </>
              )}
            </p>
            <div className="hidden items-center gap-0.5 rounded-md border border-pub-border bg-pub-surface-muted p-0.5 md:flex">
              <button
                type="button"
                onClick={() => setView('list')}
                className={`rounded p-1.5 transition-colors ${view === 'list' ? 'bg-white text-pub-ink shadow-sm' : 'text-pub-ink-subtle hover:text-pub-ink-muted'}`}
                aria-label="List view"
              >
                <ListBullets size={16} weight={view === 'list' ? 'fill' : 'regular'} />
              </button>
              <button
                type="button"
                onClick={() => setView('grid')}
                className={`rounded p-1.5 transition-colors ${view === 'grid' ? 'bg-white text-pub-ink shadow-sm' : 'text-pub-ink-subtle hover:text-pub-ink-muted'}`}
                aria-label="Grid view"
              >
                <SquaresFour size={16} weight={view === 'grid' ? 'fill' : 'regular'} />
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div
          className={`mt-4 overflow-hidden rounded-xl border border-pub-border bg-white shadow-sm ${view === 'grid' ? 'grid gap-0 sm:grid-cols-2' : ''}`}
        >
          {[...Array(4)].map((_, i) =>
            view === 'grid' ? (
              <div key={i} className="animate-pulse border-b border-pub-border p-5 sm:border-b-0 sm:border-r">
                <div className="mb-3 h-4 w-2/3 rounded bg-pub-border" />
                <div className="h-3 w-1/2 rounded bg-pub-surface-muted" />
              </div>
            ) : (
              <SkeletonRow key={i} />
            ),
          )}
        </div>
      )}

      {!loading && fetchError && (
        <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-pub-border bg-white py-16 text-center shadow-sm">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
            <WarningCircle className="text-red-400" size={24} weight="duotone" />
          </div>
          <h3 className="mb-1 text-sm font-semibold text-pub-ink">Couldn&apos;t load jobs</h3>
          <p className="mb-4 text-sm text-pub-ink-subtle">Please check your connection and try again.</p>
          <button
            type="button"
            onClick={fetchJobs}
            className="pub-btn-primary pub-btn-primary--sm inline-flex items-center gap-2"
          >
            <ArrowClockwise size={16} weight="bold" />
            Try again
          </button>
        </div>
      )}

      {!loading && !fetchError && jobs.length === 0 && (
        <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-pub-border bg-white py-16 text-center shadow-sm">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-pub-surface-muted">
            <MagnifyingGlass className="text-pub-ink-subtle" size={24} weight="duotone" />
          </div>
          <h3 className="mb-1 text-sm font-semibold text-pub-ink">No jobs found</h3>
          <p className="text-sm text-pub-ink-subtle">Try adjusting your search or filters, or check back soon.</p>
        </div>
      )}

      {!loading && !fetchError && jobs.length > 0 && view === 'list' && (
        <div className="pub-job-list mt-4 shadow-sm">
          {jobs.map((job) => {
            const jobIsNew = isNew(job.postedDate);
            const salary = formatSalary(job);
            const closingSoon = job.applicationDeadline ? isClosingSoon(job.applicationDeadline) : false;

            return (
              <Link
                key={job.id}
                href={`/careers/apply/${job.slug ?? job.id}`}
                className="pub-job-row group no-underline"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-sm font-semibold leading-snug text-pub-ink transition-colors group-hover:text-pub-primary">
                      {job.title}
                    </h3>
                    {jobIsNew && <JobBadge variant="new">New</JobBadge>}
                  </div>

                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <JobBadge>{job.category}</JobBadge>
                    <JobBadge>{job.type}</JobBadge>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-pub-ink-subtle sm:text-sm">
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={14} className="shrink-0" weight="bold" />
                      {job.location}
                    </span>
                    {salary && <span className="font-medium text-pub-ink-muted">{salary}</span>}
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-pub-ink-subtle sm:hidden">
                    <span className="inline-flex items-center gap-1">
                      <Clock size={14} className="shrink-0" weight="bold" />
                      {formatDate(job.postedDate)}
                    </span>
                    {job.applicationDeadline && (
                      <span className={closingSoon ? 'font-medium text-pub-primary' : ''}>
                        Closes {formatDeadline(job.applicationDeadline)}
                      </span>
                    )}
                  </div>
                </div>

                <div className="hidden shrink-0 flex-col items-end gap-1 text-right text-xs leading-relaxed text-pub-ink-subtle sm:flex">
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    <Clock size={14} className="shrink-0" weight="bold" />
                    {formatDate(job.postedDate)}
                  </span>
                  {job.applicationDeadline && (
                    <span className={`whitespace-nowrap ${closingSoon ? 'font-medium text-pub-primary' : ''}`}>
                      Closes {formatDeadline(job.applicationDeadline)}
                    </span>
                  )}
                </div>

                <CaretRight
                  size={16}
                  className="shrink-0 text-pub-ink-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-pub-primary"
                  weight="bold"
                />
              </Link>
            );
          })}
        </div>
      )}

      {!loading && !fetchError && jobs.length > 0 && view === 'grid' && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {jobs.map((job) => {
            const jobIsNew = isNew(job.postedDate);
            const salary = formatSalary(job);
            const closingSoon = job.applicationDeadline ? isClosingSoon(job.applicationDeadline) : false;

            return (
              <Link
                key={job.id}
                href={`/careers/apply/${job.slug ?? job.id}`}
                className="pub-card group flex h-full flex-col p-5 no-underline"
              >
                <div className="mb-3 flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-pub-ink transition-colors group-hover:text-pub-primary">
                        {job.title}
                      </h3>
                      {jobIsNew && <JobBadge variant="new">New</JobBadge>}
                    </div>
                    <p className="mt-1 truncate text-xs text-pub-ink-subtle">{orgName}</p>
                  </div>
                  <CaretRight
                    size={16}
                    className="shrink-0 text-pub-ink-subtle transition-transform group-hover:translate-x-0.5 group-hover:text-pub-primary"
                    weight="bold"
                  />
                </div>

                <div className="mb-3 flex flex-wrap gap-1.5">
                  <JobBadge>{job.category}</JobBadge>
                  <JobBadge>{job.type}</JobBadge>
                </div>

                <div className="mt-auto space-y-1.5 border-t border-pub-border pt-3 text-xs text-pub-ink-subtle">
                  <span className="flex items-center gap-1.5">
                    <MapPin size={14} className="shrink-0" weight="bold" />
                    {job.location}
                  </span>
                  {salary && <span className="block font-medium text-pub-ink-muted">{salary}</span>}
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    <span className="inline-flex items-center gap-1">
                      <Clock size={14} className="shrink-0" weight="bold" />
                      {formatDate(job.postedDate)}
                    </span>
                    {job.applicationDeadline && (
                      <span className={closingSoon ? 'font-medium text-pub-primary' : ''}>
                        Closes {formatDeadline(job.applicationDeadline)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
