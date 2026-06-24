'use client';

import { RAVEN_COMMERCIAL_CONTACT } from '@/lib/commercial-upgrade';

export function PastDueBanner({
  graceDaysRemaining,
}: {
  graceDaysRemaining?: number | null;
}) {
  return (
    <div
      role="status"
      className="border-b border-amber-300 bg-amber-50 px-4 py-2.5 text-sm text-amber-950"
    >
      <strong>Payment past due.</strong>{' '}
      {graceDaysRemaining != null && graceDaysRemaining > 0 ? (
        <>
          Full access continues for {graceDaysRemaining} more day
          {graceDaysRemaining === 1 ? '' : 's'}.{' '}
        </>
      ) : (
        <>Write access is restricted until payment is received.{' '}</>
      )}
      <a
        href={RAVEN_COMMERCIAL_CONTACT.upgradeUrl}
        className="font-medium underline hover:text-amber-900"
      >
        Contact Raven to pay
      </a>
    </div>
  );
}
