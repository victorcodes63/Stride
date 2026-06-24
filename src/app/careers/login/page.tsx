import Link from 'next/link';
import { redirect } from 'next/navigation';
import PublicPageLayout from '@/components/public/PublicPageLayout';

type CareersLoginPageProps = {
  searchParams?: {
    direct?: string | string[];
  };
};

export default function CareersLoginPage({ searchParams }: CareersLoginPageProps) {
  const direct = searchParams?.direct;
  const directFlag = Array.isArray(direct) ? direct[0] : direct;

  if (directFlag === '1') {
    redirect('/dashboard/login');
  }

  return (
    <PublicPageLayout>
      <main className="min-h-[60vh] bg-pub-surface px-6 py-16 sm:px-12">
        <div className="mx-auto w-full max-w-xl rounded-2xl border border-pub-border bg-white p-8 shadow-sm">
          <h1 className="font-heading text-2xl font-bold text-pub-ink">Staff sign in</h1>
          <p className="mt-3 text-sm leading-relaxed text-pub-ink-muted">
            The careers portal uses the central Stride staff login for your organisation.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/dashboard/login" className="pub-btn-primary pub-btn-primary--sm">
              Continue to login
            </Link>
            <Link href="/careers" className="pub-btn-secondary">
              Back to careers
            </Link>
          </div>
        </div>
      </main>
    </PublicPageLayout>
  );
}
