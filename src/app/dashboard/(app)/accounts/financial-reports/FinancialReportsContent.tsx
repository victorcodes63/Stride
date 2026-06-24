'use client';

import { useCallback, useEffect, useState } from 'react';
import { BarChart3, Loader2, AlertCircle, TrendingUp, TrendingDown, DollarSign, ArrowUpRight, ArrowDownRight, PieChart, Target } from 'lucide-react';
import { motion } from 'framer-motion';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

type FinancialReport = {
 year: number;
 summary: {
 totalRevenue: number;
 totalReceived: number;
 outstandingReceivables: number;
 totalExpenses: number;
 totalVendorPaid: number;
 outstandingPayables: number;
 netIncome: number;
 budgetAllocated: number;
 budgetSpent: number;
 budgetUtilization: number;
 expenseClaimsTotal: number;
 expenseClaimsPending: number;
 expenseClaimsApproved: number;
 };
 monthlyRevenue: number[];
 monthlyExpenses: number[];
 monthlyNetIncome: number[];
 invoiceStatusBreakdown: { unpaid: number; partial: number; paid: number };
 vendorBillStatusBreakdown: { unpaid: number; partial: number; paid: number };
};

function fmtMoney(v: number) {
 return v.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' KES';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function BarChartSimple({ data, label, color }: { data: number[]; label: string; color: string }) {
 const max = Math.max(...data, 1);
 return (
 <div>
 <p className="text-xs font-semibold text-neutral-600 mb-2">{label}</p>
 <div className="flex items-end gap-1 h-24">
 {data.map((v, i) => (
 <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
 <div className={`w-full rounded-t ${color}`} style={{ height: `${Math.max((v / max) * 100, 2)}%` }} />
 <span className="text-[9px] text-neutral-400">{MONTHS[i]}</span>
 </div>
 ))}
 </div>
 </div>
 );
}

export default function FinancialReportsContent() {
 const [report, setReport] = useState<FinancialReport | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [year, setYear] = useState(new Date().getFullYear());

 const load = useCallback(() => {
 setLoading(true);
 setError(null);
 fetch(`/api/finance/reports?year=${year}`)
 .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Failed'); return d; })
 .then((d) => setReport(d as FinancialReport))
 .catch((e) => setError(e instanceof Error ? e.message : 'Failed'))
 .finally(() => setLoading(false));
 }, [year]);

 useEffect(() => { load(); }, [load]);

 const s = report?.summary;

 return (
 <DashboardPage>
 <DashboardPageHeader
 icon={BarChart3}
 title="Financial Reports"
 description="Revenue, expenses, P&L, and budget overview."
 actions={
 <select
 value={year}
 onChange={(e) => setYear(Number(e.target.value))}
 className="px-3 py-2.5 rounded-lg border border-neutral-300 text-sm bg-white font-semibold"
 >
 {[2024, 2025, 2026, 2027].map((y) => (
 <option key={y} value={y}>
 FY {y}
 </option>
 ))}
 </select>
 }
 />

 {loading && <div className="flex items-center gap-2 text-neutral-600 py-12 justify-center"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>}
 {!loading && error && (
 <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-3 items-start">
 <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /><p>{error}</p>
 </div>
 )}

 {!loading && !error && s && (
 <div className="space-y-6">
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
 {[
 { label: 'Total revenue', value: fmtMoney(s.totalRevenue), icon: TrendingUp, color: 'text-emerald-700', bg: 'bg-emerald-50 text-emerald-700' },
 { label: 'Total expenses', value: fmtMoney(s.totalExpenses), icon: TrendingDown, color: 'text-red-700', bg: 'bg-red-50 text-red-700' },
 { label: 'Net income', value: fmtMoney(s.netIncome), icon: DollarSign, color: s.netIncome >= 0 ? 'text-emerald-700' : 'text-red-700', bg: 'bg-primary-50 text-primary-700' },
 { label: 'Receivables', value: fmtMoney(s.outstandingReceivables), icon: ArrowUpRight, color: 'text-blue-700', bg: 'bg-blue-50 text-blue-700' },
 ].map((card, i) => (
 <motion.div key={card.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
 className="dashboard-stat-card">
 <div className={`inline-flex rounded-lg p-2 mb-2 ${card.bg}`}><card.icon className="w-4 h-4" /></div>
 <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-0.5">{card.label}</p>
 <p className={`text-lg font-bold tabular-nums ${card.color}`}>{card.value}</p>
 </motion.div>
 ))}
 </div>

 <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
 {[
 { label: 'Payables', value: fmtMoney(s.outstandingPayables), icon: ArrowDownRight, color: 'text-amber-700', bg: 'bg-amber-50 text-amber-700' },
 { label: 'Cash received', value: fmtMoney(s.totalReceived), icon: DollarSign, color: 'text-emerald-700', bg: 'bg-emerald-50 text-emerald-700' },
 { label: 'Budget utilization', value: `${s.budgetUtilization}%`, icon: Target, color: s.budgetUtilization > 100 ? 'text-red-700' : 'text-primary-900', bg: 'bg-primary-50 text-primary-700' },
 { label: 'Expense claims', value: fmtMoney(s.expenseClaimsTotal), icon: PieChart, color: 'text-indigo-700', bg: 'bg-indigo-50 text-indigo-700' },
 ].map((card, i) => (
 <motion.div key={card.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.16 + i * 0.04 }}
 className="dashboard-stat-card">
 <div className={`inline-flex rounded-lg p-2 mb-2 ${card.bg}`}><card.icon className="w-4 h-4" /></div>
 <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-0.5">{card.label}</p>
 <p className={`text-lg font-bold tabular-nums ${card.color}`}>{card.value}</p>
 </motion.div>
 ))}
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
 <div className="dashboard-surface p-5">
 <BarChartSimple data={report!.monthlyRevenue} label="Monthly Revenue" color="bg-emerald-500" />
 </div>
 <div className="dashboard-surface p-5">
 <BarChartSimple data={report!.monthlyExpenses} label="Monthly Expenses" color="bg-red-400" />
 </div>
 </div>

 <div className="dashboard-surface p-5">
 <BarChartSimple data={report!.monthlyNetIncome} label="Monthly Net Income" color="bg-primary-500" />
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div className="dashboard-surface p-5">
 <h3 className="font-bold text-neutral-900 mb-3">Invoice Status</h3>
 <div className="space-y-2">
 {(['unpaid', 'partial', 'paid'] as const).map((status) => {
 const count = report!.invoiceStatusBreakdown[status];
 const total = Object.values(report!.invoiceStatusBreakdown).reduce((a, b) => a + b, 0);
 const pct = total > 0 ? Math.round((count / total) * 100) : 0;
 const colors = { unpaid: 'bg-amber-500', partial: 'bg-blue-500', paid: 'bg-emerald-500' };
 return (
 <div key={status}>
 <div className="flex justify-between text-sm mb-1">
 <span className="capitalize text-neutral-700">{status}</span>
 <span className="tabular-nums text-neutral-500">{count} ({pct}%)</span>
 </div>
 <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
 <div className={`h-full rounded-full ${colors[status]}`} style={{ width: `${pct}%` }} />
 </div>
 </div>
 );
 })}
 </div>
 </div>
 <div className="dashboard-surface p-5">
 <h3 className="font-bold text-neutral-900 mb-3">Vendor Bill Status</h3>
 <div className="space-y-2">
 {(['unpaid', 'partial', 'paid'] as const).map((status) => {
 const count = report!.vendorBillStatusBreakdown[status];
 const total = Object.values(report!.vendorBillStatusBreakdown).reduce((a, b) => a + b, 0);
 const pct = total > 0 ? Math.round((count / total) * 100) : 0;
 const colors = { unpaid: 'bg-amber-500', partial: 'bg-blue-500', paid: 'bg-emerald-500' };
 return (
 <div key={status}>
 <div className="flex justify-between text-sm mb-1">
 <span className="capitalize text-neutral-700">{status}</span>
 <span className="tabular-nums text-neutral-500">{count} ({pct}%)</span>
 </div>
 <div className="h-2 bg-neutral-100 rounded-full overflow-hidden">
 <div className={`h-full rounded-full ${colors[status]}`} style={{ width: `${pct}%` }} />
 </div>
 </div>
 );
 })}
 </div>
 </div>
 </div>
 </div>
 )}
 </DashboardPage>
 );
}
