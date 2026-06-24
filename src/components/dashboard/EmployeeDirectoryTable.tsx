'use client';

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  Building2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Mail,
  MoreHorizontal,
  Pencil,
  Phone,
} from 'lucide-react';
import { dashboardTableStripeClass } from '@/lib/dashboard-layout';

export type EmployeeDirectoryRecord = {
  id: string;
  employeeNumber: string | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  jobTitle: string | null;
  kraPin: string | null;
  nssfNumber: string | null;
  nhifNumber: string | null;
  departmentId: string | null;
  departmentName: string | null;
  clientName: string | null;
  employmentStatus: string;
  bankName: string | null;
  bankBranch: string | null;
  bankAccountNumber: string | null;
  dateOfJoining: string | null;
};

const PAGE_SIZE = 25;

const AVATAR_PALETTE = [
  'bg-primary-100 text-primary-800 ring-primary-200/80',
  'bg-sky-100 text-sky-800 ring-sky-200/80',
  'bg-violet-100 text-violet-800 ring-violet-200/80',
  'bg-emerald-100 text-emerald-800 ring-emerald-200/80',
  'bg-amber-100 text-amber-900 ring-amber-200/80',
  'bg-rose-100 text-rose-800 ring-rose-200/80',
];

function initials(first: string, last: string) {
  const a = first.trim().charAt(0);
  const b = last.trim().charAt(0);
  return `${a}${b}`.toUpperCase() || '?';
}

