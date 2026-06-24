'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import PublicPageLayout from '@/components/public/PublicPageLayout';
import JobApplicationForm from '@/components/ats/JobApplicationForm';
import { JobListing } from '@/types/ats';
import { useATS } from '@/lib/use-ats';
import {
  ArrowLeft, MapPin, Clock, CheckCircle,
  Link2, Linkedin, Twitter, Check, BriefcaseBusiness, CalendarClock, ShieldCheck,
} from 'lucide-react';
import { prepareJobItemContent, sanitizeAndScopeJobSection } from '@/lib/sanitize-html';
import Link from 'next/link';
import { usePublicBrand } from '@/components/BrandProvider';

function hasSectionContent(raw: unknown): boolean {
  if (typeof raw === 'string') return raw.replace(/<[^>]+>/g, '').trim().length > 0;
  if (Array.isArray(raw)) return raw.some((x) => typeof x === 'string' && x.replace(/<[^>]+>/g, '').trim().length > 0);
  return false;
}

export default function JobApplicationPage() {
  const params = useParams();
  const router = useRouter();
  const { orgName } = usePublicBrand();
  const slugOrId = params.id as string;
  const [job, setJob] = useState<JobListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [applicationSubmitted, setApplicationSubmitted] = useState(false);

  const { getJobById } = useATS();

  useEffect(() => {
    const fetchJob = async () => {
      if (!slugOrId) return;

      setLoading(true);
      try {
        const jobData = await getJobById(slugOrId);
        setJob(jobData);
      } catch (error) {
        console.error('Error fetching job:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchJob();
  }, [slugOrId, getJobById]);

  // Redirect to canonical slug URL when user landed on CUID (old or shared link)
  useEffect(() => {
    if (!job?.slug || slugOrId === job.slug) return;
    router.replace(`/careers/apply/${job.slug}`, { scroll: false });
  }, [job?.slug, slugOrId, router]);

  const handleApplicationSuccess = () => {
    setApplicationSubmitted(true);
    setShowApplicationForm(false);
  };

  const [copied, setCopied] = useState(false);

  const isExpired =
    !!job?.applicationDeadline && new Date(job.applicationDeadline) < new Date();

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareTitle = job ? `${job.title} at ${orgName}` : '';

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select the URL from address bar
    }
  };

  if (loading) {
    return (
      <PublicPageLayout>
        <main className="min-h-screen min-w-0 overflow-x-hidden bg-pub-surface">
        <div className="pt-8 pb-20">
          <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
            <div className="max-w-2xl mx-auto">
              <div className="animate-pulse space-y-6">
                <div className="h-4 bg-pub-border rounded w-32" />
                <div className="pub-card p-8">
                  <div className="h-8 bg-pub-border rounded w-3/4 mb-4" />
                  <div className="h-4 bg-pub-surface-muted rounded w-1/2 mb-2" />
                  <div className="h-4 bg-pub-surface-muted rounded w-2/5" />
                </div>
              </div>
            </div>
          </div>
        </div>
        </main>
      </PublicPageLayout>
    );
  }

  if (!job) {
    return (
      <PublicPageLayout>
        <main className="min-h-screen min-w-0 overflow-x-hidden bg-pub-surface">
        <div className="pt-8 pb-20">
          <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
            <div className="max-w-4xl mx-auto text-center">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-8 h-8 text-red-600" />
              </div>
              <h1 className="text-3xl font-normal text-pub-ink mb-4">Role not found</h1>
              <p className="text-pub-ink-muted mb-8">
                The job you&apos;re looking for doesn&apos;t exist or has been removed.
              </p>
              <Link
                href="/careers"
                className="pub-btn-primary inline-flex items-center"
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back to careers
              </Link>
            </div>
          </div>
        </div>
        </main>
      </PublicPageLayout>
    );
  }

  return (
    <PublicPageLayout>
      <main className="min-h-screen min-w-0 overflow-x-hidden bg-pub-surface">
      <section className="pb-16 pt-8">
        <div className="mx-auto w-full max-w-[1200px] px-5 sm:px-8">
          <Link
            href="/careers"
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-pub-ink-subtle transition-colors hover:text-pub-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to careers
          </Link>

          <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
            <div className="min-w-0 space-y-8">
              <header className="pub-card p-6 sm:p-8">
                <p className="pub-eyebrow">Open role</p>
                <h1 className="mt-2 text-3xl font-normal tracking-tight text-pub-ink sm:text-4xl">{job.title}</h1>
                <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-pub-ink-muted">
                  <span className="inline-flex items-center gap-1.5">
                    <BriefcaseBusiness className="h-4 w-4 text-pub-ink-subtle" />
                    {orgName}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-pub-ink-subtle" />
                    {job.location}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <Clock className="h-4 w-4 text-pub-ink-subtle" />
                    {job.type}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-2">
                  <span className="inline-flex rounded-full bg-pub-primary-subtle px-3 py-1 text-xs font-medium text-pub-primary">
                    {job.category}
                  </span>
                  {job.salary && (
                    <span className="text-sm text-pub-ink-muted">
                      {job.salary.currency} {job.salary.min.toLocaleString()} - {job.salary.max.toLocaleString()}
                    </span>
                  )}
                </div>
              </header>

              {job.description?.trim() && (
                <section className="pub-card p-6 sm:p-8">
                  <h2 className="text-lg font-medium text-pub-ink">Role overview</h2>
                  <p className="mt-3 whitespace-pre-line text-pub-ink-muted leading-7">{job.description}</p>
                </section>
              )}

              {hasSectionContent(job.requirements) && (
                <section className="pub-card p-6 sm:p-8">
                  <h2 className="text-lg font-medium text-pub-ink">Requirements</h2>
                  <div
                    className="prose prose-sm mt-3 max-w-none text-pub-ink-muted [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1.5 [&_p]:my-2"
                    dangerouslySetInnerHTML={{
                      __html: (() => {
                        const raw = job.requirements;
                        if (typeof raw === 'string' && raw.trim()) return sanitizeAndScopeJobSection(raw, 'requirements');
                        const arr = Array.isArray(raw) ? raw.filter((r): r is string => typeof r === 'string') : [];
                        return arr.length > 0
                          ? sanitizeAndScopeJobSection(`<ul>${arr.map((r) => `<li>${prepareJobItemContent(r)}</li>`).join('')}</ul>`, 'requirements')
                          : '';
                      })(),
                    }}
                  />
                </section>
              )}

              {hasSectionContent(job.responsibilities) && (
                <section className="pub-card p-6 sm:p-8">
                  <h2 className="text-lg font-medium text-pub-ink">Responsibilities</h2>
                  <div
                    className="prose prose-sm mt-3 max-w-none text-pub-ink-muted [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1.5 [&_p]:my-2"
                    dangerouslySetInnerHTML={{
                      __html: (() => {
                        const raw = job.responsibilities;
                        if (typeof raw === 'string' && raw.trim()) return sanitizeAndScopeJobSection(raw, 'responsibilities');
                        const arr = Array.isArray(raw) ? raw.filter((r): r is string => typeof r === 'string') : [];
                        return arr.length > 0
                          ? sanitizeAndScopeJobSection(`<ul>${arr.map((r) => `<li>${prepareJobItemContent(r)}</li>`).join('')}</ul>`, 'responsibilities')
                          : '';
                      })(),
                    }}
                  />
                </section>
              )}

              {hasSectionContent(job.benefits) && (() => {
                const raw = job.benefits;
                let html: string;
                if (typeof raw === 'string' && raw.trim()) {
                  html = sanitizeAndScopeJobSection(raw, 'benefits');
                } else if (Array.isArray(raw) && raw.filter((b): b is string => typeof b === 'string').length > 0) {
                  html = sanitizeAndScopeJobSection(`<ul>${(raw as string[]).map((b) => `<li>${prepareJobItemContent(b)}</li>`).join('')}</ul>`, 'benefits');
                } else {
                  html = '';
                }
                return html ? (
                  <section className="pub-card p-6 sm:p-8">
                    <h2 className="text-lg font-medium text-pub-ink">Benefits</h2>
                    <div
                      className="prose prose-sm mt-3 max-w-none text-pub-ink-muted [&_ul]:list-disc [&_ul]:pl-6 [&_ol]:list-decimal [&_ol]:pl-6 [&_li]:my-1.5 [&_p]:my-2"
                      dangerouslySetInnerHTML={{ __html: html }}
                    />
                  </section>
                ) : null;
              })()}
            </div>

            <aside className="lg:sticky lg:top-28 lg:self-start space-y-4">
              <div className="pub-card p-5">
                <p className="pub-eyebrow">
                  {isExpired ? 'Applications closed' : 'Apply for this role'}
                </p>
                <p className="mt-2 text-base font-medium text-pub-ink">{job.title}</p>
                <p className="mt-1 text-sm text-pub-ink-subtle">{orgName}</p>

                {job.applicationDeadline && (
                  <p className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-amber-700">
                    <CalendarClock className="h-4 w-4" />
                    Closes {new Date(job.applicationDeadline).toLocaleString('en-KE', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Africa/Nairobi' })}
                  </p>
                )}

                <div className="mt-4">
                  {isExpired ? (
                    <Link
                      href="/careers"
                      className="pub-btn-secondary block w-full text-center"
                    >
                      View other vacancies
                    </Link>
                  ) : applicationSubmitted ? (
                    <div className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
                      <CheckCircle className="h-4 w-4" />
                      Application submitted
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setShowApplicationForm(true)}
                      className="pub-btn-primary w-full"
                    >
                      Apply now
                    </button>
                  )}
                </div>
              </div>

              <div className="pub-card p-5">
                <p className="pub-eyebrow">Share role</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="flex flex-col items-center gap-1.5 rounded-md border border-pub-border bg-pub-surface-muted p-3 text-xs text-pub-ink-muted hover:bg-white"
                    title="Copy link"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Link2 className="h-4 w-4 text-pub-primary" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                  <a
                    href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-1.5 rounded-md border border-pub-border bg-pub-surface-muted p-3 text-xs text-pub-ink-muted hover:bg-white"
                    title="Share on LinkedIn"
                  >
                    <Linkedin className="h-4 w-4 text-[#0A66C2]" />
                    LinkedIn
                  </a>
                  <a
                    href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(`${shareTitle} — apply now`)}&url=${encodeURIComponent(shareUrl)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex flex-col items-center gap-1.5 rounded-md border border-pub-border bg-pub-surface-muted p-3 text-xs text-pub-ink-muted hover:bg-white"
                    title="Share on X"
                  >
                    <Twitter className="h-4 w-4 text-neutral-800" />
                    X
                  </a>
                </div>
              </div>

              <div className="rounded-xl border border-pub-border bg-pub-surface-muted p-5">
                <p className="pub-eyebrow">Why join us</p>
                <ul className="mt-3 space-y-2 text-sm text-pub-ink-muted">
                  <li className="inline-flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-pub-primary" /> Structured and fair recruitment</li>
                  <li className="inline-flex items-center gap-2"><CheckCircle className="h-4 w-4 text-pub-primary" /> Credential-focused hiring standards</li>
                </ul>
              </div>
            </aside>
          </div>
        </div>
      </section>

      {/* Application Success Message */}
      {applicationSubmitted && (
        <section className="py-10 sm:py-12 bg-pub-surface-muted">
          <div className="mx-auto max-w-[1200px] px-5 sm:px-8">
            <div className="max-w-xl mx-auto text-center pub-card p-8">
              <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle className="w-7 h-7 text-emerald-600" />
              </div>
              <h3 className="text-xl font-normal text-pub-ink mb-3">Application submitted</h3>
              <p className="text-pub-ink-muted mb-6 text-sm">
                Thank you for applying to {job.title}. We&apos;ll review your application and get back to you soon.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <Link
                  href="/careers"
                  className="pub-btn-primary px-5 py-2.5 text-sm"
                >
                  Browse more jobs
                </Link>
                <Link
                  href="/careers"
                  className="pub-btn-secondary px-5 py-2.5 text-sm"
                >
                  Back to home
                </Link>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* Application Form Modal - only when not expired */}
      {showApplicationForm && !isExpired && (
        <JobApplicationForm
          job={job}
          onSuccess={handleApplicationSuccess}
          onClose={() => setShowApplicationForm(false)}
        />
      )}

      </main>
    </PublicPageLayout>
  );
}
