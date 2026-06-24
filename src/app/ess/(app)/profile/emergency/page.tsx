'use client';

import { EssPageHeader } from '@/components/ess/EssPageHeader';

export default function EssEmergencyContactsPage() {
  return (
    <div>
      <EssPageHeader title="Emergency contacts" backHref="/ess/profile" />
      <p className="rounded-xl border border-neutral-200 bg-white px-4 py-10 text-center text-sm text-neutral-600">
        Emergency contact management will be available in a future update. Contact HR to update records today.
      </p>
    </div>
  );
}
