'use client';

import { useState, useEffect, useMemo, Suspense, useRef, Fragment } from 'react';
import Link from 'next/link';
import { Banknote, FileText, Mail, Loader2, Pencil, Calculator, Upload, Download, AlertTriangle, Eye, SlidersHorizontal, Check, RotateCcw, Search, X, ChevronUp, ChevronDown, Users, UserPlus, ArrowRight, Receipt, Smartphone } from 'lucide-react';
import PayrollEditModal from '@/components/payroll/PayrollEditModal';
import { PayrollRunWizard } from '@/components/payroll/PayrollRunWizard';
import PayrollTrends from '@/components/payroll/PayrollTrends';
import useEntityConfig, { useCurrencyFormatter } from '@/hooks/useEntityConfig';
import { EntityContextBanner } from '@/components/EntityContextBanner';
import { useEntity } from '@/components/EntitySwitcher';
import { OutsourcingClientSwitcher } from '@/components/outsourcing/OutsourcingClientSwitcher';
import { PayrollSubnav } from '@/components/payroll/PayrollSubnav';
import { useOutsourcingClient } from '@/hooks/use-outsourcing-client';
import { withOutsourcingClientQuery } from '@/lib/outsourcing-client-context';
import type { OutsourcingClientOption } from '@/lib/outsourcing-client-context';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardStatCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';
import { DashboardEmptyState } from '@/components/dashboard/DashboardAsyncState';
import { dashStatusChip } from '@/lib/dashboard-status-chips';
import { derivePayrollRunState, type PayrollRunState } from '@/lib/payroll/run-wizard';
import { StrideSelect } from '@/components/ui/stride-select';
import {
  DashboardTable,
  DashboardTableCard,
  DashboardTableMeta,
  DashboardTableViewport,
} from '@/components/dashboard/DashboardDataTable';

/**
 * A payroll surface.
 * - `internal`: the company's own-staff payroll (HR & Payroll module). No end-client
 *   switcher, never sends a clientId, always links within `/dashboard/payroll`.
 * - `outsourcing`: per end-client payroll (HR Outsourcing module) with the client switcher.
 */
export type PayrollSurfaceMode = 'internal' | 'outsourcing';

export interface PayrollSurfaceConfig {
  mode: PayrollSurfaceMode;
  /** Dashboard base path, e.g. '/dashboard/payroll' | '/dashboard/outsourcing/payroll'. */
  basePath: string;
  /** API base path, e.g. '/api/payroll' | '/api/outsourcing/payroll'. */
  apiBase: string;
  /** Employees base path for "fix data" deep-links. */
  employeesPath: string;
}

type ClientState = {
  clientId: string;
  clients: OutsourcingClientOption[];
  setClientId: (id: string) => void;
  showSwitcher: boolean;
};

const INTERNAL_CLIENT_STATE: ClientState = {
  clientId: '',
  clients: [],
  setClientId: () => {},
  showSwitcher: false,
};

interface PayrollRecord {
 id: string;
 employeeId: string;
 employeeName: string;
 employeeNumber: string | null;
 clientName: string;
 departmentName: string | null;
 month: number;
 year: number;
 basicPay: string;
 allowances?: { name: string; amount: number }[];
 grossPay: string;
 paye: string;
 nssf: string;
 nhif: string;
 ahl: string;
 nita?: string;
 netPay: string;
 status: string;
 payrollFrequency?: string;
 period1Gross?: string | null;
 period2Gross?: string | null;
}

interface DepartmentOption {
 id: string;
 name: string;
}

interface PayrollImportPreview {
 totals: { parsedRows: number; matched: number; unmatched: number; invalid: number };
 duplicateNationalIds: string[];
 matchedRows: Array<{
 row: number;
 nationalId: string;
 employeeId: string;
 employeeName: string;
 employeeEmail: string;
 input: {
 daysWorked: number | null;
 incentives: number;
 allowances: number;
 overtime: number;
 holidayPay: number;
 leavePay: number;
 grossPay: number;
 };
 }>;
 unmatchedRows: Array<{
 row: number;
 nationalId: string;
 employeeName: string | null;
 email: string | null;
 reason: string;
 }>;
 invalidRows: Array<{ row: number; reason: string }>;
}

const MONTHS = [
 'January', 'February', 'March', 'April', 'May', 'June',
 'July', 'August', 'September', 'October', 'November', 'December',
];

type PayrollColumnId =
 | 'empNo'
 | 'dept'
 | 'basic'
 | 'bonus'
 | 'overtime'
 | 'houseAllowance'
 | 'commAllowance'
 | 'transportAllowance'
 | 'mealAllowance'
 | 'medicalAllowance'
 | 'gross'
 | 'paye'
 | 'nssf'
 | 'nhif'
 | 'ahl'
 | 'nita'
 | 'employerNssf'
 | 'employerAhl'
 | 'employerCost'
 | 'ctc'
 | 'deductions'
 | 'netPay'
 | 'status';

interface PayrollColumn {
 id: PayrollColumnId;
 label: string;
 align: 'left' | 'right';
 headerTitle?: string;
 render: (p: PayrollRecord) => React.ReactNode;
}

const PAYROLL_COLUMN_ORDER: PayrollColumnId[] = [
 'empNo', 'dept', 'basic',
 'bonus', 'overtime', 'houseAllowance', 'commAllowance', 'transportAllowance', 'mealAllowance', 'medicalAllowance',
 'gross', 'paye', 'nssf', 'nhif', 'ahl', 'nita',
 'employerNssf', 'employerAhl', 'employerCost', 'ctc',
 'deductions', 'netPay', 'status',
];

/** Reads a standard earning (Bonus, Overtime, allowances) from the payroll `allowances` JSON. */
function getEarningAmount(p: PayrollRecord, name: string): number {
 const found = (p.allowances ?? []).find((a) => a.name === name);
 return found ? Number(found.amount) || 0 : 0;
}

const DEFAULT_VISIBLE_COLUMNS: PayrollColumnId[] = ['empNo', 'dept', 'gross', 'deductions', 'netPay', 'status'];

const PAYROLL_COLUMNS_STORAGE_KEY = 'stride.payroll.visibleColumns.v2';
const PAYROLL_GROUPBY_STORAGE_KEY = 'stride.payroll.groupBy.v1';

type PayrollGroupBy = 'none' | 'department' | 'facility';

const GROUP_BY_OPTIONS: Array<{ value: PayrollGroupBy; label: string }> = [
 { value: 'none', label: 'No grouping' },
 { value: 'department', label: 'Group by department' },
 { value: 'facility', label: 'Group by facility' },
];

/** Numeric accessors used for column subtotals and run totals. */
const PAYROLL_NUMERIC_ACCESSORS: Partial<Record<PayrollColumnId, (p: PayrollRecord) => number>> = {
 basic: (p) => Number(p.basicPay),
 bonus: (p) => getEarningAmount(p, 'Bonus'),
 overtime: (p) => getEarningAmount(p, 'Overtime'),
 houseAllowance: (p) => getEarningAmount(p, 'House Allowance'),
 commAllowance: (p) => getEarningAmount(p, 'Comm Allowance'),
 transportAllowance: (p) => getEarningAmount(p, 'Transport Allowance'),
 mealAllowance: (p) => getEarningAmount(p, 'Meal Allowance'),
 medicalAllowance: (p) => getEarningAmount(p, 'Medical Allowance'),
 gross: (p) => Number(p.grossPay),
 paye: (p) => Number(p.paye),
 nssf: (p) => Number(p.nssf),
 nhif: (p) => Number(p.nhif),
 ahl: (p) => Number(p.ahl ?? 0),
 nita: (p) => Number(p.nita ?? 0),
 // Employer-side (Kenya): NSSF is matched by the employer (equal to the employee
 // amount), AHL is a 1.5% employer match (equal to the employee amount), and NITA
 // is an employer-only levy. None of these reduce employee net pay.
 employerNssf: (p) => Number(p.nssf),
 employerAhl: (p) => Number(p.ahl ?? 0),
 employerCost: (p) => Number(p.nssf) + Number(p.ahl ?? 0) + Number(p.nita ?? 0),
 ctc: (p) => Number(p.grossPay) + Number(p.nssf) + Number(p.ahl ?? 0) + Number(p.nita ?? 0),
 deductions: (p) => Number(p.grossPay) - Number(p.netPay),
 netPay: (p) => Number(p.netPay),
};

function sumPayrollColumn(rows: PayrollRecord[], id: PayrollColumnId): number | null {
 const accessor = PAYROLL_NUMERIC_ACCESSORS[id];
 if (!accessor) return null;
 return rows.reduce((sum, p) => sum + accessor(p), 0);
}

type PayrollSortKey = 'employee' | PayrollColumnId;

function payrollSortValue(p: PayrollRecord, key: PayrollSortKey): string | number {
 switch (key) {
 case 'employee':
 return p.employeeName.toLowerCase();
 case 'empNo':
 return (p.employeeNumber ?? '').toLowerCase();
 case 'dept':
 return (p.departmentName ?? '').toLowerCase();
 case 'status':
 return p.status;
 default: {
 const accessor = PAYROLL_NUMERIC_ACCESSORS[key];
 return accessor ? accessor(p) : '';
 }
 }
}

