'use client';

import { useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, ImagePlus, Loader2, X } from 'lucide-react';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

const CATEGORIES = [
 'Uncategorized',
 'Job Hunting Tips',
 'HR Outsourcing',
 'Compliance and Regulation',
 'Strategy Business',
];

const PLACEHOLDER_IMAGE = '/images/insights/featured-images/placeholder.png';

export default function NewInsightPage() {
 const router = useRouter();
 const [submitting, setSubmitting] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [uploadingImage, setUploadingImage] = useState(false);
 const fileInputRef = useRef<HTMLInputElement>(null);

 const [title, setTitle] = useState('');
 const [excerpt, setExcerpt] = useState('');
 const [body, setBody] = useState('');
 const [author, setAuthor] = useState('Stride');
 const [category, setCategory] = useState('Uncategorized');
 const [url, setUrl] = useState('');
 const [image, setImage] = useState('');
 const [imageTitle, setImageTitle] = useState('');

 const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
 const file = e.target.files?.[0];
 if (!file) return;
 setUploadingImage(true);
 try {
 const formData = new FormData();
 formData.append('image', file);
 const res = await fetch('/api/upload/insight-image', {
 method: 'POST',
 body: formData,
 });
 const data = await res.json();
 if (!res.ok) {
 setError(data.error || 'Image upload failed.');
 return;
 }
 setImage(data.path || data.url || '');
 if (!imageTitle.trim()) setImageTitle(file.name.replace(/\.[^.]+$/, ''));
 } catch {
 setError('Image upload failed.');
 } finally {
 setUploadingImage(false);
 if (fileInputRef.current) fileInputRef.current.value = '';
 }
 };

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 setError(null);
 const trimmedTitle = title.trim();
 const trimmedExcerpt = excerpt.trim();
 if (!trimmedTitle || !trimmedExcerpt) {
 setError('Title and excerpt are required.');
 return;
 }
 setSubmitting(true);
 try {
 const res = await fetch('/api/insights', {
 method: 'POST',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 title: trimmedTitle,
 excerpt: trimmedExcerpt,
 body: body.trim() || null,
 author: author.trim() || 'Stride',
 category: category || 'Uncategorized',
 url: url.trim() || '#',
 image: image.trim() || PLACEHOLDER_IMAGE,
 imageTitle: imageTitle.trim() || null,
 }),
 });
 const data = await res.json();
 if (!res.ok) {
 setError(data.error || 'Failed to create article.');
 setSubmitting(false);
 return;
 }
 router.push('/dashboard/insights');
 router.refresh();
 } catch {
 setError('Something went wrong. Please try again.');
 setSubmitting(false);
 }
 };

 return (
 <div className="w-full">
 <nav className="mb-4 sm:mb-5" aria-label="Breadcrumb">
 <ol className="flex items-center gap-1.5 text-sm text-neutral-500">
 <li>
 <Link href="/dashboard/insights" className="hover:text-primary-700 transition-colors">
 Insights
 </Link>
 </li>
 <li aria-hidden="true">/</li>
 <li className="text-primary-900 font-medium" aria-current="page">
 Add article
 </li>
 </ol>
 </nav>

 <DashboardPageHeader
 title="Add article"
 description="Add a new article to the public Insights page. Title, excerpt, and a featured image are recommended."
 className="mb-6 sm:mb-8"
 />

 <form onSubmit={handleSubmit} className="w-full space-y-6 sm:space-y-8">
 {error && (
 <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
 {error}
 </div>
 )}

 <div className="dashboard-surface shadow-sm p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6">
 <h2 className="text-base sm:text-lg font-semibold text-primary-900 flex items-center gap-2">
 <BookOpen className="w-5 h-5 shrink-0" />
 Article details
 </h2>

 <div>
 <label htmlFor="title" className="block text-sm font-medium text-primary-900 mb-2">
 Title <span className="text-red-600">*</span>
 </label>
 <input
 id="title"
 type="text"
 value={title}
 onChange={(e) => setTitle(e.target.value)}
 placeholder="e.g. Why Toxic Culture Accumulates Like Interest"
 required
 className="w-full min-w-0 px-4 py-2.5 sm:py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-base"
 />
 </div>

 <div>
 <label htmlFor="excerpt" className="block text-sm font-medium text-primary-900 mb-2">
 Excerpt <span className="text-red-600">*</span>
 </label>
 <textarea
 id="excerpt"
 value={excerpt}
 onChange={(e) => setExcerpt(e.target.value)}
 placeholder="Short summary for the Insights listing. One or two sentences."
 required
 rows={4}
 className="w-full min-w-0 px-4 py-2.5 sm:py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-y min-h-[100px] text-base"
 />
 </div>

 <div>
 <label htmlFor="body" className="block text-sm font-medium text-primary-900 mb-2">
 Full article body (optional)
 </label>
 <textarea
 id="body"
 value={body}
 onChange={(e) => setBody(e.target.value)}
 placeholder="Full article content. When set, readers can expand to read it on the Insights page instead of following an external link."
 rows={12}
 className="w-full min-w-0 px-4 py-2.5 sm:py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-y min-h-[200px] text-base"
 />
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
 <div className="min-w-0">
 <label htmlFor="author" className="block text-sm font-medium text-primary-900 mb-2">
 Author
 </label>
 <input
 id="author"
 type="text"
 value={author}
 onChange={(e) => setAuthor(e.target.value)}
 placeholder="e.g. Stride"
 className="w-full min-w-0 px-4 py-2.5 sm:py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-base"
 />
 </div>
 <div className="min-w-0">
 <label htmlFor="category" className="block text-sm font-medium text-primary-900 mb-2">
 Category
 </label>
 <select
 id="category"
 value={category}
 onChange={(e) => setCategory(e.target.value)}
 className="w-full min-w-0 px-4 py-2.5 sm:py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-base"
 >
 {CATEGORIES.map((c) => (
 <option key={c} value={c}>
 {c}
 </option>
 ))}
 </select>
 </div>
 </div>

 <div>
 <label htmlFor="url" className="block text-sm font-medium text-primary-900 mb-2">
 URL (link to full article)
 </label>
 <input
 id="url"
 type="url"
 value={url}
 onChange={(e) => setUrl(e.target.value)}
 placeholder="https://www.example.com/blog/..."
 className="w-full min-w-0 px-4 py-2.5 sm:py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-base"
 />
 <p className="mt-1 text-xs text-neutral-500">
 Link where readers can read the full article (e.g. your blog).
 </p>
 </div>

 <div className="space-y-4">
 <h3 className="text-sm font-medium text-primary-900 flex items-center gap-1.5">
 <ImagePlus className="w-4 h-4" />
 Featured image
 </h3>
 <input
 ref={fileInputRef}
 type="file"
 accept="image/jpeg,image/png,image/webp,image/gif"
 onChange={handleImageUpload}
 className="sr-only"
 aria-label="Upload featured image"
 />
 <div className="flex flex-col sm:flex-row gap-4">
 <div className="shrink-0">
 <div className="w-full sm:w-48 h-32 rounded-lg border border-neutral-200 bg-neutral-50 overflow-hidden flex items-center justify-center">
 {image ? (
 <img
 src={image}
 alt={imageTitle || 'Featured'}
 className="w-full h-full object-cover"
 />
 ) : (
 <span className="text-neutral-400 text-sm">No image</span>
 )}
 </div>
 </div>
 <div className="min-w-0 flex-1 space-y-3">
 <button
 type="button"
 onClick={() => fileInputRef.current?.click()}
 disabled={uploadingImage}
 className="inline-flex items-center gap-2 px-4 py-2.5 border border-neutral-300 rounded-lg text-neutral-700 hover:bg-neutral-50 font-medium text-sm disabled:opacity-50"
 >
 {uploadingImage ? (
 <Loader2 className="w-4 h-4 animate-spin" />
 ) : (
 <ImagePlus className="w-4 h-4" />
 )}
 {uploadingImage ? 'Uploading…' : 'Upload image'}
 </button>
 {image && (
 <button
 type="button"
 onClick={() => {
 setImage('');
 setImageTitle('');
 }}
 className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:text-red-700"
 >
 <X className="w-4 h-4" />
 Remove image
 </button>
 )}
 <p className="text-xs text-neutral-500">
 JPEG, PNG, WebP or GIF. Max 4MB. Stored like applicant CVs and linked in the database.
 </p>
 <div className="min-w-0">
 <label htmlFor="imageTitle" className="block text-sm font-medium text-neutral-700 mb-1.5">
 Image title (optional)
 </label>
 <input
 id="imageTitle"
 type="text"
 value={imageTitle}
 onChange={(e) => setImageTitle(e.target.value)}
 placeholder="Caption or title for the image"
 className="w-full min-w-0 px-4 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-base"
 />
 <p className="mt-1 text-xs text-neutral-500">
 Stored in the database with the article, e.g. for accessibility or display.
 </p>
 </div>
 </div>
 </div>
 </div>

 <div className="pt-6 sm:pt-8 mt-6 sm:mt-8 border-t border-neutral-200 flex flex-col-reverse sm:flex-row sm:justify-end sm:items-center gap-3 sm:gap-4">
 <Link
 href="/dashboard/insights"
 className="w-full sm:w-auto order-2 sm:order-1 px-6 py-3 min-h-[44px] sm:min-h-0 border border-neutral-300 text-neutral-700 rounded-lg font-medium hover:bg-neutral-50 transition-colors inline-flex items-center justify-center"
 >
 Cancel
 </Link>
 <button
 type="submit"
 disabled={submitting}
 className="w-full sm:w-auto order-1 sm:order-2 px-6 py-3 min-h-[44px] sm:min-h-0 bg-primary-900 text-white rounded-lg font-semibold hover:bg-primary-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors inline-flex items-center justify-center gap-2"
 >
 {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
 {submitting ? 'Adding…' : 'Add article'}
 </button>
 </div>
 </div>
 </form>
 </div>
 );
}
