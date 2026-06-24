'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Plus, Pencil, Trash2, Loader2, BookOpen, ExternalLink } from 'lucide-react';
import { INSIGHTS_EXAMPLES } from '@/data/insights-examples';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

type InsightItem = {
 id: string;
 title: string;
 excerpt: string;
 date: string;
 author: string;
 category: string;
 url: string;
 image: string;
 imageTitle?: string | null;
 publishedAt?: string;
 createdAt?: string;
 updatedAt?: string;
};

const CATEGORIES = [
 'Uncategorized',
 'Job Hunting Tips',
 'HR Outsourcing',
 'Compliance and Regulation',
 'Strategy Business',
];

export default function DashboardInsightsPage() {
 const [list, setList] = useState<InsightItem[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [deletingId, setDeletingId] = useState<string | null>(null);
 const [loadingExamples, setLoadingExamples] = useState(false);

 const fetchList = async () => {
 setLoading(true);
 setError(null);
 try {
 const res = await fetch('/api/insights');
 if (!res.ok) throw new Error('Failed to load');
 const data = await res.json();
 setList(Array.isArray(data) ? data : []);
 } catch {
 setError('Failed to load insights.');
 setList([]);
 } finally {
 setLoading(false);
 }
 };

 useEffect(() => {
 fetchList();
 }, []);

 const handleDelete = async (item: InsightItem) => {
 if (!window.confirm(`Delete "${item.title}"? This cannot be undone.`)) return;
 setDeletingId(item.id);
 try {
 const res = await fetch(`/api/insights/${item.id}`, { method: 'DELETE' });
 if (!res.ok) {
 const data = await res.json();
 setError(data.error || 'Failed to delete.');
 return;
 }
 setList((prev) => prev.filter((i) => i.id !== item.id));
 } catch {
 setError('Failed to delete article.');
 } finally {
 setDeletingId(null);
 }
 };

 const handleLoadExamples = async () => {
 setLoadingExamples(true);
 setError(null);
 try {
 for (const ex of INSIGHTS_EXAMPLES) {
 await fetch('/api/insights', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 title: ex.title,
 excerpt: ex.excerpt,
 author: ex.author,
 category: ex.category,
 url: ex.url,
 image: ex.image,
 }),
 });
 }
 await fetchList();
 } catch {
 setError('Failed to load example articles.');
 } finally {
 setLoadingExamples(false);
 }
 };

 return (
 <DashboardPage>
 <DashboardPageHeader
 title="Insights"
 description="Manage articles shown on the public Insights page. Add, edit, or remove articles."
 actions={
 <div className="flex flex-wrap items-center gap-2 shrink-0">
 {list.length === 0 && (
 <button
 type="button"
 onClick={handleLoadExamples}
 disabled={loadingExamples}
 className="btn-secondary inline-flex items-center gap-2"
 >
 {loadingExamples ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4" />}
 Load example articles
 </button>
 )}
 <Link
 href="/dashboard/insights/new"
 className="btn-primary inline-flex shrink-0 items-center gap-2"
 >
 <Plus className="w-4 h-4" />
 Add article
 </Link>
 </div>
 }
 />

 {error && (
 <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-4 text-red-800 text-sm">
 {error}
 </div>
 )}

 {loading ? (
 <div className="flex items-center justify-center py-16">
 <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
 </div>
 ) : list.length === 0 ? (
 <div className="dashboard-surface shadow-sm p-8 sm:p-12 text-center">
 <BookOpen className="w-12 h-12 text-neutral-300 mx-auto mb-4" />
 <p className="text-neutral-600 text-sm sm:text-base mb-4">
 No articles yet. Add your first article or load the 10 example articles to get started.
 </p>
 <div className="flex flex-wrap justify-center gap-3">
 <button
 type="button"
 onClick={handleLoadExamples}
 disabled={loadingExamples}
 className="inline-flex items-center gap-2 px-4 py-2.5 bg-secondary-100 text-secondary-800 rounded-lg hover:bg-secondary-200 text-sm font-medium"
 >
 {loadingExamples ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
 Load example articles
 </button>
 <Link
 href="/dashboard/insights/new"
 className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 text-sm font-medium"
 >
 <Plus className="w-4 h-4" />
 Add article
 </Link>
 </div>
 </div>
 ) : (
 <div className="dashboard-surface shadow-sm overflow-hidden">
 <div className="overflow-x-auto">
 <table className="data-table dashboard-data-table w-full text-left">
 <thead>
 <tr className="dashboard-toolbar">
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider">Title</th>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider">Category</th>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider">Author</th>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider">Date</th>
 <th className="px-4 py-3 text-xs font-semibold text-neutral-600 uppercase tracking-wider text-right">Actions</th>
 </tr>
 </thead>
 <tbody>
 {list.map((item) => (
 <tr key={item.id} className="border-b border-neutral-100 hover:bg-neutral-50/50">
 <td className="px-4 py-3">
 <span className="text-sm font-medium text-primary-900 line-clamp-2">{item.title}</span>
 </td>
 <td className="px-4 py-3 text-sm text-neutral-600">{item.category}</td>
 <td className="px-4 py-3 text-sm text-neutral-600">{item.author}</td>
 <td className="px-4 py-3 text-sm text-neutral-600">{item.date}</td>
 <td className="px-4 py-3 text-right">
 <div className="flex items-center justify-end gap-2">
 <a
 href={item.url}
 target="_blank"
 rel="noopener noreferrer"
 className="p-2 rounded-lg text-neutral-600 hover:bg-neutral-100 hover:text-primary-600 transition-colors"
 title="View link"
 >
 <ExternalLink className="w-4 h-4" />
 </a>
 <Link
 href={`/dashboard/insights/${item.id}/edit`}
 className="p-2 rounded-lg text-neutral-600 hover:bg-neutral-100 hover:text-primary-600 transition-colors"
 title="Edit"
 >
 <Pencil className="w-4 h-4" />
 </Link>
 <button
 type="button"
 onClick={() => handleDelete(item)}
 disabled={deletingId === item.id}
 className="p-2 rounded-lg text-neutral-600 hover:bg-red-50 hover:text-red-600 transition-colors disabled:opacity-50"
 title="Delete"
 >
 {deletingId === item.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
 </button>
 </div>
 </td>
 </tr>
 ))}
 </tbody>
 </table>
 </div>
 </div>
 )}

 <p className="mt-6 text-sm text-neutral-500">
 Articles appear on the public <a href="/insights" target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline">Insights page</a>. Use &quot;Add article&quot; to open the full form with image upload; featured images are stored like applicant CVs and linked in the database.
 </p>
 </DashboardPage>
 );
}
