'use client';

import { useMemo, useState } from 'react';
import { Download, FileSpreadsheet, FileText, Users, User, Coins, X } from 'lucide-react';
import { StrideSelect } from '@/components/ui/stride-select';

type ExportFormat = 'pdf' | 'xlsx';
type ExportReport = 'roster' | 'person' | 'liability';
type ExportGroupBy = 'none' | 'group' | 'costCenter';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Absolute API path, e.g. /api/staff/leave/export */
  endpoint: string;
  year: number;
  /** Label for the grouping dimension shown to the user. */
  groupLabel: string;
  supportsCostCentre?: boolean;
  people: Array<{ id: string; name: string }>;
  /** Extra query params (e.g. clientId for outsourced). */
  extraParams?: Record<string, string>;
};

const REPORTS: Array<{ value: ExportReport; label: string; hint: string; icon: typeof Users }> = [
  { value: 'roster', label: 'Roster summary', hint: 'Balances, usage & YTD for everyone', icon: Users },
  { value: 'person', label: 'Individual statements', hint: 'Full per-person balances & history', icon: User },
  { value: 'liability', label: 'Liability report', hint: 'Outstanding leave value', icon: Coins },
];

export function LeaveExportDialog({
  open,
  onClose,
  endpoint,
  year,
  groupLabel,
  supportsCostCentre = false,
  people,
  extraParams,
}: Props) {
  const [format, setFormat] = useState<ExportFormat>('pdf');
  const [report, setReport] = useState<ExportReport>('roster');
  const [groupBy, setGroupBy] = useState<ExportGroupBy>('none');
  const [personId, setPersonId] = useState<string>('all');

  const groupOptions = useMemo(() => {
    const opts = [
      { value: 'none', label: 'No grouping' },
      { value: 'group', label: `By ${groupLabel.toLowerCase()}` },
    ];
    if (supportsCostCentre) opts.push({ value: 'costCenter', label: 'By cost centre' });
    return opts;
  }, [groupLabel, supportsCostCentre]);

  if (!open) return null;

  const download = () => {
    const params = new URLSearchParams({ format, report, groupBy, year: String(year) });
    if (report === 'person' && personId !== 'all') params.set('personId', personId);
    for (const [k, v] of Object.entries(extraParams ?? {})) {
      if (v) params.set(k, v);
    }
    const url = `${endpoint}?${params.toString()}`;
    const a = document.createElement('a');
    a.href = url;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="w-full max-w-2xl rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-neutral-100 px-6 py-4">
          <div>
            <h3 className="text-base font-semibold text-primary-900">Export leave</h3>
            <p className="text-xs text-neutral-500">Choose what to download and how it&apos;s organised.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-100">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          <div>
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Report</div>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {REPORTS.map((r) => {
                const Icon = r.icon;
                const active = report === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setReport(r.value)}
                    className={`rounded-xl border p-3 text-left transition ${
                      active
                        ? 'border-primary-500 bg-primary-50 ring-1 ring-primary-500'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <Icon className={`h-5 w-5 ${active ? 'text-primary-700' : 'text-neutral-400'}`} />
                    <div className="mt-2 text-sm font-medium text-neutral-800">{r.label}</div>
                    <div className="text-[11px] leading-tight text-neutral-500">{r.hint}</div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Format</div>
              <div className="inline-flex w-full rounded-lg border border-neutral-200 p-0.5">
                <button
                  type="button"
                  onClick={() => setFormat('pdf')}
                  className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium ${
                    format === 'pdf' ? 'bg-primary-900 text-white' : 'text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  <FileText className="h-4 w-4" /> PDF
                </button>
                <button
                  type="button"
                  onClick={() => setFormat('xlsx')}
                  className={`inline-flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-2 text-sm font-medium ${
                    format === 'xlsx' ? 'bg-primary-900 text-white' : 'text-neutral-600 hover:bg-neutral-50'
                  }`}
                >
                  <FileSpreadsheet className="h-4 w-4" /> Excel
                </button>
              </div>
              {format === 'xlsx' ? (
                <p className="mt-1.5 text-[11px] text-neutral-500">
                  Excel includes Summary, Balances, Applications &amp; Liability sheets.
                </p>
              ) : null}
            </div>

            {report === 'person' ? (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Who</div>
                <StrideSelect
                  value={personId}
                  onChange={setPersonId}
                  options={[{ value: 'all', label: 'Everyone' }, ...people.map((p) => ({ value: p.id, label: p.name }))]}
                  ariaLabel="Person"
                  className="w-full"
                />
              </div>
            ) : (
              <div>
                <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-500">Group by</div>
                <StrideSelect
                  value={groupBy}
                  onChange={(v) => setGroupBy(v as ExportGroupBy)}
                  options={groupOptions}
                  ariaLabel="Group by"
                  className="w-full"
                />
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end gap-2 border-t border-neutral-100 px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-neutral-200 px-4 py-2 text-sm">
            Cancel
          </button>
          <button
            type="button"
            onClick={download}
            className="btn-primary inline-flex items-center gap-2"
          >
            <Download className="h-4 w-4" /> Download
          </button>
        </div>
      </div>
    </div>
  );
}
