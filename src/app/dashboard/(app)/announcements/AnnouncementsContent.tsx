'use client';

import { useCallback, useEffect, useState } from 'react';
import { Megaphone, Loader2, AlertCircle, Plus, Pin, Clock, Send, Archive } from 'lucide-react';
import { motion } from 'framer-motion';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

type AnnouncementRow = {
 id: string;
 title: string;
 body: string;
 status: string;
 priority: string;
 authorUserId: string;
 publishedAt: string | null;
 expiresAt: string | null;
 isPinned: boolean;
 createdAt: string;
};

const PRIORITY_STYLES: Record<string, string> = {
 low: 'bg-neutral-100 text-neutral-600',
 normal: 'bg-blue-50 text-blue-700',
 high: 'bg-amber-50 text-amber-800',
 urgent: 'bg-red-50 text-red-800',
};

const STATUS_STYLES: Record<string, string> = {
 draft: 'bg-neutral-100 text-neutral-600',
 published: 'bg-emerald-50 text-emerald-800',
 archived: 'bg-neutral-100 text-neutral-500',
};

export default function AnnouncementsContent() {
 const [announcements, setAnnouncements] = useState<AnnouncementRow[] | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [showForm, setShowForm] = useState(false);
 const [submitting, setSubmitting] = useState(false);
 const [filter, setFilter] = useState('');

 const [form, setForm] = useState({
 title: '', body: '', priority: 'normal', isPinned: false, status: 'published',
 });

 const load = useCallback(() => {
 setLoading(true);
 setError(null);
 const q = filter ? `?status=${filter}` : '';
 fetch(`/api/announcements${q}`)
 .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Failed'); return d; })
 .then((d) => setAnnouncements(d.announcements ?? []))
 .catch((e) => { setError(e instanceof Error ? e.message : 'Failed'); setAnnouncements([]); })
 .finally(() => setLoading(false));
 }, [filter]);

 useEffect(() => { load(); }, [load]);

 const submit = async () => {
 if (!form.title.trim() || !form.body.trim()) return;
 setSubmitting(true);
 try {
 const res = await fetch('/api/announcements', {
 method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
 });
 if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed'); }
 setShowForm(false);
 setForm({ title: '', body: '', priority: 'normal', isPinned: false, status: 'published' });
 load();
 } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
 finally { setSubmitting(false); }
 };

 return (
 <DashboardPage>
 <DashboardPageHeader
 title="Announcements"
 icon={Megaphone}
 description="Company-wide notices and updates."
 actions={
 <button
 type="button"
 onClick={() => setShowForm(!showForm)}
 className="btn-primary inline-flex shrink-0 items-center gap-2"
 >
 <Plus className="h-4 w-4" /> New announcement
 </button>
 }
 />

 {showForm && (
 <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
 className="rounded-xl border border-primary-200 bg-primary-50/30 p-5 mb-6 space-y-4">
 <h3 className="font-bold text-primary-900">New Announcement</h3>
 <input placeholder="Title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
 className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
 <textarea placeholder="Message body *" rows={4} value={form.body}
 onChange={(e) => setForm({ ...form, body: e.target.value })}
 className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm resize-y" />
 <div className="flex flex-wrap gap-3 items-center">
 <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}
 className="px-3 py-2 rounded-lg border border-neutral-300 text-sm bg-white">
 <option value="low">Low priority</option>
 <option value="normal">Normal</option>
 <option value="high">High priority</option>
 <option value="urgent">Urgent</option>
 </select>
 <label className="flex items-center gap-2 text-sm">
 <input type="checkbox" checked={form.isPinned} onChange={(e) => setForm({ ...form, isPinned: e.target.checked })}
 className="rounded border-neutral-300" />
 Pin to top
 </label>
 <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
 className="px-3 py-2 rounded-lg border border-neutral-300 text-sm bg-white">
 <option value="published">Publish now</option>
 <option value="draft">Save as draft</option>
 </select>
 </div>
 <div className="flex gap-2">
 <button onClick={submit} disabled={submitting}
 className="px-5 py-2 rounded-lg bg-primary-900 text-white text-sm font-semibold hover:bg-primary-800 disabled:opacity-50">
 {submitting ? 'Publishing…' : form.status === 'draft' ? 'Save draft' : 'Publish'}
 </button>
 <button onClick={() => setShowForm(false)}
 className="px-5 py-2 rounded-lg border border-neutral-300 text-sm font-semibold hover:bg-neutral-50">Cancel</button>
 </div>
 </motion.div>
 )}

 <div className="flex gap-2 mb-5 flex-wrap">
 {['', 'published', 'draft', 'archived'].map((s) => (
 <button key={s} onClick={() => setFilter(s)}
 className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filter === s ? 'bg-primary-900 text-white' : 'bg-white border border-neutral-300 text-neutral-600 hover:bg-neutral-50'}`}>
 {s || 'All'}
 </button>
 ))}
 </div>

 {loading && <div className="flex items-center gap-2 text-neutral-600 py-12 justify-center"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>}
 {!loading && error && (
 <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-3 items-start">
 <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /><p>{error}</p>
 </div>
 )}

 {!loading && !error && announcements && announcements.length === 0 && (
 <div className="dashboard-surface p-8 text-center text-sm text-neutral-500">
 No announcements yet. Create one to keep your team informed.
 </div>
 )}

 {!loading && !error && announcements && announcements.length > 0 && (
 <div className="space-y-3">
 {announcements.map((a, idx) => (
 <motion.div key={a.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.03 }}
 className={`dashboard-surface p-5 transition-colors ${a.isPinned ? 'border-primary-200 bg-primary-50/20' : 'border-neutral-200 hover:border-neutral-300'}`}>
 <div className="flex items-start gap-3">
 <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center shrink-0">
 {a.isPinned ? <Pin className="w-5 h-5 text-primary-700" /> : <Megaphone className="w-5 h-5 text-primary-700" />}
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 flex-wrap mb-1">
 <h3 className="font-bold text-primary-900">{a.title}</h3>
 <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${PRIORITY_STYLES[a.priority] || ''}`}>{a.priority}</span>
 <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${STATUS_STYLES[a.status] || ''}`}>{a.status}</span>
 {a.isPinned && <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-primary-100 text-primary-800">pinned</span>}
 </div>
 <p className="text-sm text-neutral-600 line-clamp-3 whitespace-pre-wrap">{a.body}</p>
 <p className="text-xs text-neutral-400 mt-2">
 {a.publishedAt ? `Published ${new Date(a.publishedAt).toLocaleDateString()}` : `Created ${new Date(a.createdAt).toLocaleDateString()}`}
 {a.expiresAt && ` · Expires ${new Date(a.expiresAt).toLocaleDateString()}`}
 </p>
 </div>
 </div>
 </motion.div>
 ))}
 </div>
 )}
 </DashboardPage>
 );
}
