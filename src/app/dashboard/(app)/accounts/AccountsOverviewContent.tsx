'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
 ArrowRight,
 Banknote,
 Building2,
 Coins,
 FileSignature,
 FileStack,
 FileText,
 Landmark,
 LayoutGrid,
 Loader2,
 PieChart,
 BarChart3,
 Receipt,
 Scale,
 Users,
 Wallet,
} from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardStatCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';

type ClientRow = {
 id: string;
 type: string;
};

type InvoiceRow = {
 id: string;
 invoiceNumber: number;
 clientName: string;
 issueDate: string;
 status: string;
 totalIncVat: number;
 currency: string;
};

const MODULES: {
 href: string;
 title: string;
 desc: string;
 icon: React.ComponentType<{ className?: string }>;
 highlight?: boolean;
}[] = [
 {
 href: '/dashboard/accounts/clients',
 title: 'Billing clients',
 desc: 'Parties and entities you invoice',
 icon: Building2,
 },
 {
 href: '/dashboard/accounts/invoices',
 title: 'Invoices',
 desc: 'Multi-line, VAT, PDFs & numbering',
 icon: FileText,
 highlight: true,
 },
 {
 href: '/dashboard/accounts/receipts',
 title: 'Receipts & allocations',
 desc: 'Client payments → invoices',
 icon: Receipt,
 },
 {
 href: '/dashboard/accounts/payment-accounts',
 title: 'Payment accounts',
 desc: 'Bank details shown on invoice PDFs',
 icon: Banknote,
 },
 {
 href: '/dashboard/people/contracts',
 title: 'Contracts',
 desc: 'Reminders & managers',
 icon: FileSignature,
 },
 {
 href: '/dashboard/accounts/vendors',
 title: 'Vendors',
 desc: 'Creditor profiles & spend history',
 icon: Wallet,
 },
 {
 href: '/dashboard/accounts/vendor-bills',
 title: 'Vendor bills',
 desc: 'AP lines, VAT & payment allocations',
 icon: FileStack,
 },
 {
 href: '/dashboard/accounts/statements',
 title: 'Statements',
 desc: 'Debtors & creditors views',
 icon: Scale,
 },
 {
 href: '/dashboard/accounts/expenses',
 title: 'Expense claims',
 desc: 'Submit & approve reimbursements',
 icon: Receipt,
 },
 {
 href: '/dashboard/accounts/budgets',
 title: 'Budgets',
 desc: 'Departmental budget tracking',
 icon: PieChart,
 },
 {
 href: '/dashboard/accounts/petty-cash',
 title: 'Petty cash',
 desc: 'Float management & disbursements',
 icon: Coins,
 },
 {
 href: '/dashboard/accounts/financial-reports',
 title: 'Financial reports',
 desc: 'P&L, revenue & expense analysis',
 icon: BarChart3,
 highlight: true,
 },
];

