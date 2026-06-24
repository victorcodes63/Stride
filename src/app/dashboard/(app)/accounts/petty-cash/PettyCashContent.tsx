'use client';

import { useCallback, useEffect, useState } from 'react';
import { Coins, Loader2, AlertCircle, Plus, ArrowUpCircle, ArrowDownCircle, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

type PettyCashTx = {
 id: string;
 type: string;
 amount: number;
 date: string;
 description: string;
 category: string | null;
 reference: string | null;
};

type PettyCashFund = {
 id: string;
 name: string;
 currency: string;
 floatAmount: number;
 currentBalance: number;
 status: string;
 custodianName: string | null;
 transactionCount: number;
 recentTransactions: PettyCashTx[];
 createdAt: string;
};

function fmtMoney(v: number, currency = 'KES') {
 return v.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency;
}

export default function PettyCashContent() {
 const [funds, setFunds] = useState<PettyCashFund[] | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [showNewFund, setShowNewFund] = useState(false);
 const [showTx, setShowTx] = useState<string | null>(null);
 const [submitting, setSubmitting] = useState(false);

 const [fundForm, setFundForm] = useState({ name: '', floatAmount: '', custodianName: '' });
 const [txForm, setTxForm] = useState({ transactionType: 'disbursement', amount: '', description: '', category: '', date: new Date().toISOString().split('T')[0]! });

 const load = useCallback(() => {
 setLoading(true);
 setError(null);
 fetch('/api/finance/petty-cash')
 .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Failed'); return d; })
 .then((d) => setFunds(d.funds ?? []))
 .catch((e) => { setError(e instanceof Error ? e.message : 'Failed'); setFunds([]); })
 .finally(() => setLoading(false));
 }, []);

 useEffect(() => { load(); }, [load]);

 const createFund = async () => {
 if (!fundForm.name.trim() || !fundForm.floatAmount) return;
 setSubmitting(true);
 try {
 const res = await fetch('/api/finance/petty-cash', {
 method: 'POST', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ name: fundForm.name, floatAmount: Number(fundForm.floatAmount), custodianName: fundForm.custodianName }),
 });
 if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed'); }
 setShowNewFund(false);
 setFundForm({ name: '', floatAmount: '', custodianName: '' });
 load();
 } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
 finally { setSubmitting(false); }
 };

 const recordTx = async (fundId: string) => {
 if (!txForm.amount || !txForm.description.trim()) return;
 setSubmitting(true);
 try {
 const res = await fetch('/api/finance/petty-cash', {
 method: 'POST', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ action: 'transaction', fundId, ...txForm, amount: Number(txForm.amount) }),
 });
 if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed'); }
 setShowTx(null);
 setTxForm({ transactionType: 'disbursement', amount: '', description: '', category: '', date: new Date().toISOString().split('T')[0]! });
 load();
 } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
 finally { setSubmitting(false); }
 };

 return (
 <DashboardPage>
 <DashboardPageHeader
 icon={Coins}
 title="Petty Cash"
 description="Manage petty cash funds, disbursements, and replenishments."
 actions={
 <button
 type="button"
 onClick={() => setShowNewFund(!showNewFund)}
 className="btn-primary inline-flex items-center gap-2"
 >
 <Plus className="h-4 w-4" strokeWidth={1.75} />
 New fund
 </button>
 }
 />

 {showNewFund && (
 <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
 className="rounded-xl border border-primary-200 bg-primary-50/30 p-5 mb-6 space-y-4">
 <h3 className="font-bold text-primary-900">Create Petty Cash Fund</h3>
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
 <input placeholder="Fund name *" value={fundForm.name} onChange={(e) => setFundForm({ ...fundForm, name: e.target.value })}
 className="px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
 <input type="number" placeholder="Float amount *" value={fundForm.floatAmount}
 onChange={(e) => setFundForm({ ...fundForm, floatAmount: e.target.value })}
 className="px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
 <input placeholder="Custodian name" value={fundForm.custodianName}
 onChange={(e) => setFundForm({ ...fundForm, custodianName: e.target.value })}
 className="px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
 </div>
 <div className="flex gap-2">
 <button onClick={createFund} disabled={submitting}
 className="px-5 py-2 rounded-lg bg-primary-900 text-white text-sm font-semibold hover:bg-primary-800 disabled:opacity-50">
 {submitting ? 'Creating…' : 'Create fund'}
 </button>
 <button onClick={() => setShowNewFund(false)} className="px-5 py-2 rounded-lg border border-neutral-300 text-sm font-semibold hover:bg-neutral-50">Cancel</button>
 </div>
 </motion.div>
 )}

 {loading && <div className="flex items-center gap-2 text-neutral-600 py-12 justify-center"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>}
 {!loading && error && (
 <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-3 items-start">
 <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /><p>{error}</p>
 </div>
 )}

 {!loading && !error && funds && funds.length === 0 && (
 <div className="dashboard-surface p-8 text-center text-sm text-neutral-500">
 No petty cash funds. Create one to get started.
 </div>
 )}

 {!loading && !error && funds && funds.length > 0 && (
 <div className="space-y-4">
 {funds.map((fund) => {
 const pct = fund.floatAmount > 0 ? Math.round((fund.currentBalance / fund.floatAmount) * 100) : 0;
 return (
 <div key={fund.id} className="dashboard-surface overflow-hidden shadow-sm">
 <div className="p-4 sm:p-5">
 <div className="flex items-start justify-between gap-3 mb-3">
 <div>
 <h3 className="font-bold text-primary-900 flex items-center gap-2">
 <Coins className="w-5 h-5 text-primary-700" /> {fund.name}
 </h3>
 <p className="text-xs text-neutral-500 mt-0.5">{fund.custodianName || 'No custodian'} · {fund.transactionCount} transactions</p>
 </div>
 <span className={`px-2 py-0.5 rounded text-xs font-medium ${fund.status === 'open' ? 'bg-emerald-50 text-emerald-800' : 'bg-neutral-100 text-neutral-700'}`}>
 {fund.status}
 </span>
 </div>
 <div className="grid grid-cols-3 gap-4 mb-3">
 <div>
 <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Float</p>
 <p className="text-sm font-bold text-primary-900 tabular-nums">{fmtMoney(fund.floatAmount, fund.currency)}</p>
 </div>
 <div>
 <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Balance</p>
 <p className={`text-sm font-bold tabular-nums ${pct < 20 ? 'text-red-700' : pct < 50 ? 'text-amber-700' : 'text-emerald-700'}`}>
 {fmtMoney(fund.currentBalance, fund.currency)}
 </p>
 </div>
 <div>
 <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500">Remaining</p>
 <p className="text-sm font-bold text-neutral-600 tabular-nums">{pct}%</p>
 </div>
 </div>
 <div className="relative h-2 bg-neutral-100 rounded-full overflow-hidden mb-3">
 <div className={`absolute inset-y-0 left-0 rounded-full ${pct < 20 ? 'bg-red-500' : pct < 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
 style={{ width: `${Math.min(pct, 100)}%` }} />
 </div>
 <div className="flex gap-2">
 <button onClick={() => setShowTx(showTx === fund.id ? null : fund.id)}
 className="px-3 py-1.5 rounded-lg border border-neutral-300 text-xs font-semibold hover:bg-neutral-50 flex items-center gap-1">
 <Plus className="w-3.5 h-3.5" /> Record transaction
 </button>
 </div>
 </div>

 {showTx === fund.id && (
 <div className="border-t border-neutral-200 p-4 bg-neutral-50/50 space-y-3">
 <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
 <select value={txForm.transactionType} onChange={(e) => setTxForm({ ...txForm, transactionType: e.target.value })}
 className="px-3 py-2 rounded-lg border border-neutral-300 text-sm bg-white">
 <option value="disbursement">Disbursement</option>
 <option value="replenishment">Replenishment</option>
 <option value="refund">Refund</option>
 </select>
 <input type="number" placeholder="Amount" value={txForm.amount}
 onChange={(e) => setTxForm({ ...txForm, amount: e.target.value })}
 className="px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
 <input placeholder="Description" value={txForm.description}
 onChange={(e) => setTxForm({ ...txForm, description: e.target.value })}
 className="px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
 <input type="date" value={txForm.date}
 onChange={(e) => setTxForm({ ...txForm, date: e.target.value })}
 className="px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
 </div>
 <button onClick={() => recordTx(fund.id)} disabled={submitting}
 className="px-4 py-1.5 rounded-lg bg-primary-900 text-white text-sm font-semibold hover:bg-primary-800 disabled:opacity-50">
 {submitting ? 'Recording…' : 'Record'}
 </button>
 </div>
 )}

 {fund.recentTransactions.length > 0 && (
 <div className="border-t border-neutral-200">
 <div className="px-4 py-2.5 bg-neutral-50/50">
 <p className="text-xs font-semibold text-neutral-600">Recent transactions</p>
 </div>
 <div className="divide-y divide-neutral-100">
 {fund.recentTransactions.slice(0, 5).map((tx) => (
 <div key={tx.id} className="flex items-center gap-3 px-4 py-2.5">
 {tx.type === 'replenishment' || tx.type === 'refund' ? (
 <ArrowUpCircle className="w-4 h-4 text-emerald-600 shrink-0" />
 ) : (
 <ArrowDownCircle className="w-4 h-4 text-red-500 shrink-0" />
 )}
 <div className="flex-1 min-w-0">
 <p className="text-sm text-neutral-800 truncate">{tx.description}</p>
 <p className="text-xs text-neutral-500">{tx.date}{tx.category ? ` · ${tx.category}` : ''}</p>
 </div>
 <span className={`text-sm font-semibold tabular-nums ${tx.type === 'disbursement' ? 'text-red-700' : 'text-emerald-700'}`}>
 {tx.type === 'disbursement' ? '-' : '+'}{fmtMoney(tx.amount, '')}
 </span>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 );
 })}
 </div>
 )}
 </DashboardPage>
 );
}
