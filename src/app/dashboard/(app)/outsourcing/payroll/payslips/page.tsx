'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import BrandLogo from '@/components/BrandLogo';
import { ChevronLeft, Mail, Loader2, Printer, AlertTriangle } from 'lucide-react';
import useEntityConfig, { useCurrencyFormatter } from '@/hooks/useEntityConfig';
import { EntityContextBanner } from '@/components/EntityContextBanner';
import { useEntity } from '@/components/EntitySwitcher';

interface PayrollRecord {
 id: string;
 employeeName: string;
 employeeNumber: string | null;
 clientName: string;
 departmentName: string | null;
 month: number;
 year: number;
 basicPay: string;
 allowances: { name: string; amount: number }[];
 deductions: { name: string; amount: number }[];
 grossPay: string;
 leavePay?: string;
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
 biweeklyAttendance?: { period1: string[]; period2: string[] } | null;
}

const MONTHS = [
 'January', 'February', 'March', 'April', 'May', 'June',
 'July', 'August', 'September', 'October', 'November', 'December',
];

function PayslipsContent() {
 const { activeEntity } = useEntity();
 const entityConfig = useEntityConfig();
 const formatCurrency = useCurrencyFormatter();
 const searchParams = useSearchParams();
 const month = parseInt(searchParams.get('month') || String(new Date().getMonth() + 1), 10);
 const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);
 const clientId = searchParams.get('clientId') || '';
 const departmentId = searchParams.get('departmentId') || '';
 const employeeIdsParam = searchParams.get('employeeIds') || '';

 const [payrolls, setPayrolls] = useState<PayrollRecord[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [sending, setSending] = useState(false);
 const [sendResult, setSendResult] = useState<{ sent: number; skipped: number; errors?: string[] } | null>(null);
 const [printLayout, setPrintLayout] = useState<'single' | 'four'>('single');
 const [showSendConfirm, setShowSendConfirm] = useState(false);

 useEffect(() => {
 const htmlEl = document.documentElement;
 const mainEl = document.querySelector('main') as HTMLElement | null;
 const prevOverflow = document.body.style.overflow;
 const prevMainOverflow = mainEl?.style.overflow ?? '';
 htmlEl.classList.add('payslip-hide-scrollbar-root');
 document.body.classList.add('payslip-hide-scrollbar');
 document.body.style.overflow = 'hidden';
 if (mainEl) mainEl.style.overflow = 'hidden';
 return () => {
 htmlEl.classList.remove('payslip-hide-scrollbar-root');
 document.body.classList.remove('payslip-hide-scrollbar');
 document.body.style.overflow = prevOverflow;
 if (mainEl) mainEl.style.overflow = prevMainOverflow;
 };
 }, []);

 useEffect(() => {
 const params = new URLSearchParams();
 params.set('month', String(month));
 params.set('year', String(year));
 if (clientId) params.set('clientId', clientId);
 if (departmentId) params.set('departmentId', departmentId);
 if (employeeIdsParam.trim()) params.set('employeeIds', employeeIdsParam.trim());
 fetch(`/api/outsourcing/payroll?${params}`)
 .then((r) => r.json())
 .then((data) => {
 setPayrolls(Array.isArray(data) ? data : []);
 setError(null);
 })
 .catch(() => {
 setPayrolls([]);
 setError('Failed to load payroll');
 })
 .finally(() => setLoading(false));
 }, [month, year, clientId, departmentId, employeeIdsParam, activeEntity.id]);

 const handlePrint = () => {
 window.print();
 };

 const handleSendPayslips = async () => {
 const employeeCount = employeeIdsParam
 ? employeeIdsParam.split(',').map((s) => s.trim()).filter(Boolean).length
 : payrolls.length;
 if (employeeCount === 0) return;
 setShowSendConfirm(true);
 };

 const executeSendPayslips = async () => {
 setSending(true);
 setSendResult(null);
 try {
 const res = await fetch('/api/outsourcing/payroll/send-payslips', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 month,
 year,
 ...(clientId ? { clientId } : {}),
 ...(departmentId ? { departmentId } : {}),
 ...(employeeIdsParam ? { employeeIds: employeeIdsParam.split(',').map((s) => s.trim()).filter(Boolean) } : {}),
 }),
 });
 const data = await res.json();
 if (!res.ok) {
 setSendResult({ sent: 0, skipped: 0, errors: [data.error || 'Failed to send payslips'] });
 return;
 }
 setSendResult({
 sent: data.sent ?? 0,
 skipped: data.skipped ?? 0,
 errors: data.errors,
 });
 } catch {
 setSendResult({ sent: 0, skipped: 0, errors: ['Network error'] });
 } finally {
 setSending(false);
 }
 };

 if (loading) {
 return (
 <div className="p-8 animate-pulse">
 <div className="h-6 bg-neutral-200 rounded w-1/3 mb-4" />
 <div className="h-4 bg-neutral-100 rounded w-full mb-2" />
 <div className="h-4 bg-neutral-100 rounded w-5/6" />
 </div>
 );
 }

 return (
 <div
 className={`w-full min-w-0 payslip-scroll-area ${
 printLayout === 'four'
 ? 'print-four-mode h-auto overflow-visible'
 : 'print-single-mode h-screen overflow-y-auto'
 }`}
 >
 <div className="print:hidden flex flex-col gap-2 mb-6">
 <div className="flex items-center justify-between gap-4 flex-wrap">
 <Link
 href="/dashboard/outsourcing/payroll"
 className="inline-flex items-center gap-2 text-neutral-600 hover:text-primary-700"
 >
 <ChevronLeft className="w-5 h-5" />
 Back to payroll
 </Link>
 <div className="flex items-center gap-3">
 <label className="inline-flex items-center gap-2 text-sm text-neutral-700">
 <span>Print format</span>
 <select
 value={printLayout}
 onChange={(e) => setPrintLayout(e.target.value === 'four' ? 'four' : 'single')}
 className="px-3 py-2 border border-neutral-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-primary-500"
 >
 <option value="single">Single payslip per page</option>
 <option value="four">4 payslips per page</option>
 </select>
 </label>
 <button
 type="button"
 onClick={handleSendPayslips}
 disabled={sending || payrolls.length === 0}
 className="inline-flex items-center gap-2 px-4 py-2 bg-primary-700 text-white rounded-lg text-sm font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
 {sending ? 'Sending…' : 'Send payslips via email'}
 </button>
 <button
 type="button"
 onClick={handlePrint}
 className="inline-flex items-center gap-2 px-4 py-2 bg-primary-900 text-white rounded-lg text-sm font-medium hover:bg-primary-800"
 >
 <Printer className="w-4 h-4" />
 Print payslips
 </button>
 </div>
 </div>
 <EntityContextBanner />
 </div>

 {sendResult && (
 <div className="print:hidden mb-6 p-4 rounded-lg text-sm border bg-neutral-50 border-neutral-200">
 <p className="font-medium text-neutral-800">
 Sent: {sendResult.sent} · Skipped (no email): {sendResult.skipped}
 </p>
 {sendResult.errors && sendResult.errors.length > 0 && (
 <ul className="mt-2 list-disc list-inside text-red-600 text-xs">
 {sendResult.errors.slice(0, 5).map((err, i) => (
 <li key={i}>{err}</li>
 ))}
 {sendResult.errors.length > 5 && (
 <li>…and {sendResult.errors.length - 5} more</li>
 )}
 </ul>
 )}
 </div>
 )}
 {showSendConfirm && (
 <div className="print:hidden fixed inset-0 z-50 flex items-center justify-center bg-black/40">
 <div className="w-full max-w-lg bg-white rounded-xl shadow-lg border border-neutral-200 p-5 sm:p-6">
 <h3 className="text-base font-semibold text-neutral-900 flex items-center gap-2">
 <AlertTriangle className="w-5 h-5 text-amber-600" />
 Confirm sending payslips
 </h3>
 <p className="text-sm text-neutral-600 mt-1">
 Send payslips for {employeeIdsParam ? employeeIdsParam.split(',').map((s) => s.trim()).filter(Boolean).length : payrolls.length} employee(s) for {MONTHS[month - 1]} {year}?
 </p>
 <div className="mt-5 flex items-center justify-end gap-2">
 <button
 type="button"
 className="px-4 py-2 rounded-lg border border-neutral-300 text-neutral-800 hover:bg-neutral-50"
 onClick={() => setShowSendConfirm(false)}
 >
 Cancel
 </button>
 <button
 type="button"
 className="px-4 py-2 rounded-lg bg-primary-900 text-white hover:bg-primary-800"
 onClick={async () => {
 setShowSendConfirm(false);
 await executeSendPayslips();
 }}
 >
 Confirm send
 </button>
 </div>
 </div>
 </div>
 )}

 {error && (
 <div className="print:hidden mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
 {error}
 </div>
 )}

 {payrolls.length === 0 ? (
 <div className="p-8 text-center text-neutral-500">
 No payroll records for {MONTHS[month - 1]} {year}.
 </div>
 ) : (
 <div
 className={
 printLayout === 'four'
 ? 'payslip-grid space-y-6 print:space-y-0 print:grid print:grid-cols-2 print:gap-[2.5mm]'
 : 'space-y-6 print:space-y-4'
 }
 >
 {payrolls.map((p, index) => {
 const daysWorkedFromAllowances = Array.isArray(p.allowances)
 ? p.allowances.find((a) => a.name.toLowerCase() === 'days worked')
 : undefined;
 const displayAllowances = Array.isArray(p.allowances)
 ? p.allowances.filter((a) => a.name.toLowerCase() !== 'days worked')
 : [];
 return (
 <div
 key={p.id}
 className={`payslip-card dashboard-surface p-6 sm:p-8 print:border print:border-neutral-300 print:shadow-none ${
 printLayout === 'four'
 ? 'print:rounded-none print:p-[2.2mm] print:break-inside-avoid print:overflow-hidden print:min-h-0 print:border-dashed print:border-neutral-400'
 : `print:rounded-none print:p-4 ${index < payrolls.length - 1 ? 'print:break-after-page' : ''}`
 }`}
 >
 <div className={`mb-4 pb-3 ${printLayout === 'four' ? 'border-b border-neutral-400' : 'border-b border-primary-900'}`}>
 <div className="flex items-center justify-between gap-3">
 <BrandLogo variant="header" className="h-9 w-auto object-contain print:h-6" />
 <span className="text-sm font-medium text-neutral-600 print:text-xs text-right ml-auto">Stride</span>
 </div>
 </div>

 <div className="mb-4">
 <h1 className="text-xl font-bold text-primary-900 print:text-base">Payslip</h1>
 <p className="text-sm text-neutral-600">{MONTHS[month - 1]} {year}</p>
 <div className="mt-2 text-sm text-neutral-700">
 <p className="font-semibold text-primary-900">{p.employeeName}</p>
 {p.employeeNumber && <p className="text-xs text-neutral-500">No: {p.employeeNumber}</p>}
 <p>{p.clientName}</p>
 {p.departmentName && <p className="text-xs text-neutral-500">{p.departmentName}</p>}
 </div>
 </div>

 <div className="space-y-4">
 <div className="border border-neutral-200 rounded-lg p-4">
 <h2 className="text-xs font-semibold uppercase text-neutral-600 mb-3">Earnings</h2>
 <table className="data-table dashboard-data-table w-full text-sm">
 <tbody>
 <tr>
 <td className="py-1">Basic pay</td>
 <td className="text-right tabular-nums font-medium">{formatCurrency(Number(p.basicPay))}</td>
 </tr>
 {daysWorkedFromAllowances && (
 <tr>
 <td className="py-1">Days worked</td>
 <td className="text-right tabular-nums">
 {Number(daysWorkedFromAllowances.amount).toLocaleString(entityConfig.currency.locale)}
 </td>
 </tr>
 )}
 {displayAllowances.map((a, i) => (
 <tr key={i}>
 <td className="py-1">{a.name}</td>
 <td className="text-right tabular-nums">{formatCurrency(Number(a.amount))}</td>
 </tr>
 ))}
 {Number(p.leavePay ?? 0) > 0 && (
 <tr>
 <td className="py-1">Leave pay</td>
 <td className="text-right tabular-nums">{formatCurrency(Number(p.leavePay!))}</td>
 </tr>
 )}
 <tr className="border-t border-neutral-200 font-semibold">
 <td className="py-2">Gross</td>
 <td className="text-right tabular-nums">{formatCurrency(Number(p.grossPay))}</td>
 </tr>
 </tbody>
 </table>
 </div>

 <div className="border border-neutral-200 rounded-lg p-4">
 <h2 className="text-xs font-semibold uppercase text-neutral-600 mb-3">Deductions</h2>
 <table className="data-table dashboard-data-table w-full text-sm">
 <tbody>
 <tr>
 <td className="py-1">{entityConfig.payroll.deductionColumnHeaders.paye}</td>
 <td className="text-right tabular-nums">{formatCurrency(Number(p.paye))}</td>
 </tr>
 <tr>
 <td className="py-1">{entityConfig.payroll.deductionColumnHeaders.nssf}</td>
 <td className="text-right tabular-nums">{formatCurrency(Number(p.nssf))}</td>
 </tr>
 <tr>
 <td className="py-1">{entityConfig.payroll.deductionColumnHeaders.nhif}</td>
 <td className="text-right tabular-nums">{formatCurrency(Number(p.nhif))}</td>
 </tr>
 <tr>
 <td className="py-1">
 {entityConfig.payroll.statutoryItems.find((i) => i.key === 'ahl')?.label ??
 entityConfig.payroll.deductionColumnHeaders.ahl}
 </td>
 <td className="text-right tabular-nums">{formatCurrency(Number(p.ahl ?? 0))}</td>
 </tr>
 {Array.isArray(p.deductions) &&
 p.deductions
 .filter((d) => String(d.name).trim().toUpperCase() !== 'NITA')
 .map((d, i) => (
 <tr key={i}>
 <td className="py-1">{d.name}</td>
 <td className="text-right tabular-nums">{formatCurrency(Number(d.amount))}</td>
 </tr>
 ))}
 <tr className="border-t border-neutral-200 font-semibold">
 <td className="py-2">Net pay</td>
 <td className="text-right tabular-nums text-primary-700">{formatCurrency(Number(p.netPay))}</td>
 </tr>
 </tbody>
 </table>
 </div>

 {Number(p.nita ?? 0) > 0 && (
 <div className="border border-neutral-200 rounded-lg p-4 bg-neutral-50/90">
 <h2 className="text-xs font-semibold uppercase text-neutral-500 mb-2">Employer contributions (informational)</h2>
 <table className="data-table dashboard-data-table w-full text-sm">
 <tbody>
 <tr>
 <td className="py-1">
 {entityConfig.payroll.statutoryItems.find((i) => i.key === 'nita' || i.key === 'nita-u')
 ?.label ?? entityConfig.payroll.deductionColumnHeaders.nita}{' '}
 (employer)
 </td>
 <td className="text-right tabular-nums">{formatCurrency(Number(p.nita ?? 0))}</td>
 </tr>
 </tbody>
 </table>
 <p className="text-[11px] text-neutral-500 mt-2">Not deducted from your net pay.</p>
 </div>
 )}
 </div>
 </div>
 );
 })}
 </div>
 )}
 <style jsx global>{`
 @media screen {
 html.payslip-hide-scrollbar-root,
 html.payslip-hide-scrollbar-root body,
 html.payslip-hide-scrollbar-root body * {
 scrollbar-width: none !important;
 -ms-overflow-style: none !important;
 }
 html.payslip-hide-scrollbar-root::-webkit-scrollbar,
 html.payslip-hide-scrollbar-root body::-webkit-scrollbar,
 html.payslip-hide-scrollbar-root body *::-webkit-scrollbar {
 width: 0 !important;
 height: 0 !important;
 display: none !important;
 }
 .payslip-scroll-area {
 scrollbar-width: none;
 -ms-overflow-style: none;
 }
 .payslip-scroll-area::-webkit-scrollbar {
 width: 0;
 height: 0;
 display: none;
 }
 body.payslip-hide-scrollbar {
 scrollbar-width: none;
 }
 body.payslip-hide-scrollbar::-webkit-scrollbar {
 width: 0;
 height: 0;
 display: none;
 }
 }
 @media print {
 .payslip-scroll-area {
 height: auto !important;
 overflow: visible !important;
 }
 @page {
 size: A4 portrait;
 margin: 6mm;
 }
 .print-four-mode {
 font-size: 10px;
 line-height: 1.2;
 }
 .print-four-mode h1 {
 font-size: 16px !important;
 line-height: 1.1 !important;
 }
 .print-four-mode h2 {
 font-size: 10px !important;
 margin-bottom: 1.5mm !important;
 }
 .print-four-mode p,
 .print-four-mode td,
 .print-four-mode span {
 line-height: 1.15 !important;
 }
 .print-four-mode table td {
 padding-top: 0.7mm !important;
 padding-bottom: 0.7mm !important;
 }
 .print-four-mode .print\\:grid-cols-2 > div {
 max-height: calc((297mm - 12mm - 2.5mm) / 2);
 height: calc((297mm - 12mm - 2.5mm) / 2);
 overflow: hidden !important;
 }
 .print-single-mode .payslip-card {
 min-height: calc(297mm - 12mm);
 page-break-after: always !important;
 break-after: page !important;
 break-inside: avoid !important;
 padding: 7mm !important;
 }
 .print-single-mode .payslip-card:last-child {
 page-break-after: auto !important;
 break-after: auto !important;
 }
 }
 `}</style>
 </div>
 );
}

export default function PayslipsPage() {
 return (
 <Suspense fallback={
 <div className="p-8 animate-pulse">
 <div className="h-6 bg-neutral-200 rounded w-1/3 mb-4" />
 <div className="h-4 bg-neutral-100 rounded w-full mb-2" />
 <div className="h-4 bg-neutral-100 rounded w-5/6" />
 </div>
 }>
 <PayslipsContent />
 </Suspense>
 );
}
