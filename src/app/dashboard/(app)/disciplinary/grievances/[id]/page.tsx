'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { GRIEVANCE_STATUSES, getJurisdictionPolicy } from '@/lib/east-africa-hr-policy';

type GrievanceDetail = {
 id: string;
 grievanceNumber: string;
 status: string;
 subject: string;
 description: string;
 category: string;
 investigationNotes: string | null;
 resolution: string | null;
 submittedAt: string;
 employee: { firstName: string; lastName: string; email: string | null };
 against: { firstName: string; lastName: string } | null;
};

export default function AdminGrievanceDetailPage() {
 const params = useParams<{ id: string }>();
 const router = useRouter();
 const [data, setData] = useState<GrievanceDetail | null>(null);
 const [status, setStatus] = useState('');
 const [investigationNotes, setInvestigationNotes] = useState('');
 const [resolution, setResolution] = useState('');
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState<string | null>(null);

 async function load() {
 const res = await fetch(`/api/grievances/${params.id}`);
 const body = await res.json().catch(() => null);
 if (!res.ok) {
 setError(body?.error || 'Not found');
 return;
 }
 setData(body);
 setStatus(body.status);
 setInvestigationNotes(body.investigationNotes || '');
 setResolution(body.resolution || '');
 }

 useEffect(() => {
 void load();
 }, [params.id]);

 async function save() {
 if (!data) return;
 setSaving(true);
 setError(null);
 const res = await fetch(`/api/grievances/${data.id}`, {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 status,
 investigationNotes,
 ...(resolution.trim() ? { resolution: resolution.trim() } : {}),
 }),
 });
 setSaving(false);
 if (!res.ok) {
 const b = await res.json().catch(() => ({}));
 setError(b.error || 'Save failed');
 return;
 }
 await load();
 }

 if (error && !data) {
 return (
 <div className="space-y-2 text-sm">
 <p className="text-red-600">{error}</p>
 <Link href="/dashboard/disciplinary" className="text-primary-700 underline">
 Back
 </Link>
 </div>
 );
 }

 if (!data) return <p className="text-sm text-neutral-500">Loading...</p>;

 const policy = getJurisdictionPolicy('KE');

 return (
 <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
 <div className="space-y-4 lg:col-span-2">
 <div className="flex flex-wrap items-center gap-2 text-sm">
 <Link href="/dashboard/disciplinary" className="text-primary-700 hover:underline">
 ← Disciplinary & grievances
 </Link>
 </div>
 <DashboardPageHeader
 title={`${data.grievanceNumber} — ${data.subject}`}
 description={
 <>
 Raised by {data.employee.firstName} {data.employee.lastName}
 {data.against ? (
 <>
 {' '}
 · Regarding {data.against.firstName} {data.against.lastName}
 </>
 ) : null}
 </>
 }
 />
 <div className="dashboard-stat-card">
 <p className="text-sm font-semibold text-primary-900">Description</p>
 <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-800">{data.description}</p>
 </div>
 <div className="dashboard-stat-card">
 <p className="text-sm font-semibold text-primary-900">Investigation & outcome</p>
 <div className="mt-2 space-y-2">
 <label className="block text-xs font-medium text-neutral-600">Status</label>
 <select
 className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
 value={status}
 onChange={(e) => setStatus(e.target.value)}
 >
 {GRIEVANCE_STATUSES.map((s) => (
 <option key={s} value={s}>
 {s.replaceAll('_', ' ')}
 </option>
 ))}
 </select>
 <label className="block text-xs font-medium text-neutral-600">Investigation notes (internal)</label>
 <textarea
 className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
 rows={5}
 value={investigationNotes}
 onChange={(e) => setInvestigationNotes(e.target.value)}
 />
 <label className="block text-xs font-medium text-neutral-600">Resolution (shared with employee when closing)</label>
 <textarea
 className="w-full rounded border border-neutral-300 px-3 py-2 text-sm"
 rows={4}
 value={resolution}
 onChange={(e) => setResolution(e.target.value)}
 placeholder="Outcome summary for the employee portal notification"
 />
 {error ? <p className="text-xs text-red-600">{error}</p> : null}
 <button
 type="button"
 disabled={saving}
 onClick={() => void save()}
 className="rounded bg-primary-900 px-4 py-2 text-sm text-white disabled:opacity-60"
 >
 {saving ? 'Saving…' : 'Save'}
 </button>
 </div>
 </div>
 </div>
 <div className="space-y-4">
 <div className="dashboard-stat-card text-sm">
 <p className="font-semibold text-primary-900">Meta</p>
 <dl className="mt-2 space-y-1 text-xs text-neutral-600">
 <div>Submitted: {new Date(data.submittedAt).toLocaleString()}</div>
 <div>Category: {data.category.replaceAll('_', ' ')}</div>
 </dl>
 </div>
 <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-xs text-amber-950">
 <p className="font-semibold">Grievance handling (East Africa)</p>
 <ul className="mt-2 list-inside list-disc space-y-1">
 {policy.grievanceBullets.map((b) => (
 <li key={b}>{b}</li>
 ))}
 </ul>
 <p className="mt-3 text-amber-900/85">
 Align timelines with the employer’s registered HR policy and any collective agreement. Escalate to labour offices only after internal steps where required.
 </p>
 </div>
 <button
 type="button"
 onClick={() => router.push('/dashboard/disciplinary')}
 className="w-full rounded border border-neutral-300 py-2 text-sm text-neutral-700"
 >
 Close
 </button>
 </div>
 </div>
 );
}