function avatarPalette(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

function employmentStatusLabel(status: string) {
  switch (status) {
    case 'probation':
      return 'Probation';
    case 'on_leave':
      return 'On leave';
    case 'suspended':
      return 'Suspended';
    case 'terminated':
      return 'Terminated';
    default:
      return 'Active';
  }
}

function employmentStatusClass(status: string) {
  switch (status) {
    case 'probation':
      return 'bg-amber-50 text-amber-800 ring-amber-200/70';
    case 'on_leave':
      return 'bg-sky-50 text-sky-800 ring-sky-200/70';
    case 'suspended':
      return 'bg-red-50 text-red-800 ring-red-200/70';
    case 'terminated':
      return 'bg-neutral-100 text-neutral-600 ring-neutral-200/70';
    default:
      return 'bg-emerald-50 text-emerald-800 ring-emerald-200/70';
  }
}

function profileFields(employee: EmployeeDirectoryRecord) {
  return [
    { key: 'KRA PIN', ok: !!employee.kraPin?.trim() },
    { key: 'NSSF', ok: !!employee.nssfNumber?.trim() },
    { key: 'SHIF', ok: !!employee.nhifNumber?.trim() },
    { key: 'Department', ok: !!employee.departmentId },
    { key: 'Bank', ok: !!(employee.bankName?.trim() || employee.bankAccountNumber?.trim()) },
  ];
}

function profileScore(employee: EmployeeDirectoryRecord) {
  const fields = profileFields(employee);
  const done = fields.filter((f) => f.ok).length;
  return { done, total: fields.length, fields };
}

function formatJoinDate(iso: string | null) {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function RowActionsMenu({
  employee,
  onCopyEmail,
}: {
  employee: EmployeeDirectoryRecord;
  onCopyEmail: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-ink"
        aria-label={`Actions for ${employee.firstName} ${employee.lastName}`}
        aria-expanded={open}
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-30 mt-1 w-48 overflow-hidden rounded-lg border border-neutral-200 bg-white py-1 shadow-lg">
          <Link
            href={`/dashboard/employees/${employee.id}/edit`}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
            onClick={() => setOpen(false)}
          >
            <Pencil className="h-4 w-4 text-neutral-400" />
            Edit profile
          </Link>
          {employee.email ? (
            <a
              href={`mailto:${employee.email}`}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
              onClick={() => setOpen(false)}
            >
              <Mail className="h-4 w-4 text-neutral-400" />
              Send email
            </a>
          ) : null}
          {employee.phone ? (
            <a
              href={`tel:${employee.phone}`}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-neutral-700 hover:bg-neutral-50"
              onClick={() => setOpen(false)}
            >
              <Phone className="h-4 w-4 text-neutral-400" />
              Call
            </a>
          ) : null}
          {employee.email ? (
            <button
              type="button"
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 hover:bg-neutral-50"
              onClick={() => {
                onCopyEmail();
                setOpen(false);
              }}
            >
              <Copy className="h-4 w-4 text-neutral-400" />
              Copy email
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function ExpandedDetails({
  employee,
  showClientColumn,
}: {
  employee: EmployeeDirectoryRecord;
  showClientColumn: boolean;
}) {
  const score = profileScore(employee);
  return (
    <div className="grid gap-4 bg-neutral-50/80 px-4 py-4 sm:grid-cols-2 lg:grid-cols-4 md:px-6">
      <div className="rounded-lg border border-neutral-200/80 bg-white p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500">Statutory</p>
        <dl className="mt-2 space-y-1.5 text-sm">
          <div className="flex justify-between gap-3">
            <dt className="text-neutral-500">KRA PIN</dt>
            <dd className="font-mono text-xs text-neutral-800">{employee.kraPin ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-neutral-500">NSSF</dt>
            <dd className="font-mono text-xs text-neutral-800">{employee.nssfNumber ?? '—'}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-neutral-500">SHIF</dt>
            <dd className="font-mono text-xs text-neutral-800">{employee.nhifNumber ?? '—'}</dd>
          </div>
        </dl>
      </div>
      <div className="rounded-lg border border-neutral-200/80 bg-white p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500">Banking</p>
        <dl className="mt-2 space-y-1.5 text-sm">
          <div>
            <dt className="text-neutral-500">Bank</dt>
            <dd className="font-medium text-neutral-800">{employee.bankName ?? '—'}</dd>
          </div>
          {employee.bankBranch ? (
            <div>
              <dt className="text-neutral-500">Branch</dt>
              <dd className="text-neutral-800">{employee.bankBranch}</dd>
            </div>
          ) : null}
          <div>
            <dt className="text-neutral-500">Account</dt>
            <dd className="font-mono text-xs text-neutral-800">{employee.bankAccountNumber ?? '—'}</dd>
          </div>
        </dl>
      </div>
      <div className="rounded-lg border border-neutral-200/80 bg-white p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500">Employment</p>
        <dl className="mt-2 space-y-1.5 text-sm">
          <div>
            <dt className="text-neutral-500">Joined</dt>
            <dd className="text-neutral-800">{formatJoinDate(employee.dateOfJoining)}</dd>
          </div>
          <div>
            <dt className="text-neutral-500">Department</dt>
            <dd className="text-neutral-800">{employee.departmentName ?? 'Unassigned'}</dd>
          </div>
          {showClientColumn && employee.clientName ? (
            <div>
              <dt className="text-neutral-500">Client</dt>
              <dd className="text-neutral-800">{employee.clientName}</dd>
            </div>
          ) : null}
        </dl>
      </div>
      <div className="rounded-lg border border-neutral-200/80 bg-white p-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500">Profile checklist</p>
        <ul className="mt-2 space-y-1.5">
          {score.fields.map((field) => (
            <li key={field.key} className="flex items-center justify-between text-sm">
              <span className="text-neutral-600">{field.key}</span>
              <span
                className={`inline-flex h-5 min-w-[3.25rem] items-center justify-center rounded-full px-2 text-[11px] font-medium ${
                  field.ok ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'
                }`}
              >
                {field.ok ? 'Done' : 'Missing'}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

type EmployeeDirectoryTableProps = {
  employees: EmployeeDirectoryRecord[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  showClientColumn?: boolean;
};

export default function EmployeeDirectoryTable({
  employees,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  showClientColumn = false,
}: EmployeeDirectoryTableProps) {
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    setPage(1);
    setExpandedId(null);
  }, [employees]);

  const totalPages = Math.max(1, Math.ceil(employees.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  const pageEmployees = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return employees.slice(start, start + PAGE_SIZE);
  }, [employees, safePage]);

  const allPageSelected =
    pageEmployees.length > 0 && pageEmployees.every((e) => selectedIds.has(e.id));

  const copyEmail = async (employee: EmployeeDirectoryRecord) => {
    if (!employee.email) return;
    try {
      await navigator.clipboard.writeText(employee.email);
      setCopiedId(employee.id);
      window.setTimeout(() => setCopiedId((id) => (id === employee.id ? null : id)), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <>
      <div className="overflow-x-auto">
        <table className="data-table dashboard-data-table w-full min-w-[720px]">
          <thead>
            <tr className="border-b border-neutral-200">
              <th className="w-10 px-3 py-3">
                <input
                  type="checkbox"
                  checked={allPageSelected}
                  onChange={onToggleSelectAll}
                  className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                  aria-label="Select all on this page"
                />
              </th>
              <th className="w-8 px-1 py-3" aria-hidden />
              <th className="col-primary px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500">
                Employee
              </th>
              <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500">
                Role &amp; department
              </th>
              {showClientColumn ? (
                <th className="hidden px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500 md:table-cell">
                  Client
                </th>
              ) : null}
              <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500">
                Status
              </th>
              <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500">
                Profile
              </th>
              <th className="hidden px-3 py-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-neutral-500 sm:table-cell">
                Contact
              </th>
              <th className="col-actions w-12 px-3 py-3" aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {pageEmployees.map((employee, rowIndex) => {
              const fullName = `${employee.firstName} ${employee.lastName}`.trim();
              const palette = avatarPalette(fullName);
              const score = profileScore(employee);
              const expanded = expandedId === employee.id;
              const selected = selectedIds.has(employee.id);

              return (
                <Fragment key={employee.id}>
                  <tr
                    data-selected={selected ? 'true' : undefined}
                    data-employee-row
                    className={`group transition-colors ${dashboardTableStripeClass(rowIndex)}`}
                  >
                    <td className="px-3 py-3 align-middle">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => onToggleSelect(employee.id)}
                        className="rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                        aria-label={`Select ${fullName}`}
                      />
                    </td>
                    <td className="px-1 py-3 align-middle">
                      <button
                        type="button"
                        onClick={() => setExpandedId(expanded ? null : employee.id)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-100 hover:text-neutral-700"
                        aria-expanded={expanded}
                        aria-label={expanded ? 'Hide details' : 'Show details'}
                      >
                        <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                      </button>
                    </td>
                    <td className="col-primary px-3 py-3 align-middle">
                      <div className="flex min-w-0 items-center gap-3">
                        <div
                          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold ring-1 ring-inset ${palette}`}
                        >
                          {initials(employee.firstName, employee.lastName)}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/dashboard/employees/${employee.id}/edit`}
                            className="block truncate font-medium text-ink hover:text-primary-700"
                          >
                            {fullName}
                          </Link>
                          <p className="truncate text-xs text-neutral-500">
                            {employee.employeeNumber ? `#${employee.employeeNumber}` : 'No employee number'}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <p className="truncate text-sm font-medium text-neutral-800">{employee.jobTitle ?? '—'}</p>
                      <p className="mt-0.5 truncate text-xs text-neutral-500">
                        {employee.departmentName ?? 'No department'}
                      </p>
                    </td>
                    {showClientColumn ? (
                      <td className="hidden px-3 py-3 align-middle md:table-cell">
                        {employee.clientName ? (
                          <span className="inline-flex max-w-[160px] items-center gap-1 truncate rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-700">
                            <Building2 className="h-3 w-3 shrink-0 text-neutral-400" />
                            <span className="truncate">{employee.clientName}</span>
                          </span>
                        ) : (
                          <span className="text-sm text-neutral-400">—</span>
                        )}
                      </td>
                    ) : null}
                    <td className="px-3 py-3 align-middle">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${employmentStatusClass(employee.employmentStatus)}`}
                      >
                        {employmentStatusLabel(employee.employmentStatus)}
                      </span>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-200">
                          <div
                            className={`h-full rounded-full transition-all ${
                              score.done === score.total ? 'bg-emerald-500' : 'bg-amber-500'
                            }`}
                            style={{ width: `${Math.round((score.done / score.total) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs tabular-nums text-neutral-500">
                          {score.done}/{score.total}
                        </span>
                      </div>
                    </td>
                    <td className="hidden px-3 py-3 align-middle sm:table-cell">
                      <div className="flex items-center gap-1">
                        {employee.email ? (
                          <a
                            href={`mailto:${employee.email}`}
                            title={employee.email}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-primary-50 hover:text-primary-700"
                          >
                            <Mail className="h-4 w-4" />
                          </a>
                        ) : (
                          <span className="inline-flex h-8 w-8 items-center justify-center text-neutral-300" title="No email">
                            <Mail className="h-4 w-4" />
                          </span>
                        )}
                        {employee.phone ? (
                          <a
                            href={`tel:${employee.phone}`}
                            title={employee.phone}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-primary-50 hover:text-primary-700"
                          >
                            <Phone className="h-4 w-4" />
                          </a>
                        ) : null}
                        {copiedId === employee.id ? (
                          <span className="text-[10px] font-medium text-emerald-600">Copied</span>
                        ) : null}
                      </div>
                    </td>
                    <td className="col-actions px-3 py-3 align-middle">
                      <RowActionsMenu employee={employee} onCopyEmail={() => void copyEmail(employee)} />
                    </td>
                  </tr>
                  {expanded ? (
                    <tr className="bg-[var(--dash-surface-muted)]" data-zebra-skip>
                      <td colSpan={showClientColumn ? 9 : 8} className="p-0">
                        <ExpandedDetails employee={employee} showClientColumn={showClientColumn} />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-neutral-100 px-4 py-3 text-sm text-neutral-500 sm:flex-row sm:items-center sm:justify-between md:px-5">
        <span>
          {selectedIds.size > 0 ? `${selectedIds.size} selected · ` : ''}
          Showing {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, employees.length)} of{' '}
          {employees.length}
        </span>
        {totalPages > 1 ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-200 px-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </button>
            <span className="min-w-[4.5rem] text-center text-xs tabular-nums text-neutral-600">
              Page {safePage} / {totalPages}
            </span>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-neutral-200 px-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-40"
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>
    </>
  );
}