function ColumnPickerMenu({
 columns,
 visible,
 onToggle,
 onReset,
}: {
 columns: Array<{ id: PayrollColumnId; label: string }>;
 visible: Set<PayrollColumnId>;
 onToggle: (id: PayrollColumnId) => void;
 onReset: () => void;
}) {
 const [open, setOpen] = useState(false);
 const ref = useRef<HTMLDivElement>(null);

 useEffect(() => {
 if (!open) return;
 function onDocClick(e: MouseEvent) {
 if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
 }
 function onKey(e: KeyboardEvent) {
 if (e.key === 'Escape') setOpen(false);
 }
 document.addEventListener('mousedown', onDocClick);
 document.addEventListener('keydown', onKey);
 return () => {
 document.removeEventListener('mousedown', onDocClick);
 document.removeEventListener('keydown', onKey);
 };
 }, [open]);

 return (
 <div className="relative" ref={ref}>
 <button
 type="button"
 onClick={() => setOpen((v) => !v)}
 aria-haspopup="menu"
 aria-expanded={open}
 className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
 >
 <SlidersHorizontal className="h-4 w-4" />
 Columns
 <span className="rounded bg-neutral-100 px-1.5 text-xs text-neutral-500">{visible.size}</span>
 </button>
 {open && (
 <div className="absolute right-0 z-30 mt-2 w-60 rounded-xl border border-neutral-200 bg-white p-2 shadow-lg">
 <p className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500">
 Show columns
 </p>
 <div className="max-h-72 overflow-auto">
 {columns.map((col) => {
 const checked = visible.has(col.id);
 return (
 <button
 key={col.id}
 type="button"
 role="menuitemcheckbox"
 aria-checked={checked}
 onClick={() => onToggle(col.id)}
 className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-sm text-neutral-700 hover:bg-neutral-50"
 >
 <span
 className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
 checked ? 'border-primary-600 bg-primary-600 text-white' : 'border-neutral-300 bg-white'
 }`}
 >
 {checked && <Check className="h-3 w-3" strokeWidth={3} />}
 </span>
 {col.label}
 </button>
 );
 })}
 </div>
 <div className="mt-1 border-t border-neutral-100 pt-1">
 <button
 type="button"
 onClick={onReset}
 className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-neutral-600 hover:bg-neutral-50"
 >
 <RotateCcw className="h-3.5 w-3.5" />
 Reset to default
 </button>
 </div>
 </div>
 )}
 </div>
 );
}

export function PayrollWorkspace({ config }: { config: PayrollSurfaceConfig }) {
 return (
  <Suspense fallback={<div className="h-40 animate-pulse rounded-2xl bg-neutral-100" />}>
   {config.mode === 'outsourcing' ? (
    <OutsourcingPayrollWorkspace config={config} />
   ) : (
    <PayrollWorkspaceInner config={config} client={INTERNAL_CLIENT_STATE} />
   )}
  </Suspense>
 );
}

/** Outsourcing surface: reads the end-client from the switcher / URL. */
function OutsourcingPayrollWorkspace({ config }: { config: PayrollSurfaceConfig }) {
 const { clientId, clients, setClientId, showSwitcher } = useOutsourcingClient({ excludePrimary: true });
 return (
  <PayrollWorkspaceInner
   config={config}
   client={{ clientId, clients, setClientId, showSwitcher }}
  />
 );
}

function PayrollWorkspaceInner({
 config,
 client,
}: {
 config: PayrollSurfaceConfig;
 client: ClientState;
}) {
 const { activeEntity } = useEntity();
 const { clientId, clients, setClientId, showSwitcher } = client;
 const [showTrends, setShowTrends] = useState(false);
 const entityConfig = useEntityConfig();
 const formatCurrency = useCurrencyFormatter();
 const now = new Date();
 const [month, setMonth] = useState(now.getMonth() + 1);
 const [year, setYear] = useState(now.getFullYear());
 const [scope, setScope] = useState<'all' | 'department'>('all');
 const [departmentId, setDepartmentId] = useState('');
 const [departments, setDepartments] = useState<DepartmentOption[]>([]);
 const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
 const [loading, setLoading] = useState(true);
 const [generating, setGenerating] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [generateResult, setGenerateResult] = useState<string | null>(null);
 const [sendingId, setSendingId] = useState<string | null>(null);
 const [editPayrollId, setEditPayrollId] = useState<string | null>(null);
 const [editEmployeeName, setEditEmployeeName] = useState('');
 const [recalculating, setRecalculating] = useState(false);
 const [importingPayrollInput, setImportingPayrollInput] = useState(false);
 const [committingPayrollInput, setCommittingPayrollInput] = useState(false);
 const [selectedPayrollInputFile, setSelectedPayrollInputFile] = useState<File | null>(null);
 const [importPreview, setImportPreview] = useState<PayrollImportPreview | null>(null);
 const [showMissingEmployeesPrompt, setShowMissingEmployeesPrompt] = useState(false);
 const [pendingSendPayslip, setPendingSendPayslip] = useState<{ employeeId: string; employeeName: string } | null>(null);
 const [bankExportWarning, setBankExportWarning] = useState<string | null>(null);
 const [visibleColumns, setVisibleColumns] = useState<Set<PayrollColumnId>>(
 () => new Set(DEFAULT_VISIBLE_COLUMNS),
 );
 const [groupBy, setGroupBy] = useState<PayrollGroupBy>('none');
 const [groupFilter, setGroupFilter] = useState<string>('');
 const [search, setSearch] = useState('');
 const [sort, setSort] = useState<{ key: PayrollSortKey; dir: 'asc' | 'desc' }>({ key: 'employee', dir: 'asc' });
 const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
 const [pendingBulkSend, setPendingBulkSend] = useState<{ employeeIds: string[]; label: string } | null>(null);
 const [bulkSending, setBulkSending] = useState(false);
 const [columnsHydrated, setColumnsHydrated] = useState(false);
 const [setup, setSetup] = useState<{
 staffCount: number;
 staffWithSalaryCount: number;
 staffMissingSalaryCount: number;
 } | null>(null);
 const [reportsOpen, setReportsOpen] = useState(false);

 /** In internal mode the surface never scopes to an end-client. */
 const isOutsourcing = config.mode === 'outsourcing';
 const linkWithClient = (path: string) => (isOutsourcing ? withOutsourcingClientQuery(path, clientId) : path);

 useEffect(() => {
 setGroupFilter('');
 }, [groupBy]);

 const toggleSort = (key: PayrollSortKey) => {
 setSort((prev) => (prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
 };

 const toggleRowSelected = (id: string) => {
 setSelectedIds((prev) => {
 const next = new Set(prev);
 if (next.has(id)) next.delete(id);
 else next.add(id);
 return next;
 });
 };

 useEffect(() => {
 try {
 const raw = localStorage.getItem(PAYROLL_COLUMNS_STORAGE_KEY);
 if (raw) {
 const parsed = JSON.parse(raw);
 if (Array.isArray(parsed)) {
 const valid = parsed.filter((id): id is PayrollColumnId =>
 PAYROLL_COLUMN_ORDER.includes(id as PayrollColumnId),
 );
 setVisibleColumns(new Set(valid));
 }
 }
 const savedGroupBy = localStorage.getItem(PAYROLL_GROUPBY_STORAGE_KEY);
 if (savedGroupBy && GROUP_BY_OPTIONS.some((o) => o.value === savedGroupBy)) {
 setGroupBy(savedGroupBy as PayrollGroupBy);
 }
 } catch {
 /* ignore malformed storage */
 }
 setColumnsHydrated(true);
 }, []);

 useEffect(() => {
 if (!columnsHydrated) return;
 try {
 localStorage.setItem(PAYROLL_COLUMNS_STORAGE_KEY, JSON.stringify([...visibleColumns]));
 localStorage.setItem(PAYROLL_GROUPBY_STORAGE_KEY, groupBy);
 } catch {
 /* ignore quota / privacy-mode errors */
 }
 }, [visibleColumns, groupBy, columnsHydrated]);

 const toggleColumn = (id: PayrollColumnId) => {
 setVisibleColumns((prev) => {
 const next = new Set(prev);
 if (next.has(id)) next.delete(id);
 else next.add(id);
 return next;
 });
 };

 const resetColumns = () => setVisibleColumns(new Set(DEFAULT_VISIBLE_COLUMNS));

 const statutoryHeaders = entityConfig.payroll.deductionColumnHeaders;

 const allColumns: PayrollColumn[] = useMemo(() => {
 const byId: Record<PayrollColumnId, PayrollColumn> = {
 empNo: {
 id: 'empNo', label: 'Employee no.', align: 'left',
 render: (p) => <span className="text-neutral-600 tabular-nums">{p.employeeNumber ?? '—'}</span>,
 },
 dept: {
 id: 'dept', label: 'Dept', align: 'left',
 render: (p) => <span className="text-neutral-600">{p.departmentName ?? '—'}</span>,
 },
 basic: {
 id: 'basic', label: 'Basic', align: 'right',
 render: (p) => formatCurrency(Number(p.basicPay)),
 },
 bonus: {
 id: 'bonus', label: 'Bonus', align: 'right', headerTitle: 'Bonus',
 render: (p) => formatCurrency(getEarningAmount(p, 'Bonus')),
 },
 overtime: {
 id: 'overtime', label: 'Overtime', align: 'right', headerTitle: 'Overtime',
 render: (p) => formatCurrency(getEarningAmount(p, 'Overtime')),
 },
 houseAllowance: {
 id: 'houseAllowance', label: 'House allow.', align: 'right', headerTitle: 'House Allowance',
 render: (p) => formatCurrency(getEarningAmount(p, 'House Allowance')),
 },
 commAllowance: {
 id: 'commAllowance', label: 'Comm allow.', align: 'right', headerTitle: 'Comm Allowance',
 render: (p) => formatCurrency(getEarningAmount(p, 'Comm Allowance')),
 },
 transportAllowance: {
 id: 'transportAllowance', label: 'Transport allow.', align: 'right', headerTitle: 'Transport Allowance',
 render: (p) => formatCurrency(getEarningAmount(p, 'Transport Allowance')),
 },
 mealAllowance: {
 id: 'mealAllowance', label: 'Meal allow.', align: 'right', headerTitle: 'Meal Allowance',
 render: (p) => formatCurrency(getEarningAmount(p, 'Meal Allowance')),
 },
 medicalAllowance: {
 id: 'medicalAllowance', label: 'Medical allow.', align: 'right', headerTitle: 'Medical Allowance',
 render: (p) => formatCurrency(getEarningAmount(p, 'Medical Allowance')),
 },
 gross: {
 id: 'gross', label: 'Gross', align: 'right',
 render: (p) => formatCurrency(Number(p.grossPay)),
 },
 paye: {
 id: 'paye', label: statutoryHeaders.paye, align: 'right',
 render: (p) => formatCurrency(Number(p.paye)),
 },
 nssf: {
 id: 'nssf', label: statutoryHeaders.nssf, align: 'right',
 render: (p) => formatCurrency(Number(p.nssf)),
 },
 nhif: {
 id: 'nhif', label: statutoryHeaders.nhif, align: 'right',
 render: (p) => formatCurrency(Number(p.nhif)),
 },
 ahl: {
 id: 'ahl', label: statutoryHeaders.ahl, align: 'right',
 render: (p) => formatCurrency(Number(p.ahl ?? 0)),
 },
 nita: {
 id: 'nita', label: statutoryHeaders.nita, align: 'right',
 headerTitle: 'Employer levy (not deducted from net pay)',
 render: (p) => <span className="text-neutral-500">{formatCurrency(Number(p.nita ?? 0))}</span>,
 },
 employerNssf: {
 id: 'employerNssf', label: 'Emp. NSSF', align: 'right',
 headerTitle: 'Employer NSSF contribution (matches employee; not deducted from net pay)',
 render: (p) => <span className="text-neutral-500">{formatCurrency(Number(p.nssf))}</span>,
 },
 employerAhl: {
 id: 'employerAhl', label: 'Emp. AHL', align: 'right',
 headerTitle: 'Employer Affordable Housing Levy (1.5% match; not deducted from net pay)',
 render: (p) => <span className="text-neutral-500">{formatCurrency(Number(p.ahl ?? 0))}</span>,
 },
 employerCost: {
 id: 'employerCost', label: 'Employer cost', align: 'right',
 headerTitle: 'Total employer statutory cost (employer NSSF + AHL + NITA)',
 render: (p) => (
 <span className="text-neutral-600">
 {formatCurrency(Number(p.nssf) + Number(p.ahl ?? 0) + Number(p.nita ?? 0))}
 </span>
 ),
 },
 ctc: {
 id: 'ctc', label: 'Cost to company', align: 'right',
 headerTitle: 'Total cost to company (gross + employer NSSF + AHL + NITA)',
 render: (p) => (
 <span className="font-medium text-primary-900">
 {formatCurrency(Number(p.grossPay) + Number(p.nssf) + Number(p.ahl ?? 0) + Number(p.nita ?? 0))}
 </span>
 ),
 },
 deductions: {
 id: 'deductions', label: 'Deductions', align: 'right',
 headerTitle: 'Total deductions from gross (gross − net)',
 render: (p) => <span className="text-neutral-600">{formatCurrency(Number(p.grossPay) - Number(p.netPay))}</span>,
 },
 netPay: {
 id: 'netPay', label: 'Net pay', align: 'right',
 render: (p) => <span className="font-medium text-primary-900">{formatCurrency(Number(p.netPay))}</span>,
 },
 status: {
 id: 'status', label: 'Status', align: 'left',
 render: (p) => (
 <span className={dashStatusChip(
 p.status === 'paid' ? 'success' : p.status === 'approved' ? 'primary' : 'warning',
 )}>
 {p.status}
 </span>
 ),
 },
 };
 return PAYROLL_COLUMN_ORDER.map((id) => byId[id]);
 }, [formatCurrency, statutoryHeaders]);

 const orderedVisibleColumns = allColumns.filter((c) => visibleColumns.has(c.id));
 const tableMinWidth = 470 + orderedVisibleColumns.length * 130;
 const totalColumnCount = orderedVisibleColumns.length + 3; // select + employee + columns + actions

 const filteredPayrolls = useMemo(() => {
 const q = search.trim().toLowerCase();
 if (!q) return payrolls;
 return payrolls.filter(
 (p) =>
 p.employeeName.toLowerCase().includes(q) ||
 (p.employeeNumber ?? '').toLowerCase().includes(q) ||
 (p.departmentName ?? '').toLowerCase().includes(q),
 );
 }, [payrolls, search]);

 const sortedPayrolls = useMemo(() => {
 const arr = [...filteredPayrolls];
 arr.sort((a, b) => {
 const av = payrollSortValue(a, sort.key);
 const bv = payrollSortValue(b, sort.key);
 let cmp: number;
 if (typeof av === 'number' && typeof bv === 'number') cmp = av - bv;
 else cmp = String(av).localeCompare(String(bv));
 return sort.dir === 'asc' ? cmp : -cmp;
 });
 return arr;
 }, [filteredPayrolls, sort]);

 const groupedPayrolls = useMemo(() => {
 if (groupBy === 'none') return null;
 const map = new Map<string, { label: string; rows: PayrollRecord[] }>();
 for (const p of sortedPayrolls) {
 const label =
 groupBy === 'department'
 ? p.departmentName ?? 'No department'
 : p.clientName ?? 'Unassigned';
 const existing = map.get(label);
 if (existing) existing.rows.push(p);
 else map.set(label, { label, rows: [p] });
 }
 return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label));
 }, [groupBy, sortedPayrolls]);

 const groupFilterOptions = useMemo(() => {
 if (!groupedPayrolls) return [];
 return [
 { value: '', label: groupBy === 'department' ? 'All departments' : 'All facilities' },
 ...groupedPayrolls.map((g) => ({ value: g.label, label: `${g.label} (${g.rows.length})` })),
 ];
 }, [groupedPayrolls, groupBy]);

 const displayedGroups = useMemo(() => {
 if (!groupedPayrolls) return null;
 if (!groupFilter) return groupedPayrolls;
 const match = groupedPayrolls.filter((g) => g.label === groupFilter);
 return match.length > 0 ? match : groupedPayrolls;
 }, [groupedPayrolls, groupFilter]);

 const displayedRows = useMemo(
 () => (displayedGroups ? displayedGroups.flatMap((g) => g.rows) : sortedPayrolls),
 [displayedGroups, sortedPayrolls],
 );

 const displayedRowIds = useMemo(() => displayedRows.map((r) => r.id), [displayedRows]);
 const selectedCount = useMemo(
 () => displayedRowIds.filter((id) => selectedIds.has(id)).length,
 [displayedRowIds, selectedIds],
 );
 const allDisplayedSelected = displayedRowIds.length > 0 && selectedCount === displayedRowIds.length;

 const toggleSelectAll = () => {
 setSelectedIds((prev) => {
 const next = new Set(prev);
 if (allDisplayedSelected) {
 for (const id of displayedRowIds) next.delete(id);
 } else {
 for (const id of displayedRowIds) next.add(id);
 }
 return next;
 });
 };

 const employeeIdsForSelection = () =>
 displayedRows.filter((r) => selectedIds.has(r.id)).map((r) => r.employeeId);

 const executeBulkSend = async (employeeIds: string[]) => {
 if (employeeIds.length === 0) return;
 setBulkSending(true);
 setError(null);
 try {
 const res = await fetch(`${config.apiBase}/send-payslips`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ month, year, employeeIds, ...(clientId.trim() ? { clientId: clientId.trim() } : {}) }),
 });
 const data = await res.json();
 if (!res.ok) throw new Error(data.error || 'Failed to send payslips');
 const sent = data.sent ?? 0;
 const skipped = data.skipped ?? 0;
 setGenerateResult(
 `Sent ${sent} payslip${sent === 1 ? '' : 's'}${skipped > 0 ? ` · ${skipped} skipped (no email on file)` : ''}.`,
 );
 if (data.errors?.length) setError(data.errors[0]);
 setSelectedIds(new Set());
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to send payslips');
 } finally {
 setBulkSending(false);
 }
 };

 const payslipsUrlForEmployees = (employeeIds: string[]) => {
 const params = new URLSearchParams();
 params.set('month', String(month));
 params.set('year', String(year));
 if (clientId.trim()) params.set('clientId', clientId.trim());
 params.set('employeeIds', employeeIds.join(','));
 return `${config.basePath}/payslips?${params.toString()}`;
 };

 const sortHeader = (label: string, key: PayrollSortKey, align: 'left' | 'right' = 'left') => {
 const active = sort.key === key;
 return (
 <button
 type="button"
 onClick={() => toggleSort(key)}
 className={`inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.06em] hover:text-primary-700 ${
 align === 'right' ? 'flex-row-reverse' : ''
 }`}
 >
 {label}
 {active ? (
 sort.dir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
 ) : (
 <span className="inline-block w-3" aria-hidden />
 )}
 </button>
 );
 };

 const runTotals = useMemo(
 () =>
 displayedRows.reduce(
 (acc, p) => {
 acc.headcount += 1;
 acc.gross += Number(p.grossPay);
 acc.net += Number(p.netPay);
 acc.deductions += Number(p.grossPay) - Number(p.netPay);
 const employer = Number(p.nssf) + Number(p.ahl ?? 0) + Number(p.nita ?? 0);
 acc.employerCost += employer;
 acc.ctc += Number(p.grossPay) + employer;
 return acc;
 },
 { headcount: 0, gross: 0, net: 0, deductions: 0, employerCost: 0, ctc: 0 },
 ),
 [displayedRows],
 );

 const renderPayrollRow = (p: PayrollRecord) => (
 <tr key={p.id} data-selected={selectedIds.has(p.id) ? 'true' : undefined}>
 <td className="px-4 py-3 w-10">
 <input
 type="checkbox"
 aria-label={`Select ${p.employeeName}`}
 checked={selectedIds.has(p.id)}
 onChange={() => toggleRowSelected(p.id)}
 className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500/40"
 />
 </td>
 <td className="px-4 py-3">
 <span className="font-medium text-primary-900">{p.employeeName}</span>
 {p.payrollFrequency === 'biweekly' && (
 <span className="ml-1 text-[10px] uppercase font-bold text-amber-700 bg-amber-100 px-1 rounded">2wk</span>
 )}
 </td>
 {orderedVisibleColumns.map((col) => (
 <td
 key={col.id}
 className={`px-4 py-3 ${col.align === 'right' ? 'col-right tabular-nums' : ''}`}
 >
 {col.render(p)}
 </td>
 ))}
                    <td className="px-4 py-3 col-right whitespace-nowrap" style={{ width: '1%' }}>
                      <div className="inline-flex items-center gap-1">
 <button
 type="button"
 onClick={() => { setEditPayrollId(p.id); setEditEmployeeName(p.employeeName); }}
 title={`Edit pay for ${p.employeeName}`}
 className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-neutral-600 hover:bg-primary-50 hover:text-primary-700 transition-colors"
 >
 <Pencil className="w-4 h-4" />
 </button>
 <Link
 href={`${config.basePath}/payslips?month=${month}&year=${year}${clientId.trim() ? `&clientId=${encodeURIComponent(clientId.trim())}` : ''}&employeeIds=${encodeURIComponent(p.employeeId)}`}
 title={`View payslip for ${p.employeeName}`}
 className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-neutral-600 hover:bg-primary-50 hover:text-primary-700 transition-colors"
 >
 <Eye className="w-4 h-4" />
 </Link>
 <a
 href={`${config.apiBase}/p9?year=${year}&employeeId=${encodeURIComponent(p.employeeId)}&format=pdf${clientId.trim() ? `&clientId=${encodeURIComponent(clientId.trim())}` : ''}`}
 title={`Download ${year} P9A tax card for ${p.employeeName}`}
 className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-neutral-600 hover:bg-primary-50 hover:text-primary-700 transition-colors"
 >
 <FileText className="w-4 h-4" />
 </a>
 <button
 type="button"
 onClick={() => handleSendPayslip(p.employeeId, p.employeeName)}
 disabled={sendingId === p.employeeId}
 title={`Send payslip for ${MONTHS[month - 1]} ${year} to ${p.employeeName}`}
 className="inline-flex items-center justify-center w-9 h-9 rounded-lg text-neutral-600 hover:bg-primary-50 hover:text-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
 >
 {sendingId === p.employeeId ? (
 <Loader2 className="w-4 h-4 animate-spin" />
 ) : (
 <Mail className="w-4 h-4" />
 )}
 </button>
 </div>
 </td>
 </tr>
 );

 const renderSubtotalRow = (rows: PayrollRecord[], keyPrefix: string) => (
 <tr key={`${keyPrefix}-subtotal`} className="payroll-subtotal-row">
 <td className="px-4 py-2" />
 <td className="px-4 py-2 text-[11px] font-semibold uppercase tracking-wide opacity-70">
 Subtotal
 </td>
 {orderedVisibleColumns.map((col) => {
 const sum = sumPayrollColumn(rows, col.id);
 return (
 <td
 key={col.id}
 className={`px-4 py-2 font-medium ${col.align === 'right' ? 'col-right tabular-nums' : ''}`}
 >
      {sum != null ? formatCurrency(sum) : ''}
                </td>
              );
            })}
            <td className="px-4 py-2" style={{ width: '1%' }} />
 </tr>
 );

 const bankExportState = useMemo(() => {
 if (payrolls.length === 0) return { enabled: false, title: 'No payroll records to export.' as const };
 if (payrolls.some((p) => p.status === 'draft')) {
 return { enabled: false, title: 'Approve the payroll run before exporting.' as const };
 }
 if (!payrolls.every((p) => p.status === 'approved' || p.status === 'paid')) {
 return { enabled: false, title: 'All visible payroll records must be approved or paid before exporting.' as const };
 }
 return { enabled: true, title: 'Download CSV for bank batch payment (net pay)' as const };
 }, [payrolls]);

 const draftCount = useMemo(() => payrolls.filter((p) => p.status === 'draft').length, [payrolls]);
 const approvedCount = useMemo(
 () => payrolls.filter((p) => p.status === 'approved' || p.status === 'paid').length,
 [payrolls],
 );
 const approvedOnlyCount = useMemo(() => payrolls.filter((p) => p.status === 'approved').length, [payrolls]);
 const paidCount = useMemo(() => payrolls.filter((p) => p.status === 'paid').length, [payrolls]);

 /** Guided run lifecycle — drives the header CTA and empty/setup states. */
 const runState: PayrollRunState = derivePayrollRunState({
 staffCount: setup?.staffCount ?? (payrolls.length > 0 ? payrolls.length : 0),
 payrollCount: payrolls.length,
 draftCount,
 approvedCount: approvedOnlyCount,
 paidCount,
 });
 /** Only trust "no staff" once the setup probe has returned. */
 const knownNoStaff = setup != null && setup.staffCount === 0 && payrolls.length === 0;

 const fetchPayrolls = async () => {
 setLoading(true);
 setError(null);
 try {
 const params = new URLSearchParams();
 params.set('month', String(month));
 params.set('year', String(year));
 if (clientId.trim()) params.set('clientId', clientId.trim());
 if (scope === 'department' && departmentId.trim()) params.set('departmentId', departmentId.trim());
 const res = await fetch(`${config.apiBase}?${params}`);
 const data = await res.json();
 if (!res.ok) throw new Error(data.error || 'Failed to load payroll');
 setPayrolls(Array.isArray(data) ? data : []);
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to load payroll');
 setPayrolls([]);
 } finally {
 setLoading(false);
 }
 };

 const fetchDepartments = async (cid: string) => {
 try {
 const url = isOutsourcing
 ? `/api/outsourcing/clients/${cid}/departments`
 : `${config.apiBase}/departments`;
 const res = await fetch(url);
 const data = await res.json().catch(() => []);
 if (res.ok && Array.isArray(data)) {
 setDepartments(data.map((d: { id: string; name: string }) => ({ id: d.id, name: d.name })));
 } else {
 setDepartments([]);
 }
 } catch {
 setDepartments([]);
 }
 };

 useEffect(() => {
  if (!isOutsourcing) {
   void fetchDepartments('');
  } else if (clientId.trim()) {
   void fetchDepartments(clientId.trim());
  } else {
   setDepartments([]);
   setDepartmentId('');
  }
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [clientId, activeEntity.id, isOutsourcing]);

 useEffect(() => {
 fetchPayrolls();
 // eslint-disable-next-line react-hooks/exhaustive-deps
 }, [month, year, scope, clientId, departmentId, activeEntity.id]);

 // Setup readiness (does the workforce exist / have salaries?) powers the guided
 // empty and setup states without blocking the main payroll list.
 useEffect(() => {
 let active = true;
 const params = new URLSearchParams({ month: String(month), year: String(year) });
 if (clientId.trim()) params.set('clientId', clientId.trim());
 if (scope === 'department' && departmentId.trim()) params.set('departmentId', departmentId.trim());
 fetch(`${config.apiBase}/run/overview?${params}`, { credentials: 'include' })
 .then((r) => (r.ok ? r.json() : null))
 .then((d) => {
 if (active && d?.setup) setSetup(d.setup);
 })
 .catch(() => {
 /* non-blocking */
 });
 return () => {
 active = false;
 };
 }, [month, year, scope, clientId, departmentId, activeEntity.id, config.apiBase]);

 const handleGenerate = async () => {
 setGenerating(true);
 setGenerateResult(null);
 setError(null);
 try {
 const body: Record<string, unknown> = { month, year };
 if (clientId.trim()) body.clientId = clientId.trim();
 if (scope === 'department' && departmentId.trim()) body.departmentId = departmentId.trim();
 const res = await fetch(`${config.apiBase}/generate`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 credentials: 'include',
 body: JSON.stringify(body),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) {
 const hint =
 typeof data.detail === 'string' && data.detail.trim()
 ? ` ${data.detail}`
 : '';
 throw new Error((data.error || 'Failed to generate') + hint);
 }
 setGenerateResult(data.message || `Created ${data.created ?? 0} payroll record(s).`);
 await fetchPayrolls();
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to generate payroll');
 } finally {
 setGenerating(false);
 }
 };

 const payslipUrl = () => {
 const params = new URLSearchParams();
 params.set('month', String(month));
 params.set('year', String(year));
 if (clientId.trim()) params.set('clientId', clientId.trim());
 if (scope === 'department' && departmentId.trim()) params.set('departmentId', departmentId.trim());
 return `${config.basePath}/payslips?${params}`;
 };

 const canGenerate = scope === 'all' || (scope === 'department' && departmentId.trim());

 const runPayrollImportPreview = async (file: File) => {
 setImportingPayrollInput(true);
 setError(null);
 setGenerateResult(null);
 try {
 const formData = new FormData();
 formData.append('file', file);
 if (clientId.trim()) formData.append('clientId', clientId.trim());
 formData.append('month', String(month));
 formData.append('year', String(year));
 const res = await fetch(`${config.apiBase}/import/preview`, {
 method: 'POST',
 body: formData,
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error(data.error || 'Failed to preview payroll input.');
 setImportPreview(data as PayrollImportPreview);
 setShowMissingEmployeesPrompt((data?.totals?.unmatched ?? 0) > 0);
 setGenerateResult(`Preview ready: ${data.totals.matched} matched, ${data.totals.unmatched} unmatched, ${data.totals.invalid} invalid.`);
 } catch (e) {
 setImportPreview(null);
 setShowMissingEmployeesPrompt(false);
 setError(e instanceof Error ? e.message : 'Failed to preview payroll input.');
 } finally {
 setImportingPayrollInput(false);
 }
 };

 const handlePayrollInputFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 e.target.value = '';
 if (!file) return;
 setSelectedPayrollInputFile(file);
 await runPayrollImportPreview(file);
 };

 const handleCreateMissingEmployees = async () => {
 if (!importPreview) return;
 const missingRows = importPreview.unmatchedRows.map((r) => ({
 nationalId: r.nationalId,
 employeeName: r.employeeName,
 email: r.email,
 }));
 if (missingRows.length === 0) return;
 setImportingPayrollInput(true);
 setError(null);
 try {
 const res = await fetch(`${config.apiBase}/import/create-missing-employees`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ clientId: clientId.trim() || null, missingRows }),
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error(data.error || 'Failed to create missing employees.');
 setShowMissingEmployeesPrompt(false);
 setGenerateResult(`Created ${data.createdCount ?? 0} missing employee(s). Re-running preview...`);
 if (selectedPayrollInputFile) await runPayrollImportPreview(selectedPayrollInputFile);
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to create missing employees.');
 } finally {
 setImportingPayrollInput(false);
 }
 };

 const handleCommitPayrollImport = async () => {
 if (!selectedPayrollInputFile) return;
 setCommittingPayrollInput(true);
 setError(null);
 try {
 const formData = new FormData();
 formData.append('file', selectedPayrollInputFile);
 if (clientId.trim()) formData.append('clientId', clientId.trim());
 formData.append('month', String(month));
 formData.append('year', String(year));
 const res = await fetch(`${config.apiBase}/import/commit`, {
 method: 'POST',
 body: formData,
 });
 const data = await res.json().catch(() => ({}));
 if (!res.ok) throw new Error(data.error || 'Failed to commit payroll import.');
 setGenerateResult(data.message || 'Payroll import committed.');
 setImportPreview(null);
 setSelectedPayrollInputFile(null);
 setShowMissingEmployeesPrompt(false);
 await fetchPayrolls();
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to commit payroll import.');
 } finally {
 setCommittingPayrollInput(false);
 }
 };

 const executeSendPayslip = async (employeeId: string, employeeName: string) => {
 setSendingId(employeeId);
 try {
 const res = await fetch(`${config.apiBase}/send-payslips`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ month, year, employeeIds: [employeeId], ...(clientId.trim() ? { clientId: clientId.trim() } : {}) }),
 });
 const data = await res.json();
 if (!res.ok) throw new Error(data.error || 'Failed to send');
 if (data.errors?.length) {
 setError(data.errors[0] || 'Failed to send payslip');
 } else if (data.sent > 0) {
 setGenerateResult(`Payslip sent to ${employeeName}.`);
 } else if (data.skipped > 0) {
 setError(`${employeeName} has no email on file.`);
 }
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to send payslip');
 } finally {
 setSendingId(null);
 }
 };
 const handleSendPayslip = async (employeeId: string, employeeName: string) => {
 setPendingSendPayslip({ employeeId, employeeName });
 };

 const handleBankExport = async () => {
 if (!bankExportState.enabled) return;
 setBankExportWarning(null);
 setError(null);
 try {
 const params = new URLSearchParams();
 params.set('month', String(month));
 params.set('year', String(year));
 if (clientId.trim()) params.set('clientId', clientId.trim());
 if (scope === 'department' && departmentId.trim()) params.set('departmentId', departmentId.trim());
 const res = await fetch(`${config.apiBase}/bank-export?${params.toString()}`, { credentials: 'include' });
 const miss = parseInt(res.headers.get('X-Missing-Bank-Details-Count') || '0', 10);
 if (!res.ok) {
 const data = await res.json().catch(() => ({}));
 const errMsg = (data as { error?: string }).error || 'Bank export failed';
 throw new Error(errMsg);
 }
 const blob = await res.blob();
 const cd = res.headers.get('Content-Disposition');
 const match = cd?.match(/filename="([^"]+)"/);
 const filename = match?.[1] ?? `payroll-${year}-${String(month).padStart(2, '0')}-bank-export.csv`;
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = filename;
 a.rel = 'noopener';
 document.body.appendChild(a);
 a.click();
 a.remove();
 URL.revokeObjectURL(url);
 if (miss > 0) {
 setBankExportWarning(
 `${miss} employee(s) are missing bank name or account number and may need manual payment.`,
 );
 }
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Bank export failed');
 }
 };

 const handleGlExport = async () => {
 setError(null);
 try {
 const params = new URLSearchParams();
 params.set('month', String(month));
 params.set('year', String(year));
 if (clientId.trim()) params.set('clientId', clientId.trim());
 if (scope === 'department' && departmentId.trim()) params.set('departmentId', departmentId.trim());
 const res = await fetch(`${config.apiBase}/gl-export?${params.toString()}`, { credentials: 'include' });
 if (!res.ok) {
 const data = await res.json().catch(() => ({}));
 throw new Error((data as { error?: string }).error || 'GL export failed');
 }
 const blob = await res.blob();
 const cd = res.headers.get('Content-Disposition');
 const match = cd?.match(/filename="([^"]+)"/);
 const filename = match?.[1] ?? `payroll-journal-${year}-${String(month).padStart(2, '0')}.csv`;
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = filename;
 a.rel = 'noopener';
 document.body.appendChild(a);
 a.click();
 a.remove();
 URL.revokeObjectURL(url);
 } catch (e) {
 setError(e instanceof Error ? e.message : 'GL export failed');
 }
 };

 const handleP10Export = async () => {
 setError(null);
 try {
 const params = new URLSearchParams();
 params.set('month', String(month));
 params.set('year', String(year));
 if (clientId.trim()) params.set('clientId', clientId.trim());
 if (scope === 'department' && departmentId.trim()) params.set('departmentId', departmentId.trim());
 const res = await fetch(`${config.apiBase}/p10?${params.toString()}`, { credentials: 'include' });
 if (!res.ok) {
 const data = await res.json().catch(() => ({}));
 throw new Error((data as { error?: string }).error || 'P10 export failed');
 }
 const blob = await res.blob();
 const cd = res.headers.get('Content-Disposition');
 const match = cd?.match(/filename="([^"]+)"/);
 const filename = match?.[1] ?? `P10_SectionB_${year}-${String(month).padStart(2, '0')}.csv`;
 const url = URL.createObjectURL(blob);
 const a = document.createElement('a');
 a.href = url;
 a.download = filename;
 a.rel = 'noopener';
 document.body.appendChild(a);
 a.click();
 a.remove();
 URL.revokeObjectURL(url);
 } catch (e) {
 setError(e instanceof Error ? e.message : 'P10 export failed');
 }
 };

 const handleRecalculateStatutory = async () => {
 setRecalculating(true);
 setError(null);
 try {
 const body: Record<string, unknown> = { month, year };
 if (clientId.trim()) body.clientId = clientId.trim();
 if (scope === 'department' && departmentId.trim()) body.departmentId = departmentId.trim();
 const res = await fetch(`${config.apiBase}/recalculate-statutory`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(body),
 });
 const data = await res.json();
 if (!res.ok) throw new Error(data.error || 'Failed to recalculate');
 setGenerateResult(data.message || `Recalculated statutory for ${data.updated ?? 0} record(s).`);
 await fetchPayrolls();
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to recalculate statutory');
 } finally {
 setRecalculating(false);
 }
 };

 const templateUrl = isOutsourcing
 ? (clientId.trim()
 ? `/api/outsourcing/employees/template?mode=payroll-input&clientId=${encodeURIComponent(clientId.trim())}`
 : '/api/outsourcing/employees/template?mode=payroll-input')
 : `${config.apiBase}/import/template`;

 const RUN_STATE_LABEL: Record<PayrollRunState, string> = {
 needs_setup: 'Set up workforce',
 ready_to_generate: 'Ready to generate',
 draft: 'Draft run',
 approved: 'Approved · ready to pay',
 paid: 'Paid',
 };

 const headerAction = (() => {
 switch (runState) {
 case 'needs_setup':
 return (
 <Link href={config.employeesPath} className="btn-primary inline-flex items-center gap-2">
 <UserPlus className="h-4 w-4" />
 Add employees
 </Link>
 );
 case 'ready_to_generate':
 return (
 <button
 type="button"
 onClick={handleGenerate}
 disabled={!canGenerate || generating}
 className="btn-primary inline-flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
 {generating ? 'Generating…' : 'Generate payroll'}
 </button>
 );
 case 'draft':
 return (
 <a href="#payroll-run" className="btn-primary inline-flex items-center gap-2">
 <ArrowRight className="h-4 w-4" />
 Review &amp; approve
 </a>
 );
 case 'approved':
 return (
 <Link
 href={linkWithClient(`${config.basePath}/disbursements?month=${month}&year=${year}`)}
 className="btn-primary inline-flex items-center gap-2"
 >
 <Smartphone className="h-4 w-4" />
 Pay run
 </Link>
 );
 case 'paid':
 return (
 <Link
 href={payslipUrl()}
 target="_blank"
 rel="noopener noreferrer"
 className="btn-primary inline-flex items-center gap-2"
 >
 <Eye className="h-4 w-4" />
 View payslips
 </Link>
 );
 }
 })();

 return (
 <DashboardPage>
 <DashboardPageHeader
 eyebrow={isOutsourcing ? 'HR Outsourcing' : 'HR & Payroll'}
 title={entityConfig.payroll.runLabel}
 description="Run payroll, review, approve, and pay your workforce — start to finish."
 meta={`${MONTHS[month - 1]} ${year} · ${payrolls.length} record${payrolls.length === 1 ? '' : 's'}`}
 badges={[{ label: RUN_STATE_LABEL[runState] }]}
 actions={headerAction}
 footer={<PayrollSubnav config={config} clientId={clientId} />}
 />
 <EntityContextBanner />
 {isOutsourcing && showSwitcher ? (
  <div className="mb-4 max-w-md">
   <OutsourcingClientSwitcher clients={clients} value={clientId} onChange={setClientId} />
  </div>
 ) : null}

 {error && (
 <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
 {error}
 </div>
 )}

 {generateResult && (
 <div className="mb-6 p-4 bg-primary-50 border border-primary-200 rounded-lg text-primary-800 text-sm flex items-center justify-between">
 <span>{generateResult}</span>
 <button type="button" onClick={() => setGenerateResult(null)} className="text-primary-600 hover:underline">
 Dismiss
 </button>
 </div>
 )}

 {bankExportWarning && (
 <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-sm flex items-center justify-between gap-3">
 <span>{bankExportWarning}</span>
 <button type="button" onClick={() => setBankExportWarning(null)} className="text-amber-800 hover:underline shrink-0">
 Dismiss
 </button>
 </div>
 )}

 {knownNoStaff ? (
 <div className="dashboard-surface shadow-sm mb-6 p-5 sm:p-6">
 <div className="flex items-start gap-3">
 <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-700">
 <Users className="h-5 w-5" />
 </span>
 <div className="min-w-0 flex-1">
 <h2 className="text-base font-semibold text-primary-900">No staff on your payroll yet</h2>
 <p className="mt-1 text-sm text-neutral-600">
 Add your own staff (with a base salary) to this workspace, then generate {MONTHS[month - 1]} {year} payroll.
 If you already added employees, they may be attached to a different client or entity — check the Employees list.
 </p>
 <div className="mt-4 flex flex-wrap gap-2">
 <Link
 href={config.employeesPath}
 className="inline-flex items-center gap-2 rounded-lg bg-primary-900 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800"
 >
 <UserPlus className="h-4 w-4" />
 Add an employee
 </Link>
 <button
 type="button"
 onClick={() => {
 const el = document.getElementById('payroll-input-import-file') as HTMLInputElement | null;
 el?.click();
 }}
 className="inline-flex items-center gap-2 rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
 >
 <Upload className="h-4 w-4" />
 Import from template
 </button>
 </div>
 </div>
 </div>
 </div>
 ) : null}

 {!knownNoStaff && (
 <div id="payroll-run" className="mb-6 scroll-mt-24">
 <PayrollRunWizard
 month={month}
 year={year}
 scope={scope}
 clientId={clientId}
 departmentId={departmentId}
 payrollCount={payrolls.length}
 draftCount={draftCount}
 approvedCount={approvedCount}
 formatCurrency={formatCurrency}
 onGenerate={handleGenerate}
 generating={generating}
 onApproved={fetchPayrolls}
 onBankExport={handleBankExport}
 bankExportEnabled={bankExportState.enabled}
 apiBase={config.apiBase}
 basePath={config.basePath}
 employeesPath={config.employeesPath}
 />
 </div>
 )}

 <div className="dashboard-surface shadow-sm p-4 sm:p-6 mb-6">
 <h2 className="text-base font-semibold text-primary-900 mb-1 flex items-center gap-2">
 <Banknote className="w-5 h-5 text-primary-600" />
 Period &amp; payroll inputs
 </h2>
 <p className="mb-4 text-sm text-neutral-500">
 Choose the pay period and scope, or import amounts from the payroll template.
 </p>
 <div className="flex flex-wrap gap-4 items-end">
 <div>
 <label className="block text-xs font-medium text-neutral-600 mb-1">Month</label>
 <StrideSelect
 ariaLabel="Month"
 value={String(month)}
 onChange={(value) => setMonth(parseInt(value, 10))}
 options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-neutral-600 mb-1">Year</label>
 <input
 type="number"
 value={year}
 onChange={(e) => setYear(parseInt(e.target.value, 10) || year)}
 min={2020}
 max={2030}
 className="px-4 py-2 border border-neutral-300 rounded-lg text-sm w-24 focus:ring-2 focus:ring-primary-500"
 />
 </div>
 <div>
 <label className="block text-xs font-medium text-neutral-600 mb-1">Scope</label>
 <StrideSelect
 ariaLabel="Scope"
 value={scope}
 onChange={(value) => setScope(value as 'all' | 'department')}
 options={[
 { value: 'all', label: 'All employees' },
 { value: 'department', label: 'By department' },
 ]}
 />
 </div>
 {scope === 'department' && (
 <div>
 <label className="block text-xs font-medium text-neutral-600 mb-1">Department</label>
 <StrideSelect
 className="min-w-[180px]"
 ariaLabel="Department"
 placeholder="Select department"
 value={departmentId}
 onChange={setDepartmentId}
 options={[
 { value: '', label: 'Select department' },
 ...departments.map((d) => ({ value: d.id, label: d.name })),
 ]}
 />
 </div>
 )}
 </div>
 <div className="mt-4 pt-4 border-t border-neutral-100">
 <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 mb-2">
 Payroll input template import
 </p>
 <p className="text-sm text-neutral-600 mb-3">
 Download the payroll-input template, fill it, preview matches by National ID, then commit to create/update draft payroll records.
 </p>
 <div className="flex flex-wrap items-center gap-2">
 <button
 type="button"
 onClick={() => {
 window.open(templateUrl, '_blank');
 }}
 className="inline-flex items-center gap-2 px-4 py-2 border border-neutral-300 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50"
 >
 <Download className="w-4 h-4" />
 Download payroll template
 </button>
 <input
 id="payroll-input-import-file"
 type="file"
 accept=".xlsx,.xls"
 className="hidden"
 onChange={handlePayrollInputFileSelected}
 />
 <button
 type="button"
 disabled={importingPayrollInput}
 onClick={() => {
 const el = document.getElementById('payroll-input-import-file') as HTMLInputElement | null;
 el?.click();
 }}
 className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-800 text-white rounded-lg text-sm font-medium hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 <Upload className="w-4 h-4" />
 {importingPayrollInput ? 'Previewing…' : 'Upload & preview'}
 </button>
 {importPreview && (
 <button
 type="button"
 disabled={
 committingPayrollInput ||
 importPreview.totals.invalid > 0 ||
 importPreview.totals.unmatched > 0 ||
 importPreview.totals.matched === 0
 }
 onClick={handleCommitPayrollImport}
 className="inline-flex items-center gap-2 px-4 py-2 bg-primary-900 text-white rounded-lg text-sm font-semibold hover:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {committingPayrollInput ? <Loader2 className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
 Commit import
 </button>
 )}
 </div>
 {importPreview && (
 <div className="mt-3 p-3 rounded-lg border border-primary-200 bg-primary-50 text-sm text-primary-900">
 Parsed: {importPreview.totals.parsedRows} · Matched: {importPreview.totals.matched} · Unmatched: {importPreview.totals.unmatched} · Invalid: {importPreview.totals.invalid}
 {importPreview.duplicateNationalIds.length > 0 && (
 <div className="mt-2 text-amber-800">
 Duplicate National IDs in sheet: {importPreview.duplicateNationalIds.join(', ')}
 </div>
 )}
 {importPreview.invalidRows.length > 0 && (
 <ul className="mt-2 text-red-800 text-xs list-disc list-inside space-y-0.5 max-h-24 overflow-auto">
 {importPreview.invalidRows.slice(0, 8).map((r, idx) => (
 <li key={`${r.row}-${idx}`}>Row {r.row}: {r.reason}</li>
 ))}
 </ul>
 )}
 </div>
 )}
 </div>
 </div>

 <div className="dashboard-surface shadow-sm mb-6 p-4 sm:p-6">
 <button
 type="button"
 onClick={() => setReportsOpen((v) => !v)}
 aria-expanded={reportsOpen}
 className="flex w-full items-center justify-between text-base font-semibold text-primary-900"
 >
 <span className="flex items-center gap-2">
 <Receipt className="h-5 w-5 text-primary-600" />
 Reports &amp; compliance
 </span>
 {reportsOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
 </button>
 {reportsOpen && (
 <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
 <button
 type="button"
 onClick={handleRecalculateStatutory}
 disabled={payrolls.length === 0 || recalculating}
 title={`Recalculate ${entityConfig.payroll.statutoryItems.map((i) => i.badge).join(', ')} for all in scope`}
 className="flex items-start gap-3 rounded-xl border border-neutral-200 p-3 text-left transition-colors hover:border-primary-300 hover:bg-primary-50/40 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-primary-700">
 {recalculating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
 </span>
 <span>
 <span className="block text-sm font-medium text-primary-900">Recalculate statutory</span>
 <span className="block text-xs text-neutral-500">Refresh deductions for all in scope</span>
 </span>
 </button>
 <button
 type="button"
 onClick={handleBankExport}
 disabled={!bankExportState.enabled}
 title={bankExportState.title}
 className="flex items-start gap-3 rounded-xl border border-neutral-200 p-3 text-left transition-colors hover:border-primary-300 hover:bg-primary-50/40 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-primary-700">
 <Download className="h-4 w-4" />
 </span>
 <span>
 <span className="block text-sm font-medium text-primary-900">Bank transfer file</span>
 <span className="block text-xs text-neutral-500">CSV batch for bank-paid staff</span>
 </span>
 </button>
 <button
 type="button"
 onClick={handleGlExport}
 title="Download the payroll journal (double-entry) as CSV for your accounting system"
 className="flex items-start gap-3 rounded-xl border border-neutral-200 p-3 text-left transition-colors hover:border-primary-300 hover:bg-primary-50/40"
 >
 <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-primary-700">
 <FileText className="h-4 w-4" />
 </span>
 <span>
 <span className="block text-sm font-medium text-primary-900">GL journal (CSV)</span>
 <span className="block text-xs text-neutral-500">Double-entry for accounting</span>
 </span>
 </button>
 <button
 type="button"
 onClick={handleP10Export}
 title="Download the KRA P10 Section B (Simplified Unified Payroll Return) as CSV to import into the iTax template"
 className="flex items-start gap-3 rounded-xl border border-neutral-200 p-3 text-left transition-colors hover:border-primary-300 hover:bg-primary-50/40"
 >
 <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-primary-700">
 <FileText className="h-4 w-4" />
 </span>
 <span>
 <span className="block text-sm font-medium text-primary-900">P10 return (KRA)</span>
 <span className="block text-xs text-neutral-500">Section B for iTax</span>
 </span>
 </button>
 </div>
 )}
 </div>

 <DashboardTableCard className="payroll-table-clean">
 <DashboardTableMeta
 title={`Payroll records (${month}/${year})`}
 description={loading ? undefined : `${displayedRows.length} record${displayedRows.length === 1 ? '' : 's'}`}
 actions={
 payrolls.length > 0 ? (
 <div className="flex flex-wrap items-center gap-2">
 <div className="relative">
 <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
 <input
 type="search"
 value={search}
 onChange={(e) => setSearch(e.target.value)}
 placeholder="Search name or no.…"
 aria-label="Search payroll"
 className="w-48 rounded-lg border border-neutral-300 bg-white py-2 pl-8 pr-3 text-sm text-neutral-800 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
 />
 </div>
 <StrideSelect
 ariaLabel="Group payroll by"
 value={groupBy}
 onChange={(value) => setGroupBy(value as PayrollGroupBy)}
 options={GROUP_BY_OPTIONS.map((o) => ({ value: o.value, label: o.label }))}
 />
 {groupBy !== 'none' && groupFilterOptions.length > 1 && (
 <StrideSelect
 ariaLabel={groupBy === 'department' ? 'Filter by department' : 'Filter by facility'}
 value={groupFilter}
 onChange={setGroupFilter}
 options={groupFilterOptions}
 />
 )}
 <ColumnPickerMenu
 columns={allColumns.map((c) => ({ id: c.id, label: c.label }))}
 visible={visibleColumns}
 onToggle={toggleColumn}
 onReset={resetColumns}
 />
 </div>
 ) : undefined
 }
 />
 {loading ? (
 <div className="p-8 animate-pulse">
 <div className="h-4 bg-neutral-100 rounded w-full mb-4" />
 <div className="h-4 bg-neutral-100 rounded w-5/6 mb-4" />
 <div className="h-4 bg-neutral-100 rounded w-4/6" />
 </div>
 ) : payrolls.length === 0 ? (
 <DashboardEmptyState
 icon={Banknote}
 title={`No payroll records for ${MONTHS[month - 1]} ${year}`}
 description={
 knownNoStaff
 ? 'Add employees with a base salary to this workspace, then generate the run.'
 : 'Generate draft records for employees in scope, or import amounts from the payroll template.'
 }
 action={
 knownNoStaff ? (
 <Link
 href={config.employeesPath}
 className="inline-flex items-center gap-2 rounded-lg bg-primary-900 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800"
 >
 <UserPlus className="h-4 w-4" />
 Add employees
 </Link>
 ) : (
 <button
 type="button"
 onClick={handleGenerate}
 disabled={!canGenerate || generating}
 className="inline-flex items-center gap-2 rounded-lg bg-primary-900 px-4 py-2 text-sm font-medium text-white hover:bg-primary-800 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Banknote className="h-4 w-4" />}
 {generating ? 'Generating…' : 'Generate payroll'}
 </button>
 )
 }
 />
 ) : (
 <>
 <div className="border-b border-neutral-200/70 px-4 py-4 sm:px-5">
 <DashboardStatGrid columns={6}>
 <DashboardStatCard size="compact" label="Headcount" value={String(runTotals.headcount)} tone="primary" />
 <DashboardStatCard size="compact" label="Gross" value={formatCurrency(runTotals.gross)} tone="sky" />
 <DashboardStatCard size="compact" label="Deductions" value={formatCurrency(runTotals.deductions)} tone="warning" />
 <DashboardStatCard size="compact" label="Net pay" value={formatCurrency(runTotals.net)} tone="success" />
 <DashboardStatCard size="compact" label="Employer cost" value={formatCurrency(runTotals.employerCost)} tone="violet" />
 <DashboardStatCard size="compact" label="Cost to company" value={formatCurrency(runTotals.ctc)} tone="primary" />
 </DashboardStatGrid>
 </div>
 {selectedCount > 0 && (
 <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-200/70 bg-primary-50/60 px-4 py-2.5 sm:px-5">
 <span className="text-sm font-medium text-primary-900">
 {selectedCount} selected
 </span>
 <div className="flex items-center gap-2">
 <Link
 href={payslipsUrlForEmployees(employeeIdsForSelection())}
 target="_blank"
 rel="noopener noreferrer"
 className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 bg-white px-3 py-1.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
 >
 <Eye className="h-4 w-4" />
 View payslips
 </Link>
 <button
 type="button"
 onClick={() => setPendingBulkSend({ employeeIds: employeeIdsForSelection(), label: `${selectedCount} selected employee${selectedCount === 1 ? '' : 's'}` })}
 className="inline-flex items-center gap-1.5 rounded-lg bg-primary-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-primary-800"
 >
 <Mail className="h-4 w-4" />
 Send payslips
 </button>
 <button
 type="button"
 onClick={() => setSelectedIds(new Set())}
 className="inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-sm text-neutral-600 hover:text-neutral-900"
 >
 <X className="h-4 w-4" />
 Clear
 </button>
 </div>
 </div>
 )}
 <DashboardTableViewport minWidth={tableMinWidth}>
 <DashboardTable className="payroll-table-clean">
 <thead>
 <tr>
 <th className="w-10">
 <input
 type="checkbox"
 aria-label="Select all shown"
 checked={allDisplayedSelected}
 onChange={toggleSelectAll}
 className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500/40"
 />
 </th>
 <th className="text-left">{sortHeader('Employee', 'employee')}</th>
 {orderedVisibleColumns.map((col) => (
 <th
 key={col.id}
 className={col.align === 'right' ? 'col-right' : 'text-left'}
 title={col.headerTitle}
 >
 {sortHeader(col.label, col.id, col.align)}
 </th>
 ))}
                <th className="col-right whitespace-nowrap" style={{ width: '1%' }}>Actions</th>
 </tr>
 </thead>
 <tbody>
 {displayedRows.length === 0 ? (
 <tr>
 <td colSpan={totalColumnCount} className="px-4 py-10 text-center text-sm text-neutral-500">
 No payroll records match “{search}”.
 </td>
 </tr>
 ) : displayedGroups ? (
 displayedGroups.map((group) => (
 <Fragment key={group.label}>
 <tr className="payroll-group-header">
 <td colSpan={totalColumnCount} className="px-4 py-2.5">
 <div className="flex flex-wrap items-center justify-between gap-3">
 <span className="text-sm font-semibold">
 {group.label}
 <span className="ml-2 text-xs font-normal opacity-70">
 {group.rows.length} {group.rows.length === 1 ? 'employee' : 'employees'}
 </span>
 </span>
 <div className="flex items-center gap-3">
 <span className="text-xs opacity-70 tabular-nums">
 Net {formatCurrency(sumPayrollColumn(group.rows, 'netPay') ?? 0)}
 </span>
 <div className="flex items-center gap-1">
 <Link
 href={payslipsUrlForEmployees(group.rows.map((r) => r.employeeId))}
 target="_blank"
 rel="noopener noreferrer"
 title={`View payslips for ${group.label}`}
 className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white/70 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
 >
 <Eye className="h-3.5 w-3.5" />
 View
 </Link>
 <button
 type="button"
 onClick={() => setPendingBulkSend({ employeeIds: group.rows.map((r) => r.employeeId), label: group.label })}
 title={`Send payslips for ${group.label}`}
 className="inline-flex items-center gap-1 rounded-md border border-neutral-300 bg-white/70 px-2 py-1 text-xs font-medium text-neutral-700 hover:bg-neutral-50"
 >
 <Mail className="h-3.5 w-3.5" />
 Send all
 </button>
 </div>
 </div>
 </div>
 </td>
 </tr>
 {group.rows.map(renderPayrollRow)}
 {renderSubtotalRow(group.rows, group.label)}
 </Fragment>
 ))
 ) : (
 sortedPayrolls.map(renderPayrollRow)
 )}
 </tbody>
 </DashboardTable>
 </DashboardTableViewport>
 </>
 )}
 </DashboardTableCard>

 <div className="dashboard-surface shadow-sm p-4 sm:p-6 mt-6">
 <button
 type="button"
 onClick={() => setShowTrends((v) => !v)}
 className="flex w-full items-center justify-between text-base font-semibold text-primary-900"
 >
 <span>YTD &amp; month-over-month trends</span>
 {showTrends ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
 </button>
 {showTrends && (
 <div className="mt-4">
 <PayrollTrends clientId={clientId.trim() || undefined} year={year} apiBase={config.apiBase} />
 </div>
 )}
 </div>

 {editPayrollId && (
 <PayrollEditModal
 payrollId={editPayrollId}
 employeeName={editEmployeeName}
 month={month}
 year={year}
 onClose={() => { setEditPayrollId(null); setEditEmployeeName(''); }}
 onSaved={fetchPayrolls}
 apiBase={config.apiBase}
 />
 )}

 {showMissingEmployeesPrompt && importPreview && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
 <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg border border-neutral-200 p-5 sm:p-6">
 <h3 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
 <AlertTriangle className="w-5 h-5 text-amber-600" />
 Add missing employees?
 </h3>
 <p className="text-sm text-neutral-600 mt-1">
 {importPreview.totals.unmatched} row(s) have National IDs not found in this workspace. Create these employees now, then continue payroll import?
 </p>
 <ul className="mt-3 text-sm text-neutral-700 list-disc list-inside space-y-1 max-h-48 overflow-auto">
 {importPreview.unmatchedRows.slice(0, 20).map((r, idx) => (
 <li key={`${r.nationalId}-${idx}`}>
 Row {r.row}: {r.employeeName || 'Unnamed'} · ID {r.nationalId}
 </li>
 ))}
 </ul>
 <div className="mt-5 flex items-center justify-end gap-2">
 <button
 type="button"
 className="px-4 py-2 rounded-lg border border-neutral-300 text-neutral-800 hover:bg-neutral-50"
 onClick={() => setShowMissingEmployeesPrompt(false)}
 disabled={importingPayrollInput}
 >
 Continue without them
 </button>
 <button
 type="button"
 className="px-4 py-2 rounded-lg bg-primary-900 text-white hover:bg-primary-800 disabled:opacity-50 inline-flex items-center gap-2"
 onClick={handleCreateMissingEmployees}
 disabled={importingPayrollInput}
 >
 {importingPayrollInput ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
 Create missing employees
 </button>
 </div>
 </div>
 </div>
 )}
 {pendingSendPayslip && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
 <div className="w-full max-w-lg bg-white rounded-xl shadow-lg border border-neutral-200 p-5 sm:p-6">
 <h3 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
 <AlertTriangle className="w-5 h-5 text-amber-600" />
 Confirm sending payslip
 </h3>
 <p className="text-sm text-neutral-600 mt-1">
 Send payslip for {pendingSendPayslip.employeeName} ({MONTHS[month - 1]} {year}) now?
 </p>
 <div className="mt-5 flex items-center justify-end gap-2">
 <button
 type="button"
 className="px-4 py-2 rounded-lg border border-neutral-300 text-neutral-800 hover:bg-neutral-50"
 onClick={() => setPendingSendPayslip(null)}
 >
 Cancel
 </button>
 <button
 type="button"
 className="px-4 py-2 rounded-lg bg-primary-900 text-white hover:bg-primary-800"
 onClick={async () => {
 const action = pendingSendPayslip;
 setPendingSendPayslip(null);
 await executeSendPayslip(action.employeeId, action.employeeName);
 }}
 >
 Confirm send
 </button>
 </div>
 </div>
 </div>
 )}
 {pendingBulkSend && (
 <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
 <div className="w-full max-w-lg bg-white rounded-xl shadow-lg border border-neutral-200 p-5 sm:p-6">
 <h3 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
 <Mail className="w-5 h-5 text-primary-600" />
 Send payslips
 </h3>
 <p className="text-sm text-neutral-600 mt-1">
 Email {pendingBulkSend.employeeIds.length} payslip{pendingBulkSend.employeeIds.length === 1 ? '' : 's'} for {pendingBulkSend.label} ({MONTHS[month - 1]} {year})? Employees without an email on file are skipped.
 </p>
 <div className="mt-5 flex items-center justify-end gap-2">
 <button
 type="button"
 className="px-4 py-2 rounded-lg border border-neutral-300 text-neutral-800 hover:bg-neutral-50"
 onClick={() => setPendingBulkSend(null)}
 disabled={bulkSending}
 >
 Cancel
 </button>
 <button
 type="button"
 className="px-4 py-2 rounded-lg bg-primary-900 text-white hover:bg-primary-800 disabled:opacity-50 inline-flex items-center gap-2"
 disabled={bulkSending}
 onClick={async () => {
 const action = pendingBulkSend;
 setPendingBulkSend(null);
 await executeBulkSend(action.employeeIds);
 }}
 >
 {bulkSending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
 Send {pendingBulkSend.employeeIds.length} payslip{pendingBulkSend.employeeIds.length === 1 ? '' : 's'}
 </button>
 </div>
 </div>
 </div>
 )}
 </DashboardPage>
 );
}
