'use client';

import { useCallback, useEffect, useState } from 'react';
import { GraduationCap, Loader2, AlertCircle, Plus, Users, Clock, CheckCircle, Globe, MapPin, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { DashboardStatCard, DashboardStatGrid } from '@/components/dashboard/DashboardStatGrid';

type ProgramRow = {
 id: string;
 title: string;
 description: string | null;
 category: string | null;
 provider: string | null;
 location: string | null;
 isOnline: boolean;
 startDate: string | null;
 endDate: string | null;
 durationHours: number | null;
 maxParticipants: number | null;
 cost: number | null;
 currency: string;
 status: string;
 enrollmentCount: number;
 completedCount: number;
 materialCount: number;
 createdAt: string;
};

const STATUS_STYLES: Record<string, string> = {
 scheduled: 'bg-blue-50 text-blue-800',
 in_progress: 'bg-amber-50 text-amber-800',
 completed: 'bg-emerald-50 text-emerald-800',
 cancelled: 'bg-neutral-100 text-neutral-500',
};

export default function TrainingContent() {
 const [programs, setPrograms] = useState<ProgramRow[] | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [showForm, setShowForm] = useState(false);
 const [submitting, setSubmitting] = useState(false);

 const [form, setForm] = useState({
 title: '', description: '', category: '', provider: '', location: '',
 isOnline: false, startDate: '', endDate: '', durationHours: '', maxParticipants: '', cost: '',
 });

 const load = useCallback(() => {
 setLoading(true);
 setError(null);
 fetch('/api/training')
 .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Failed'); return d; })
 .then((d) => setPrograms(d.programs ?? []))
 .catch((e) => { setError(e instanceof Error ? e.message : 'Failed'); setPrograms([]); })
 .finally(() => setLoading(false));
 }, []);

 useEffect(() => { load(); }, [load]);

 const submit = async () => {
 if (!form.title.trim()) return;
 setSubmitting(true);
 try {
 const res = await fetch('/api/training', {
 method: 'POST', headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 ...form,
 durationHours: form.durationHours ? Number(form.durationHours) : null,
 maxParticipants: form.maxParticipants ? Number(form.maxParticipants) : null,
 cost: form.cost ? Number(form.cost) : null,
 }),
 });
 if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed'); }
 setShowForm(false);
 setForm({ title: '', description: '', category: '', provider: '', location: '', isOnline: false, startDate: '', endDate: '', durationHours: '', maxParticipants: '', cost: '' });
 load();
 } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
 finally { setSubmitting(false); }
 };

 const stats = programs ? {
 total: programs.length,
 active: programs.filter((p) => p.status === 'in_progress' || p.status === 'scheduled').length,
 totalEnrolled: programs.reduce((s, p) => s + p.enrollmentCount, 0),
 totalCompleted: programs.reduce((s, p) => s + p.completedCount, 0),
 } : null;

 return (
 <DashboardPage>
 <DashboardPageHeader
 title="Training & Development"
 icon={GraduationCap}
 description="Manage training programs and enrollments."
 actions={
 <button
 type="button"
 onClick={() => setShowForm(!showForm)}
 className="btn-primary inline-flex shrink-0 items-center gap-2"
 >
 <Plus className="h-4 w-4" /> New program
 </button>
 }
 />

 {stats ? (
 <DashboardStatGrid>
 <DashboardStatCard label="Total programs" value={stats.total} tone="primary" />
 <DashboardStatCard label="Active" value={stats.active} tone="sky" />
 <DashboardStatCard label="Enrolled" value={stats.totalEnrolled} tone="violet" />
 <DashboardStatCard label="Completed" value={stats.totalCompleted} tone="success" />
 </DashboardStatGrid>
 ) : null}

 {showForm && (
 <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
 className="rounded-xl border border-primary-200 bg-primary-50/30 p-5 mb-6 space-y-4">
 <h3 className="font-bold text-primary-900">New Training Program</h3>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <input placeholder="Program title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
 className="px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
 <input placeholder="Category (e.g. Leadership, Technical)" value={form.category}
 onChange={(e) => setForm({ ...form, category: e.target.value })}
 className="px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
 </div>
 <textarea placeholder="Description" rows={2} value={form.description}
 onChange={(e) => setForm({ ...form, description: e.target.value })}
 className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm resize-y" />
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
 <input placeholder="Provider" value={form.provider} onChange={(e) => setForm({ ...form, provider: e.target.value })}
 className="px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
 <input placeholder="Location" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
 className="px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
 <label className="flex items-center gap-2 text-sm px-3 py-2">
 <input type="checkbox" checked={form.isOnline} onChange={(e) => setForm({ ...form, isOnline: e.target.checked })} className="rounded border-neutral-300" />
 Online / virtual
 </label>
 </div>
 <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
 <input type="date" placeholder="Start date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })}
 className="px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
 <input type="date" placeholder="End date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })}
 className="px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
 <input type="number" placeholder="Duration (hrs)" value={form.durationHours} onChange={(e) => setForm({ ...form, durationHours: e.target.value })}
 className="px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
 <input type="number" placeholder="Max participants" value={form.maxParticipants} onChange={(e) => setForm({ ...form, maxParticipants: e.target.value })}
 className="px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
 </div>
 <div className="flex gap-2">
 <button onClick={submit} disabled={submitting}
 className="px-5 py-2 rounded-lg bg-primary-900 text-white text-sm font-semibold hover:bg-primary-800 disabled:opacity-50">
 {submitting ? 'Creating…' : 'Create program'}
 </button>
 <button onClick={() => setShowForm(false)} className="px-5 py-2 rounded-lg border border-neutral-300 text-sm font-semibold hover:bg-neutral-50">Cancel</button>
 </div>
 </motion.div>
 )}

 {loading && <div className="flex items-center gap-2 text-neutral-600 py-12 justify-center"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>}
 {!loading && error && (
 <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-3 items-start">
 <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /><p>{error}</p>
 </div>
 )}

 {!loading && !error && programs && programs.length === 0 && (
 <div className="dashboard-surface p-8 text-center text-sm text-neutral-500">
 No training programs yet. Create one to start developing your team.
 </div>
 )}

 {!loading && !error && programs && programs.length > 0 && (
 <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
 {programs.map((p, idx) => (
 <motion.div key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}
 className="dashboard-surface p-5 hover:border-neutral-300 transition-colors">
 <div className="flex items-start justify-between gap-2 mb-3">
 <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center shrink-0">
 <GraduationCap className="w-5 h-5 text-primary-700" />
 </div>
 <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_STYLES[p.status] || 'bg-neutral-100 text-neutral-700'}`}>
 {p.status.replace('_', ' ')}
 </span>
 </div>
 <h3 className="font-bold text-primary-900 mb-1">{p.title}</h3>
 {p.description && <p className="text-sm text-neutral-600 line-clamp-2 mb-3">{p.description}</p>}
 <div className="space-y-1.5 text-xs text-neutral-500">
 {p.category && <div className="flex items-center gap-1.5"><GraduationCap className="w-3.5 h-3.5" /> {p.category}</div>}
 {p.provider && <div className="flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> {p.provider}</div>}
 <div className="flex items-center gap-1.5">
 {p.isOnline ? <Globe className="w-3.5 h-3.5" /> : <MapPin className="w-3.5 h-3.5" />}
 {p.isOnline ? 'Online' : p.location || 'TBD'}
 </div>
 {p.startDate && <div className="flex items-center gap-1.5"><Calendar className="w-3.5 h-3.5" /> {p.startDate}{p.endDate ? ` – ${p.endDate}` : ''}</div>}
 </div>
 <div className="flex items-center gap-3 mt-3 pt-3 border-t border-neutral-100">
 <span className="text-xs text-neutral-500"><Users className="w-3.5 h-3.5 inline mr-1" />{p.enrollmentCount} enrolled</span>
 <span className="text-xs text-emerald-600"><CheckCircle className="w-3.5 h-3.5 inline mr-1" />{p.completedCount} completed</span>
 {p.durationHours && <span className="text-xs text-neutral-500"><Clock className="w-3.5 h-3.5 inline mr-1" />{p.durationHours}h</span>}
 </div>
 </motion.div>
 ))}
 </div>
 )}
 </DashboardPage>
 );
}