export default function AccountsOverviewContent() {
 const [clients, setClients] = useState<ClientRow[] | null>(null);
 const [invoices, setInvoices] = useState<InvoiceRow[] | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);

 const load = useCallback(() => {
 setLoading(true);
 setError(null);
 Promise.all([
 fetch('/api/accounts/clients').then(async (r) => {
 const data = await r.json().catch(() => ({}));
 if (!r.ok) throw new Error(data.error || 'Failed to load clients');
 return data as { clients?: ClientRow[] };
 }),
 fetch('/api/accounts/invoices').then(async (r) => {
 const data = await r.json().catch(() => ({}));
 if (!r.ok) throw new Error(data.error || 'Failed to load invoices');
 return data as { invoices?: InvoiceRow[] };
 }),
 ])
 .then(([c, inv]) => {
 setClients(Array.isArray(c.clients) ? c.clients : []);
 setInvoices(Array.isArray(inv.invoices) ? inv.invoices : []);
 })
 .catch((e) => {
 setError(e instanceof Error ? e.message : 'Failed to load Accounts data');
 setClients([]);
 setInvoices([]);
 })
 .finally(() => setLoading(false));
 }, []);

 useEffect(() => {
 load();
 }, [load]);

 const stats = useMemo(() => {
 const c = clients ?? [];
 const inv = invoices ?? [];
 const open = inv.filter((i) => i.status === 'unpaid' || i.status === 'partial').length;
 const paid = inv.filter((i) => i.status === 'paid').length;
 return {
 clientsTotal: c.length,
 invoicesTotal: inv.length,
 openInvoices: open,
 paidInvoices: paid,
 };
 }, [clients, invoices]);

 const recentInvoices = useMemo(() => (invoices ?? []).slice(0, 6), [invoices]);

 const statCards = [
 {
 label: 'Billing clients',
 value: stats.clientsTotal,
 sub: 'Subsidiaries, entities & customers',
 icon: Users,
 tone: 'primary' as const,
 },
 {
 label: 'Invoices (loaded)',
 value: stats.invoicesTotal,
 sub: 'Latest 200 in system',
 icon: FileText,
 tone: 'primary' as const,
 },
 {
 label: 'Open invoices',
 value: stats.openInvoices,
 sub: 'Unpaid or partial',
 icon: Landmark,
 tone: 'primary' as const,
 },
 {
 label: 'Paid invoices',
 value: stats.paidInvoices,
 sub: 'Fully settled',
 icon: Building2,
 tone: 'primary' as const,
 },
 ];

 if (loading) {
 return (
 <div className="w-full min-w-0 flex flex-col items-center justify-center py-24 gap-4">
 <Loader2 className="w-9 h-9 text-primary-600 animate-spin" />
 <p className="text-sm text-neutral-500">Loading Accounts overview…</p>
 </div>
 );
 }

 if (error) {
 return (
 <div className="w-full min-w-0 space-y-4">
      <DashboardPageHeader
        variant="hero"
        eyebrow="Finance & payroll"
        title="Accounts"
        description="Manage billing clients, invoices, receipts, contracts, vendors, statements, and payroll from one place."
      />
 <div className="rounded-2xl border border-red-100 bg-red-50/80 p-5 text-red-800 text-sm max-w-2xl">
 {error}
 </div>
 </div>
 );
 }

 return (
 <div className="w-full min-w-0 space-y-8 sm:space-y-10">
      <DashboardPageHeader
        variant="hero"
        eyebrow="Finance & payroll"
        title="Accounts"
        description="Manage billing clients, invoices, receipts, contracts, vendors, statements, and payroll from one place."
        actions={[
          { href: '/dashboard/accounts/clients', label: 'Billing clients', icon: Building2, variant: 'primary' },
          { href: '/dashboard/accounts/invoices', label: 'All invoices', icon: LayoutGrid, variant: 'secondary' },
        ]}
        className="sm:p-8"
      />

 {/* Snapshot */}
 <section className="space-y-4">
 <h2 className="text-lg font-bold text-[var(--dash-text-strong)] pb-1 border-b border-[var(--dash-border)]">Live snapshot</h2>
 <DashboardStatGrid columns={4}>
 {statCards.map((s) => (
 <DashboardStatCard
 key={s.label}
 label={s.label}
 value={s.value}
 hint={s.sub}
 tone={s.tone}
 />
 ))}
 </DashboardStatGrid>
 </section>

 {/* Modules — Quick entry style */}
 <section className="space-y-4">
 <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 border-b border-neutral-200 pb-4">
 <div>
 <h2 className="text-lg font-bold text-neutral-900">Accounts modules</h2>
 <p className="text-sm text-neutral-500 mt-1 max-w-2xl">
 Same destinations as the sidebar—open the area you need.
 </p>
 </div>
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4">
 {MODULES.map((tile, idx) => {
 const Icon = tile.icon;
 return (
 <motion.div
 key={tile.href}
 initial={{ opacity: 0, y: 8 }}
 animate={{ opacity: 1, y: 0 }}
 transition={{ delay: 0.08 + idx * 0.03 }}
 >
 <Link
 href={tile.href}
 className={`flex items-center gap-4 p-4 rounded-2xl border transition-all hover:shadow-md h-full ${
 tile.highlight
 ? 'dash-feature-link'
 : 'bg-white border-neutral-200 hover:border-primary-300 hover:bg-primary-50/40'
 }`}
 >
 <div
 className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
 tile.highlight ? 'dash-feature-link-icon' : 'bg-primary-50 text-primary-700'
 }`}
 >
 <Icon className={`w-5 h-5 ${tile.highlight ? 'text-white' : ''}`} />
 </div>
 <div className="min-w-0 flex-1">
 <p
 className={`font-bold text-sm ${tile.highlight ? 'text-white' : 'text-primary-900'}`}
 >
 {tile.title}
 </p>
 <p
 className={`text-xs line-clamp-2 ${tile.highlight ? 'dash-feature-link-desc' : 'text-neutral-500'}`}
 >
 {tile.desc}
 </p>
 </div>
 <ArrowRight
 className={`w-4 h-4 shrink-0 ${tile.highlight ? 'text-white' : 'text-neutral-300'}`}
 />
 </Link>
 </motion.div>
 );
 })}
 </div>
 </section>

 {/* Recent invoices */}
 <section className="space-y-4 pb-2">
 <div className="dashboard-surface overflow-hidden min-w-0 shadow-sm">
 <div className="px-5 py-4 dashboard-toolbar flex items-center justify-between gap-3">
 <h2 className="font-bold text-neutral-900">Recent invoices</h2>
 <Link
 href="/dashboard/accounts/invoices"
 className="text-sm font-semibold text-primary-600 hover:text-primary-800 flex items-center gap-1"
 >
 View all <ArrowRight className="w-4 h-4" />
 </Link>
 </div>
 <div className="divide-y divide-neutral-100">
 {recentInvoices.length === 0 ? (
 <div className="px-5 py-10 text-center text-sm text-neutral-500">
 No invoices yet. Create one from a billing client or use the sample seed in development.
 </div>
 ) : (
 recentInvoices.map((inv) => (
 <Link
 key={inv.id}
 href={`/dashboard/accounts/invoices/${inv.id}`}
 className="flex items-center gap-3 px-5 py-3.5 hover:bg-primary-50/40 transition-colors"
 >
 <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center shrink-0 ring-2 ring-white shadow-sm">
 <span className="text-sm font-bold text-primary-800 tabular-nums">#{inv.invoiceNumber}</span>
 </div>
 <div className="flex-1 min-w-0">
 <p className="font-semibold text-sm text-primary-900 truncate">{inv.clientName}</p>
 <p className="text-xs text-neutral-500 truncate">
 {inv.issueDate} ·{' '}
 {inv.totalIncVat.toLocaleString('en-KE', {
 minimumFractionDigits: 2,
 maximumFractionDigits: 2,
 })}{' '}
 {inv.currency}
 </p>
 </div>
 <span className="text-[10px] font-semibold uppercase tracking-wide text-neutral-500 shrink-0 px-2 py-0.5 rounded-lg bg-neutral-100">
 {inv.status}
 </span>
 </Link>
 ))
 )}
 </div>
 </div>
 </section>
 </div>
 );
}
