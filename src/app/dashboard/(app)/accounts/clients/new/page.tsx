'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2, AlertCircle } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

const inputClass =
 'w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2.5 text-sm text-neutral-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30';

export default function NewAccountsClientPage() {
 const router = useRouter();
 const [name, setName] = useState('');
 const [currency, setCurrency] = useState('KES');
 const [contactName, setContactName] = useState('');
 const [contactEmail, setContactEmail] = useState('');
 const [contactPhone, setContactPhone] = useState('');
 const [billingNotes, setBillingNotes] = useState('');
 const [submitting, setSubmitting] = useState(false);
 const [error, setError] = useState<string | null>(null);

 const submit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!name.trim()) {
 setError('Client name is required.');
 return;
 }
 setError(null);
 setSubmitting(true);
 try {
 const r = await fetch('/api/accounts/clients', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 type: 'custom',
 name: name.trim(),
 currency: currency.trim() || 'KES',
 contactName: contactName.trim() || null,
 contactEmail: contactEmail.trim() || null,
 contactPhone: contactPhone.trim() || null,
 billingNotes: billingNotes.trim() || null,
 }),
 });
 const j = await r.json().catch(() => ({}));
 if (!r.ok) throw new Error(j.error || `Failed (${r.status})`);
 if (j.id) router.push(`/dashboard/accounts/clients/${j.id}`);
 else router.push('/dashboard/accounts/clients');
 } catch (err) {
 setError(err instanceof Error ? err.message : 'Failed to create');
 } finally {
 setSubmitting(false);
 }
 };

 return (
 <DashboardPage>
 <nav className="mb-4" aria-label="Breadcrumb">
 <ol className="flex items-center gap-1.5 text-sm text-neutral-500">
 <li>
 <Link href="/dashboard/accounts/clients" className="hover:text-primary-700">
 Billing clients
 </Link>
 </li>
 <li aria-hidden="true">/</li>
 <li className="text-neutral-900 font-medium">New billing client</li>
 </ol>
 </nav>

 <DashboardPageHeader
 title="New billing client"
 description="Add a party your company invoices — a subsidiary, inter-company entity, or external customer."
 />

 <form onSubmit={submit} className="space-y-6 mt-6">
 {error && (
 <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 flex gap-2">
 <AlertCircle className="w-5 h-5 shrink-0" />
 {error}
 </div>
 )}

 <div className="dashboard-surface p-5 sm:p-6 shadow-sm">
 <div className="grid md:grid-cols-2 gap-6 lg:gap-8">
 <div className="space-y-4">
 <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-neutral-500">
 Company
 </p>
 <div>
 <label htmlFor="name" className="block text-sm font-medium text-neutral-800 mb-1.5">
 Display name <span className="text-red-600">*</span>
 </label>
 <input
 id="name"
 className={inputClass}
 value={name}
 onChange={(e) => setName(e.target.value)}
 placeholder="e.g. Demo Corp Kenya Ltd"
 required
 />
 </div>
 <div>
 <label htmlFor="currency" className="block text-sm font-medium text-neutral-800 mb-1.5">
 Currency
 </label>
 <input
 id="currency"
 className={inputClass}
 value={currency}
 onChange={(e) => setCurrency(e.target.value)}
 />
 </div>
 </div>
 <div className="space-y-4">
 <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-widest text-neutral-500">
 Contact person
 </p>
 <div>
 <label htmlFor="cn" className="block text-sm font-medium text-neutral-800 mb-1.5">
 Contact name
 </label>
 <input
 id="cn"
 className={inputClass}
 value={contactName}
 onChange={(e) => setContactName(e.target.value)}
 placeholder="e.g. Jane Doe"
 />
 </div>
 <div>
 <label htmlFor="ce" className="block text-sm font-medium text-neutral-800 mb-1.5">
 Email
 </label>
 <input
 id="ce"
 type="email"
 className={inputClass}
 value={contactEmail}
 onChange={(e) => setContactEmail(e.target.value)}
 placeholder="e.g. jane@company.com"
 />
 </div>
 <div>
 <label htmlFor="cp" className="block text-sm font-medium text-neutral-800 mb-1.5">
 Phone
 </label>
 <input
 id="cp"
 className={inputClass}
 value={contactPhone}
 onChange={(e) => setContactPhone(e.target.value)}
 placeholder="e.g. +254 700 123 456"
 />
 </div>
 </div>
 </div>
 <div className="mt-6 pt-6 border-t border-neutral-100">
 <label htmlFor="bn" className="block text-sm font-medium text-neutral-800 mb-1.5">
 Internal notes <span className="text-neutral-400 font-normal">(optional, not shown on invoices)</span>
 </label>
 <textarea
 id="bn"
 rows={4}
 className={`${inputClass} resize-y min-h-[100px]`}
 value={billingNotes}
 onChange={(e) => setBillingNotes(e.target.value)}
 placeholder="e.g. Monthly retainer, inter-company billing, project reference…"
 />
 </div>
 </div>

 <div className="flex flex-wrap gap-3">
 <button
 type="submit"
 disabled={submitting}
 className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary-900 text-white text-sm font-semibold hover:bg-primary-800 disabled:opacity-60"
 >
 {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
 Create billing client
 </button>
 <Link
 href="/dashboard/accounts/clients"
 className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-neutral-300 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
 >
 Cancel
 </Link>
 </div>
 </form>
 </DashboardPage>
 );
}
