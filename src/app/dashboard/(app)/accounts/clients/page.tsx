'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Building2, AlertCircle, Plus, Search, Pencil, FileText } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

type ClientRow = {
 id: string;
 name: string;
 currency: string;
 contactName: string | null;
 contactEmail: string | null;
 contactPhone: string | null;
 billingNotes: string | null;
 counts: { invoices: number; contracts: number; payments: number; payrolls: number };
};

function contactSummary(c: ClientRow): string {
 const parts = [c.contactName, c.contactEmail, c.contactPhone].filter(Boolean);
 return parts.join(' · ');
}

export default function AccountsClientsPage() {
 const [clients, setClients] = useState<ClientRow[] | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [loading, setLoading] = useState(true);
 const [searchQuery, setSearchQuery] = useState('');

 const load = useCallback(() => {
 setLoading(true);
 fetch('/api/accounts/clients')
 .then(async (r) => {
 const data = await r.json().catch(() => ({}));
 if (!r.ok) throw new Error(data.error || `Failed (${r.status})`);
 return data as { clients?: ClientRow[] };
 })
 .then((data) => {
 setClients(Array.isArray(data.clients) ? data.clients : []);
 setError(null);
 })
 .catch((e) => {
 setError(e instanceof Error ? e.message : 'Failed to load');
 setClients([]);
 })
 .finally(() => setLoading(false));
 }, []);

 useEffect(() => {
 load();
 }, [load]);

 const totals = useMemo(() => {
 const rows = clients ?? [];
 return {
 totalClients: rows.length,
 totalInvoices: rows.reduce((s, c) => s + c.counts.invoices, 0),
 totalContracts: rows.reduce((s, c) => s + c.counts.contracts, 0),
 };
 }, [clients]);

 const filteredClients = useMemo(() => {
 const rows = clients ?? [];
 const q = searchQuery.trim().toLowerCase();
 if (!q) return rows;
 return rows.filter((c) => {
 const blob = [c.name, c.currency, c.contactName, c.contactEmail, c.contactPhone, c.billingNotes]
 .filter(Boolean)
 .join(' ')
 .toLowerCase();
 return blob.includes(q);
 });
 }, [clients, searchQuery]);

 return (
 <DashboardPage>
 <DashboardPageHeader
 icon={Building2}
 title="Billing clients"
 description="Parties you issue invoices to — subsidiaries, inter-company entities, or external customers. Each client holds its own contact details, currency, and invoice history."
 actions={[
 { href: '/dashboard/accounts/clients/new', label: 'Add billing client', icon: Plus },
 ]}
 />

 {error && (
 <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-3 items-start">
 <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
 <p>{error}</p>
 </div>
 )}

 {loading ? null : (
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-6">
 <div className="dashboard-surface p-4 sm:p-5 shadow-sm">
 <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1">
 Total clients
 </p>
 <p className="text-2xl sm:text-3xl font-bold text-primary-900 tabular-nums">{totals.totalClients}</p>
 </div>
 <div className="dashboard-surface p-4 sm:p-5 shadow-sm">
 <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1">
 Invoices
 </p>
 <p className="text-2xl sm:text-3xl font-bold text-primary-700 tabular-nums">{totals.totalInvoices}</p>
 </div>
 <div className="dashboard-surface p-4 sm:p-5 shadow-sm">
 <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-neutral-500 mb-1">
 Contracts
 </p>
 <p className="text-2xl sm:text-3xl font-bold text-emerald-700 tabular-nums">{totals.totalContracts}</p>
 </div>
 </div>
 )}

 {loading ? (
 <div className="dashboard-surface shadow-sm p-8 sm:p-12">
 <div className="animate-pulse space-y-4">
 <div className="h-6 bg-neutral-200 rounded w-1/3" />
 <div className="h-4 bg-neutral-100 rounded w-full" />
 <div className="h-4 bg-neutral-100 rounded w-5/6" />
 </div>
 </div>
 ) : (clients?.length ?? 0) === 0 ? (
 <div className="dashboard-surface shadow-sm p-8 sm:p-12 text-center">
 <Building2 className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
 <p className="text-neutral-600 mb-4 max-w-md mx-auto text-sm sm:text-base">
 No billing clients yet. Add the parties your company invoices — subsidiaries, departments, or external
 customers.
 </p>
 <Link
 href="/dashboard/accounts/clients/new"
 className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary-900 text-white rounded-lg font-medium hover:bg-primary-800 transition-colors"
 >
 <Plus className="w-4 h-4" />
 Add billing client
 </Link>
 </div>
 ) : (
 <>
 <div className="mb-5">
 <div className="relative max-w-xs sm:max-w-sm w-full">
 <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
 <input
 type="search"
 placeholder="Search by name, contact, or notes…"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 className="w-full pl-9 pr-4 py-2 border border-neutral-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
 aria-label="Search billing clients"
 />
 </div>
 </div>

 {filteredClients.length === 0 ? (
 <div className="dashboard-surface shadow-sm p-8 sm:p-12 text-center">
 <Search className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
 <p className="text-neutral-600">No clients match your search.</p>
 </div>
 ) : (
 <div className="dashboard-surface shadow-sm overflow-hidden min-w-0">
 <div className="overflow-x-auto">
 <table className="data-table dashboard-data-table w-full min-w-[640px]">
 <thead>
 <tr className="dashboard-toolbar">
 <th className="text-xs font-semibold uppercase tracking-wider text-neutral-500 px-4 sm:px-5 py-3">
 Client
 </th>
 <th className="text-xs font-semibold uppercase tracking-wider text-neutral-500 px-4 sm:px-5 py-3">
 Contact
 </th>
 <th className="text-xs font-semibold uppercase tracking-wider text-neutral-500 px-4 sm:px-5 py-3">
 Currency
 </th>
 <th className="text-xs font-semibold uppercase tracking-wider text-neutral-500 px-4 sm:px-5 py-3 col-center">
 Invoices
 </th>
 <th className="text-xs font-semibold uppercase tracking-wider text-neutral-500 px-4 sm:px-5 py-3 col-right">
 Actions
 </th>
 </tr>
 </thead>
 <tbody>
 {filteredClients.map((c) => {
 const contact = contactSummary(c);
 return (
 <tr key={c.id} className="transition-colors">
 <td className="px-4 sm:px-5 py-3">
 <Link
 href={`/dashboard/accounts/clients/${c.id}`}
 className="font-medium text-primary-900 text-sm hover:text-primary-700 hover:underline"
 >
 {c.name}
 </Link>
 </td>
 <td className="px-4 sm:px-5 py-3 text-neutral-600 text-sm">
 {contact ? (
 <span className="truncate block max-w-[20rem]" title={contact}>
 {contact}
 </span>
 ) : (
 <span className="text-neutral-400 text-xs">—</span>
 )}
 </td>
 <td className="px-4 sm:px-5 py-3 text-neutral-700 text-sm tabular-nums">{c.currency}</td>
 <td className="px-4 sm:px-5 py-3 text-neutral-600 text-sm tabular-nums">
 <span className="inline-flex items-center gap-1">
 <FileText className="w-3.5 h-3.5 text-neutral-400" />
 {c.counts.invoices}
 </span>
 </td>
 <td className="px-4 sm:px-5 py-3 text-right">
 <Link
 href={`/dashboard/accounts/clients/${c.id}`}
 className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-neutral-600 hover:text-primary-700 hover:bg-primary-50 transition-colors"
 >
 <Pencil className="w-3.5 h-3.5" />
 Edit
 </Link>
 </td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 </div>
 )}
 </>
 )}
 </DashboardPage>
 );
}
