import { Lock } from 'lucide-react';
import Link from 'next/link';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';
import { companySetupTierLabel, companySetupUpgradeCopy, getDeploymentTier } from '@/lib/deployment-tier';

export function CompanySetupTierGate() {
  const tier = getDeploymentTier();

  return (
    <DashboardPage>
      <DashboardPageHeader
        title="Company setup"
        description="Branding, login experience, and dashboard defaults for this deployment."
      />

      <div className="dashboard-panel max-w-2xl p-6 sm:p-8">
        <div className="flex items-start gap-4">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[var(--swatch-amber-bg)] text-[var(--swatch-amber-fg)] ring-1 ring-[var(--swatch-amber-border)]">
            <Lock className="h-5 w-5" strokeWidth={1.75} aria-hidden />
          </div>
          <div className="min-w-0 space-y-3">
            <div>
              <p className="text-sm font-semibold text-ink">Available on Growth and Enterprise</p>
              <p className="mt-1.5 text-sm leading-relaxed text-neutral-600">{companySetupUpgradeCopy()}</p>
            </div>
            <p className="text-xs text-neutral-500">
              Current plan: <span className="font-medium text-neutral-700">{companySetupTierLabel(tier)}</span>
            </p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link href="/dashboard/settings" className="btn-secondary text-sm">
                Open settings
              </Link>
              <a href="mailto:hello@raventechgroup.co.ke" className="btn-primary text-sm">
                Contact sales
              </a>
            </div>
          </div>
        </div>
      </div>
    </DashboardPage>
  );
}
