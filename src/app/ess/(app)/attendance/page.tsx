'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { EssEmptyState } from '@/components/ess/EssUi';
import { StrideSelect } from '@/components/ui/stride-select';

type AttendanceSummary = {
  month: string | null;
  totalDaysWorked: number;
  totalScheduledDays: number;
  totalHours: number;
  overtimeHours: number;
  lateCount: number;
  absentCount: number;
  pendingReviewCount: number;
};

type AttendanceRow = {
  date: string;
  shiftName: string;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  clockIn: string | null;
  clockOut: string | null;
  totalHours: number;
  overtimeHours: number;
  lateMinutes: number;
  status: 'complete' | 'late' | 'pending_review' | 'corrected';
  note: string | null;
};

const STATUS_STYLES: Record<AttendanceRow['status'], string> = {
  complete: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  late: 'bg-amber-50 text-amber-700 border-amber-200',
  pending_review: 'bg-amber-50 text-amber-700 border-amber-200',
  corrected: 'bg-neutral-100 text-neutral-700 border-neutral-200',
};

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toMonthInputValue(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function shiftMonth(month: string, delta: number): string {
  const [year, monthIndex] = month.split('-').map(Number);
  return toMonthInputValue(new Date(Date.UTC(year, monthIndex - 1 + delta, 1)));
}

function formatMonthLabel(month: string): string {
  const [year, monthIndex] = month.split('-').map(Number);
  return `${MONTH_LABELS[(monthIndex || 1) - 1] ?? 'Month'} ${year}`;
}

function buildMonthOptions(anchor: string, past = 18, future = 2) {
  const options: { value: string; label: string }[] = [];
  for (let i = -past; i <= future; i += 1) {
    const value = shiftMonth(anchor, i);
    options.push({ value, label: formatMonthLabel(value) });
  }
  return options;
}

function monthBounds(month: string): { from: string; to: string } {
  const [year, monthIndex] = month.split('-').map(Number);
  const first = new Date(Date.UTC(year, monthIndex - 1, 1));
  const next = new Date(Date.UTC(year, monthIndex, 1));
  const last = new Date(next.getTime() - 24 * 60 * 60 * 1000);
  return {
    from: first.toISOString().slice(0, 10),
    to: last.toISOString().slice(0, 10),
  };
}

function formatTime(value: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatStatus(status: AttendanceRow['status']): string {
  if (status === 'pending_review') return 'Pending review';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
}

function AttendanceCard({ row }: { row: AttendanceRow }) {
  return (
    <article className="ess-card-flat p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ess-muted)]">{formatDate(row.date)}</p>
          <h2 className="mt-1 text-base font-black text-[var(--ess-text)]">{row.shiftName}</h2>
        </div>
        <span className={`shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-black ${STATUS_STYLES[row.status]}`}>
          {formatStatus(row.status)}
        </span>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-2xl bg-[var(--ess-surface-soft)] px-3 py-2">
          <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ess-muted)]">Clock in</dt>
          <dd className="mt-1 font-black text-[var(--ess-text)]">{formatTime(row.clockIn)}</dd>
        </div>
        <div className="rounded-2xl bg-[var(--ess-surface-soft)] px-3 py-2">
          <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ess-muted)]">Clock out</dt>
          <dd className="mt-1 font-black text-[var(--ess-text)]">{formatTime(row.clockOut)}</dd>
        </div>
        <div className="rounded-2xl bg-[var(--ess-surface-soft)] px-3 py-2">
          <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ess-muted)]">Hours</dt>
          <dd className="mt-1 font-black text-[var(--ess-text)]">{row.totalHours.toFixed(1)}</dd>
        </div>
        <div className="rounded-2xl bg-[var(--ess-surface-soft)] px-3 py-2">
          <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ess-muted)]">Overtime</dt>
          <dd className="mt-1 font-black text-[var(--ess-text)]">{row.overtimeHours.toFixed(1)}</dd>
        </div>
      </dl>
      {row.note ? <p className="mt-3 text-sm text-[var(--ess-muted)]">{row.note}</p> : null}
    </article>
  );
}

