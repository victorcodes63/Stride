'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { Briefcase, Banknote, FileText, Filter } from 'lucide-react';
import { RichTextListEditor } from '@/components/jobs/RichTextListEditor';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { toHtmlString } from '@/lib/job-list-html';
import { toDateTimeLocalNairobi } from '@/lib/timezone';

interface JobForEdit {
 id: string;
 title: string;
 location: string;
 type: string;
 category: string;
 description: string;
 requirements: string | string[];
 responsibilities: string | string[];
 benefits: string | string[];
 concealCompany?: boolean;
 applicationStartAt?: string | null;
 applicationDeadline?: string | null;
 salary?: { min: number; max: number; currency: string };
 salaryPublic?: boolean;
 minYearsExperience?: number | null;
 educationLevel?: string | null;
 educationQualification?: string | null;
 requiredCertifications?: string | null;
}

const JOB_TYPES = ['Full Time', 'Part Time', 'Contract', 'Remote'] as const;
const CATEGORIES = [
 'Executive',
 'Sales & Marketing',
 'Education & Training',
 'Technology',
 'Operations',
 'Finance & Accounting',
];

export default function EditJobPage() {
 const router = useRouter();
 const params = useParams();
 const id = params?.id as string | undefined;
 const [loading, setLoading] = useState(true);
 const [submitting, setSubmitting] = useState(false);
 const [error, setError] = useState<string | null>(null);
 const [title, setTitle] = useState('');
 const [location, setLocation] = useState('Nairobi');
 const [type, setType] = useState<string>('Full Time');
 const [categorySelect, setCategorySelect] = useState<string>('');
 const [categoryCustom, setCategoryCustom] = useState<string>('');
 const [categorySuggestions, setCategorySuggestions] = useState<string[]>([]);
 const [description, setDescription] = useState('');
 const [requirements, setRequirements] = useState('');
 const [responsibilities, setResponsibilities] = useState('');
 const [benefits, setBenefits] = useState('');
 const [concealCompany, setConcealCompany] = useState(false);
 const [applicationStartAt, setApplicationStartAt] = useState(''); // datetime-local
 const [applicationDeadline, setApplicationDeadline] = useState(''); // datetime-local; when applications close
 const [salaryMin, setSalaryMin] = useState('');
 const [salaryMax, setSalaryMax] = useState('');
 const [salaryCurrency, setSalaryCurrency] = useState('KES');
 const [salaryPublic, setSalaryPublic] = useState(false);
 const [minYearsExperience, setMinYearsExperience] = useState('');
 const [educationLevel, setEducationLevel] = useState('');
 const [educationQualification, setEducationQualification] = useState('');
 const [requiredCertifications, setRequiredCertifications] = useState('');

 useEffect(() => {
 if (!id) return;
 let cancelled = false;
 Promise.all([
 fetch(`/api/jobs/${id}?internal=true`).then((r) => r.json()),
 fetch('/api/jobs/categories').then((r) => r.json()),
 ]).then(([jobData, categoriesData]) => {
 if (cancelled) return;
 if (jobData?.error || !jobData?.id) {
 setError(jobData?.error || 'Job not found');
 setLoading(false);
 return;
 }
 const job = jobData as JobForEdit;
 setTitle(job.title ?? '');
 setLocation(job.location ?? 'Nairobi');
 setType(job.type ?? 'Full Time');
 setDescription(job.description ?? '');
 setRequirements(toHtmlString(job.requirements));
 setResponsibilities(toHtmlString(job.responsibilities));
 setBenefits(toHtmlString(job.benefits));
 setConcealCompany(job.concealCompany ?? false);
 if (job.applicationStartAt) {
 const localVal = toDateTimeLocalNairobi(job.applicationStartAt);
 if (localVal) setApplicationStartAt(localVal);
 }
 if (job.applicationDeadline) {
 const localVal = toDateTimeLocalNairobi(job.applicationDeadline);
 if (localVal) setApplicationDeadline(localVal);
 }
 setSalaryMin(job.salary?.min != null ? String(job.salary.min) : '');
 setSalaryMax(job.salary?.max != null ? String(job.salary.max) : '');
 setSalaryCurrency(job.salary?.currency ?? 'KES');
 setSalaryPublic(job.salaryPublic ?? false);
 setMinYearsExperience(job.minYearsExperience != null ? String(job.minYearsExperience) : '');
 setEducationLevel(job.educationLevel ?? '');
 setEducationQualification(job.educationQualification ?? '');
 setRequiredCertifications(job.requiredCertifications ?? '');
 const merged = Array.isArray(categoriesData)
 ? [...new Set([...CATEGORIES, ...categoriesData])].sort((a, b) => a.localeCompare(b))
 : [...CATEGORIES];
 setCategorySuggestions(merged);
 const jobCategory = job.category ?? '';
 if (jobCategory && merged.includes(jobCategory)) {
 setCategorySelect(jobCategory);
 } else if (jobCategory) {
 setCategorySelect('__other__');
 setCategoryCustom(jobCategory);
 }
 setLoading(false);
 }).catch(() => {
 if (!cancelled) {
 setError('Failed to load job.');
 setCategorySuggestions([...CATEGORIES]);
 setLoading(false);
 }
 });
 return () => { cancelled = true; };
 }, [id]);

 const handleSubmit = async (e: React.FormEvent) => {
 e.preventDefault();
 if (!id) return;
 setError(null);
 setSubmitting(true);

 if (!title.trim()) {
 setError('Job title is required.');
 setSubmitting(false);
 return;
 }
 if (!description.trim()) {
 setError('Job description is required.');
 setSubmitting(false);
 return;
 }
 const hasContent = (s: string) => s.replace(/<[^>]+>/g, '').trim().length > 0;
 if (!hasContent(requirements)) {
 setError('Add at least one requirement.');
 setSubmitting(false);
 return;
 }
 if (!hasContent(responsibilities)) {
 setError('Add at least one key responsibility.');
 setSubmitting(false);
 return;
 }
 if (!location.trim()) {
 setError('Location is required.');
 setSubmitting(false);
 return;
 }
 const effectiveCategory = categorySelect === '__other__' ? categoryCustom.trim() : categorySelect;
 if (!effectiveCategory) {
 setError('Category is required.');
 setSubmitting(false);
 return;
 }

 try {
 const res = await fetch(`/api/jobs/${id}`, {
 method: 'PATCH',
 headers: { 'Content-Type': 'application/json' },
 body: JSON.stringify({
 title: title.trim(),
 company: '',
 concealCompany,
 location: location.trim(),
 type,
 category: effectiveCategory,
 description: description.trim(),
 requirements: requirements.trim() || undefined,
 responsibilities: responsibilities.trim() || undefined,
 benefits: benefits.trim(),
 salary:
 salaryMin.trim() || salaryMax.trim()
 ? {
 min: Number(salaryMin) || 0,
 max: Number(salaryMax) || 0,
 currency: salaryCurrency,
 }
 : undefined,
 salaryPublic,
 applicationStartAt: applicationStartAt.trim() || null,
 applicationDeadline: applicationDeadline.trim() || null,
 minYearsExperience: minYearsExperience.trim() ? parseInt(minYearsExperience, 10) : null,
 educationLevel: educationLevel.trim() || null,
 educationQualification: educationQualification.trim() || null,
 requiredCertifications: requiredCertifications.trim() || null,
 }),
 });

 const data = await res.json().catch(() => ({}));

 if (!res.ok) {
 setError(data.error || 'Failed to update job.');
 setSubmitting(false);
 return;
 }

 router.push('/dashboard/jobs');
 router.refresh();
 } catch {
 setError('Something went wrong. Please try again.');
 setSubmitting(false);
 }
 };

 if (!id) return null;
 if (loading) {
 return (
 <DashboardPage>
 <div className="animate-pulse space-y-4">
 <div className="h-6 bg-neutral-200 rounded w-1/3" />
 <div className="h-10 bg-neutral-100 rounded w-full" />
 <div className="h-10 bg-neutral-100 rounded w-5/6" />
 </div>
 </DashboardPage>
 );
 }
 if (error && !title) {
 return (
 <DashboardPage>
 <nav className="mb-4 sm:mb-5" aria-label="Breadcrumb">
 <ol className="flex items-center gap-1.5 text-sm text-neutral-500">
 <li>
 <Link href="/dashboard/jobs" className="hover:text-primary-700 transition-colors">
 Job openings
 </Link>
 </li>
 </ol>
 </nav>
 <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-800">{error}</div>
 <Link href="/dashboard/jobs" className="mt-4 inline-block text-primary-600 hover:text-primary-800 font-medium">
 Back to Job openings
 </Link>
 </DashboardPage>
 );
 }

 return (
 <div className="w-full">
 <nav className="mb-4 sm:mb-5" aria-label="Breadcrumb">
 <ol className="flex items-center gap-1.5 text-sm text-neutral-500">
 <li>
 <Link href="/dashboard/jobs" className="hover:text-primary-700 transition-colors">
 Job openings
 </Link>
 </li>
 <li aria-hidden="true">/</li>
 <li className="text-primary-900 font-medium truncate max-w-[200px] sm:max-w-none" aria-current="page">
 Edit: {title || 'Job'}
 </li>
 </ol>
 </nav>

 <DashboardPageHeader
 title="Edit job"
 description="Update the job details below. Changes will appear on the careers page."
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
 <Briefcase className="w-5 h-5 shrink-0" />
 Job details
 </h2>

 <div>
 <label htmlFor="title" className="block text-sm font-medium text-primary-900 mb-2">
 Job title <span className="text-red-600">*</span>
 </label>
 <input
 id="title"
 type="text"
 value={title}
 onChange={(e) => setTitle(e.target.value)}
 placeholder="e.g. CEO and Trust Secretary"
 required
 className="w-full min-w-0 px-4 py-2.5 sm:py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-base"
 />
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
 <div className="min-w-0 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
 <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Employer profile</p>
 <p className="mt-1 text-sm text-neutral-700">
 Employer display name is managed centrally in{' '}
 <Link href="/dashboard/recruitment/profile" className="text-primary-700 hover:underline">
 Careers profile
 </Link>
 .
 </p>
 </div>
 <div className="min-w-0">
 <label htmlFor="location" className="block text-sm font-medium text-primary-900 mb-2">
 Location <span className="text-red-600">*</span>
 </label>
 <input
 id="location"
 type="text"
 value={location}
 onChange={(e) => setLocation(e.target.value)}
 placeholder="e.g. Nairobi"
 required
 className="w-full min-w-0 px-4 py-2.5 sm:py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-base"
 />
 </div>
 </div>

 <div className="flex items-start gap-3">
 <input
 id="concealCompany"
 type="checkbox"
 checked={concealCompany}
 onChange={(e) => setConcealCompany(e.target.checked)}
 className="mt-1 h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
 />
 <label htmlFor="concealCompany" className="text-sm text-neutral-700">
 <span className="font-medium text-primary-900">Conceal company name on job board</span>
 <span className="block mt-0.5 text-neutral-600">
 When ticked, the public careers page will show &quot;Confidential&quot; instead of the employer name for this job.
 </span>
 </label>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5">
 <div className="min-w-0">
 <label htmlFor="type" className="block text-sm font-medium text-primary-900 mb-2">
 Job type
 </label>
 <select
 id="type"
 value={type}
 onChange={(e) => setType(e.target.value)}
 className="w-full min-w-0 px-4 py-2.5 sm:py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-base"
 >
 {JOB_TYPES.map((t) => (
 <option key={t} value={t}>
 {t}
 </option>
 ))}
 </select>
 </div>
 <div className="min-w-0">
 <label htmlFor="category" className="block text-sm font-medium text-primary-900 mb-2">
 Category <span className="text-red-600">*</span>
 </label>
 <select
 id="category"
 value={categorySelect}
 onChange={(e) => setCategorySelect(e.target.value)}
 required={categorySelect !== '__other__'}
 className="w-full min-w-0 px-4 py-2.5 sm:py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-base"
 >
 <option value="">— Select category —</option>
 {categorySuggestions.map((c) => (
 <option key={c} value={c}>
 {c}
 </option>
 ))}
 <option value="__other__">— Other (type below) —</option>
 </select>
 {categorySelect === '__other__' && (
 <input
 type="text"
 value={categoryCustom}
 onChange={(e) => setCategoryCustom(e.target.value)}
 placeholder="Enter category name"
 required
 className="mt-3 w-full min-w-0 px-4 py-2.5 sm:py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-base"
 />
 )}
 <p className="mt-1 text-xs text-neutral-500">
 Choose from the list or select &quot;Other&quot; and enter a custom category.
 </p>
 </div>
 </div>
 </div>

 {/* Section 2: Role content */}
 <div className="dashboard-surface shadow-sm p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6">
 <h2 className="text-base sm:text-lg font-semibold text-primary-900 flex items-center gap-2">
 <FileText className="w-5 h-5 shrink-0" />
 Role content
 </h2>

 <div>
 <label htmlFor="description" className="block text-sm font-medium text-primary-900 mb-2">
 Job description <span className="text-red-600">*</span>
 </label>
 <textarea
 id="description"
 value={description}
 onChange={(e) => setDescription(e.target.value)}
 placeholder="Describe the role and what the organization is looking for."
 required
 rows={5}
 className="w-full min-w-0 px-4 py-2.5 sm:py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-y min-h-[120px] sm:min-h-[140px] text-base"
 />
 </div>

 <div>
 <label htmlFor="requirements" className="block text-sm font-medium text-primary-900 mb-2">
 Requirements <span className="text-red-600">*</span>
 </label>
 <RichTextListEditor
 key="requirements"
 id="requirements"
 value={requirements}
 onChange={setRequirements}
 placeholder="Add requirements… Use bullet list and bold in the toolbar."
 aria-label="Requirements"
 />
 <p className="mt-1 text-xs text-neutral-500">Type each item and press Enter for a new bullet. Use bold for emphasis.</p>
 </div>

 <div>
 <label htmlFor="responsibilities" className="block text-sm font-medium text-primary-900 mb-2">
 Key responsibilities <span className="text-red-600">*</span>
 </label>
 <RichTextListEditor
 key="responsibilities"
 id="responsibilities"
 value={responsibilities}
 onChange={setResponsibilities}
 placeholder="Add key responsibilities… Use bullet list and bold in the toolbar."
 aria-label="Key responsibilities"
 />
 <p className="mt-1 text-xs text-neutral-500">Type each item and press Enter for a new bullet. Use bold for emphasis.</p>
 </div>

 <div>
 <label htmlFor="benefits" className="block text-sm font-medium text-primary-900 mb-2">
 Benefits (optional)
 </label>
 <RichTextListEditor
 key="benefits"
 id="benefits"
 value={benefits}
 onChange={setBenefits}
 placeholder="Add benefits… Use bullet list and bold in the toolbar."
 aria-label="Benefits"
 />
 <p className="mt-1 text-xs text-neutral-500">Optional. Use bullet list and bold for emphasis.</p>
 </div>
 </div>

 {/* Section 3: Compensation */}
 <div className="dashboard-surface shadow-sm p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6">
 <h2 className="text-base sm:text-lg font-semibold text-primary-900 flex items-center gap-2">
 <Banknote className="w-5 h-5 shrink-0" />
 Compensation
 </h2>

 <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
 <div className="min-w-0">
 <label htmlFor="salaryMin" className="block text-sm font-medium text-neutral-700 mb-1.5">
 Min
 </label>
 <input
 id="salaryMin"
 type="number"
 min={0}
 step={1}
 value={salaryMin}
 onChange={(e) => setSalaryMin(e.target.value)}
 placeholder="e.g. 80000"
 className="w-full min-w-0 px-4 py-2.5 sm:py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-base"
 />
 </div>
 <div className="min-w-0">
 <label htmlFor="salaryMax" className="block text-sm font-medium text-neutral-700 mb-1.5">
 Max
 </label>
 <input
 id="salaryMax"
 type="number"
 min={0}
 step={1}
 value={salaryMax}
 onChange={(e) => setSalaryMax(e.target.value)}
 placeholder="e.g. 120000"
 className="w-full min-w-0 px-4 py-2.5 sm:py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-base"
 />
 </div>
 <div className="min-w-0">
 <label htmlFor="salaryCurrency" className="block text-sm font-medium text-neutral-700 mb-1.5">
 Currency
 </label>
 <select
 id="salaryCurrency"
 value={salaryCurrency}
 onChange={(e) => setSalaryCurrency(e.target.value)}
 className="w-full min-w-0 px-4 py-2.5 sm:py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-base"
 >
 <option value="KES">KES</option>
 <option value="USD">USD</option>
 </select>
 </div>
 </div>
 <div className="flex items-start gap-3 mt-4">
 <input
 id="salaryPublic"
 type="checkbox"
 checked={salaryPublic}
 onChange={(e) => setSalaryPublic(e.target.checked)}
 className="mt-1 h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
 />
 <label htmlFor="salaryPublic" className="text-sm text-neutral-700">
 <span className="font-medium text-primary-900">Show salary on public job board</span>
 <span className="block mt-0.5 text-neutral-600">
 When unchecked, salary is kept internal and only visible to staff in the dashboard.
 </span>
 </label>
 </div>
 </div>

 {/* Section 4: Candidate filters */}
 <div className="dashboard-surface shadow-sm p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6">
 <h2 className="text-base sm:text-lg font-semibold text-primary-900 flex items-center gap-2">
 <Filter className="w-5 h-5 shrink-0" />
 Candidate filters
 </h2>

 <div>
 <label htmlFor="applicationStartAt" className="block text-sm font-medium text-primary-900 mb-2">
 When to start accepting applications (optional)
 </label>
 <input
 id="applicationStartAt"
 type="datetime-local"
 value={applicationStartAt}
 onChange={(e) => setApplicationStartAt(e.target.value)}
 min={toDateTimeLocalNairobi(new Date().toISOString())}
 className="w-full min-w-0 px-4 py-2.5 sm:py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-base"
 />
 <p className="mt-1 text-xs text-neutral-500">The job will be hidden from the public board until this date/time. Leave empty to accept applications immediately.</p>
 </div>

 <div>
 <label htmlFor="applicationDeadline" className="block text-sm font-medium text-primary-900 mb-2">
 Application deadline (date & time)
 </label>
 <input
 id="applicationDeadline"
 type="datetime-local"
 value={applicationDeadline}
 onChange={(e) => setApplicationDeadline(e.target.value)}
 min={applicationStartAt ? applicationStartAt.slice(0, 16) : toDateTimeLocalNairobi(new Date().toISOString())}
 className="w-full min-w-0 px-4 py-2.5 sm:py-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-base"
 />
 <p className="mt-1 text-xs text-neutral-500">Applications close at this exact date and time. Leave empty for no expiry.</p>
 </div>

 <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
 <div>
 <label htmlFor="minYearsExperience" className="block text-sm font-medium text-primary-900 mb-2">
 Minimum years of experience (for filtering candidates)
 </label>
 <input
 type="number"
 id="minYearsExperience"
 value={minYearsExperience}
 onChange={(e) => setMinYearsExperience(e.target.value)}
 min={0}
 placeholder="e.g. 5"
 className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-base"
 />
 </div>
 <div>
 <label htmlFor="educationLevel" className="block text-sm font-medium text-primary-900 mb-2">
 Minimum education level (for filtering candidates)
 </label>
 <select
 id="educationLevel"
 value={educationLevel}
 onChange={(e) => setEducationLevel(e.target.value)}
 className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white text-base"
 >
 <option value="">Any</option>
 <option value="High School">High School</option>
 <option value="Certificate">Certificate</option>
 <option value="Bachelor">Bachelor</option>
 <option value="Master">Master</option>
 <option value="PhD">PhD</option>
 </select>
 </div>
 </div>

 <div>
 <label htmlFor="educationQualification" className="block text-sm font-medium text-primary-900 mb-2">
 Degree or field (for filtering candidates)
 </label>
 <input
 type="text"
 id="educationQualification"
 value={educationQualification}
 onChange={(e) => setEducationQualification(e.target.value)}
 placeholder="e.g. MBA, Bachelor of Commerce, MSc Computer Science, Law"
 className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-base"
 />
 <p className="mt-1 text-xs text-neutral-500">Optional. Used to filter candidates by education keyword.</p>
 </div>

 <div>
 <label htmlFor="requiredCertifications" className="block text-sm font-medium text-primary-900 mb-2">
 Required professional certifications (for filtering)
 </label>
 <input
 type="text"
 id="requiredCertifications"
 value={requiredCertifications}
 onChange={(e) => setRequiredCertifications(e.target.value)}
 placeholder="e.g. CPA, CFA, PMP, Nursing Council registration"
 className="w-full px-4 py-2.5 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-base"
 />
 <p className="mt-1 text-xs text-neutral-500">Optional. Shown on application sidebar so reviewers can compare candidate to role.</p>
 </div>

 <div className="pt-6 sm:pt-8 mt-6 sm:mt-8 border-t border-neutral-200 flex flex-col-reverse sm:flex-row sm:justify-end sm:items-center gap-3 sm:gap-4">
 <Link
 href="/dashboard/jobs"
 className="w-full sm:w-auto order-2 sm:order-1 px-6 py-3 min-h-[44px] sm:min-h-0 border border-neutral-300 text-neutral-700 rounded-lg font-medium hover:bg-neutral-50 transition-colors inline-flex items-center justify-center"
 >
 Cancel
 </Link>
 <button
 type="submit"
 disabled={submitting}
 className="w-full sm:w-auto order-1 sm:order-2 px-6 py-3 min-h-[44px] sm:min-h-0 bg-primary-900 text-white rounded-lg font-semibold hover:bg-primary-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
 >
 {submitting ? 'Saving…' : 'Save changes'}
 </button>
 </div>
 </div>
 </form>
 </div>
 );
}
