'use client';

import { useEffect, useMemo, useState } from 'react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

type Holiday = {
 id: string;
 name: string;
 date: string | null;
 recurring: boolean;
 recurDay: number | null;
 recurMonth: number | null;
 notes: string | null;
 isActive: boolean;
};

type ResolvedHoliday = { date: string; name: string };

type FormState = {
 id: string | null;
 name: string;
 recurring: boolean;
 date: string;
 recurDay: number;
 recurMonth: number;
 notes: string;
 isActive: boolean;
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function emptyForm(): FormState {
 return {
 id: null,
 name: '',
 recurring: false,
 date: '',
 recurDay: 1,
 recurMonth: 1,
 notes: '',
 isActive: true,
 };
}

export default function AdminHolidaysPage() {
 const [year, setYear] = useState(new Date().getFullYear());
 const [view, setView] = useState<'calendar' | 'table'>('calendar');
 const [rows, setRows] = useState<Holiday[]>([]);
 const [resolved, setResolved] = useState<ResolvedHoliday[]>([]);
 const [form, setForm] = useState<FormState>(emptyForm);
 const [loading, setLoading] = useState(true);
 const [saving, setSaving] = useState(false);
 const [error, setError] = useState<string | null>(null);

 async function load() {
 setLoading(true);
 setError(null);
 try {
 const [rowsRes, yearRes] = await Promise.all([
 fetch('/api/admin/holidays', { cache: 'no-store' }),
 fetch(`/api/admin/holidays/year/${year}`, { cache: 'no-store' }),
 ]);
 const rowsJson = await rowsRes.json();
 const yearJson = await yearRes.json();
 if (!rowsRes.ok) throw new Error(rowsJson.error || 'Failed to load holidays.');
 if (!yearRes.ok) throw new Error(yearJson.error || 'Failed to resolve yearly holidays.');
 setRows(Array.isArray(rowsJson) ? rowsJson : []);
 setResolved(
 (Array.isArray(yearJson) ? yearJson : []).map((item: { date: string; name: string }) => ({
 date: item.date.slice(0, 10),
 name: item.name,
 }))
 );
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to load holidays.');
 } finally {
 setLoading(false);
 }
 }

 useEffect(() => {
 void load();
 }, [year]);

 const byDate = useMemo(() => {
 const map = new Map<string, string[]>();
 for (const item of resolved) {
 const bucket = map.get(item.date) ?? [];
 bucket.push(item.name);
 map.set(item.date, bucket);
 }
 return map;
 }, [resolved]);

 async function saveHoliday() {
 setSaving(true);
 setError(null);
 try {
 const payload = {
 name: form.name,
 recurring: form.recurring,
 date: form.recurring ? null : form.date,
 recurDay: form.recurring ? form.recurDay : null,
 recurMonth: form.recurring ? form.recurMonth : null,
 notes: form.notes || null,
 isActive: form.isActive,
 };
 const res = await fetch(
 form.id ? `/api/admin/holidays/${form.id}` : '/api/admin/holidays',
 {
 method: form.id ? 'PUT' : 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify(payload),
 }
 );
 const json = await res.json();
 if (!res.ok) throw new Error(json.error || 'Failed to save holiday.');
 setForm(emptyForm());
 await load();
 } catch (e) {
 setError(e instanceof Error ? e.message : 'Failed to save holiday.');
 } finally {
 setSaving(false);
 }
 }

 async function deactivateHoliday(id: string) {
 const res = await fetch(`/api/admin/holidays/${id}`, { method: 'DELETE' });
 if (!res.ok) {
 const json = await res.json().catch(() => ({}));
 setError(json.error || 'Failed to deactivate holiday.');
 return;
 }
 await load();
 }

 return (
 <DashboardPage className="space-y-4">
 <DashboardPageHeader
 title="Public holidays"
 description="System-wide holiday calendar for automatic overtime rates."
 actions={
 <div className="flex items-center gap-2">
 <button type="button" onClick={() => setYear((v) => v - 1)} className="rounded border border-neutral-300 px-3 py-1 text-sm">Prev</button>
 <span className="min-w-16 text-center font-semibold">{year}</span>
 <button type="button" onClick={() => setYear((v) => v + 1)} className="rounded border border-neutral-300 px-3 py-1 text-sm">Next</button>
 <button type="button" onClick={() => setView((v) => (v === 'calendar' ? 'table' : 'calendar'))} className="rounded bg-primary-700 px-3 py-1 text-sm text-white">
 {view === 'calendar' ? 'Table view' : 'Calendar view'}
 </button>
 </div>
 }
 />

 {error ? <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}

 <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
 <div className="dashboard-stat-card">
 {loading ? (
 <p className="text-sm text-neutral-500">Loading holidays...</p>
 ) : view === 'table' ? (
 <table className="data-table dashboard-data-table w-full text-sm">
 <thead className="bg-neutral-50 text-neutral-600">
 <tr>
 <th className="col-center px-2 py-2">Date</th>
 <th className="px-2 py-2">Name</th>
 <th className="col-center px-2 py-2">Type</th>
 <th className="col-center px-2 py-2">Status</th>
 <th className="col-right px-2 py-2">Actions</th>
 </tr>
 </thead>
 <tbody>
 {rows.map((r) => (
 <tr key={r.id} className="border-t border-neutral-100">
 <td className="col-center px-2 py-2 tabular-nums">{r.recurring ? `${r.recurDay} ${MONTH_NAMES[(r.recurMonth ?? 1) - 1]}` : (r.date?.slice(0, 10) ?? '—')}</td>
 <td className="px-2 py-2">{r.name}</td>
 <td className="col-center px-2 py-2">{r.recurring ? 'Recurring' : 'Specific'}</td>
 <td className="col-center px-2 py-2">{r.isActive ? 'Active' : 'Inactive'}</td>
 <td className="col-right px-2 py-2">
 <div className="flex gap-2">
 <button type="button" onClick={() => setForm({
 id: r.id,
 name: r.name,
 recurring: r.recurring,
 date: r.date?.slice(0, 10) ?? '',
 recurDay: r.recurDay ?? 1,
 recurMonth: r.recurMonth ?? 1,
 notes: r.notes ?? '',
 isActive: r.isActive,
 })} className="rounded border border-neutral-300 px-2 py-1 text-xs">Edit</button>
 <button type="button" onClick={() => void deactivateHoliday(r.id)} className="rounded border border-red-300 px-2 py-1 text-xs text-red-700">Deactivate</button>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 ) : (
 <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
 {Array.from({ length: 12 }, (_, idx) => idx + 1).map((month) => {
 const first = new Date(Date.UTC(year, month - 1, 1));
 const startDow = first.getUTCDay();
 const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
 return (
 <div key={month} className="rounded border border-neutral-200 p-2">
 <p className="mb-2 text-sm font-semibold">{MONTH_NAMES[month - 1]}</p>
 <div className="grid grid-cols-7 gap-1 text-[11px]">
 {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => <div key={`${month}-dow-${i}`} className="text-center text-neutral-500">{d}</div>)}
 {Array.from({ length: startDow }).map((_, i) => <div key={`${month}-blank-${i}`} />)}
 {Array.from({ length: days }, (_, i) => i + 1).map((d) => {
 const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
 const names = byDate.get(dateKey) ?? [];
 return (
 <button
 key={dateKey}
 type="button"
 title={names.join(', ')}
 onClick={() => setForm((f) => ({ ...f, recurring: false, date: dateKey }))}
 className={`rounded px-1 py-1 text-center ${names.length ? 'bg-primary-100 text-primary-800' : 'hover:bg-neutral-100'}`}
 >
 {d}{names.length ? '•' : ''}
 </button>
 );
 })}
 </div>
 </div>
 );
 })}
 </div>
 )}
 </div>

 <div className="dashboard-stat-card">
 <h2 className="mb-2 text-sm font-semibold">{form.id ? 'Edit holiday' : 'Add holiday'}</h2>
 <div className="space-y-2 text-sm">
 <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Holiday name" className="h-9 w-full rounded border border-neutral-300 px-2" />
 <label className="inline-flex items-center gap-2">
 <input type="checkbox" checked={form.recurring} onChange={(e) => setForm((f) => ({ ...f, recurring: e.target.checked }))} />
 Recurring annual holiday
 </label>
 {form.recurring ? (
 <div className="grid grid-cols-2 gap-2">
 <input type="number" min={1} max={31} value={form.recurDay} onChange={(e) => setForm((f) => ({ ...f, recurDay: Number(e.target.value) }))} className="h-9 rounded border border-neutral-300 px-2" />
 <select value={form.recurMonth} onChange={(e) => setForm((f) => ({ ...f, recurMonth: Number(e.target.value) }))} className="h-9 rounded border border-neutral-300 px-2">
 {MONTH_NAMES.map((m, idx) => <option key={m} value={idx + 1}>{m}</option>)}
 </select>
 </div>
 ) : (
 <input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} className="h-9 w-full rounded border border-neutral-300 px-2" />
 )}
 <textarea value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional)" className="min-h-20 w-full rounded border border-neutral-300 p-2" />
 <label className="inline-flex items-center gap-2">
 <input type="checkbox" checked={form.isActive} onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))} />
 Active
 </label>
 <div className="flex gap-2">
 <button type="button" disabled={saving} onClick={() => void saveHoliday()} className="rounded bg-primary-700 px-3 py-2 text-white disabled:opacity-60">
 {saving ? 'Saving...' : form.id ? 'Update' : 'Create'}
 </button>
 <button type="button" onClick={() => setForm(emptyForm())} className="rounded border border-neutral-300 px-3 py-2">Reset</button>
 </div>
 </div>
 </div>
 </div>
 </DashboardPage>
 );
}