export default function EssAttendancePage() {
  const currentMonth = toMonthInputValue(new Date());
  const [month, setMonth] = useState(currentMonth);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<AttendanceSummary | null>(null);
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [error, setError] = useState('');

  const range = useMemo(() => monthBounds(month), [month]);
  const monthOptions = useMemo(() => buildMonthOptions(currentMonth), [currentMonth]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    const listParams = new URLSearchParams({
      from: range.from,
      to: range.to,
      page: String(page),
      pageSize: '20',
    });

    Promise.all([
      fetch(`/api/ess/attendance/summary?month=${encodeURIComponent(month)}`),
      fetch(`/api/ess/attendance?${listParams.toString()}`),
    ])
      .then(async ([summaryRes, listRes]) => {
        const summaryJson = await summaryRes.json().catch(() => ({}));
        const listJson = await listRes.json().catch(() => ({}));

        if (!summaryRes.ok || !listRes.ok) {
          throw new Error(summaryJson.error || listJson.error || 'Failed to load attendance.');
        }

        if (cancelled) return;
        setSummary(summaryJson as AttendanceSummary);
        setRows(Array.isArray(listJson.items) ? (listJson.items as AttendanceRow[]) : []);
        setTotalPages(Number(listJson.totalPages) > 0 ? Number(listJson.totalPages) : 1);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setSummary(null);
        setRows([]);
        setTotalPages(1);
        setError(e instanceof Error ? e.message : 'Failed to load attendance.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [month, page, range.from, range.to]);

  function selectMonth(next: string) {
    setMonth(next || currentMonth);
    setPage(1);
  }

  return (
    <div className="space-y-5">
      <EssPageHeader
        title="Attendance"
        subtitle="Monthly summary and history"
        backHref="/ess/work"
        action={
          <Link
            href="/ess/attendance/clock"
            className="inline-flex min-h-11 items-center rounded-full bg-[var(--ess-primary)] px-4 text-sm font-black text-white"
          >
            Clock
          </Link>
        }
      />

      <div className="ess-card-flat flex items-center gap-2 p-2">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => selectMonth(shiftMonth(month, -1))}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--ess-muted)] hover:bg-[var(--ess-primary-soft)] hover:text-[var(--ess-primary)]"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <StrideSelect
          surface="ess"
          className="min-w-0 flex-1"
          triggerClassName="ess-field-compact justify-center text-center"
          value={month}
          onChange={selectMonth}
          options={
            monthOptions.some((o) => o.value === month)
              ? monthOptions
              : [{ value: month, label: formatMonthLabel(month) }, ...monthOptions]
          }
          ariaLabel="Month"
        />
        <button
          type="button"
          aria-label="Next month"
          onClick={() => selectMonth(shiftMonth(month, 1))}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--ess-muted)] hover:bg-[var(--ess-primary-soft)] hover:text-[var(--ess-primary)]"
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {error ? (
        <p className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <section className="grid grid-cols-2 gap-3">
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-600">Days worked / scheduled</p>
          <p className="mt-1 text-xl font-semibold text-primary-900">
            {summary?.totalDaysWorked ?? 0} / {summary?.totalScheduledDays ?? 0}
          </p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-600">Total hours</p>
          <p className="mt-1 text-xl font-semibold text-primary-900">{summary?.totalHours ?? 0}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-600">Overtime hours</p>
          <p className="mt-1 text-xl font-semibold text-primary-900">{summary?.overtimeHours ?? 0}</p>
        </div>
        <div className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-xs text-neutral-600">Late arrivals</p>
          <p className="mt-1 text-xl font-semibold text-amber-700">{summary?.lateCount ?? 0}</p>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4">
          <p className="text-xs text-amber-800">Pending review items</p>
          <p className="mt-1 text-xl font-semibold text-amber-700">{summary?.pendingReviewCount ?? 0}</p>
        </div>
      </section>

      <section className="space-y-3">
        {rows.map((row) => (
          <AttendanceCard key={row.date} row={row} />
        ))}
        {!loading && !rows.length ? (
          <EssEmptyState title="No attendance records" message="No attendance records found for this month." />
        ) : null}
      </section>

      <div className="flex items-center justify-between">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="min-h-11 rounded-md border border-neutral-300 px-3 py-2.5 text-sm disabled:opacity-50"
        >
          Previous
        </button>
        <p className="text-sm text-neutral-600">
          Page {page} of {totalPages}
        </p>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          className="min-h-11 rounded-md border border-neutral-300 px-3 py-2.5 text-sm disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}
