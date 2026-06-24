'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AlertCircle, Loader2 } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

const inputClass =
 'w-full min-w-0 rounded-lg border border-neutral-300 px-3 py-2 text-sm text-neutral-900 shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30';

export default function NewVendorPage() {
 const router = useRouter();
 const [name, setName] = useState('');
 const [currency, setCurrency] = useState('KES');
 const [contactName, setContactName] = useState('');
 const [contactEmail, setContactEmail] = useState('');
 const [contactPhone, setContactPhone] = useState('');
 const [notes, setNotes] = useState('');
 const [submitting, setSubmitting] = useState(false);
 const [error, setError] = useState<string | null>(null);

 const submit = async (e: React.FormEvent) => {
 e.preventDefault();
 setError(null);
 if (!name.trim()) {
 setError('Vendor name is required.');
 return;
 }
 setSubmitting(true);
 try {
 const r = await fetch('/api/accounts/vendors', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 name: name.trim(),
 currency: currency.trim() || 'KES',
 contactName: contactName.trim() || null,
 contactEmail: contactEmail.trim() || null,
 contactPhone: contactPhone.trim() || null,
 notes: notes.trim() || null,
 }),
 });
 const j = await r.json().catch(() => ({}));
 if (!r.ok) throw new Error(j.error || `Failed (${r.status})`);
 const id = typeof j.id === 'string' ? j.id : null;
 if (id) router.push(`/dashboard/accounts/vendors/${id}`);
 else router.push('/dashboard/accounts/vendors');
 } catch (err) {
 setError(err instanceof Error ? err.message : 'Could not create vendor');
 } finally {
 setSubmitting(false);
 }
 };

 return (
 <DashboardPage className="max-w-2xl">
 <nav className="mb-4" aria-label="Breadcrumb">
 <ol className="flex flex-wrap items-center gap-1.5 text-sm text-neutral-500">
 <li>
 <Link href="/dashboard/accounts" className="hover:text-primary-700 transition-colors">
 Accounts
 </Link>
 </li>
 <li aria-hidden="true">/</li>
 <li>
 <Link href="/dashboard/accounts/vendors" className="hover:text-primary-700 transition-colors">
 Vendors
 </Link>
 </li>
 <li aria-hidden="true">/</li>
 <li className="text-primary-900 font-medium" aria-current="page">
 New
 </li>
 </ol>
 </nav>
 <DashboardPageHeader
 title="New vendor"
 description="Add a supplier or an internal creditor profile (e.g. petty cash). Bills and payments are created from the vendor page or the bills list."
 className="mb-6"
 />

 {error && (
 <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900 flex gap-2">
 <AlertCircle className="w-5 h-5 shrink-0" />
 {error}
 </div>
 )}

 <form onSubmit={submit} className="space-y-4 dashboard-surface p-6 shadow-sm">
 <div>
 <label htmlFor="name" className="block text-sm font-medium text-neutral-700 mb-1">
 Name <span className="text-red-600">*</span>
 </label>
 <input
 id="name"
 value={name}
 onChange={(e) => setName(e.target.value)}
 className={inputClass}
 placeholder="e.g. Safaricom PLC or Petty cash (internal)"
 required
 />
 </div>
 <div>
 <label htmlFor="currency" className="block text-sm font-medium text-neutral-700 mb-1">
 Default currency
 </label>
 <input
 id="currency"
 value={currency}
 onChange={(e) => setCurrency(e.target.value.toUpperCase())}
 className={inputClass}
 maxLength={8}
 />
 </div>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div>
 <label htmlFor="contactName" className="block text-sm font-medium text-neutral-700 mb-1">
 Contact name
 </label>
 <input
 id="contactName"
 value={contactName}
 onChange={(e) => setContactName(e.target.value)}
 className={inputClass}
 />
 </div>
 <div>
 <label htmlFor="contactEmail" className="block text-sm font-medium text-neutral-700 mb-1">
 Contact email
 </label>
 <input
 id="contactEmail"
 type="email"
 value={contactEmail}
 onChange={(e) => setContactEmail(e.target.value)}
 className={inputClass}
 />
 </div>
 </div>
 <div>
 <label htmlFor="contactPhone" className="block text-sm font-medium text-neutral-700 mb-1">
 Contact phone
 </label>
 <input
 id="contactPhone"
 value={contactPhone}
 onChange={(e) => setContactPhone(e.target.value)}
 className={inputClass}
 />
 </div>
 <div>
 <label htmlFor="notes" className="block text-sm font-medium text-neutral-700 mb-1">
 Notes
 </label>
 <textarea
 id="notes"
 value={notes}
 onChange={(e) => setNotes(e.target.value)}
 rows={3}
 className={inputClass}
 />
 </div>
 <div className="flex flex-wrap gap-2 pt-2">
 <button
 type="submit"
 disabled={submitting}
 className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-primary-900 text-white text-sm font-semibold hover:bg-primary-800 disabled:opacity-60"
 >
 {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
 Create vendor
 </button>
 <Link
 href="/dashboard/accounts/vendors"
 className="inline-flex items-center justify-center px-5 py-2.5 rounded-lg border border-neutral-300 text-sm font-medium text-neutral-800 hover:bg-neutral-50"
 >
 Cancel
 </Link>
 </div>
 </form>
 </DashboardPage>
 );
}
