'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { AlertTriangle, LayoutDashboard, Mail } from 'lucide-react';
import { getModuleLabel, type ModuleKey } from '@/lib/modules';
import { moduleUpgradeMessage, RAVEN_COMMERCIAL_CONTACT } from '@/lib/commercial-upgrade';
import { DashboardPage } from '@/components/dashboard/DashboardPage';
import { DashboardPageHeader } from '@/components/dashboard/DashboardPageHeader';

function ModuleUnavailableContent() {
  const searchParams = useSearchParams();
  const moduleKey = (searchParams.get('module') ?? 'core') as ModuleKey;
  const fromPath = searchParams.get('from') ?? '';
  const label = getModuleLabel(moduleKey);
  const upgradeMessage = moduleUpgradeMessage(moduleKey);

  return (
    <DashboardPage>
      <div className="mx-auto max-w-lg rounded-xl border border-amber-200 bg-amber-50/80 p-8">
        <DashboardPageHeader
          icon={AlertTriangle}
          iconClassName="h-7 w-7 shrink-0 text-amber-700"
          title="Module not available"
          description={
            <>
              <strong>{label}</strong> is not enabled on this deployment.
              {fromPath ? (
                <>
                  {' '}
                  You tried to open <code className="rounded bg-white/80 px-1 py-0.5 text-xs">{fromPath}</code>.
                </>
              ) : null}
            </>
          }
        />
        <p className="mt-4 text-sm text-neutral-700">{upgradeMessage}</p>
        <p className="mt-3 text-sm text-neutral-600">
          Contact your system administrator if you believe you should have access. Modules are licensed per
          organisation instance.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <a
            href={RAVEN_COMMERCIAL_CONTACT.upgradeUrl}
            className="inline-flex items-center gap-2 rounded-md bg-primary-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
          >
            <Mail className="h-4 w-4" />
            Contact sales to upgrade
          </a>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-md border border-neutral-200 bg-white px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            <LayoutDashboard className="h-4 w-4" />
            Back to overview
          </Link>
        </div>
      </div>
    </DashboardPage>
  );
}

export default function ModuleUnavailablePage() {
  return (
    <Suspense
      fallback={
        <DashboardPage>
          <div className="mx-auto max-w-lg dashboard-surface p-8 text-center text-sm text-neutral-500">
            Loading…
          </div>
        </DashboardPage>
      }
    >
      <ModuleUnavailableContent />
    </Suspense>
  );
}
