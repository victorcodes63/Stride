'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DISCIPLINARY_STATUSES, JURISDICTION_POLICIES, getJurisdictionPolicy } from '@/lib/east-africa-hr-policy';

type CaseDetail = {
 id: string;
 caseNumber: string;
 subject: string;
 description: string;
 type: string;
 severity: string;
 status: string;
 laborJurisdiction: string;
 showCauseResponseDueAt: string | null;
 hearingAt: string | null;
 resolution: string | null;
 employee: { firstName: string; lastName: string; employeeNumber: string | null };
 actions: Array<{
 id: string;
 type: string;
 description: string;
 actionDate: string;
 employeeAcknowledged: boolean;
 performedBy: { name: string };
 }>;
 documents: Array<{ id: string; title: string; fileName: string }>;
};

function toLocalInput(iso: string | null) {
 if (!iso) return '';
 const d = new Date(iso);
 if (Number.isNaN(d.getTime())) return '';
 const pad = (n: number) => String(n).padStart(2, '0');
 return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function DisciplinaryCasePage() {
 const params = useParams<{ id: string }>();
 const [data, setData] = useState<CaseDetail | null>(null);
 const [actionType, setActionType] = useState('VERBAL_WARNING');
 const [description, setDescription] = useState('');
 const [error, setError] = useState<string | null>(null);
 const [jurisdiction, setJurisdiction] = useState('KE');
 const [showCauseDue, setShowCauseDue] = useState('');
 const [hearing, setHearing] = useState('');
 const [status, setStatus] = useState('OPEN');
 const [savingMeta, setSavingMeta] = useState(false);
 const [complianceError, setComplianceError] = useState<string | null>(null);

 const load = useCallback(async () => {
 const res = await fetch(`/api/disciplinary/cases/${params.id}`);
 const body = await res.json().catch(() => null);
 if (res.ok && body) {
 setData(body);
 setJurisdiction(body.laborJurisdiction || 'KE');
 setShowCauseDue(toLocalInput(body.showCauseResponseDueAt));
 setHearing(toLocalInput(body.hearingAt));
 setStatus(body.status);
 }
 }, [params.id]);

 useEffect(() => {
 void load();
 }, [load]);

 async function addAction() {
 setError(null);
 const res = await fetch(`/api/disciplinary/cases/${params.id}/actions`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ type: actionType, description }),
 });
 const body = await res.json().catch(() => ({}));
 if (!res.ok) {
 setError(body.error || 'Failed to add action');
 return;
 }
 setDescription('');
 await load();
 }

 async function generateLetter(letterType: string, actionId?: string) {
 await fetch(`/api/disciplinary/cases/${params.id}/generate-letter`, {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({ letterType, actionId }),
 });
 await load();
 }

 async function saveCompliance() {
 if (!data) return;
 setSavingMeta(true);
 setComplianceError(null);
 const res = await fetch(`/api/disciplinary/cases/${params.id}`, {
 method: 'PUT',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 laborJurisdiction: jurisdiction,
 status,
 showCauseResponseDueAt: showCauseDue ? new Date(showCauseDue).toISOString() : null,
 hearingAt: hearing ? new Date(hearing).toISOString() : null,
 }),
 });
 const body = await res.json().catch(() => ({}));
 setSavingMeta(false);
 if (!res.ok) {
 setComplianceError(body.error || 'Save failed');
 return;
 }
 await load();
 }

 if (!data) return <div className="text-sm text-neutral-500">Loading case...</div>;

 const policy = getJurisdictionPolicy(jurisdiction);

 return (
 <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
 <div className="dashboard-stat-card lg:col-span-2">
 <div className="flex flex-wrap items-center gap-2 text-sm">
 <Link href="/dashboard/disciplinary" className="text-primary-700 hover:underline">
 ← All cases
 </Link>
 </div>
 <DashboardPageHeader
 title={`${data.caseNumber} — ${data.subject}`}
 description={`${data.employee.firstName} ${data.employee.lastName} | ${data.type.replaceAll('_', ' ')} | ${data.severity.replaceAll('_', ' ')}`}
 className="mt-2"
 />
 <div className="mt-4 rounded-lg border border-neutral-100 bg-neutral-50 p-3 text-sm text-neutral-800">
 <span className="font-semibold text-primary-900">Allegation / summary</span>
 <p className="mt-2 whitespace-pre-wrap">{data.description}</p>
 </div>
 <div className="mt-4 space-y-3">
 {data.actions.map((action) => (
 <div key={action.id} className="rounded-lg border border-neutral-100 bg-neutral-50 p-3">
 <p className="text-sm font-semibold">
 {new Date(action.actionDate).toLocaleDateString()} — {action.type.replaceAll('_', ' ')}
 </p>
 <p className="text-sm text-neutral-700">{action.description}</p>
 <p className="text-xs text-neutral-500">Issued by {action.performedBy.name} | Acknowledged: {action.employeeAcknowledged ? 'Yes' : 'Pending'}</p>
 <button
 type="button"
 onClick={() => void generateLetter(action.type, action.id)}
 className="mt-2 rounded border border-neutral-300 px-2 py-1 text-xs"
 >
 Generate letter
 </button>
 </div>
 ))}
 </div>
 <div className="mt-4 rounded-lg border border-neutral-100 p-3">
 <p className="text-sm font-semibold">Add action</p>
 <div className="mt-2 flex flex-wrap gap-2">
 <select value={actionType} onChange={(e) => setActionType(e.target.value)} className="rounded border border-neutral-300 px-2 py-1 text-sm">
 {[
 'VERBAL_WARNING',
 'WRITTEN_WARNING',
 'FINAL_WARNING',
 'SHOW_CAUSE_LETTER',
 'HEARING',
 'SUSPENSION',
 'DEMOTION',
 'TERMINATION',
 'CASE_DISMISSED',
 ].map((t) => (
 <option key={t} value={t}>
 {t.replaceAll('_', ' ')}
 </option>
 ))}
 </select>
 <input
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 className="min-w-[12rem] flex-1 rounded border border-neutral-300 px-2 py-1 text-sm"
 placeholder="Action details"
 />
 <button type="button" onClick={() => void addAction()} className="rounded bg-primary-900 px-3 py-1 text-sm text-white">
 Save
 </button>
 </div>
 {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
 </div>
 </div>
 <div className="space-y-4">
 <div className="dashboard-stat-card">
 <p className="text-sm font-semibold text-primary-900">Documents</p>
 <div className="mt-2 space-y-2">
 {data.documents.length === 0 ? (
 <p className="text-xs text-neutral-500">No documents yet. Generate a letter or upload from the API.</p>
 ) : (
 data.documents.map((doc) => (
 <a
 key={doc.id}
 className="block text-sm text-primary-700 hover:underline"
 href={`/api/disciplinary/cases/${data.id}/documents/${doc.id}`}
 >
 {doc.title} ({doc.fileName})
 </a>
 ))
 )}
 </div>
 </div>
 <div className="dashboard-stat-card">
 <p className="text-sm font-semibold text-primary-900">Case status & fair process dates</p>
 <p className="mt-1 text-xs text-neutral-500">Align with your registered HR policy; dates appear on the employee portal.</p>
 <div className="mt-3 space-y-2 text-sm">
 <label className="block text-xs font-medium text-neutral-600">Status</label>
 <select className="w-full rounded border border-neutral-300 px-2 py-1.5" value={status} onChange={(e) => setStatus(e.target.value)}>
 {DISCIPLINARY_STATUSES.map((s) => (
 <option key={s} value={s}>
 {s.replaceAll('_', ' ')}
 </option>
 ))}
 </select>
 <label className="block text-xs font-medium text-neutral-600">Labour jurisdiction (letter text & SLAs)</label>
 <select className="w-full rounded border border-neutral-300 px-2 py-1.5" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)}>
 {(Object.keys(JURISDICTION_POLICIES) as Array<keyof typeof JURISDICTION_POLICIES>).map((code) => (
 <option key={code} value={code}>
 {JURISDICTION_POLICIES[code].label}
 </option>
 ))}
 </select>
 <label className="block text-xs font-medium text-neutral-600">Show-cause response due</label>
 <input
 type="datetime-local"
 className="w-full rounded border border-neutral-300 px-2 py-1.5"
 value={showCauseDue}
 onChange={(e) => setShowCauseDue(e.target.value)}
 />
 <label className="block text-xs font-medium text-neutral-600">Hearing</label>
 <input
 type="datetime-local"
 className="w-full rounded border border-neutral-300 px-2 py-1.5"
 value={hearing}
 onChange={(e) => setHearing(e.target.value)}
 />
 {complianceError ? <p className="text-xs text-red-600">{complianceError}</p> : null}
 <button
 type="button"
 disabled={savingMeta}
 onClick={() => void saveCompliance()}
 className="w-full rounded bg-primary-900 py-2 text-sm text-white disabled:opacity-50"
 >
 {savingMeta ? 'Saving…' : 'Save compliance fields'}
 </button>
 </div>
 </div>
 <div className="rounded-xl border border-amber-100 bg-amber-50 p-4 text-xs text-amber-950">
 <p className="font-semibold text-amber-950">Checklist — {policy.label}</p>
 <ul className="mt-2 list-inside list-disc space-y-1">
 {policy.fairProcessBullets.map((b) => (
 <li key={b}>{b}</li>
 ))}
 </ul>
 <p className="mt-3 text-amber-900/90">
 Not legal advice. Configure <code className="rounded bg-amber-100/80 px-1">laborJurisdiction</code> and internal policy to match the employee’s contract and work location.
 </p>
 </div>
 </div>
 </div>
 );
}
