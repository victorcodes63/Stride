'use client';

import { useCallback, useEffect, useState } from 'react';
import { FolderOpen, Loader2, AlertCircle, Plus, FileText, File, FileImage, Calendar, Download, Tag } from 'lucide-react';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { motion } from 'framer-motion';

type DocRow = {
 id: string;
 title: string;
 description: string | null;
 category: string;
 fileName: string;
 fileSize: number | null;
 mimeType: string | null;
 version: string | null;
 status: string;
 isPublic: boolean;
 department: string | null;
 tags: string[] | null;
 effectiveDate: string | null;
 expiryDate: string | null;
 createdAt: string;
 updatedAt: string;
};

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
 policy: FileText,
 procedure: FileText,
 template: File,
 handbook: FileText,
 form: File,
 guideline: FileText,
};

const CATEGORIES = ['All', 'Policy', 'Procedure', 'Template', 'Handbook', 'Form', 'Guideline', 'SOP', 'Manual', 'Other'];

function fmtSize(bytes: number | null): string {
 if (!bytes) return '';
 if (bytes < 1024) return `${bytes} B`;
 if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
 return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CompanyDocumentsContent() {
 const [documents, setDocuments] = useState<DocRow[] | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [category, setCategory] = useState('All');
 const [search, setSearch] = useState('');
 const [showForm, setShowForm] = useState(false);
 const [submitting, setSubmitting] = useState(false);

 const [form, setForm] = useState({
 title: '', description: '', category: 'Policy', filePath: '/uploads/placeholder.pdf',
 fileName: 'document.pdf', department: '', version: '1.0',
 });

 const load = useCallback(() => {
 setLoading(true);
 setError(null);
 const q = category !== 'All' ? `?category=${category}` : '';
 fetch(`/api/company-documents${q}`)
 .then(async (r) => { const d = await r.json().catch(() => ({})); if (!r.ok) throw new Error(d.error || 'Failed'); return d; })
 .then((d) => setDocuments(d.documents ?? []))
 .catch((e) => { setError(e instanceof Error ? e.message : 'Failed'); setDocuments([]); })
 .finally(() => setLoading(false));
 }, [category]);

 useEffect(() => { load(); }, [load]);

 const filtered = documents
 ? documents.filter((d) => {
 if (!search.trim()) return true;
 const q = search.toLowerCase();
 return d.title.toLowerCase().includes(q) || (d.description?.toLowerCase().includes(q)) || d.category.toLowerCase().includes(q);
 })
 : [];

 const submit = async () => {
 if (!form.title.trim() || !form.category.trim()) return;
 setSubmitting(true);
 try {
 const res = await fetch('/api/company-documents', {
 method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
 });
 if (!res.ok) { const d = await res.json().catch(() => ({})); throw new Error(d.error || 'Failed'); }
 setShowForm(false);
 setForm({ title: '', description: '', category: 'Policy', filePath: '/uploads/placeholder.pdf', fileName: 'document.pdf', department: '', version: '1.0' });
 load();
 } catch (e) { setError(e instanceof Error ? e.message : 'Failed'); }
 finally { setSubmitting(false); }
 };

 const categories = [...new Set(documents?.map((d) => d.category) ?? [])];

 return (
 <DashboardPage>
 <DashboardPageHeader
 title="Company Documents"
 icon={FolderOpen}
 iconClassName="h-7 w-7 shrink-0 text-primary-700"
 description="Policies, SOPs, handbooks, and shared company documents."
 actions={
 <button
 type="button"
 onClick={() => setShowForm(!showForm)}
 className="btn-primary inline-flex shrink-0 items-center gap-2"
 >
 <Plus className="h-4 w-4" /> Upload document
 </button>
 }
 className="mb-6"
 />

 {showForm && (
 <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
 className="rounded-xl border border-primary-200 bg-primary-50/30 p-5 mb-6 space-y-4">
 <h3 className="font-bold text-primary-900">Upload Document</h3>
 <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
 <input placeholder="Document title *" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
 className="px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
 <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}
 className="px-3 py-2 rounded-lg border border-neutral-300 text-sm bg-white">
 {CATEGORIES.filter((c) => c !== 'All').map((c) => <option key={c} value={c}>{c}</option>)}
 </select>
 </div>
 <textarea placeholder="Description" rows={2} value={form.description}
 onChange={(e) => setForm({ ...form, description: e.target.value })}
 className="w-full px-3 py-2 rounded-lg border border-neutral-300 text-sm resize-y" />
 <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
 <input placeholder="Department" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })}
 className="px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
 <input placeholder="Version" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })}
 className="px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
 <input placeholder="File name" value={form.fileName} onChange={(e) => setForm({ ...form, fileName: e.target.value })}
 className="px-3 py-2 rounded-lg border border-neutral-300 text-sm" />
 </div>
 <div className="flex gap-2">
 <button onClick={submit} disabled={submitting}
 className="px-5 py-2 rounded-lg bg-primary-900 text-white text-sm font-semibold hover:bg-primary-800 disabled:opacity-50">
 {submitting ? 'Uploading…' : 'Upload'}
 </button>
 <button onClick={() => setShowForm(false)} className="px-5 py-2 rounded-lg border border-neutral-300 text-sm font-semibold hover:bg-neutral-50">Cancel</button>
 </div>
 </motion.div>
 )}

 <div className="flex flex-col sm:flex-row gap-3 mb-5">
 <input placeholder="Search documents…" value={search} onChange={(e) => setSearch(e.target.value)}
 className="flex-1 max-w-sm px-4 py-2.5 rounded-lg border border-neutral-300 text-sm" />
 <div className="flex gap-2 flex-wrap">
 {CATEGORIES.slice(0, 6).map((c) => (
 <button key={c} onClick={() => setCategory(c)}
 className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${category === c ? 'bg-primary-900 text-white' : 'bg-white border border-neutral-300 text-neutral-600 hover:bg-neutral-50'}`}>
 {c}
 </button>
 ))}
 </div>
 </div>

 {loading && <div className="flex items-center gap-2 text-neutral-600 py-12 justify-center"><Loader2 className="w-5 h-5 animate-spin" /> Loading…</div>}
 {!loading && error && (
 <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex gap-3 items-start">
 <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" /><p>{error}</p>
 </div>
 )}

 {!loading && !error && filtered.length === 0 && (
 <div className="dashboard-surface p-8 text-center text-sm text-neutral-500">
 No documents found. Upload policies, handbooks, and SOPs for your team.
 </div>
 )}

 {!loading && !error && filtered.length > 0 && (
 <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
 {filtered.map((doc, idx) => {
 const Icon = CATEGORY_ICONS[doc.category.toLowerCase()] || FileText;
 return (
 <motion.div key={doc.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.02 }}
 className="dashboard-stat-card hover:border-neutral-300 transition-colors">
 <div className="flex items-start gap-3">
 <div className="w-10 h-10 rounded-lg bg-primary-50 flex items-center justify-center shrink-0">
 <Icon className="w-5 h-5 text-primary-700" />
 </div>
 <div className="flex-1 min-w-0">
 <h3 className="font-bold text-sm text-primary-900 truncate">{doc.title}</h3>
 {doc.description && <p className="text-xs text-neutral-600 line-clamp-2 mt-0.5">{doc.description}</p>}
 <div className="flex flex-wrap gap-1.5 mt-2">
 <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-primary-50 text-primary-700">{doc.category}</span>
 {doc.version && <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-100 text-neutral-600">v{doc.version}</span>}
 {doc.department && <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-neutral-100 text-neutral-600">{doc.department}</span>}
 </div>
 <p className="text-[10px] text-neutral-400 mt-2">
 {doc.fileName}{doc.fileSize ? ` · ${fmtSize(doc.fileSize)}` : ''} · Updated {new Date(doc.updatedAt).toLocaleDateString()}
 </p>
 </div>
 </div>
 </motion.div>
 );
 })}
 </div>
 )}
 </DashboardPage>
 );
}
