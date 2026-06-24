'use client';

import { useCallback, useEffect, useState } from 'react';
import { Receipt, Loader2, AlertCircle, Plus, CheckCircle, XCircle, Clock, Banknote } from 'lucide-react';
import { motion } from 'framer-motion';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

type ClaimRow = {
 id: string;
 claimNumber: string;
 claimantName: string;
 department: string | null;
 description: string;
 currency: string;
 totalAmount: number;
 status: string;
 itemCount: number;
 submittedAt: string | null;
 approvedAt: string | null;
 createdAt: string;
};

const STATUS_STYLES: Record<string, string> = {
 draft: 'bg-neutral-100 text-neutral-700',
 submitted: 'bg-blue-50 text-blue-800',
 approved: 'bg-emerald-50 text-emerald-800',
 rejected: 'bg-red-50 text-red-800',
 reimbursed: 'bg-indigo-50 text-indigo-800',
 cancelled: 'bg-neutral-100 text-neutral-500',
};

function fmtMoney(v: number, currency = 'KES') {
 return v.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency;
}

export default function ExpenseClaimsContent() {
 const [claims, setClaims] = useState<ClaimRow[] | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [filter, setFilter] = useState<string>('');
 const [showForm, setShowForm] = useState(false);

 const load = useCallback(() => {
 setLoading(true);
 setError(null);
 const q = filter ? `?status=${filter}` : '';
 fetch(`/api/finance/expenses${q}`)
 .then(async (r) => {
 const data = await r.json().catch(() => ({}));
 if (!r.ok) throw new Error(data.error || 'Failed to load');
 return data;
 })
 .then((data) => setClaims(data.claims ?? []))
 .catch((e) => { setError(e instanceof Error ? e.message : 'Failed'); setClaims([]); })
 .finally(() => setLoading(false));
 }, [filter]);

 useEffect(() => { load(); }, [load]);

 const stats = claims ? {
 total: claims.length,
 pending: claims.filter((c) => c.status === 'submitted').length,
 approved: claims.filter((c) => c.status === 'approved').length,
 totalAmount: claims.reduce((s, c) => s + c.totalAmount, 0),
 } : null;

 const [form, setForm] = useState({
 claimantName: '', department: '', description: '', currency: 'KES',
 items: [{ date: new Date().toISOString().split('T')[0]!, category: 'other', description: '', amount: '' }],
 });
 const [submitting, setSubmitting] = useState(false);

 const submitClaim = async () => {
 if (!form.claimantName.trim() || !form.description.trim()) return;
 const validItems = form.items.filter((i) => i.description.trim() && Number(i.amount) > 0);
 if (validItems.length === 0) return;

 setSubmitting(true);
 try {
 const res = await fetch('/api/finance/expenses', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ ...form, items: validItems }),
 });
 if (!res.ok) {
 const d = await res.json().catch(() => ({}));
 throw new Error(d.error || 'Failed');
 }
 setShowForm(false);
 setForm({
 claimantName: '', department: '', description: '', currency: 'KES',
 items: [{ date: new Date().toISOString().split('T')[0]!, category: 'other', description: '', amount: '' }],
 });
 load();
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed');
 } finally {
 setSubmitting(false);
 }
 };

 const handleAction = async (id: string, action: string) => {
 try {
 const res = await fetch(`/api/finance/expenses/${id}`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ action }),
 });
 if (!res.ok) {
 const d = await res.json().catch(() => ({}));
 throw new Error(d.error || 'Failed');
 }
 load();
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed');
 }
 };

 return (
 <DashboardPage>
 <DashboardPageHeader
 icon={Receipt}
 title="Expense Claims"
 description="Submit, approve, and track employee expense reimbursements."
 actions={
 <button
 type="button"
 onClick={() => setShowForm(!showForm)}
 className="btn-primary inline-flex items-center gap-2"
 >
 <Plus className="h-4 w-4" strokeWidth={1.75} />
 New claim
 </button>
 }
 />

 {stats && (
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
 {[
 { label: 'Total claims', value: stats.total, icon: Receipt, color: 'text-primary-900' },
 { label: 'Pending review', value: stats.pending, icon: Clock, color: 'text-blue-700' },
 { label: 'Approved', value: stats.approved, icon: CheckCircle, color: 'text-emerald-700' },
 { label: 'Total value', value: fmtMoney(stats.totalAmount), icon: Banknote, color: 'text-primary-900' },
 ].map((s, i) => (
 <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
 className="dashboard-stat-card">
 <div className="inline-flex rounded-lg p-2 mb-2 bg-primary-50 text-primary-700">
 <s.icon className="w-4 h-4" />
 </div>
 <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-0.5">{s.label}</p>
 <p className={`text-xl font-bold tabular-nums ${s.color}`}>{s.value}</p>
 </motion.div>
 ))}
 </div>
 )}

 {showForm && (
 <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
 className="rounded-xl border border-primary-200 bg-primary-50/30 p-5 mb-6 space-y-4">
 <h3 className="font-bold text-primary-900">New Expense Claim</h3>
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
 <input placeholder="Claimant name *" value={form.claimantName} onChange={(e) => setForm({ ...form, claimantName: e.target.value })}
 className="px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
 <input placeholder="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}
 className="px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
 <input placeholder="Description *" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
 className="px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
 </div>
 <div className="space-y-2">
 <p className="text-sm font-semibold text-neutral-700">Line items</p>
 {form.items.map((item, idx) => (
 <div key={idx} className="grid grid-cols-1 sm:grid-cols-4 gap-2">
 <input type="date" value={item.date} onChange={(e) => {
 const items = [...form.items]; items[idx] = { ...items[idx]!, date: e.target.value }; setForm({ ...form, items });
 }} className="px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
 <select value={item.category} onChange={(e) => {
 const items = [...form.items]; items[idx] = { ...items[idx]!, category: e.target.value }; setForm({ ...form, items });
 }} className="px-3 py-2 rounded-lg border border-neutral-300 text-sm bg-white">
 {['travel','meals','accommodation','transport','office_supplies','communication','training','fuel','parking','medical','other'].map((c) => (
 <option key={c} value={c}>{c.replace('_', ' ')}</option>
 ))}
 </select>
 <input placeholder="Description" value={item.description} onChange={(e) => {
 const items = [...form.items]; items[idx] = { ...items[idx]!, description: e.target.value }; setForm({ ...form, items });
 }} className="px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
 <input type="number" placeholder="Amount" value={item.amount} onChange={(e) => {
 const items = [...form.items]; items[idx] = { ...items[idx]!, amount: e.target.value }; setForm({ ...form, items });
 }} className="px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
 </div>
 ))}
 <button onClick={() => setForm({ ...form, items: [...form.items, { date: new Date().toISOString().split('T')[0]!, category: 'other', description: '', amount: '' }] })}
 className="text-sm text-primary-700 font-semibold hover:text-primary-900">+ Add line</button>
 </div>
 <div className="flex gap-2">
 <button onClick={submitClaim} disabled={submitting}
 className="px-5 py-2 rounded-lg bg-primary-900 text-white text-sm font-semibold hover:bg-primary-800 disabled:opacity-50">
 {submitting ? 'Creating…' : 'Create claim'}
 </button>
 <button onClick={() => setShowForm(false)} className="px-5 py-2 rounded-lg border border-neutral-300 text-sm font-semibold hover:bg-neutral-50">Cancel</button>
 </div>
 </motion.div>
 )}

 <div className="flex gap-2 mb-4 flex-wrap">
 {['', 'draft', 'submitted', 'approved', 'rejected', 'reimbursed'].map((s) => (
 <button key={s} onClick={() => setFilter(s)}
 className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filter === s ? 'bg-primary-900 text-white' : 'bg-white border border-neutral-300 text-neutral-600 hover:bg-neutral-50'}`}>
 {s || 'All'}
 </button>
 ))}
 </div>

 {loading && <div className="flex items-center gap-2 text-neutral-600 py-12 justify-center"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>}

 {!loading && error && (
 <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-3 items-start">
 <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /><p>{error}</p>
 </div>
 )}

 {!loading && !error && claims && claims.length === 0 && (
 <div className="dashboard-surface p-8 text-center text-sm text-neutral-500">
 No expense claims found. Create one to get started.
 </div>
 )}

 {!loading && !error && claims && claims.length > 0 && (
 <div className="dashboard-surface shadow-sm overflow-hidden">
 <div className="overflow-x-auto">
 <table className="w-full min-w-[700px] text-sm">
 <thead>
 <tr className="border-b border-neutral-200 bg-neutral-50/90">
 <th className="px-4 py-3 font-semibold text-neutral-700 text-left">#</th>
 <th className="px-4 py-3 font-semibold text-neutral-700 text-left">Claimant</th>
 <th className="px-4 py-3 font-semibold text-neutral-700 text-left">Description</th>
 <th className="px-4 py-3 font-semibold text-neutral-700 text-center">Items</th>
 <th className="px-4 py-3 font-semibold text-neutral-700 text-right">Amount</th>
 <th className="px-4 py-3 font-semibold text-neutral-700 text-center">Status</th>
 <th className="px-4 py-3 font-semibold text-neutral-700 text-center">Actions</th>
 </tr>
 </thead>
 <tbody>
 {claims.map((c) => (
 <tr key={c.id} className="border-b border-neutral-100 hover:bg-primary-50/30 transition-colors">
 <td className="px-4 py-3 font-medium text-primary-800">{c.claimNumber}</td>
 <td className="px-4 py-3 text-neutral-800">
 <div>{c.claimantName}</div>
 {c.department && <div className="text-xs text-neutral-500">{c.department}</div>}
 </td>
 <td className="px-4 py-3 text-neutral-600 max-w-[200px] truncate">{c.description}</td>
 <td className="px-4 py-3 text-center tabular-nums">{c.itemCount}</td>
 <td className="px-4 py-3 text-right tabular-nums font-semibold text-primary-900">{fmtMoney(c.totalAmount, c.currency)}</td>
 <td className="px-4 py-3 text-center">
 <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLES[c.status] || 'bg-neutral-100 text-neutral-700'}`}>
 {c.status}
 </span>
 </td>
 <td className="px-4 py-3 text-center">
 <div className="flex items-center justify-center gap-1">
 {c.status === 'draft' && (
 <button onClick={() => handleAction(c.id, 'submit')} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-700" title="Submit">
 <Clock className="w-4 h-4" />
 </button>
 )}
 {c.status === 'submitted' && (
 <>
 <button onClick={() => handleAction(c.id, 'approve')} className="p-1.5 rounded-lg hover:bg-emerald-50 text-emerald-700" title="Approve">
 <CheckCircle className="w-4 h-4" />
 </button>
 <button onClick={() => handleAction(c.id, 'reject')} className="p-1.5 rounded-lg hover:bg-red-50 text-red-700" title="Reject">
 <XCircle className="w-4 h-4" />
 </button>
 </>
 )}
 {c.status === 'approved' && (
 <button onClick={() => handleAction(c.id, 'reimburse')} className="p-1.5 rounded-lg hover:bg-indigo-50 text-indigo-700" title="Mark reimbursed">
 <Banknote className="w-4 h-4" />
 </button>
 )}
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}
 </DashboardPage>
 );
}
