import Link from 'next/link';
import DynamicJobListings from '@/components/ats/DynamicJobListings';
import PublicPageLayout from '@/components/public/PublicPageLayout';
import { CareersDemoBanner } from '@/components/public/CareersDemoBanner';
import CareersHighlights from '@/components/public/CareersHighlights';
import { getResolvedPublicBrand } from '@/lib/get-resolved-public-brand';
import { isPublicDemoMode } from '@/lib/deployment-config';

type CareersPageProps = {
  searchParams?: Promise<{
    keyword?: string | string[];
  }>;
};

export default async function CareersPage({ searchParams }: CareersPageProps) {
  const publicBrand = await getResolvedPublicBrand();
  const demoMode = isPublicDemoMode();
  const employerName = publicBrand.careersEmployerName || publicBrand.orgName;
  const careersTagline =
    publicBrand.careersTagline ||
    'Human resources, payroll, recruitment, and workforce operations in one place.';
  const params = searchParams ? await searchParams : undefined;
  const selectedKeywordRaw = params?.keyword;
  const selectedKeyword =
    typeof selectedKeywordRaw === 'string'
      ? selectedKeywordRaw
      : Array.isArray(selectedKeywordRaw)
        ? selectedKeywordRaw[0] || ''
        : '';

  return (
    <PublicPageLayout>
      <main className="min-h-screen bg-pub-surface pb-4">
        {demoMode ? <CareersDemoBanner employerName={employerName} /> : null}

        <section className="pub-careers-hero border-b border-pub-border">
        {publicBrand.careersHeroImageUrl ? (
          <div className="relative h-40 w-full overflow-hidden md:h-48">
            <img
              src={publicBrand.careersHeroImageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-gradient-to-b from-white/10 to-white" />
          </div>
        ) : null}

        <div className={`relative ${publicBrand.careersHeroImageUrl ? '' : 'pub-gradient-mesh'}`}>
          <div className="relative mx-auto w-full max-w-[1200px] px-5 py-14 sm:px-8 md:py-20">
            <p className="pub-eyebrow pub-eyebrow--dark mb-3">Careers</p>
            <h1 className="pub-display max-w-3xl">
              Join {employerName}
            </h1>
            <p className="mt-5 max-w-xl text-[1.0625rem] leading-relaxed text-pub-ink-muted">
              {careersTagline}
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="#job-openings" className="pub-btn-primary">
                View open roles
              </a>
              {demoMode ? (
                <>
                  <Link href="/dashboard/login" className="pub-btn-secondary">
                    See recruiter dashboard
                  </Link>
                  <Link
                    href="/platform"
                    className="inline-flex h-11 items-center px-1 text-sm font-semibold text-[var(--pub-primary)] hover:underline"
                  >
                    Recruitment on Stride →
                  </Link>
                </>
              ) : (
                <Link href="/dashboard/login" className="pub-btn-secondary">
                  Staff sign in
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>

      <CareersHighlights variant={demoMode ? 'product-demo' : 'candidate'} />

      <section id="job-openings" className="pub-careers-jobs bg-pub-surface-muted py-14 md:py-20">
        <div className="mx-auto w-full max-w-[1200px] px-5 sm:px-8">
          <div className="mb-6 flex items-end justify-between gap-4">
            <div>
              <h2 className="pub-heading-md">Open roles</h2>
              <p className="mt-1 text-sm text-pub-ink-subtle">
                {demoMode
                  ? 'Sample vacancies seeded for this demo employer — apply to walk through the candidate experience.'
                  : 'Active vacancies across departments and locations.'}
              </p>
            </div>
          </div>
          <DynamicJobListings
            showSearch={true}
            initialFilters={selectedKeyword ? { keyword: selectedKeyword } : {}}
          />
        </div>
      </section>
      </main>
    </PublicPageLayout>
  );
}
