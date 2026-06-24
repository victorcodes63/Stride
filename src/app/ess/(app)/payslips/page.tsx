'use client';

import { useEffect, useState } from 'react';
import { Download, Receipt } from 'lucide-react';
import { EssPageHeader } from '@/components/ess/EssPageHeader';
import { EssPullRefresh } from '@/components/ess/EssPullRefresh';
import { EssEmptyState, essInputClass, essSecondaryButtonClass } from '@/components/ess/EssUi';

type PayslipRow = {
  id: string;
  month: number;
  year: number;
  basicPay: number;
  grossPay: number;
  netPay: number;
  paye: number;
  nssf: number;
  nhif: number;
  ahl: number;
  status: string;
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function money(value: number) {
  return `KES ${Number(value || 0).toLocaleString()}`;
}

function periodLabel(row: PayslipRow) {
  return `${MONTH_NAMES[row.month - 1] ?? `Month ${row.month}`} ${row.year}`;
}

function statusClass(status: string) {
  const normalized = status.toLowerCase();
  if (normalized === 'paid' || normalized === 'approved') {
    return 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-200';
  }
  if (normalized === 'draft') return 'bg-amber-500/10 text-amber-700 dark:text-amber-200';
  return 'bg-[var(--ess-secondary-soft)] text-[var(--ess-secondary)]';
}

function PayslipCard({ row }: { row: PayslipRow }) {
  return (
    <article className="ess-card-flat overflow-hidden">
      <div className="flex items-start justify-between gap-3 border-b border-[var(--ess-border)] px-4 py-4">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-[0.12em] text-[var(--ess-muted)]">Payslip</p>
          <h2 className="mt-1 text-lg font-black text-[var(--ess-text)]">{periodLabel(row)}</h2>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${statusClass(row.status)}`}>
          {row.status}
        </span>
      </div>

      <div className="px-4 py-4">
        <div className="rounded-2xl bg-[var(--ess-primary-soft)] px-4 py-3">
          <p className="text-xs font-bold uppercase tracking-[0.1em] text-[var(--ess-primary)]">Net pay</p>
          <p className="mt-1 text-2xl font-black tracking-tight text-[var(--ess-text)]">{money(row.netPay)}</p>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
          {[
            ['Basic', row.basicPay],
            ['Gross', row.grossPay],
            ['PAYE', row.paye],
            ['NSSF', row.nssf],
            ['SHIF', row.nhif],
            ['AHL', row.ahl],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-[var(--ess-surface-soft)] px-3 py-2">
              <dt className="text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--ess-muted)]">{label}</dt>
              <dd className="mt-1 font-black text-[var(--ess-text)]">{money(Number(value))}</dd>
            </div>
          ))}
        </dl>

        <a
          href={`/api/ess/payslips/${row.id}/pdf`}
          target="_blank"
          rel="noreferrer"
          className="mt-4 flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--ess-primary)] px-4 py-2 text-sm font-black text-white"
        >
          <Download className="h-4 w-4" />
          Download PDF
        </a>
      </div>
    </article>
  );
}

export default function EssPayslipsPage() {
  const [rows, setRows] = useState<PayslipRow[]>([]);
  const [year, setYear] = useState('');
  const [month, setMonth] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  async function load() {
    const params = new URLSearchParams();
    if (year) params.set('year', year);
    if (month) params.set('month', month);
    if (status) params.set('status', status);
    params.set('page', String(page));
    params.set('pageSize', '10');
    const data = await fetch(`/api/ess/payslips?${params.toString()}`)
      .then((r) => r.json())
      .catch(() => ({}));
    const items = Array.isArray(data) ? data : Array.isArray(data?.items) ? data.items : [];
    setRows(items);
    setTotalPages(Number(data?.totalPages) > 0 ? Number(data.totalPages) : 1);
  }

  useEffect(() => {
    load().catch(() => {
      setRows([]);
      setTotalPages(1);
    });
  }, [month, page, status, year]);

  return (
    <EssPullRefresh onRefresh={load}>
    <div className="space-y-5">
      <EssPageHeader title="Payslips" subtitle="View monthly pay summaries and download PDFs." backHref="/ess/pay" />
      <section className="ess-card-flat p-4">
        <div className="grid gap-3">
          <input
            type="number"
            min={2000}
            max={3000}
            value={year}
            onChange={(e) => {
              setYear(e.target.value);
              setPage(1);
            }}
            placeholder="Year"
            className={essInputClass}
          />
          <select
            value={month}
            onChange={(e) => {
              setMonth(e.target.value);
              setPage(1);
            }}
            className={essInputClass}
          >
            <option value="">All months</option>
            {Array.from({ length: 12 }).map((_, i) => (
              <option key={i + 1} value={String(i + 1)}>
                {MONTH_NAMES[i]}
              </option>
            ))}
          </select>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className={essInputClass}
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="approved">Approved</option>
            <option value="paid">Paid</option>
          </select>
          <button
            type="button"
            onClick={() => {
              setYear('');
              setMonth('');
              setStatus('');
              setPage(1);
            }}
            className={essSecondaryButtonClass}
          >
            Clear filters
          </button>
        </div>
      </section>

      <section className="space-y-3">
        {rows.map((row) => (
          <PayslipCard key={row.id} row={row} />
        ))}
        {!rows.length ? (
          <EssEmptyState
            title="No payslips available yet"
            message="Your published payslips will appear here when payroll is processed."
            icon={<Receipt className="h-6 w-6" />}
          />
        ) : null}
      </section>

      <div className="ess-card-flat flex items-center justify-between gap-3 px-3 py-3">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          className="min-h-10 rounded-full border border-[var(--ess-border)] px-4 text-sm font-bold text-[var(--ess-text)] disabled:opacity-45"
        >
          Previous
        </button>
        <p className="text-sm font-bold text-[var(--ess-muted)]">
          Page {page} of {totalPages}
        </p>
        <button
          type="button"
          disabled={page >= totalPages}
          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          className="min-h-10 rounded-full border border-[var(--ess-border)] px-4 text-sm font-bold text-[var(--ess-text)] disabled:opacity-45"
        >
          Next
        </button>
      </div>
    </div>
    </EssPullRefresh>
  );
}
