'use client';

import { useCallback, useEffect, useState } from 'react';
import { Scale, Loader2, AlertCircle, Building2, Wallet, ChevronDown, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

type StatementEntry = {
 date: string;
 type: string;
 reference: string;
 description: string;
 debit: number;
 credit: number;
 balance: number;
};

type ClientStatement = {
 clientId: string;
 clientName: string;
 clientType: string;
 currency: string;
 entries: StatementEntry[];
 summary: {
 totalInvoiced: number;
 totalPaid: number;
 closingBalance: number;
 };
};

type VendorStatement = {
 vendorId: string;
 vendorName: string;
 currency: string;
 entries: StatementEntry[];
 summary: {
 totalBilled: number;
 totalPaid: number;
 closingBalance: number;
 };
};

function fmtMoney(v: number, currency = 'KES') {
 return v.toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ' + currency;
}

function StatementTable({ entries, currency }: { entries: StatementEntry[]; currency: string }) {
 if (entries.length === 0) {
 return <p className="text-sm text-neutral-500 py-4 text-center">No transactions found.</p>;
 }
 return (
 <div className="overflow-x-auto">
 <table className="w-full min-w-[640px] text-sm">
 <thead>
 <tr className="dashboard-toolbar">
 <th className="px-3 py-2.5 text-left font-semibold text-neutral-700">Date</th>
 <th className="px-3 py-2.5 text-left font-semibold text-neutral-700">Type</th>
 <th className="px-3 py-2.5 text-left font-semibold text-neutral-700">Reference</th>
 <th className="px-3 py-2.5 text-left font-semibold text-neutral-700">Description</th>
 <th className="px-3 py-2.5 text-right font-semibold text-neutral-700">Debit</th>
 <th className="px-3 py-2.5 text-right font-semibold text-neutral-700">Credit</th>
 <th className="px-3 py-2.5 text-right font-semibold text-neutral-700">Balance</th>
 </tr>
 </thead>
 <tbody>
 {entries.map((e, i) => (
 <tr key={i} className="border-b border-neutral-100 hover:bg-primary-50/30 transition-colors">
 <td className="px-3 py-2.5 tabular-nums text-neutral-700">{e.date}</td>
 <td className="px-3 py-2.5">
 <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
 e.type === 'invoice' || e.type === 'bill' ? 'bg-blue-50 text-blue-800'
 : e.type === 'payment' ? 'bg-emerald-50 text-emerald-800'
 : 'bg-amber-50 text-amber-800'
 }`}>
 {e.type.replace('_', ' ')}
 </span>
 </td>
 <td className="px-3 py-2.5 text-neutral-700 font-medium">{e.reference}</td>
 <td className="px-3 py-2.5 text-neutral-600">{e.description}</td>
 <td className="px-3 py-2.5 text-right tabular-nums text-neutral-800">
 {e.debit > 0 ? fmtMoney(e.debit, '') : '—'}
 </td>
 <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">
 {e.credit > 0 ? fmtMoney(e.credit, '') : '—'}
 </td>
 <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-primary-900">
 {fmtMoney(e.balance, '')}
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 );
}

function ExpandableStatement({ name, currency, entries, summary, icon: Icon, summaryLabels }: {
 name: string;
 currency: string;
 entries: StatementEntry[];
 summary: Record<string, number>;
 icon: React.ComponentType<{ className?: string }>;
 summaryLabels: { key: string; label: string; color?: string }[];
}) {
 const [open, setOpen] = useState(false);
 return (
 <div className="dashboard-surface overflow-hidden shadow-sm">
 <button
 onClick={() => setOpen(!open)}
 className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-neutral-50/80 transition-colors text-left"
 >
 <div className="w-9 h-9 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
 <Icon className="w-4.5 h-4.5 text-primary-700" />
 </div>
 <div className="flex-1 min-w-0">
 <p className="font-semibold text-sm text-primary-900 truncate">{name}</p>
 <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-0.5">
 {summaryLabels.map(({ key, label, color }) => (
 <span key={key} className={`text-xs tabular-nums ${color || 'text-neutral-500'}`}>
 {label}: {fmtMoney(summary[key] ?? 0, currency)}
 </span>
 ))}
 </div>
 </div>
 {open ? <ChevronDown className="w-4 h-4 text-neutral-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-neutral-400 shrink-0" />}
 </button>
 <AnimatePresence>
 {open && (
 <motion.div
 initial={{ height: 0, opacity: 0 }}
 animate={{ height: 'auto', opacity: 1 }}
 exit={{ height: 0, opacity: 0 }}
 transition={{ duration: 0.2 }}
 className="border-t border-neutral-200"
 >
 <StatementTable entries={entries} currency={currency} />
 </motion.div>
 )}
 </AnimatePresence>
 </div>
 );
}

export default function AccountsStatementsPage() {
 const [tab, setTab] = useState<'client' | 'vendor'>('client');
 const [clientStatements, setClientStatements] = useState<ClientStatement[] | null>(null);
 const [vendorStatements, setVendorStatements] = useState<VendorStatement[] | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);

 const load = useCallback((type: 'client' | 'vendor') => {
 setLoading(true);
 setError(null);
 fetch(`/api/accounts/statements?type=${type}`)
 .then(async (r) => {
 const data = await r.json().catch(() => ({}));
 if (!r.ok) throw new Error(data.error || `Failed (${r.status})`);
 return data;
 })
 .then((data) => {
 if (type === 'client') setClientStatements(data.statements ?? []);
 else setVendorStatements(data.statements ?? []);
 })
 .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
 .finally(() => setLoading(false));
 }, []);

 useEffect(() => {
 load(tab);
 }, [tab, load]);

 const totalBalance = tab === 'client'
 ? (clientStatements ?? []).reduce((s, c) => s + c.summary.closingBalance, 0)
 : (vendorStatements ?? []).reduce((s, v) => s + v.summary.closingBalance, 0);

 return (
 <DashboardPage>
 <DashboardPageHeader
 icon={Scale}
 title="Statements"
 description="Client and vendor statements of account — opening balance, transactions, and closing balance."
 />

 <div className="flex items-center gap-2 mb-6">
 <button
 onClick={() => setTab('client')}
 className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
 tab === 'client' ? 'bg-primary-900 text-white' : 'bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50'
 }`}
 >
 <Building2 className="w-4 h-4" /> Debtors (clients)
 </button>
 <button
 onClick={() => setTab('vendor')}
 className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
 tab === 'vendor' ? 'bg-primary-900 text-white' : 'bg-white border border-neutral-300 text-neutral-700 hover:bg-neutral-50'
 }`}
 >
 <Wallet className="w-4 h-4" /> Creditors (vendors)
 </button>
 </div>

 {!loading && !error && (
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
 <div className="dashboard-stat-card">
 <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">
 {tab === 'client' ? 'Total invoiced' : 'Total billed'}
 </p>
 <p className="text-xl font-bold text-primary-900 tabular-nums">
 {fmtMoney(tab === 'client'
 ? (clientStatements ?? []).reduce((s, c) => s + c.summary.totalInvoiced, 0)
 : (vendorStatements ?? []).reduce((s, v) => s + v.summary.totalBilled, 0)
 )}
 </p>
 </div>
 <div className="dashboard-stat-card">
 <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">Total paid</p>
 <p className="text-xl font-bold text-emerald-700 tabular-nums">
 {fmtMoney(tab === 'client'
 ? (clientStatements ?? []).reduce((s, c) => s + c.summary.totalPaid, 0)
 : (vendorStatements ?? []).reduce((s, v) => s + v.summary.totalPaid, 0)
 )}
 </p>
 </div>
 <div className="dashboard-stat-card">
 <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 mb-1">Outstanding</p>
 <p className={`text-xl font-bold tabular-nums ${totalBalance > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
 {fmtMoney(totalBalance)}
 </p>
 </div>
 </div>
 )}

 {loading && (
 <div className="flex items-center gap-2 text-neutral-600 py-12 justify-center">
 <Loader2 className="w-5 h-5 animate-spin" /> Loading statements…
 </div>
 )}

 {!loading && error && (
 <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-3 items-start">
 <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
 <p className="font-medium">{error}</p>
 </div>
 )}

 {!loading && !error && tab === 'client' && (
 <div className="space-y-3">
 {(clientStatements ?? []).length === 0 ? (
 <div className="dashboard-surface p-8 text-center text-sm text-neutral-500">
 No client statements available. Create invoices and record payments to generate statements.
 </div>
 ) : (
 (clientStatements ?? []).map((s) => (
 <ExpandableStatement
 key={s.clientId}
 name={s.clientName}
 currency={s.currency}
 entries={s.entries}
 summary={s.summary}
 icon={Building2}
 summaryLabels={[
 { key: 'totalInvoiced', label: 'Invoiced' },
 { key: 'totalPaid', label: 'Paid', color: 'text-emerald-600' },
 { key: 'closingBalance', label: 'Balance', color: s.summary.closingBalance > 0 ? 'text-amber-600 font-medium' : 'text-emerald-600 font-medium' },
 ]}
 />
 ))
 )}
 </div>
 )}

 {!loading && !error && tab === 'vendor' && (
 <div className="space-y-3">
 {(vendorStatements ?? []).length === 0 ? (
 <div className="dashboard-surface p-8 text-center text-sm text-neutral-500">
 No vendor statements available. Create vendor bills and record payments to generate statements.
 </div>
 ) : (
 (vendorStatements ?? []).map((s) => (
 <ExpandableStatement
 key={s.vendorId}
 name={s.vendorName}
 currency={s.currency}
 entries={s.entries}
 summary={s.summary}
 icon={Wallet}
 summaryLabels={[
 { key: 'totalBilled', label: 'Billed' },
 { key: 'totalPaid', label: 'Paid', color: 'text-emerald-600' },
 { key: 'closingBalance', label: 'Owing', color: s.summary.closingBalance > 0 ? 'text-amber-600 font-medium' : 'text-emerald-600 font-medium' },
 ]}
 />
 ))
 )}
 </div>
 )}
 </DashboardPage>
 );
}
