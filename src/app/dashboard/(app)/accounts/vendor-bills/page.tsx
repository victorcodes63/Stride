'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FileStack, Loader2, AlertCircle, Plus } from 'lucide-react';
import useEntityConfig, { useDisplayMoney } from '@/hooks/useEntityConfig';
import { EntityContextBanner } from '@/components/EntityContextBanner';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

type BillRow = {
 id: string;
 vendorId: string;
 vendorName: string;
 billRef: string | null;
 issueDate: string;
 dueDate: string | null;
 currency: string;
 status: string;
 subtotalExVat: number;
 vatAmount: number;
 totalIncVat: number;
 lineCount: number;
};

function VendorBillsListInner() {
 const entityConfig = useEntityConfig();
 const displayMoney = useDisplayMoney();
 const router = useRouter();
 const searchParams = useSearchParams();
 const filterVendorId = searchParams.get('vendorId')?.trim() || undefined;

 const [bills, setBills] = useState<BillRow[] | null>(null);
 const [error, setError] = useState<string | null>(null);
 const [loading, setLoading] = useState(true);
 const [vendorName, setVendorName] = useState<string | null>(null);

 const load = useCallback(() => {
 setLoading(true);
 const q = filterVendorId ? `?vendorId=${encodeURIComponent(filterVendorId)}` : '';
 fetch(`/api/accounts/vendor-bills${q}`)
 .then(async (r) => {
 const data = await r.json().catch(() => ({}));
 if (!r.ok) throw new Error(data.error || `Failed (${r.status})`);
 return data as { bills?: BillRow[] };
 })
 .then((data) => {
 setBills(Array.isArray(data.bills) ? data.bills : []);
 setError(null);
 const first = data.bills?.[0];
 if (filterVendorId && first?.vendorName) setVendorName(first.vendorName);
 else if (!filterVendorId) setVendorName(null);
 })
 .catch((e) => {
 setError(e instanceof Error ? e.message : 'Failed to load');
 setBills([]);
 })
 .finally(() => setLoading(false));
 }, [filterVendorId]);

 useEffect(() => {
 load();
 }, [load]);

 const openBill = (id: string) => router.push(`/dashboard/accounts/vendor-bills/${id}`);

 return (
 <DashboardPage>
 <DashboardPageHeader
 icon={FileStack}
 title="Vendor bills"
 description={
 <>
 <EntityContextBanner />
 Creditor invoices (AP): multi-line, {entityConfig.tax.vatLabel}, payment allocations update status.{' '}
 {entityConfig.tax.whtLabel}: {entityConfig.tax.whtRates}.
 </>
 }
 actions={[
 {
 href: filterVendorId
 ? `/dashboard/accounts/vendor-bills/new?vendorId=${encodeURIComponent(filterVendorId)}`
 : '/dashboard/accounts/vendor-bills/new',
 label: 'New bill',
 icon: Plus,
 },
 ]}
 />

 {filterVendorId && (
 <div className="mb-4 rounded-lg border border-primary-100 bg-primary-50/60 px-3 py-2 text-sm text-primary-900 flex flex-wrap items-center gap-x-3 gap-y-1">
 <span>
 Filtered by vendor{vendorName ? `: ${vendorName}` : ''}.
 </span>
 <Link href="/dashboard/accounts/vendor-bills" className="font-medium underline hover:no-underline">
 Show all bills
 </Link>
 <Link
 href={`/dashboard/accounts/vendors/${filterVendorId}`}
 className="font-medium underline hover:no-underline"
 >
 Vendor profile
 </Link>
 </div>
 )}

 {loading && (
 <div className="flex items-center gap-2 text-neutral-600 py-12 justify-center">
 <Loader2 className="w-5 h-5 animate-spin" />
 Loading bills…
 </div>
 )}

 {!loading && error && (
 <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-3">
 <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
 <p className="font-medium">{error}</p>
 </div>
 )}

 {!loading && !error && bills && bills.length === 0 && (
 <div className="dashboard-surface p-8 text-center text-neutral-600 text-sm space-y-4">
 <p>No vendor bills yet.</p>
 <Link
 href={
 filterVendorId
 ? `/dashboard/accounts/vendor-bills/new?vendorId=${encodeURIComponent(filterVendorId)}`
 : '/dashboard/accounts/vendor-bills/new'
 }
 className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary-900 text-white text-sm font-semibold hover:bg-primary-800"
 >
 <Plus className="w-4 h-4" />
 New bill
 </Link>
 </div>
 )}

 {!loading && !error && bills && bills.length > 0 && (
 <div className="dashboard-surface shadow-sm overflow-hidden">
 <div className="overflow-x-auto">
 <table className="data-table dashboard-data-table w-full min-w-[900px] text-sm">
 <thead>
 <tr className="border-b border-neutral-200 bg-neutral-50/90">
 <th className="px-4 py-3 font-semibold text-neutral-700">Vendor</th>
 <th className="px-4 py-3 font-semibold text-neutral-700">Reference</th>
 <th className="px-4 py-3 font-semibold text-neutral-700 col-center">Issued</th>
 <th className="px-4 py-3 font-semibold text-neutral-700 col-center">Due</th>
 <th className="px-4 py-3 font-semibold text-neutral-700 col-center">Ex-VAT</th>
 <th className="px-4 py-3 font-semibold text-neutral-700 col-center">{entityConfig.tax.vatLabel}</th>
 <th className="px-4 py-3 font-semibold text-neutral-700 col-center">Total</th>
 <th className="px-4 py-3 font-semibold text-neutral-700 col-center">Status</th>
 </tr>
 </thead>
 <tbody>
 {bills.map((bill, index) => (
 <tr
 key={bill.id}
 role="link"
 tabIndex={0}
 onClick={() => openBill(bill.id)}
 onKeyDown={(e) => {
 if (e.key === 'Enter' || e.key === ' ') {
 e.preventDefault();
 openBill(bill.id);
 }
 }}
 className="cursor-pointer border-b border-neutral-100 transition-colors"
 >
 <td className="px-4 py-3 text-neutral-800">{bill.vendorName}</td>
 <td className="px-4 py-3 font-medium text-primary-800">
 {bill.billRef || bill.id.slice(0, 8)}
 </td>
 <td className="px-4 py-3 col-center text-neutral-600 tabular-nums">{bill.issueDate}</td>
 <td className="px-4 py-3 col-center text-neutral-600 tabular-nums">{bill.dueDate ?? '—'}</td>
 <td className="px-4 py-3 col-center tabular-nums text-neutral-800">
 {displayMoney(bill.subtotalExVat, bill.currency)}
 </td>
 <td className="px-4 py-3 col-center tabular-nums text-neutral-700">
 {displayMoney(bill.vatAmount, bill.currency)}
 </td>
 <td className="px-4 py-3 col-center tabular-nums font-semibold text-primary-900">
 {displayMoney(bill.totalIncVat, bill.currency)}
 </td>
 <td className="px-4 py-3 col-center">
 <span
 className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${
 bill.status === 'paid'
 ? 'bg-emerald-50 text-emerald-800'
 : bill.status === 'partial'
 ? 'bg-amber-50 text-amber-800'
 : 'bg-neutral-100 text-neutral-700'
 }`}
 >
 {bill.status}
 </span>
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

export default function VendorBillsPage() {
 return (
 <Suspense
 fallback={
 <div className="flex items-center gap-2 text-neutral-600 py-12 justify-center">
 <Loader2 className="w-5 h-5 animate-spin" />
 Loading bills…
 </div>
 }
 >
 <VendorBillsListInner />
 </Suspense>
 );
}
