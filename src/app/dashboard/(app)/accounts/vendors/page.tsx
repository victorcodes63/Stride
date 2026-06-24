'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Store, Loader2, AlertCircle, Plus, FileStack } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

type VendorRow = {
 id: string;
 name: string;
 currency: string;
 contactName: string | null;
 contactEmail: string | null;
 counts: { bills: number; payments: number };
};

function AccountsVendorsPageInner() {
 const router = useRouter();
 const [rows, setRows] = useState<VendorRow[] | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [loading, setLoading] = useState(true);

 const load = useCallback(() => {
 setLoading(true);
 fetch('/api/accounts/vendors')
 .then(async (r) => {
 const data = await r.json().catch(() => ({}));
 if (!r.ok) throw new Error(data.error || `Failed (${r.status})`);
 return data as { vendors?: VendorRow[] };
 })
 .then((data) => {
 setRows(Array.isArray(data.vendors) ? data.vendors : []);
 setError(null);
 })
 .catch((e) => {
 setError(e instanceof Error ? e.message : 'Failed to load');
 setRows([]);
 })
 .finally(() => setLoading(false));
 }, []);

 useEffect(() => {
 load();
 }, [load]);

 const openVendor = (id: string) => router.push(`/dashboard/accounts/vendors/${id}`);

 return (
 <DashboardPage>
 <DashboardPageHeader
 icon={Store}
 title="Vendors & creditors"
 description={
 <>
 Supplier and internal creditor profiles. Bills, VAT lines, and payment allocations live under each vendor
 or in{' '}
 <Link href="/dashboard/accounts/vendor-bills" className="font-medium text-primary-800 underline hover:no-underline">
 all bills
 </Link>
 .
 </>
 }
 actions={[
 { href: '/dashboard/accounts/vendor-bills', label: 'All bills', icon: FileStack, variant: 'secondary' },
 { href: '/dashboard/accounts/vendors/new', label: 'New vendor', icon: Plus },
 ]}
 />

 {loading && (
 <div className="flex items-center gap-2 text-neutral-600 py-12 justify-center">
 <Loader2 className="w-5 h-5 animate-spin" />
 Loading vendors…
 </div>
 )}

 {!loading && error && (
 <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-3 items-start">
 <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
 <div>
 <p className="font-medium">{error}</p>
 {error.includes('permission') && (
 <p className="mt-2 text-amber-800">
 Admins have full access; other staff need Accounts access and{' '}
 <code className="bg-amber-100/80 px-1 rounded text-xs">canManageVendors</code> to create vendors
 and bills.
 </p>
 )}
 </div>
 </div>
 )}

 {!loading && !error && rows && rows.length === 0 && (
 <div className="dashboard-surface p-8 text-center text-neutral-600 text-sm space-y-4">
 <p>No vendors yet. Add suppliers or an internal profile (e.g. petty cash).</p>
 <Link
 href="/dashboard/accounts/vendors/new"
 className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-900 text-white text-sm font-semibold hover:bg-primary-800"
 >
 <Plus className="w-4 h-4" />
 New vendor
 </Link>
 </div>
 )}

 {!loading && !error && rows && rows.length > 0 && (
 <div className="dashboard-surface shadow-sm overflow-hidden">
 <div className="overflow-x-auto">
 <table className="data-table dashboard-data-table w-full min-w-[640px] text-sm">
 <thead>
 <tr className="border-b border-neutral-200 bg-neutral-50/90">
 <th className="px-4 py-3 font-semibold text-neutral-700">Vendor</th>
 <th className="px-4 py-3 font-semibold text-neutral-700">Contact</th>
 <th className="px-4 py-3 font-semibold text-neutral-700 col-center">Currency</th>
 <th className="px-4 py-3 font-semibold text-neutral-700 col-center">Bills</th>
 <th className="px-4 py-3 font-semibold text-neutral-700 col-center">Payments</th>
 </tr>
 </thead>
 <tbody>
 {rows.map((v, index) => (
 <tr
 key={v.id}
 role="link"
 tabIndex={0}
 onClick={() => openVendor(v.id)}
 onKeyDown={(e) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 openVendor(v.id);
 }
 }}
 className="cursor-pointer border-b border-neutral-100 transition-colors"
 >
 <td className="px-4 py-3 font-medium text-primary-800">{v.name}</td>
 <td className="px-4 py-3 text-neutral-600">
 {v.contactName || v.contactEmail || '—'}
 </td>
 <td className="px-4 py-3 col-center text-neutral-600">{v.currency}</td>
 <td className="px-4 py-3 col-center tabular-nums text-neutral-800">{v.counts.bills}</td>
 <td className="px-4 py-3 col-center tabular-nums text-neutral-800">{v.counts.payments}</td>
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

export default function AccountsVendorsPage() {
 return (
 <Suspense
 fallback={
 <div className="flex items-center gap-2 text-neutral-600 py-12 justify-center">
 <Loader2 className="w-5 h-5 animate-spin" />
 Loading…
 </div>
 }
 >
 <AccountsVendorsPageInner />
 </Suspense>
 );
}
