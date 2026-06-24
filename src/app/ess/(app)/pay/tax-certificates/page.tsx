'use client';

import { EssPageHeader } from '@/components/ess/EssPageHeader';

export default function EssTaxCertificatesPage() {
  return (
    <div>
      <EssPageHeader title="Tax certificates" subtitle="Annual tax documents" backHref="/ess/pay" />
      <p className="rounded-xl border border-neutral-200 bg-white px-4 py-10 text-center text-sm text-neutral-600">
        Tax certificates (e.g. P9) will appear here when HR publishes them for your employment year.
      </p>
    </div>
  );
}
