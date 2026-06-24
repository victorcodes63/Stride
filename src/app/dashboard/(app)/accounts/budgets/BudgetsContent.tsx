'use client';

import { useCallback, useEffect, useState } from 'react';
import { PieChart, Loader2, AlertCircle, Plus, TrendingUp, Wallet, Target } from 'lucide-react';
import { motion } from 'framer-motion';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

type BudgetRow = {
 id: string;
 name: string;
 department: string | null;
 category: string | null;
 fiscalYear: number;
 periodType: string;
 currency: string;
 allocatedAmount: number;
 spentAmount: number;
 utilizationPercent: number;
 status: string;
 startDate: string;
 endDate: string;
 itemCount: number;
 items: { id: string; name: string; allocatedAmount: number; spentAmount: number }[];
};

function fmtMoney(v: number, currency = 'KES') {
 return v.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency;
}

const STATUS_STYLES: Record<string, string> = {
 draft: 'bg-neutral-100 text-neutral-700',
 active: 'bg-emerald-50 text-emerald-800',
 closed: 'bg-neutral-100 text-neutral-500',
 exceeded: 'bg-red-50 text-red-800',
};

export default function BudgetsContent() {
 const [budgets, setBudgets] = useState<BudgetRow[] | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [year, setYear] = useState(new Date().getFullYear());
 const [showForm, setShowForm] = useState(false);
 const [submitting, setSubmitting] = useState(false);

 const [form, setForm] = useState({
 name: '', department: '', category: '', allocatedAmount: '',
 periodType: 'annual', startDate: `${year}-01-01`, endDate: `${year}-12-31`, notes: '',
 });

 const load = useCallback(() => {
 setLoading(true);
 setError(null);
 fetch(`/api/finance/budgets?year=${year}`)
 .then(async (r) => {
 const data = await r.json().catch(() => ({}));
 if (!r.ok) throw new Error(data.error || 'Failed');
 return data;
 })
 .then((data) => setBudgets(data.budgets ?? []))
 .catch((e) => { setError(e instanceof Error ? e.message : 'Failed'); setBudgets([]); })
 .finally(() => setLoading(false));
 }, [year]);

 useEffect(() => { load(); }, [load]);

 const totals = budgets ? {
 allocated: budgets.reduce((s, b) => s + b.allocatedAmount, 0),
 spent: budgets.reduce((s, b) => s + b.spentAmount, 0),
 count: budgets.length,
 } : null;

 const submitBudget = async () => {
 if (!form.name.trim() || !form.allocatedAmount) return;
 setSubmitting(true);
 try {
 const res = await fetch('/api/finance/budgets', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ ...form, fiscalYear: year, allocatedAmount: Number(form.allocatedAmount) }),
 });
 if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed'); }
 setShowForm(false);
 setForm({ name: '', department: '', category: '', allocatedAmount: '', periodType: 'annual', startDate: `${year}-01-01`, endDate: `${year}-12-31`, notes: '' });
 load();
 } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
 finally { setSubmitting(false); }
 };

 return (
 <DashboardPage>
 <DashboardPageHeader
 icon={PieChart}
 title="Budgets"
 description="Allocate, track, and monitor departmental and project budgets."
 actions={
 <>
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
 <button
 type="button"
 onClick={() => setShowForm(!showForm)}
 className="btn-primary inline-flex items-center gap-2"
 >
 <Plus className="h-4 w-4" strokeWidth={1.75} />
 New budget
 </button>
 </>
 }
 />

 {totals && (
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
 {[
 { label: 'Total allocated', value: fmtMoney(totals.allocated), icon: Target, color: 'text-primary-900' },
 { label: 'Total spent', value: fmtMoney(totals.spent), icon: TrendingUp, color: 'text-amber-700' },
 { label: 'Remaining', value: fmtMoney(totals.allocated - totals.spent), icon: Wallet, color: totals.allocated - totals.spent >= 0 ? 'text-emerald-700' : 'text-red-700' },
 ].map((s, i) => (
 <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
 className="dashboard-stat-card">
 <div className="inline-flex rounded-lg p-2 mb-2 bg-primary-50 text-primary-700"><s.icon className="w-4 h-4" /></div>
 <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-0.5">{s.label}</p>
 <p className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
 </motion.div>
 ))}
 </div>
 )}

 {showForm && (
 <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
 className="rounded-xl border border-primary-200 bg-primary-50/30 p-5 mb-6 space-y-4">
 <h3 className="font-bold text-primary-900">New Budget</h3>
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
 <input placeholder="Budget name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
 className="px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
 <input placeholder="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}
 className="px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
 <input type="number" placeholder="Allocated amount *" value={form.allocatedAmount}
 onChange={(e) => setForm({ ...form, allocatedAmount: e.target.value })}
 className="px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
 <select value={form.periodType} onChange={(e) => setForm({ ...form, periodType: e.target.value })}
 className="px-3 py-2 rounded-lg border border-neutral-300 text-sm bg-white">
 <option value="annual">Annual</option>
 <option value="quarterly">Quarterly</option>
 <option value="monthly">Monthly</option>
 </select>
 <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
 className="px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
 <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
 className="px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
 </div>
 <div className="flex gap-2">
 <button onClick={submitBudget} disabled={submitting}
 className="px-5 py-2 rounded-lg bg-primary-900 text-white text-sm font-semibold hover:bg-primary-800 disabled:opacity-50">
 {submitting ? 'Creating…' : 'Create budget'}
 </button>
 <button onClick={() => setShowForm(false)} className="px-5 py-2 rounded-lg border border-neutral-300 text-sm font-semibold hover:bg-neutral-50">Cancel</button>
 </div>
 </motion.div>
 )}

 {loading && <div className="flex items-center gap-2 text-neutral-600 py-12 justify-center"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>}
 {!loading && error && (
 <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-3 items-start">
 <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /><p>{error}</p>
 </div>
 )}

 {!loading && !error && budgets && budgets.length === 0 && (
 <div className="dashboard-surface p-8 text-center text-sm text-neutral-500">
 No budgets for FY {year}. Create one to start tracking spend.
 </div>
 )}

 {!loading && !error && budgets && budgets.length > 0 && (
 <div className="space-y-3">
 {budgets.map((b, idx) => {
 const remaining = b.allocatedAmount - b.spentAmount;
 const pct = b.utilizationPercent;
 return (
 <motion.div key={b.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}
 className="dashboard-stat-card hover:border-neutral-300 transition-colors">
 <div className="flex items-start justify-between gap-3 mb-3">
 <div>
 <h3 className="font-bold text-primary-900">{b.name}</h3>
 <p className="text-xs text-neutral-500 mt-0.5">
 {b.department || 'No department'} · {b.periodType} · {b.startDate} to {b.endDate}
 </p>
 </div>
 <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[b.status] || 'bg-neutral-100 text-neutral-700'}`}>
 {b.status}
 </span>
 </div>
 <div className="grid grid-cols-3 gap-4 mb-3">
 <div>
 <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Allocated</p>
 <p className="text-sm font-bold text-primary-900 tabular-nums">{fmtMoney(b.allocatedAmount, b.currency)}</p>
 </div>
 <div>
 <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Spent</p>
 <p className="text-sm font-bold text-amber-700 tabular-nums">{fmtMoney(b.spentAmount, b.currency)}</p>
 </div>
 <div>
 <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Remaining</p>
 <p className={`text-sm font-bold tabular-nums ${remaining >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>{fmtMoney(remaining, b.currency)}</p>
 </div>
 </div>
 <div className="relative h-2 bg-neutral-100 rounded-full overflow-hidden">
 <div
 className={`absolute inset-y-0 left-0 rounded-full transition-all ${pct > 100 ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
 style={{ width: `${Math.min(pct, 100)}%` }}
 />
 </div>
 <p className="text-xs text-neutral-500 mt-1 tabular-nums">{pct}% utilized</p>
 </motion.div>
 );
 })}
 </div>
 )}
 </DashboardPage>
 );
}
